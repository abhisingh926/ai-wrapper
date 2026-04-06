import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from litellm import acompletion
import os
import json as _json

from app.database import get_db
from app.models.agent import Agent
from app.models.agent_database import AgentDatabaseConnection, AgentDatabaseSchema, AgentDatabaseTableMeta
from app.api.auth import get_current_user
from app.models.user import User
from app.utils.encryption import encrypt_credentials
from app.services.database_connector import test_database_connection, fetch_tables_and_columns, fetch_foreign_key_relationships
from app.services.chroma import get_agent_collection

router = APIRouter()

# --- Schemas ---

class ConnectionRequest(BaseModel):
    db_type: str
    host: str
    port: int
    db_name: str
    username: str
    password: str

class ConnectionOut(BaseModel):
    id: str
    db_type: str
    host: str
    port: int
    db_name: str
    username: str
    status: str

class SchemaItemOut(BaseModel):
    id: str
    table_name: str
    column_name: str
    data_type: str
    ai_description: Optional[str]
    requires_review: bool
    is_vectorized: bool

class TableMetaOut(BaseModel):
    id: str
    table_name: str
    display_name: Optional[str]
    description: Optional[str]
    requires_review: bool
    is_hidden: bool
    review_status: str  # 'pending' | 'under_review' | 'reviewed'

class TableMetaUpdateItem(BaseModel):
    table_name: str
    display_name: str
    description: str
    requires_review: bool

class SchemaUpdateItem(BaseModel):
    id: str
    ai_description: str
    requires_review: bool

class SchemaUpdateRequest(BaseModel):
    items: List[SchemaUpdateItem]
    table_metas: Optional[List[TableMetaUpdateItem]] = []

class BulkUpdateStatusRequest(BaseModel):
    table_names: List[str]
    review_status: str  # 'pending' | 'under_review' | 'reviewed'

# --- Helper Functions ---

def _load_settings() -> dict:
    settings_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "platform_settings.json")
    try:
        with open(settings_path, "r") as f:
            return _json.load(f)
    except Exception:
        return {}

# --- Endpoints ---

@router.get("/{agent_id}/database/connection", response_model=Optional[ConnectionOut])
async def get_connection(
    agent_id: str, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    
    if not conn:
        return None
        
    return ConnectionOut(
        id=str(conn.id),
        db_type=conn.db_type,
        host=conn.host,
        port=conn.port,
        db_name=conn.db_name,
        username=conn.username,
        status=conn.status
    )

@router.post("/{agent_id}/database/connection", response_model=ConnectionOut)
async def save_connection(
    agent_id: str,
    payload: ConnectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    # Encrypt password
    encrypted_pass = encrypt_credentials({"password": payload.password})
    
    # Check if exists
    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    
    if conn:
        conn.db_type = payload.db_type
        conn.host = payload.host
        conn.port = payload.port
        conn.db_name = payload.db_name
        conn.username = payload.username
        conn.encrypted_password = encrypted_pass
    else:
        conn = AgentDatabaseConnection(
            agent_id=agent_id,
            db_type=payload.db_type,
            host=payload.host,
            port=payload.port,
            db_name=payload.db_name,
            username=payload.username,
            encrypted_password=encrypted_pass
        )
        db.add(conn)
        
    # Test connection
    if test_database_connection(conn):
        conn.status = "connected"
    else:
        conn.status = "failed"
        
    await db.commit()
    await db.refresh(conn)
    
    if conn.status == "failed":
        raise HTTPException(status_code=400, detail="Database connection failed. Please check your credentials and host.")
        
    return ConnectionOut(
        id=str(conn.id),
        db_type=conn.db_type,
        host=conn.host,
        port=conn.port,
        db_name=conn.db_name,
        username=conn.username,
        status=conn.status
    )
    
@router.post("/{agent_id}/database/schema/fetch", response_model=List[SchemaItemOut])
async def fetch_schema(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    
    if not conn or conn.status != "connected":
        raise HTTPException(status_code=400, detail="No active database connection found.")
        
    # Reflect schema from external DB
    raw_schema = fetch_tables_and_columns(conn)
    if not raw_schema:
        raise HTTPException(status_code=404, detail="No tables found or failed to fetch schema.")
    
    # --- INCREMENTAL SYNC ---
    # Load existing columns from Postgres (keyed by table+column)
    existing_res = await db.execute(select(AgentDatabaseSchema).where(AgentDatabaseSchema.connection_id == conn.id))
    existing_schemas = existing_res.scalars().all()
    existing_keys = {(s.table_name, s.column_name) for s in existing_schemas}
    
    # Load existing table meta (keyed by table_name)
    existing_meta_res = await db.execute(select(AgentDatabaseTableMeta).where(AgentDatabaseTableMeta.connection_id == conn.id))
    existing_metas = existing_meta_res.scalars().all()
    existing_meta_keys = {m.table_name for m in existing_metas}
    
    new_schema_objects = []
    new_table_names = set()
    
    for item in raw_schema:
        key = (item["table_name"], item["column_name"])
        new_table_names.add(item["table_name"])
        
        if key not in existing_keys:
            # Only insert NEW columns
            schema_obj = AgentDatabaseSchema(
                id=uuid.uuid4(),
                connection_id=conn.id,
                table_name=item["table_name"],
                column_name=item["column_name"],
                data_type=item["data_type"],
                ai_description="",
                requires_review=True,
                is_vectorized=False
            )
            db.add(schema_obj)
            new_schema_objects.append(schema_obj)
    
    # Add table meta for any NEW tables not seen before
    for table_name in new_table_names:
        if table_name not in existing_meta_keys:
            meta = AgentDatabaseTableMeta(
                id=uuid.uuid4(),
                connection_id=conn.id,
                table_name=table_name,
                display_name="",
                description="",
                requires_review=True
            )
            db.add(meta)
    
    await db.commit()
    
    # Return full schema (existing + newly added)
    all_res = await db.execute(select(AgentDatabaseSchema).where(AgentDatabaseSchema.connection_id == conn.id))
    all_schemas = all_res.scalars().all()
    
    return [SchemaItemOut(
        id=str(s.id),
        table_name=s.table_name,
        column_name=s.column_name,
        data_type=s.data_type,
        ai_description=s.ai_description,
        requires_review=s.requires_review,
        is_vectorized=s.is_vectorized
    ) for s in all_schemas]


@router.post("/{agent_id}/database/schema/generate", response_model=List[SchemaItemOut])
async def generate_ai_schema(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        agent = await db.get(Agent, agent_id)
        if not agent or agent.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Agent not found")
            
        result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
        conn = result.scalar_one_or_none()
        if not conn:
            raise HTTPException(status_code=400, detail="No active database connection.")
            
        schema_res = await db.execute(select(AgentDatabaseSchema).where(AgentDatabaseSchema.connection_id == conn.id))
        schema_items = schema_res.scalars().all()
        
        if not schema_items:
            raise HTTPException(status_code=400, detail="No schema found. Fetch schema first.")
            
        # Group by table for better context
        tables = {}
        for item in schema_items:
            if item.table_name not in tables:
                tables[item.table_name] = []
            tables[item.table_name].append(f"{item.column_name} ({item.data_type})")
            
        # Fetch API key — match chat_engine.py pattern (global admin key, no user_id filter)
        from app.models.integration import Integration, UserIntegration
        from app.utils.encryption import decrypt_credentials

        api_key = None
        try:
            integration = await db.scalar(select(Integration).where(Integration.slug == "openai"))
            if integration:
                ui_result = await db.execute(
                    select(UserIntegration).where(
                        UserIntegration.integration_id == integration.id,
                        UserIntegration.status == "connected",
                    )
                )
                user_integration = ui_result.scalars().first()
                if user_integration and user_integration.credentials:
                    encrypted = user_integration.credentials.get("encrypted", "")
                    if encrypted:
                        creds = decrypt_credentials(encrypted)
                        api_key = creds.get("api_key", "")
        except Exception as e:
            print(f"[generate_ai_schema] Could not fetch OpenAI API key: {e}")

        if not api_key:
            raise HTTPException(status_code=400, detail="No OpenAI API key configured. Please connect your OpenAI integration in the Admin Panel.")

        print(f"[generate_ai_schema] api_key found: {'yes' if api_key else 'no'}, tables to process: {list(tables.keys())}")

        # Fetch existing table metas keyed by table_name
        meta_res = await db.execute(select(AgentDatabaseTableMeta).where(AgentDatabaseTableMeta.connection_id == conn.id))
        table_metas = {m.table_name: m for m in meta_res.scalars().all()}
            
        model_name = "gpt-4o-mini"
            
        for table_name, columns in tables.items():
            prompt = (
                f"You are a database analyst. Analyze this database table and its columns.\n\n"
                f"Table name: {table_name}\n"
                f"Columns: {', '.join(columns)}\n\n"
                f"Return a JSON object with EXACTLY these keys:\n"
                f"1. \"table_display_name\": A clean, human-readable name for this table (e.g. 'Meeting Rooms' for 'mtg_rooms').\n"
                f"2. \"table_description\": A 1-2 sentence plain English summary of what this table stores and its purpose.\n"
                f"3. \"columns\": A dictionary where each key is the exact column name and the value is a brief 1-2 sentence description of what that column holds.\n\n"
                f"Example:\n"
                f"{{\"table_display_name\": \"Meeting Rooms\", \"table_description\": \"Stores all meeting room records.\", "
                f"\"columns\": {{\"id\": \"Unique identifier.\", \"room_name\": \"The name of the room.\"}}}}"
            )
            
            try:
                print(f"[generate_ai_schema] Calling LLM for table: {table_name}")
                response = await acompletion(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    api_key=api_key,
                    response_format={"type": "json_object"}
                )
                content = response.choices[0].message.content
                print(f"[generate_ai_schema] Raw LLM response for {table_name}: {content[:300]}")
                ai_data = _json.loads(content)
                
                # --- Update table-level meta ---
                meta_obj = table_metas.get(table_name)
                if meta_obj:
                    # Only fill if currently empty — don't overwrite user-edited values
                    if not meta_obj.display_name:
                        meta_obj.display_name = str(ai_data.get("table_display_name", ""))
                    if not meta_obj.description:
                        meta_obj.description = str(ai_data.get("table_description", ""))
                    meta_obj.requires_review = True  # flag for user to verify
                    print(f"[generate_ai_schema] Table meta updated: {table_name} -> display='{meta_obj.display_name}', desc='{meta_obj.description[:60]}'")
                else:
                    print(f"[generate_ai_schema] WARNING: No table meta found for {table_name}")
                
                # --- Update column-level descriptions ---
                col_descriptions = ai_data.get("columns", {})
                print(f"[generate_ai_schema] Column keys returned: {list(col_descriptions.keys())}")
                for item in schema_items:
                    if item.table_name == table_name and item.column_name in col_descriptions:
                        item.ai_description = str(col_descriptions[item.column_name])
                        if item.column_name.lower() in ['id', 'created_at', 'updated_at', 'status', 'email', 'name']:
                            item.requires_review = False
                        else:
                            item.requires_review = True
            except Exception as e:
                import traceback
                print(f"[generate_ai_schema] FAILED for table {table_name}: {e}\n{traceback.format_exc()}")
                
        await db.commit()
        
        # Reload and return
        return [SchemaItemOut(
            id=str(s.id),
            table_name=s.table_name,
            column_name=s.column_name,
            data_type=s.data_type,
            ai_description=s.ai_description,
            requires_review=s.requires_review,
            is_vectorized=s.is_vectorized
        ) for s in schema_items]
    except Exception as general_error:
        import traceback
        error_trace = traceback.format_exc()
        raise HTTPException(status_code=400, detail=f"Diagnostic Error: {str(general_error)}\n{error_trace}")


@router.post("/{agent_id}/database/schema/save")
async def save_and_vectorize_schema(
    agent_id: str,
    payload: SchemaUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=400, detail="No active database connection.")
        
    # --- Update column descriptions ---
    for update_item in payload.items:
        schema_obj = await db.get(AgentDatabaseSchema, update_item.id)
        if schema_obj and schema_obj.connection_id == conn.id:
            schema_obj.ai_description = update_item.ai_description
            schema_obj.requires_review = update_item.requires_review
            schema_obj.is_vectorized = True

    # --- Update table descriptions ---
    for table_meta_item in (payload.table_metas or []):
        meta_res = await db.execute(
            select(AgentDatabaseTableMeta).where(
                AgentDatabaseTableMeta.connection_id == conn.id,
                AgentDatabaseTableMeta.table_name == table_meta_item.table_name
            )
        )
        meta_obj = meta_res.scalar_one_or_none()
        if meta_obj:
            meta_obj.display_name = table_meta_item.display_name
            meta_obj.description = table_meta_item.description
            meta_obj.requires_review = table_meta_item.requires_review
            
    await db.commit()
    
    # --- Reload for vectorization ---
    schema_res = await db.execute(select(AgentDatabaseSchema).where(AgentDatabaseSchema.connection_id == conn.id))
    final_schema = schema_res.scalars().all()
    
    meta_res = await db.execute(select(AgentDatabaseTableMeta).where(AgentDatabaseTableMeta.connection_id == conn.id))
    final_metas = {m.table_name: m for m in meta_res.scalars().all()}
    
    # Add to ChromaDB (clear existing first to avoid duplicates)
    collection = get_agent_collection(agent_id)
    try:
        collection.delete(where={"source": "database_schema"})
    except:
        pass
        
    documents = []
    metadatas = []
    ids = []
    
    # Add table-level description chunks (skip hidden AND non-reviewed tables)
    for table_name, meta in final_metas.items():
        if meta.is_hidden or not meta.description:
            continue
        if getattr(meta, 'review_status', 'pending') != 'reviewed':
            continue  # Only vectorize fully reviewed tables
        display = meta.display_name or table_name
        table_chunk = f"Table: {table_name} | Display Name: {display} | About: {meta.description}"
        documents.append(table_chunk)
        metadatas.append({"source": "database_schema", "table_name": table_name, "column_name": "__table__", "type": "table_meta"})
        ids.append(f"table_meta_{str(meta.id)}")
    
    # Add column-level description chunks (skip hidden OR non-reviewed tables)
    for item in final_schema:
        if not item.ai_description:
            continue
        table_meta = final_metas.get(item.table_name)
        if table_meta and (table_meta.is_hidden or getattr(table_meta, 'review_status', 'pending') != 'reviewed'):
            continue
        table_display = (table_meta.display_name or item.table_name) if table_meta else item.table_name
        text_chunk = f"Table: {table_display} ({item.table_name}) | Column: {item.column_name} | Type: {item.data_type} | Description: {item.ai_description}"
        documents.append(text_chunk)
        metadatas.append({"source": "database_schema", "table_name": item.table_name, "column_name": item.column_name, "type": "schema"})
        ids.append(str(item.id))
        
    if documents:
        collection.add(documents=documents, metadatas=metadatas, ids=ids)
        
    return {"status": "success", "vectorized_chunks": len(documents)}

@router.get("/{agent_id}/database/schema", response_model=List[SchemaItemOut])
async def get_schema(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    if not conn:
        return []
        
    schema_res = await db.execute(select(AgentDatabaseSchema).where(AgentDatabaseSchema.connection_id == conn.id))
    items = schema_res.scalars().all()
    
    return [SchemaItemOut(
        id=str(s.id),
        table_name=s.table_name,
        column_name=s.column_name,
        data_type=s.data_type,
        ai_description=s.ai_description,
        requires_review=s.requires_review,
        is_vectorized=s.is_vectorized
    ) for s in items]


@router.get("/{agent_id}/database/table-meta", response_model=List[TableMetaOut])
async def get_table_meta(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    if not conn:
        return []

    meta_res = await db.execute(select(AgentDatabaseTableMeta).where(AgentDatabaseTableMeta.connection_id == conn.id))
    metas = meta_res.scalars().all()

    return [TableMetaOut(
        id=str(m.id),
        table_name=m.table_name,
        display_name=m.display_name,
        description=m.description,
        requires_review=m.requires_review,
        is_hidden=m.is_hidden or False,
        review_status=m.review_status or "pending"
    ) for m in metas]


class ToggleHiddenRequest(BaseModel):
    is_hidden: bool

@router.post("/{agent_id}/database/table-meta/{table_name}/toggle-hidden")
async def toggle_table_hidden(
    agent_id: str,
    table_name: str,
    payload: ToggleHiddenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="No connection found")

    meta_res = await db.execute(
        select(AgentDatabaseTableMeta).where(
            AgentDatabaseTableMeta.connection_id == conn.id,
            AgentDatabaseTableMeta.table_name == table_name
        )
    )
    meta = meta_res.scalar_one_or_none()
    if not meta:
        raise HTTPException(status_code=404, detail="Table meta not found")

    meta.is_hidden = payload.is_hidden
    await db.commit()

    return {"status": "ok", "table_name": table_name, "is_hidden": meta.is_hidden}


@router.post("/{agent_id}/database/table-meta/bulk-status")
async def bulk_update_review_status(
    agent_id: str,
    payload: BulkUpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk update the review_status for a list of tables."""
    if payload.review_status not in ("pending", "under_review", "reviewed"):
        raise HTTPException(status_code=400, detail="Invalid review_status. Use: pending | under_review | reviewed")

    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="No connection found")

    updated = 0
    for table_name in payload.table_names:
        meta_res = await db.execute(
            select(AgentDatabaseTableMeta).where(
                AgentDatabaseTableMeta.connection_id == conn.id,
                AgentDatabaseTableMeta.table_name == table_name
            )
        )
        meta = meta_res.scalar_one_or_none()
        if meta:
            meta.review_status = payload.review_status
            updated += 1

    await db.commit()
    return {"status": "ok", "updated": updated, "review_status": payload.review_status}


@router.get("/{agent_id}/database/relationships")
async def get_fk_relationships(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all foreign-key relationships from the connected external database.
    Used by the frontend to build a graph and auto-select related tables.
    """
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = await db.execute(select(AgentDatabaseConnection).where(AgentDatabaseConnection.agent_id == agent_id))
    conn = result.scalar_one_or_none()
    if not conn or conn.status != "connected":
        return []

    relationships = fetch_foreign_key_relationships(conn)
    return relationships
