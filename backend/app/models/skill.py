import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), default="🔧")
    description = Column(String(500), default="")
    schedule = Column(String(100), default="Daily")
    tags = Column(JSONB, default=[])
    gradient = Column(String(200), default="from-slate-500/20 to-slate-600/10")
    icon_bg = Column(String(200), default="from-slate-500 to-slate-400")

    # Status management
    enabled = Column(Boolean, default=True)                   # admin can hide/unhide
    sort_order = Column(Integer, default=0)                   # display ordering

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Skill {self.slug} enabled={self.enabled}>"
