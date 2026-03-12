import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class SkillMessageLog(Base):
    __tablename__ = "skill_message_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True)
    
    content = Column(Text, nullable=False) # The markdown report
    channel = Column(String(50), nullable=True) # email, whatsapp, telegram
    target = Column(String(255), nullable=True) # specific phone or email address
    status = Column(String(50), default="sent") # sent, failed

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Note: We won't strictly map relationships back on users/skills schemas to avoid cyclic deps or giant models,
    # but the ForeignKeys enforce integrity.

    def __repr__(self):
        return f"<SkillMessageLog(user={self.user_id}, skill={self.skill_id}, status={self.status})>"
