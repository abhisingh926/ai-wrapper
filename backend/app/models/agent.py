import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)

    # AI Configuration
    ai_provider = Column(String(50), nullable=False)       # openai, anthropic, google
    ai_model = Column(String(100), nullable=False)          # gpt-4o, claude-3-5-sonnet, gemini-pro

    # Platform
    platform = Column(String(50), nullable=False)           # telegram, discord, whatsapp, slack, web, instagram

    # Tools / Superpowers (list of tool slugs)
    tools = Column(JSONB, default=[])                       # ["google_calendar", "notion", "github", ...]
    tool_configs = Column(JSONB, default={})                # {"lead_catcher": {"webhookUrl": "..."}, "browser": {"startUrl": "..."}}

    # Agent behaviour
    system_prompt = Column(Text, default="You are a helpful AI assistant.")
    temperature = Column(Float, default=0.7)
    version = Column(String(20), default="1.0.0")

    # Status
    status = Column(String(20), default="draft")            # draft, live, paused
    
    # Usage Statistics
    messages_count = Column(Integer, default=0)
    api_calls_count = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    avg_response_ms = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="agents")

    def __repr__(self):
        return f"<Agent {self.name} ({self.status})>"
