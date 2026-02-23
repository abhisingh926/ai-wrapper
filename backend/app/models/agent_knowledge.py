import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class AgentKnowledge(Base):
    __tablename__ = "agent_knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    
    source_type = Column(String(50), nullable=False)        # file, url, text
    source_name = Column(String(255), nullable=False)       # filename, URL, or "Raw Text"
    
    content = Column(Text, nullable=False)                  # the extracted raw text
    chunk_count = Column(Integer, default=0)                # number of chunks it produced
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to Agent
    agent = relationship("Agent", backref="knowledge_items")

    def __repr__(self):
        return f"<AgentKnowledge {self.source_name} ({self.source_type})>"
