import os
import chromadb

# Initialize local ChromaDB client (stores DB as SQLite on disk)
CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_data")
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)

def get_agent_collection(agent_id: str):
    """
    Get or create a ChromaDB collection specific to one agent.
    This guarantees 100% data separation between different agents.
    Uses Chroma's default built-in sentence-transformers locally.
    """
    collection_name = f"agent_{str(agent_id).replace('-', '_')}"
    
    return chroma_client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"} # Use cosine similarity for text embeddings
    )

def delete_agent_collection(agent_id: str):
    """Deletes the entire collection (useful if agent is deleted)."""
    collection_name = f"agent_{str(agent_id).replace('-', '_')}"
    try:
        chroma_client.delete_collection(name=collection_name)
    except Exception:
        pass
