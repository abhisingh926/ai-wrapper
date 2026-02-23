import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class AgentLead(Base):
    __tablename__ = "agent_leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)

    # Lead data fields
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    requirement = Column(Text, nullable=True)

    # Metadata
    status = Column(String(20), default="new")  # new, contacted, qualified, converted
    source = Column(String(50), default="chat")  # chat, api, manual, whatsapp
    conversation_snippet = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<AgentLead {self.name} ({self.email})>"
