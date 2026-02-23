from typing import List
from app.services.integrations.base import BaseIntegration


class WhatsAppIntegration(BaseIntegration):
    slug = "whatsapp"
    name = "WhatsApp"
    category = "chat"

    async def connect(self, credentials: dict) -> bool:
        # Validate WhatsApp credentials via OpenClaw API
        # For MVP: basic validation
        return bool(credentials.get("phone_number") and credentials.get("api_key"))

    async def get_actions(self) -> List[dict]:
        return [
            {
                "name": "send_message",
                "label": "Send WhatsApp Message",
                "description": "Send a text message via WhatsApp",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "label": "Phone Number", "placeholder": "+1234567890"},
                        "message": {"type": "string", "label": "Message", "format": "textarea"},
                    },
                    "required": ["to", "message"],
                },
            },
        ]

    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        if action == "send_message":
            # TODO: Call OpenClaw WhatsApp API
            return {"status": "success", "message_id": "mock_123", "to": config["to"]}
        raise ValueError(f"Unknown action: {action}")


class TelegramIntegration(BaseIntegration):
    slug = "telegram"
    name = "Telegram"
    category = "chat"

    async def connect(self, credentials: dict) -> bool:
        return bool(credentials.get("bot_token"))

    async def get_actions(self) -> List[dict]:
        return [
            {
                "name": "send_message",
                "label": "Send Telegram Message",
                "description": "Send a message to a Telegram chat",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "chat_id": {"type": "string", "label": "Chat ID"},
                        "message": {"type": "string", "label": "Message", "format": "textarea"},
                    },
                    "required": ["chat_id", "message"],
                },
            },
        ]

    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        if action == "send_message":
            return {"status": "success", "chat_id": config["chat_id"]}
        raise ValueError(f"Unknown action: {action}")


class GmailIntegration(BaseIntegration):
    slug = "gmail"
    name = "Gmail"
    category = "tools"

    async def connect(self, credentials: dict) -> bool:
        return bool(credentials.get("api_key") or credentials.get("app_password"))

    async def get_actions(self) -> List[dict]:
        return [
            {
                "name": "send_email",
                "label": "Send Email",
                "description": "Send an email via Gmail",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string", "label": "To (Email)", "format": "email"},
                        "subject": {"type": "string", "label": "Subject"},
                        "body": {"type": "string", "label": "Message Body", "format": "textarea"},
                        "html": {"type": "boolean", "label": "Send as HTML", "default": False},
                    },
                    "required": ["to", "subject", "body"],
                },
            },
            {
                "name": "read_inbox",
                "label": "Read Inbox",
                "description": "Read recent emails from inbox",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "max_results": {"type": "number", "label": "Max Results", "default": 10},
                        "query": {"type": "string", "label": "Search Query", "placeholder": "UNSEEN"},
                    },
                },
            },
        ]

    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        import smtplib
        import imaplib
        import email as email_lib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        # Resolve credentials — support both api_key (legacy) and app_password
        gmail_address = credentials.get("email") or credentials.get("gmail_address", "")
        app_password = credentials.get("app_password") or credentials.get("api_key", "")

        if not gmail_address or not app_password:
            return {"status": "error", "message": "Gmail credentials missing. Please reconnect with your Gmail address and App Password."}

        if action == "send_email":
            try:
                msg = MIMEMultipart("alternative")
                msg["From"] = gmail_address
                msg["To"] = config["to"]
                msg["Subject"] = config.get("subject", "(No Subject)")

                body = config.get("body", "")
                if config.get("html"):
                    msg.attach(MIMEText(body, "html"))
                else:
                    msg.attach(MIMEText(body, "plain"))

                with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                    server.login(gmail_address, app_password)
                    server.send_message(msg)

                return {"status": "success", "to": config["to"], "subject": config.get("subject", "")}
            except smtplib.SMTPAuthenticationError:
                return {"status": "error", "message": "Gmail authentication failed. Check your App Password."}
            except Exception as e:
                return {"status": "error", "message": str(e)}

        elif action == "read_inbox":
            try:
                mail = imaplib.IMAP4_SSL("imap.gmail.com")
                mail.login(gmail_address, app_password)
                mail.select("INBOX")

                search_criteria = config.get("query", "ALL")
                max_results = int(config.get("max_results", 10))

                _, data = mail.search(None, search_criteria)
                email_ids = data[0].split()

                # Get latest N emails
                email_ids = email_ids[-max_results:] if email_ids else []
                emails = []

                for eid in reversed(email_ids):
                    _, msg_data = mail.fetch(eid, "(RFC822)")
                    msg = email_lib.message_from_bytes(msg_data[0][1])

                    # Decode subject
                    subject = ""
                    raw_subject = msg["Subject"]
                    if raw_subject:
                        decoded = email_lib.header.decode_header(raw_subject)
                        subject = decoded[0][0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(decoded[0][1] or "utf-8", errors="replace")

                    # Get body
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                body = part.get_payload(decode=True).decode(errors="replace")
                                break
                    else:
                        body = msg.get_payload(decode=True).decode(errors="replace")

                    emails.append({
                        "from": msg.get("From", ""),
                        "to": msg.get("To", ""),
                        "subject": subject,
                        "date": msg.get("Date", ""),
                        "body": body[:500],  # Truncate body
                    })

                mail.logout()
                return {"status": "success", "emails": emails, "count": len(emails)}

            except imaplib.IMAP4.error as e:
                return {"status": "error", "message": f"IMAP error: {str(e)}"}
            except Exception as e:
                return {"status": "error", "message": str(e)}

        raise ValueError(f"Unknown action: {action}")


class SlackIntegration(BaseIntegration):
    slug = "slack"
    name = "Slack"
    category = "chat"

    async def connect(self, credentials: dict) -> bool:
        return bool(credentials.get("bot_token") or credentials.get("webhook_url"))

    async def get_actions(self) -> List[dict]:
        return [
            {
                "name": "post_message",
                "label": "Post to Channel",
                "description": "Post a message to a Slack channel",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string", "label": "Channel", "placeholder": "#general"},
                        "message": {"type": "string", "label": "Message", "format": "textarea"},
                    },
                    "required": ["channel", "message"],
                },
            },
        ]

    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        if action == "post_message":
            return {"status": "success", "channel": config["channel"]}
        raise ValueError(f"Unknown action: {action}")


class OpenAIIntegration(BaseIntegration):
    slug = "openai"
    name = "OpenAI"
    category = "ai"

    async def connect(self, credentials: dict) -> bool:
        return bool(credentials.get("api_key"))

    async def get_actions(self) -> List[dict]:
        return [
            {
                "name": "generate_text",
                "label": "Generate Text (GPT)",
                "description": "Generate text using OpenAI GPT models",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "label": "Prompt", "format": "textarea"},
                        "model": {
                            "type": "string", "label": "Model",
                            "enum": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
                            "default": "gpt-4o-mini",
                        },
                        "max_tokens": {"type": "number", "label": "Max Tokens", "default": 1000},
                        "temperature": {"type": "number", "label": "Temperature", "default": 0.7},
                    },
                    "required": ["prompt"],
                },
            },
            {
                "name": "summarize",
                "label": "Summarize Text",
                "description": "Summarize text using AI",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "label": "Text to Summarize", "format": "textarea"},
                        "style": {
                            "type": "string", "label": "Summary Style",
                            "enum": ["brief", "detailed", "bullet_points"],
                            "default": "brief",
                        },
                    },
                    "required": ["text"],
                },
            },
        ]

    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        if action == "generate_text":
            return {"status": "success", "output": f"[Mock GPT response for: {config['prompt'][:50]}...]"}
        elif action == "summarize":
            return {"status": "success", "summary": "[Mock summary]"}
        raise ValueError(f"Unknown action: {action}")


class NotionIntegration(BaseIntegration):
    slug = "notion"
    name = "Notion"
    category = "productivity"

    async def connect(self, credentials: dict) -> bool:
        return bool(credentials.get("api_key"))

    async def get_actions(self) -> List[dict]:
        return [
            {
                "name": "create_page",
                "label": "Create Notion Page",
                "description": "Create a new page in Notion",
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "database_id": {"type": "string", "label": "Database ID"},
                        "title": {"type": "string", "label": "Page Title"},
                        "content": {"type": "string", "label": "Content", "format": "textarea"},
                    },
                    "required": ["title"],
                },
            },
        ]

    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        if action == "create_page":
            return {"status": "success", "page_id": "mock_page_123"}
        raise ValueError(f"Unknown action: {action}")
