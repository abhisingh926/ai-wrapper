import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    icon_url = Column(String(500), nullable=True)
    category = Column(String(100), nullable=False)  # chat, productivity, ai, tools, smart_home, media, social
    config_schema = Column(JSONB, default={})  # JSON Schema defining the connect form fields
    actions_schema = Column(JSONB, default=[])  # Available actions and their config schemas
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user_integrations = relationship("UserIntegration", back_populates="integration")

    def __repr__(self):
        return f"<Integration {self.slug}>"


class UserIntegration(Base):
    __tablename__ = "user_integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=False)
    credentials = Column(JSONB, default={})  # Encrypted
    status = Column(String(50), default="connected")  # connected, disconnected
    connected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="user_integrations")
    integration = relationship("Integration", back_populates="user_integrations")

    def __repr__(self):
        return f"<UserIntegration {self.user_id} - {self.integration_id}>"
