import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    session_ip = Column(String(45), nullable=False)  # IPv4 or IPv6

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", order_by="ChatMessage.created_at", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("agent_id", "session_ip", name="uq_agent_session_ip"),
    )

    def __repr__(self):
        return f"<ChatSession {self.session_ip} -> agent {self.agent_id}>"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage {self.role}: {self.content[:50]}>"
