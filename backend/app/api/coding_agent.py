import json
import logging
import urllib.parse
from typing import Optional, List, Dict, Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.models.integration import UserIntegration, Integration
from app.middleware.auth import get_current_user
from app.utils.encryption import decrypt_credentials, encrypt_credentials

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/coding-agent", tags=["coding-agent"])

# ─── OAuth Configuration ─────────────────────────────────────────────
CODING_OAUTH_PROVIDERS = {
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scopes": "repo read:user",
    },
    "gitlab": {
        "authorize_url": "https://gitlab.com/oauth/authorize",
        "token_url": "https://gitlab.com/oauth/token",
        "scopes": "api read_user read_repository",
    },
}


@router.get("/oauth/{provider}")
async def coding_agent_oauth_initiate(
    provider: str,
    token: str = Query(..., description="JWT token for user identification"),
):
    """Redirect user to GitHub/GitLab for OAuth authorization."""
    provider = provider.lower()
    if provider not in CODING_OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    settings = get_settings()
    cfg = CODING_OAUTH_PROVIDERS[provider]
    client_id = getattr(settings, f"OAUTH_{provider.upper()}_CLIENT_ID", "")

    if not client_id:
        raise HTTPException(
            status_code=501,
            detail=f"{provider.title()} OAuth not configured. Set OAUTH_{provider.upper()}_CLIENT_ID and OAUTH_{provider.upper()}_CLIENT_SECRET in .env",
        )

    redirect_uri = f"{settings.FRONTEND_URL}/dashboard/coding-agent/callback"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": cfg["scopes"],
        "state": f"{provider}:{token}",  # Pass provider + JWT in state
    }

    if provider == "github":
        params["response_type"] = "code"
    elif provider == "gitlab":
        params["response_type"] = "code"

    auth_url = f"{cfg['authorize_url']}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.post("/oauth/callback")
async def coding_agent_oauth_callback(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Exchange authorization code for access token and save as integration."""
    code = payload.get("code")
    state = payload.get("state", "")
    
    if not code or ":" not in state:
        raise HTTPException(status_code=400, detail="Invalid callback parameters")

    provider, jwt_token = state.split(":", 1)
    provider = provider.lower()

    if provider not in CODING_OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider in state")

    # Verify the JWT to get the user
    import uuid
    settings = get_settings()
    
    try:
        from jose import jwt as jose_jwt
        payload_data = jose_jwt.decode(jwt_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str = payload_data.get("sub")
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    cfg = CODING_OAUTH_PROVIDERS[provider]
    client_id = getattr(settings, f"OAUTH_{provider.upper()}_CLIENT_ID", "")
    client_secret = getattr(settings, f"OAUTH_{provider.upper()}_CLIENT_SECRET", "")
    redirect_uri = f"{settings.FRONTEND_URL}/dashboard/coding-agent/callback"

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            cfg["token_url"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Accept": "application/json"},
        )

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {token_resp.text}")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received from provider")

    # Find the integration record
    integ_result = await db.execute(
        select(Integration).where(Integration.slug == provider)
    )
    integration = integ_result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail=f"{provider} integration not found in database")

    # Save / update the UserIntegration
    existing = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.integration_id == integration.id,
        )
    )
    user_integration = existing.scalar_one_or_none()
    encrypted_creds = encrypt_credentials({"access_token": access_token})

    if user_integration:
        user_integration.credentials = {"encrypted": encrypted_creds}
        user_integration.status = "connected"
    else:
        user_integration = UserIntegration(
            user_id=user_id,
            integration_id=integration.id,
            credentials={"encrypted": encrypted_creds},
            status="connected",
        )
        db.add(user_integration)

    await db.commit()
    return {"message": f"Successfully connected to {provider.title()}", "provider": provider}

class ChatRequest(BaseModel):
    message: str
    repository_url: Optional[str] = None

class ChatResponse(BaseModel):
    response: str

# Helper to execute GitHub API calls
async def github_api(method: str, endpoint: str, token: str, json_data: Optional[dict] = None, params: Optional[dict] = None) -> Any:
    url = f"https://api.github.com{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    async with httpx.AsyncClient() as client:
        req = client.build_request(method, url, headers=headers, json=json_data, params=params)
        resp = await client.send(req)
        if resp.status_code >= 400:
            logger.error(f"GitHub API Error: {resp.text}")
            return {"error": resp.text, "status_code": resp.status_code}
        if resp.status_code == 204:
            return {"success": True}
        return resp.json()

# Tool implementations
async def get_recent_commits(repo: str, token: str) -> dict:
    # repo format: owner/repo
    res = await github_api("GET", f"/repos/{repo}/commits", token, params={"per_page": 5})
    if isinstance(res, list):
        return {"commits": [{"sha": c["sha"], "message": c["commit"]["message"], "author": c["commit"]["author"]["name"]} for c in res]}
    return res

async def review_commit(repo: str, commit_sha: str, token: str) -> dict:
    res = await github_api("GET", f"/repos/{repo}/commits/{commit_sha}", token)
    if "files" in res:
        files = [{"filename": f["filename"], "status": f["status"], "patch": f.get("patch", "")} for f in res["files"]]
        return {"sha": res["sha"], "files": files}
    return res

async def list_pull_requests(repo: str, token: str) -> dict:
    res = await github_api("GET", f"/repos/{repo}/pulls", token, params={"state": "open"})
    if isinstance(res, list):
        return {"pull_requests": [{"title": pr["title"], "url": pr["html_url"], "number": pr["number"]} for pr in res]}
    return res

async def create_pull_request(repo: str, title: str, head: str, base: str, body: str, token: str) -> dict:
    res = await github_api("POST", f"/repos/{repo}/pulls", token, json_data={
        "title": title, "head": head, "base": base, "body": body
    })
    return res

async def get_file_content(repo: str, path: str, token: str) -> dict:
    res = await github_api("GET", f"/repos/{repo}/contents/{path}", token)
    if "content" in res:
        import base64
        decoded = base64.b64decode(res["content"]).decode("utf-8")
        return {"path": path, "content": decoded, "sha": res["sha"]}
    return res

async def update_file(repo: str, path: str, content: str, message: str, sha: str, branch: str, token: str) -> dict:
    import base64
    encoded = base64.b64encode(content.encode()).decode("utf-8")
    data = {
        "message": message,
        "content": encoded,
        "sha": sha,
        "branch": branch
    }
    res = await github_api("PUT", f"/repos/{repo}/contents/{path}", token, json_data=data)
    return res


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_recent_commits",
            "description": "Get the most recent commits for a repository. The repo must be in 'owner/repo' format.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo": {"type": "string", "description": "The repository name, e.g., 'octocat/Hello-World'"}
                },
                "required": ["repo"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "review_commit",
            "description": "Get the file changes (diffs/patches) of a specific commit to review it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo": {"type": "string"},
                    "commit_sha": {"type": "string"}
                },
                "required": ["repo", "commit_sha"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_pull_requests",
            "description": "List open pull requests for a repository.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo": {"type": "string"}
                },
                "required": ["repo"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_pull_request",
            "description": "Create a pull request on GitHub.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo": {"type": "string"},
                    "title": {"type": "string"},
                    "head": {"type": "string", "description": "The name of the branch where your changes are implemented."},
                    "base": {"type": "string", "description": "The name of the branch you want the changes pulled into (e.g., 'main')."},
                    "body": {"type": "string"}
                },
                "required": ["repo", "title", "head", "base"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_content",
            "description": "Get the contents and SHA of a file in the repository.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo": {"type": "string"},
                    "path": {"type": "string", "description": "File path, e.g., 'src/main.py'"}
                },
                "required": ["repo", "path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_file",
            "description": "Update an existing file with new content. Requires the SHA from get_file_content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo": {"type": "string"},
                    "path": {"type": "string"},
                    "content": {"type": "string", "description": "Full new file content"},
                    "message": {"type": "string", "description": "Commit message"},
                    "sha": {"type": "string", "description": "The blob SHA of the file being replaced"},
                    "branch": {"type": "string", "description": "The branch name"}
                },
                "required": ["repo", "path", "content", "message", "sha", "branch"]
            }
        }
    }
]

@router.post("/chat", response_model=ChatResponse)
async def coding_agent_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Check for GitHub integration
    result = await db.execute(
        select(UserIntegration, Integration)
        .join(Integration, UserIntegration.integration_id == Integration.id)
        .where(
            UserIntegration.user_id == current_user.id,
            Integration.slug == "github",
            UserIntegration.status == "connected"
        )
    )
    conn = result.first()
    if not conn:
        raise HTTPException(status_code=400, detail="GitHub integration not connected")

    ui, _ = conn
    encrypted = ui.credentials.get("encrypted", "")
    creds = decrypt_credentials(encrypted) if encrypted else {}
    gh_token = creds.get("access_token") or creds.get("token") or "NO_TOKEN"

    if gh_token == "NO_TOKEN":
        raise HTTPException(status_code=400, detail="Invalid GitHub credentials")

    from app.api.skills import _get_llm_api_key
    api_key, _ = await _get_llm_api_key(db)
    
    settings = get_settings()
    if not api_key:
        api_key = settings.OPENAI_API_KEY
        
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API Key not configured in Admin Panel")

    # 2. Build messages for LLM
    system_prompt = (
        "You are an expert Coding Agent. You have access to GitHub via tools to review code, create PRs, update files, etc.\n"
        "User context: " + (f"The user is currently working on the repository '{req.repository_url}'. " if req.repository_url else "No specific repo provided in the UI. ") +
        "IMPORTANT: ALL GitHub tools require the repository to be in 'owner/repo' format (e.g. 'octocat/Hello-World'). "
        "If you only have a partial repository name (e.g. 'portal-backend'), you MUST ask the user for the full 'owner/repo' name before calling any tools.\n"
        "If the user provides a full URL (e.g., 'https://github.com/owner/repo'), extract 'owner/repo' from it and use that for tools.\n"
        "You should execute tools when the user requests actions like 'review latest commit' or 'fix error in file X'."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.message}
    ]

    # 3. Call LLM
    async with httpx.AsyncClient(timeout=60.0) as client:
        llm_response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o",
                "messages": messages,
                "tools": TOOLS,
                "tool_choice": "auto"
            }
        )
        llm_response.raise_for_status()
        data = llm_response.json()
        message = data["choices"][0]["message"]

        if "tool_calls" not in message and message.get("content"):
            return ChatResponse(response=message["content"])
        
        # 4. Handle tool calls
        if "tool_calls" in message:
            messages.append(message)
            for tool_call in message["tool_calls"]:
                func_name = tool_call["function"]["name"]
                args = json.loads(tool_call["function"]["arguments"])
                
                try:
                    tool_res = {}
                    if func_name == "get_recent_commits":
                        tool_res = await get_recent_commits(args["repo"], gh_token)
                    elif func_name == "review_commit":
                        tool_res = await review_commit(args["repo"], args["commit_sha"], gh_token)
                    elif func_name == "list_pull_requests":
                        tool_res = await list_pull_requests(args["repo"], gh_token)
                    elif func_name == "create_pull_request":
                        tool_res = await create_pull_request(args["repo"], args["title"], args["head"], args["base"], args.get("body", ""), gh_token)
                    elif func_name == "get_file_content":
                        tool_res = await get_file_content(args["repo"], args["path"], gh_token)
                    elif func_name == "update_file":
                        tool_res = await update_file(args["repo"], args["path"], args["content"], args["message"], args["sha"], args.get("branch", "main"), gh_token)
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "name": func_name,
                        "content": json.dumps(tool_res)
                    })
                except Exception as e:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "name": func_name,
                        "content": json.dumps({"error": str(e)})
                    })

            # 5. Second Call to LLM
            second_llm_response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o",
                    "messages": messages
                }
            )
            second_llm_response.raise_for_status()
            final_data = second_llm_response.json()
            return ChatResponse(response=final_data["choices"][0]["message"]["content"])

    return ChatResponse(response="Sorry, I couldn't process your request.")
