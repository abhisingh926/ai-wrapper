import io
import os
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
from app.models.subscription import Subscription
import json as _json

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

def _load_settings() -> dict:
    settings_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "platform_settings.json")
    try:
        with open(settings_path, "r") as f:
            return _json.load(f)
    except Exception:
        return {}

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

    # Load settings
    settings = _load_settings()
    allowed_types = settings.get("allowed_file_types", [".pdf", ".txt"])
    max_upload_mb = settings.get("max_upload_size_mb", 10)

    # Validate file extension
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type '{file_ext}' not allowed. Supported: {', '.join(allowed_types)}")

    content = ""
    contents = await file.read()

    # Validate file size
    if len(contents) > max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {max_upload_mb} MB.")
    
    if file_ext == '.pdf':
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
            text_pages = [page.extract_text() for page in pdf_reader.pages if page.extract_text()]
            content = "\n\n".join(text_pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    elif file_ext in ['.txt', '.md', '.csv']:
        content = contents.decode("utf-8", errors="ignore")
    elif file_ext == '.docx':
        try:
            import docx
            doc = docx.Document(io.BytesIO(contents))
            content = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")
        
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
        
    url_str = str(payload.url).rstrip("/")

    # Check plan-based URL scraping access (admins bypass all restrictions)
    settings = _load_settings()
    from app.models.user import UserRole
    if current_user.role != UserRole.ADMIN:
        scraping_by_plan = settings.get("url_scraping_by_plan", {})
        if scraping_by_plan:
            sub_result = await db.execute(
                select(Subscription).where(Subscription.user_id == current_user.id)
            )
            subscription = sub_result.scalar_one_or_none()
            user_plan = subscription.plan.value if subscription else "free"
            if not scraping_by_plan.get(user_plan, True):
                raise HTTPException(
                    status_code=403,
                    detail=f"URL scraping is not available on the {user_plan.capitalize()} plan. Please upgrade."
                )
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    from urllib.parse import urljoin, urlparse
    
    base_parsed = urlparse(url_str)
    base_domain = base_parsed.netloc
    
    max_pages = settings.get("max_scrape_pages", 10)
    max_content_kb = settings.get("max_content_size_kb", 200)
    
    visited = set()
    to_visit = [url_str]
    all_content = []
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20.0, headers=headers) as client:
            while to_visit and len(visited) < max_pages:
                current_url = to_visit.pop(0)
                
                # Normalize URL
                current_url = current_url.rstrip("/")
                if current_url in visited:
                    continue
                    
                # Skip non-HTML resources
                skip_ext = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.pdf', '.zip', '.mp4', '.mp3', '.ico')
                if any(current_url.lower().endswith(ext) for ext in skip_ext):
                    continue
                    
                visited.add(current_url)
                
                try:
                    response = await client.get(current_url)
                    response.raise_for_status()
                    
                    # Only parse HTML responses
                    content_type = response.headers.get("content-type", "")
                    if "text/html" not in content_type:
                        continue
                        
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Extract internal links for crawling
                    if len(visited) < max_pages:
                        for link in soup.find_all("a", href=True):
                            href = link["href"]
                            full_url = urljoin(current_url, href).rstrip("/")
                            full_parsed = urlparse(full_url)
                            
                            # Only follow same-domain links, skip anchors and query params
                            if (full_parsed.netloc == base_domain 
                                and full_url not in visited 
                                and full_url not in to_visit
                                and "#" not in full_url):
                                to_visit.append(full_url.split("?")[0])  # Strip query params
                    
                    # Remove non-content elements
                    for tag in soup(["script", "style", "nav", "footer", "noscript", "iframe", "svg", "form"]):
                        tag.extract()
                    
                    # Get page title
                    page_title = soup.find("title")
                    title_text = page_title.get_text().strip() if page_title else ""
                    
                    # Extract main content
                    main_content = soup.find("main") or soup.find("article") or soup.find('[role="main"]') or soup.find("body") or soup
                    text = main_content.get_text(separator='\n')
                    
                    # Cleanup
                    lines = (line.strip() for line in text.splitlines())
                    page_text = '\n'.join(line for line in lines if line and len(line) > 3)
                    
                    if page_text.strip():
                        section = f"--- Page: {title_text or current_url} ---\n{page_text}"
                        all_content.append(section)
                        
                except (httpx.HTTPStatusError, httpx.TimeoutException, Exception):
                    continue  # Skip failed pages, continue crawling
                    
    except httpx.TimeoutException:
        raise HTTPException(status_code=400, detail="Website took too long to respond (timeout).")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to scrape URL: {str(e)}")
    
    content = '\n\n'.join(all_content)
    
    if not content.strip():
        raise HTTPException(status_code=400, detail="No text content found at URL. The website may require JavaScript to render.")
    
    # Limit content based on admin settings
    max_bytes = max_content_kb * 1024
    if len(content) > max_bytes:
        content = content[:max_bytes] + f"\n\n[Content truncated — exceeded {max_content_kb}KB limit]"
    
    pages_scraped = len(visited)
        
    knowledge = AgentKnowledge(
        agent_id=agent_id,
        source_type="url",
        source_name=f"{url_str} ({pages_scraped} pages)",
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
