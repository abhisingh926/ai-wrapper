import io
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, HttpUrl
import PyPDF2
from bs4 import BeautifulSoup
import httpx

from app.database import get_db
from app.models.agent import Agent
from app.models.agent_knowledge import AgentKnowledge
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()

# --- Pydantic Schemas ---

from datetime import datetime

class KnowledgeOut(BaseModel):
    id: UUID
    agent_id: UUID
    source_type: str
    source_name: str
    chunk_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ScrapeRequest(BaseModel):
    url: HttpUrl

class TextRequest(BaseModel):
    text: str
    source_name: Optional[str] = "Raw Text"

# --- Helper functions ---

def mock_chunk_count(text: str) -> int:
    """Mock a reasonable chunking strategy for UI representation."""
    if not text:
        return 0
    words = text.split()
    return max(1, len(words) // 250)  # Roughly 250 words per chunk

# --- Endpoints ---

@router.get("/{agent_id}/knowledge", response_model=List[KnowledgeOut])
async def list_agent_knowledge(
    agent_id: UUID, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Verify agent ownership
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    result = await db.execute(select(AgentKnowledge).where(AgentKnowledge.agent_id == agent_id))
    return result.scalars().all()

@router.post("/{agent_id}/knowledge/file", response_model=KnowledgeOut)
async def upload_knowledge_file(
    agent_id: UUID, 
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")

    content = ""
    contents = await file.read()
    
    if file.filename.endswith('.pdf'):
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
            text_pages = [page.extract_text() for page in pdf_reader.pages if page.extract_text()]
            content = "\n\n".join(text_pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    elif file.filename.endswith('.txt'):
        content = contents.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=400, detail="Only .pdf and .txt files are supported")
        
    if not content.strip():
        raise HTTPException(status_code=400, detail="File is empty or content could not be extracted.")
        
    knowledge = AgentKnowledge(
        agent_id=agent_id,
        source_type="file",
        source_name=file.filename,
        content=content,
        chunk_count=mock_chunk_count(content)
    )
    
    db.add(knowledge)
    await db.commit()
    await db.refresh(knowledge)
    return knowledge

@router.post("/{agent_id}/knowledge/url", response_model=KnowledgeOut)
async def scrape_knowledge_url(
    agent_id: UUID,
    payload: ScrapeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    url_str = str(payload.url)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url_str, timeout=20.0, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove non-content elements
            for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"]):
                tag.extract()
            
            # Try to find main content first, fallback to body
            main_content = soup.find("main") or soup.find("article") or soup.find("body") or soup
            text = main_content.get_text(separator='\n')
            
            # Cleanup weird spacing and empty lines
            lines = (line.strip() for line in text.splitlines())
            content = '\n'.join(line for line in lines if line)
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=400, detail="Website took too long to respond (timeout).")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Website returned error: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to scrape URL: {str(e)}")
        
    if not content.strip():
        raise HTTPException(status_code=400, detail="No text content found at URL. The website may require JavaScript to render.")
    
    # Limit content to ~50KB to prevent oversized knowledge chunks
    if len(content) > 50000:
        content = content[:50000] + "\n\n[Content truncated — exceeded 50KB limit]"
        
    knowledge = AgentKnowledge(
        agent_id=agent_id,
        source_type="url",
        source_name=url_str,
        content=content,
        chunk_count=mock_chunk_count(content)
    )
    
    db.add(knowledge)
    await db.commit()
    await db.refresh(knowledge)
    return knowledge

@router.post("/{agent_id}/knowledge/text", response_model=KnowledgeOut)
async def save_knowledge_text(
    agent_id: UUID,
    payload: TextRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    content = payload.text
    if not content.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    knowledge = AgentKnowledge(
        agent_id=agent_id,
        source_type="text",
        source_name=payload.source_name or "Raw Text",
        content=content,
        chunk_count=mock_chunk_count(content)
    )
    
    db.add(knowledge)
    await db.commit()
    await db.refresh(knowledge)
    return knowledge

@router.delete("/{agent_id}/knowledge/{knowledge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent_knowledge(
    agent_id: UUID,
    knowledge_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    knowledge = await db.get(AgentKnowledge, knowledge_id)
    if not knowledge or knowledge.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
        
    await db.delete(knowledge)
    await db.commit()
