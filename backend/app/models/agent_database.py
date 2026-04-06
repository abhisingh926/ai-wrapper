import uuid
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.database import Base

class AgentDatabaseConnection(Base):
    __tablename__ = "agent_db_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    db_type = Column(String, nullable=False) # 'postgres', 'mysql'
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    db_name = Column(String, nullable=False)
    username = Column(String, nullable=False)
    encrypted_password = Column(Text, nullable=False)
    
    status = Column(String, default="connected") # 'connected', 'failed'
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentDatabaseSchema(Base):
    __tablename__ = "agent_db_schemas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("agent_db_connections.id", ondelete="CASCADE"), nullable=False)
    
    table_name = Column(String, nullable=False)
    column_name = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    
    ai_description = Column(Text, nullable=True)
    requires_review = Column(Boolean, default=True)
    is_vectorized = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("connection_id", "table_name", "column_name", name="uq_schema_column"),
    )


class AgentDatabaseTableMeta(Base):
    """Stores display name and a brief description for each table — separate from column-level schemas."""
    __tablename__ = "agent_db_table_meta"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("agent_db_connections.id", ondelete="CASCADE"), nullable=False)

    table_name = Column(String, nullable=False)     # Raw name e.g. "accts_cand"
    display_name = Column(String, nullable=True)    # User-friendly name
    description = Column(Text, nullable=True)       # Brief description of what this table holds
    requires_review = Column(Boolean, default=True)
    is_hidden = Column(Boolean, default=False)       # Soft-removed: hidden from active list & vectorization
    # Review workflow: pending → under_review → reviewed
    review_status = Column(String, default="pending")  # 'pending' | 'under_review' | 'reviewed'

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("connection_id", "table_name", name="uq_table_meta"),
    )
