import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class AdminChannel(Base):
    __tablename__ = "admin_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), default="📱")
    description = Column(String(500), default="")
    
    # Status management
    enabled = Column(Boolean, default=True)                   # admin can disable entirely
    badge = Column(String(50), default="stable")              # stable, beta, alpha, coming_soon
    is_upcoming = Column(Boolean, default=False)              # explicitly mark as upcoming/placeholder
    sort_order = Column(Integer, default=0)                   # display ordering

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AdminChannel {self.slug} enabled={self.enabled}>"
