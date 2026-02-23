import json
import time
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import litellm
import re

from app.models.lead import AgentLead
from app.models.agent import Agent
from app.models.agent_knowledge import AgentKnowledge
from app.models.user import User
from app.models.subscription import Subscription
from app.models.chat_session import ChatSession, ChatMessage

async def _parse_and_save_lead(reply_text: str, agent: Agent, lead_fields: list, user_messages: list, db: AsyncSession) -> str:
    """Helper function to parse the [LEAD_CAPTURED] token, save to backend, and strip it from user output."""
    if not lead_fields or "[LEAD_CAPTURED]" not in reply_text:
        return reply_text
        
    try:
        marker_idx = reply_text.find("[LEAD_CAPTURED]")
        json_str = reply_text[marker_idx + len("[LEAD_CAPTURED]"):].strip()
        clean_reply = reply_text[:marker_idx].strip()
        
        # Clean up Markdown formatting around JSON if the LLM output it
        json_str = re.sub(r'```json\s*', '', json_str)
        json_str = re.sub(r'```\s*', '', json_str)
        json_str = json_str.strip()
        
        print(f"[Lead Catcher] Raw JSON string: {json_str}")
        
        extracted_data = json.loads(json_str)
        print(f"[Lead Catcher] Parsed lead data: {extracted_data}")
        
        lead = AgentLead(
            agent_id=agent.id,
            name=extracted_data.get("name"),
            email=extracted_data.get("email"),
            phone=extracted_data.get("phone"),
            company=extracted_data.get("company"),
            requirement=extracted_data.get("requirement", "Extracted dynamically by Lead Catcher."),
            status="new",
            source=agent.platform or "chat"
        )
        db.add(lead)
        print(f"[Lead Catcher] ✅ Lead saved for agent {agent.id}: {extracted_data.get('name')}")
        
        return clean_reply
    except Exception as e:
        print(f"[Lead Catcher] ❌ Error parsing lead data: {e}")
        marker_idx = reply_text.find("[LEAD_CAPTURED]")
        if marker_idx != -1:
            return reply_text[:marker_idx].strip()
        return reply_text

async def execute_agent_chat(
    db: AsyncSession,
    agent: Agent,
    client_ip: str,
    user_messages: list, # List of {"role": "...", "content": "..."}
    subscription: Subscription = None,
) -> str:
    """
    Executes the full LLM pipeline for an Agent:
    - Session tracking
    - RAG context injection
    - Lead Catcher prompt injection
    - Tool calling loop
    - Token / message accounting
    """
    
    # 1. Build Base System Prompt
    system_prompt = agent.system_prompt or "You are a helpful AI assistant."

    # 2. Get or create chat session for this IP
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.agent_id == agent.id,
            ChatSession.session_ip == client_ip,
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        session = ChatSession(agent_id=agent.id, session_ip=client_ip)
        db.add(session)
        await db.flush()

    # Save the user's latest message to DB
    if user_messages:
        last_user_msg = user_messages[-1]
        if last_user_msg.get("role") == "user":
            db.add(ChatMessage(session_id=session.id, role="user", content=last_user_msg.get("content")))
            await db.flush()

    # 2b. Load conversation history from DB for this session (last 50 messages)
    from sqlalchemy import asc
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(asc(ChatMessage.created_at))
        .limit(50)
    )
    chat_history = history_result.scalars().all()

    # 3. Check for Knowledge Base tool and inject RAG context
    knowledge_items = []
    if "knowledge_base" in (agent.tools or []):
        kb_result = await db.execute(
            select(AgentKnowledge).where(AgentKnowledge.agent_id == agent.id)
        )
        knowledge_items = kb_result.scalars().all()
        
        if knowledge_items:
            rag_context = "\n\n--- KNOWLEDGE BASE CONTEXT ---\n"
            for item in knowledge_items:
                rag_context += f"\nSource: {item.source_name}\n{item.content}\n"
            rag_context += "\n--- END KNOWLEDGE BASE CONTEXT ---\nUse the above context to inform your answers when relevant."
            system_prompt += rag_context

    # 4. Check for Lead Catcher tool and inject collection instructions
    lead_fields = []
    if "lead_catcher" in (agent.tools or []):
        lc_config = (agent.tool_configs or {}).get("lead_catcher", {})
        field_labels = {
            "name": "full name",
            "email": "email address",
            "phone": "phone number",
            "company": "company name",
            "requirement": "requirement (what they need / are looking for)",
        }
        for field, label in field_labels.items():
            if lc_config.get(field, True):
                lead_fields.append(field)

        if lead_fields:
            fields_str = ", ".join([field_labels[f] for f in lead_fields])
            # Build a clear example JSON for the LLM
            example_json = json.dumps({f: f"<collected {field_labels[f]}>" for f in lead_fields})
            lead_prompt = f"""

--- LEAD COLLECTION INSTRUCTIONS (MANDATORY) ---
You MUST collect the following information from the user: {fields_str}.
This is a MANDATORY requirement — you must gather ALL of these details during the conversation.
RULES:
- Start collecting information early in the conversation.
- Ask for one field at a time in a friendly, conversational way.
- For the "requirement" field: summarize what the user needs based on the conversation.
- Do NOT ask for information the user has already provided earlier in the conversation.
- Once you have collected ALL the required fields, append the following marker at the very END of your message on a new line:
[LEAD_CAPTURED]{example_json}
- Replace each placeholder with the actual collected value.
- The JSON MUST be valid JSON on a single line.
- Do NOT wrap the JSON in markdown code blocks.
- Only output [LEAD_CAPTURED] ONCE, when ALL fields have been gathered.
--- END LEAD COLLECTION INSTRUCTIONS ---"""
            system_prompt += lead_prompt

    # 5. Build tool schemas
    llm_tools = []
    if "weather" in (agent.tools or []):
        from app.services.weather import WEATHER_TOOL_SCHEMA
        llm_tools.append(WEATHER_TOOL_SCHEMA)
    
    if "browser" in (agent.tools or []):
        from app.services.web_search import WEB_SEARCH_TOOL_SCHEMA, FETCH_WEBPAGE_TOOL_SCHEMA
        llm_tools.append(WEB_SEARCH_TOOL_SCHEMA)
        llm_tools.append(FETCH_WEBPAGE_TOOL_SCHEMA)

    # 6. Prepare messages array — use full conversation history from DB
    messages = [{"role": "system", "content": system_prompt}]
    if chat_history:
        # Use stored conversation history so the LLM has full context
        for msg in chat_history:
            messages.append({"role": msg.role, "content": msg.content})
    else:
        # Fallback: if no history in DB yet, use what was passed in
        for msg in user_messages:
            messages.append({"role": msg.get("role"), "content": msg.get("content")})

    # 7. Model Provider selection
    provider = agent.ai_provider.lower()
    model = agent.ai_model
    
    if provider == "google":
        litellm_model = f"gemini/{model}"
        provider_slug = "google"
    elif provider == "anthropic":
        litellm_model = f"anthropic/{model}"
        provider_slug = "anthropic"
    else:
        litellm_model = model
        provider_slug = "openai"

    # 8. Fetch Admin Global API Key
    from app.models.integration import Integration, UserIntegration
    from app.utils.encryption import decrypt_credentials
    
    api_key = None
    try:
        int_result = await db.execute(
            select(Integration).where(Integration.slug == provider_slug)
        )
        integration = int_result.scalar_one_or_none()
        
        if integration:
            ui_result = await db.execute(
                select(UserIntegration).where(
                    UserIntegration.integration_id == integration.id,
                    UserIntegration.status == "connected",
                )
            )
            user_integration = ui_result.scalars().first()
            if user_integration and user_integration.credentials:
                encrypted = user_integration.credentials.get("encrypted", "")
                if encrypted:
                    creds = decrypt_credentials(encrypted)
                    api_key = creds.get("api_key", "")
    except Exception as e:
        print(f"Warning: Could not fetch global API key for {provider_slug}: {e}")

    if not api_key:
        import asyncio
        await asyncio.sleep(0.5)
        user_msg = user_messages[-1].get("content", "") if user_messages else ""
        mock_reply = f"Hello! I'm **{agent.name}** (mocked response — no API key configured).\n\nYou said: \"{user_msg}\"\n\n_To get real AI responses, add your **{provider_slug.upper()}** API key in the Admin Panel._"
        agent.messages_count = (agent.messages_count or 0) + 1
        return mock_reply

    # 9. LLM Execution Loop
    _start_ts = time.time()
    try:
        call_kwargs = dict(
            model=litellm_model,
            messages=messages,
            temperature=agent.temperature,
            api_key=api_key,
        )
        if llm_tools:
            call_kwargs["tools"] = llm_tools

        reply_text = None
        for _tool_iter in range(3):
            response = await litellm.acompletion(**call_kwargs)
            agent.api_calls_count = (agent.api_calls_count or 0) + 1
            
            choice = response.choices[0]
            if choice.finish_reason == "tool_calls" or getattr(choice.message, "tool_calls", None):
                tool_calls = choice.message.tool_calls
                messages.append(choice.message.model_dump())
                
                for tc in tool_calls:
                    fn_name = tc.function.name
                    fn_args = json.loads(tc.function.arguments)
                    
                    if fn_name == "get_weather":
                        from app.services.weather import get_weather
                        tool_result = await get_weather(fn_args.get("city", ""))
                        tool_result_str = json.dumps(tool_result)
                    elif fn_name == "web_search":
                        from app.services.web_search import web_search
                        tool_result = await web_search(fn_args.get("query", ""))
                        tool_result_str = json.dumps(tool_result)
                        print(f"[Browser Tool] Searched: {fn_args.get('query')}")
                    elif fn_name == "fetch_webpage":
                        from app.services.web_search import fetch_webpage
                        tool_result = await fetch_webpage(fn_args.get("url", ""))
                        tool_result_str = json.dumps(tool_result)
                        print(f"[Browser Tool] Fetched: {fn_args.get('url')}")
                    else:
                        tool_result_str = json.dumps({"error": f"Unknown tool: {fn_name}"})
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": tool_result_str,
                    })
                continue
            else:
                reply_text = choice.message.content
                break

        if reply_text is None:
            reply_text = "I'm sorry, I wasn't able to process that request. Please try again."

        _elapsed_ms = int((time.time() - _start_ts) * 1000)
        
        # 10. Post-processing
        class _DictMsg:
            def __init__(self, role, content):
                self.role = role
                self.content = content
        # _parse_and_save_lead expects objects with .role and .content
        obj_messages = [_DictMsg(m.get("role"), m.get("content")) for m in user_messages]
        
        reply_text = await _parse_and_save_lead(reply_text, agent, lead_fields, obj_messages, db)
        
        db.add(ChatMessage(session_id=session.id, role="assistant", content=reply_text))
        session.updated_at = datetime.utcnow()

        prev_count = agent.messages_count or 0
        prev_avg = agent.avg_response_ms or 0
        agent.messages_count = prev_count + 1
        agent.avg_response_ms = int((prev_avg * prev_count + _elapsed_ms) / agent.messages_count)

        if subscription:
            subscription.messages_used = (subscription.messages_used or 0) + 1

        await db.commit()
        return reply_text
        
    except Exception as e:
        agent.errors_count = (agent.errors_count or 0) + 1
        await db.commit()
        print(f"Chat Engine Error: {str(e)}")
        raise e
