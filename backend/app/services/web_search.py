"""
Web Search Service — Gives agents the ability to search the internet.
Uses DuckDuckGo Instant Answer API + HTML scraping fallback (no API key needed).
"""

import httpx
from bs4 import BeautifulSoup
import json


async def web_search(query: str) -> dict:
    """Search the web for a query and return top results."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        
        results = []
        
        # Method 1: DuckDuckGo HTML search
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers=headers,
            )
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Extract search result blocks
            for result_div in soup.select(".result"):
                title_tag = result_div.select_one(".result__a")
                snippet_tag = result_div.select_one(".result__snippet")
                
                if title_tag:
                    title = title_tag.get_text(strip=True)
                    link = title_tag.get("href", "")
                    snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
                    
                    if title and snippet:
                        results.append({
                            "title": title,
                            "url": link,
                            "snippet": snippet,
                        })
                
                if len(results) >= 5:
                    break
        
        if not results:
            return {"query": query, "results": [], "summary": "No results found."}
        
        # Build a summary for the LLM
        summary_parts = [f"Web search results for: \"{query}\"\n"]
        for i, r in enumerate(results, 1):
            summary_parts.append(f"{i}. **{r['title']}**")
            summary_parts.append(f"   {r['snippet']}")
            if r['url']:
                summary_parts.append(f"   URL: {r['url']}")
            summary_parts.append("")
        
        return {
            "query": query,
            "results": results,
            "summary": "\n".join(summary_parts),
        }
        
    except Exception as e:
        return {"query": query, "error": f"Search failed: {str(e)}", "results": []}


async def fetch_webpage(url: str) -> dict:
    """Fetch and extract text content from a webpage URL."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Remove non-content elements
            for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"]):
                tag.extract()
            
            main_content = soup.find("main") or soup.find("article") or soup.find("body") or soup
            text = main_content.get_text(separator="\n")
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            content = "\n".join(lines)
            
            # Limit to 4000 chars to fit in LLM context
            if len(content) > 4000:
                content = content[:4000] + "\n\n[Content truncated]"
            
            title = soup.find("title")
            title_text = title.get_text(strip=True) if title else url
            
            return {
                "url": url,
                "title": title_text,
                "content": content,
            }
    except Exception as e:
        return {"url": url, "error": f"Failed to fetch page: {str(e)}"}


# LLM function-calling schemas
WEB_SEARCH_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the internet for current information. Use this when the user asks about recent events, news, product info, company details, or anything that requires up-to-date information from the web.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query, e.g. 'latest iPhone price in India', 'Ornate Solar products'"
                }
            },
            "required": ["query"]
        }
    }
}

FETCH_WEBPAGE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "fetch_webpage",
        "description": "Fetch and read the content of a specific webpage URL. Use this when you need to read detailed information from a particular website that was found via search or provided by the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The full URL of the webpage to fetch, e.g. 'https://example.com/page'"
                }
            },
            "required": ["url"]
        }
    }
}
