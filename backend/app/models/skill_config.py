import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class UserSkillConfig(Base):
    __tablename__ = "user_skill_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)

    # Configuration
    market_type = Column(String(50), default="crypto")        # crypto, indian, forex, custom
    custom_prompt = Column(Text, default="")                   # user's custom stocks/query
    notify_channel = Column(String(50), default="email")       # email, whatsapp, telegram
    notify_target = Column(String(255), default="")            # email address or phone number
    notify_country_code = Column(String(10), default="+1")     # +1, +91, etc.
    notify_time = Column(String(20), default="08:00")          # HH:MM format
    notify_timezone = Column(String(100), default="UTC")       # e.g., America/New_York
    is_active = Column(Boolean, default=False)                 # whether scheduled

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<UserSkillConfig user={self.user_id} skill={self.skill_id}>"
