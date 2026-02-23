import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Tool(Base):
    __tablename__ = "tools"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), default="🔧")
    description = Column(String(500), default="")
    category = Column(String(100), default="general")       # productivity, ai, communication, dev, etc.

    # Status management
    enabled = Column(Boolean, default=True)                   # admin can disable
    badge = Column(String(50), default="stable")              # stable, beta, alpha, coming_soon
    sort_order = Column(Integer, default=0)                   # display ordering

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Tool {self.slug} enabled={self.enabled}>"
