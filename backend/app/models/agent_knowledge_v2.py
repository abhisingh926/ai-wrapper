import uuid
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.database import Base

class AgentKnowledgeV2(Base):
    __tablename__ = "agent_knowledge_v2"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    
    source_type = Column(String, nullable=False) # 'file', 'url', 'text'
    source_name = Column(String, nullable=False) # e.g. "handbook.pdf" or "https://example.com"
    content = Column(Text, nullable=False)       # The full raw text initially uploaded/scraped
    chunk_count = Column(Integer, default=0)     # Number of physical chunks in ChromaDB
    
    created_at = Column(DateTime, default=datetime.utcnow)
