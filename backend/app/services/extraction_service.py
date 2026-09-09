import re
import hashlib
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import Optional, Tuple, Dict, Any
import feedparser
from bs4 import BeautifulSoup
import httpx
from app.core.logging import logger


class ExtractionService:
    @staticmethod
    def normalize_url(url: str) -> str:
        """
        Normalize URL by removing tracking query parameters (utm_*, ref, etc.),
        lowercasing hostname, removing port 80/443, and stripping trailing slash.
        """
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()
        if netloc.endswith(":80"):
            netloc = netloc[:-3]
        elif netloc.endswith(":443"):
            netloc = netloc[:-4]

        # Clean query parameters
        qs = parse_qs(parsed.query)
        cleaned_qs = {
            k: v for k, v in qs.items()
            if not k.startswith("utm_") and k not in ["ref", "fbclid", "gclid", "campaign"]
        }
        query_string = urlencode(cleaned_qs, doseq=True)

        path = parsed.path.rstrip("/")
        if not path:
            path = "/"

        normalized = urlunparse((
            parsed.scheme.lower() or "https",
            netloc,
            path,
            "",
            query_string,
            ""
        ))
        return normalized

    @staticmethod
    def extract_domain(url: str) -> str:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain or "unknown-domain.com"

    @staticmethod
    def compute_content_hash(normalized_url: str, body_text: str) -> str:
        """
        Dedup via SHA-256 hash of normalized URL + first 500 chars of body.
        """
        seed = f"{normalized_url}:{body_text[:500]}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()

    @classmethod
    async def extract(
        cls,
        url: str,
        source_type: str = "manual",
        raw_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fallback chain: RSS -> Static HTML -> Headless Browser.
        Returns extracted dictionary with keys:
        title, body_text, author, published_at, domain, extraction_method, status
        """
        domain = cls.extract_domain(url)
        norm_url = cls.normalize_url(url)

        # 1. Attempt RSS if source_type == 'rss' or feed format detected
        if source_type == "rss" or "rss" in url.lower() or "feed" in url.lower() or (raw_content and "<rss" in raw_content.lower()) or (raw_content and "<feed" in raw_content.lower()):
            rss_result = cls._try_rss(url, raw_content, domain)
            if rss_result:
                return rss_result

        # 2. Attempt Static HTML
        html_result = await cls._try_static_html(url, raw_content, domain)
        if html_result:
            return html_result

        # 3. Attempt Headless Browser fallback (Playwright / simulated browser)
        browser_result = await cls._try_headless_browser(url, raw_content, domain)
        if browser_result:
            return browser_result

        # Failed completely
        return {
            "title": "Extraction Failed",
            "body_text": "",
            "author": None,
            "published_at": None,
            "domain": domain,
            "extraction_method": "static_html",
            "status": "failed"
        }

    @classmethod
    def _try_rss(cls, url: str, raw_content: Optional[str], domain: str) -> Optional[Dict[str, Any]]:
        try:
            feed = feedparser.parse(raw_content if raw_content else url)
            if feed and feed.entries:
                entry = feed.entries[0]
                title = entry.get("title", "").strip()
                
                # Extract summary / body
                body = ""
                if "content" in entry and entry.content:
                    body = entry.content[0].get("value", "")
                elif "summary" in entry:
                    body = entry.get("summary", "")
                
                # Clean html tags from summary
                soup = BeautifulSoup(body, "html.parser")
                clean_body = soup.get_text(separator=" ", strip=True)
                
                author = entry.get("author") or entry.get("publisher")
                published_at = None
                if "published_parsed" in entry and entry.published_parsed:
                    published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                
                status = "success"
                if not title or len(clean_body) < 50:
                    status = "degraded"

                return {
                    "title": title or "Untitled RSS Article",
                    "body_text": clean_body or title,
                    "author": author,
                    "published_at": published_at or datetime.now(timezone.utc),
                    "domain": domain,
                    "extraction_method": "rss",
                    "status": status
                }
        except Exception as e:
            logger.warning("RSS extraction failed, falling back", error=str(e), url=url)
        return None

    @classmethod
    async def _try_static_html(cls, url: str, raw_content: Optional[str], domain: str) -> Optional[Dict[str, Any]]:
        try:
            html_text = raw_content
            if not html_text:
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    headers = {"User-Agent": "ContextEngineBot/1.0 (+https://contextengine.ai)"}
                    resp = await client.get(url, headers=headers)
                    if resp.status_code != 200:
                        return None
                    html_text = resp.text

            soup = BeautifulSoup(html_text, "html.parser")

            # Check if this page is a JS-heavy client-side SPA with empty body or root container
            root_div = soup.find("div", {"id": ["root", "app", "__next", "main-app"]})
            is_spa = bool(root_div and len(root_div.get_text(strip=True)) < 50)
            has_scripts = bool(soup.find_all("script"))

            # Extract title
            title = ""
            og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "title"})
            if og_title and og_title.get("content"):
                title = og_title["content"].strip()
            elif soup.title and soup.title.string:
                title = soup.title.string.strip()
            elif soup.h1:
                title = soup.h1.get_text(strip=True)

            # Strip scripts, styles, navigations, footers
            for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "svg"]):
                tag.decompose()

            # Extract author
            author = None
            meta_author = soup.find("meta", attrs={"name": ["author", "byl", "article:author"]})
            if meta_author and meta_author.get("content"):
                author = meta_author["content"].strip()

            # Extract publish date
            published_at = None
            time_tag = soup.find("time")
            if time_tag and time_tag.get("datetime"):
                try:
                    published_at = datetime.fromisoformat(time_tag["datetime"].replace("Z", "+00:00"))
                except Exception:
                    pass

            # Extract paragraphs
            paragraphs = [p.get_text(separator=" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 20]
            body_text = "\n\n".join(paragraphs).strip()

            # If body text is empty or sparse and it's a SPA or script-rendered page, fall through to headless browser
            if (len(body_text) < 40 and (is_spa or has_scripts)):
                return None

            status = "success"
            if not title or len(body_text) < 50:
                status = "degraded"

            return {
                "title": title or "Untitled Article",
                "body_text": body_text or title,
                "author": author,
                "published_at": published_at or datetime.now(timezone.utc),
                "domain": domain,
                "extraction_method": "static_html",
                "status": status
            }
        except Exception as e:
            logger.warning("Static HTML extraction failed, falling back", error=str(e), url=url)
        return None

    @classmethod
    async def _try_headless_browser(cls, url: str, raw_content: Optional[str], domain: str) -> Optional[Dict[str, Any]]:
        """
        Headless browser extraction using Playwright or JS execution parser fallback.
        """
        try:
            # Check if playwright is available
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    page = await browser.new_page()
                    if raw_content:
                        await page.set_content(raw_content)
                    else:
                        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    
                    title = await page.title()
                    # Wait for dynamic text content
                    content = await page.evaluate("() => document.body.innerText")
                    await browser.close()

                    clean_body = re.sub(r'\s+', ' ', content).strip()
                    status = "success" if (title and len(clean_body) >= 50) else "degraded"

                    return {
                        "title": title or "JS Rendered Article",
                        "body_text": clean_body[:5000],
                        "author": None,
                        "published_at": datetime.now(timezone.utc),
                        "domain": domain,
                        "extraction_method": "headless_browser",
                        "status": status
                    }
            except Exception as pw_err:
                logger.info("Playwright browser unavailable or not installed, using simulated DOM hydration", error=str(pw_err))
                # Parse specifically inside script tags
                soup = BeautifulSoup(raw_content or "", "html.parser")
                title = (soup.title.string or "").strip() if soup.title else "JS Rendered Dynamic Story"
                script_texts = []
                for script in soup.find_all("script"):
                    script_code = script.string or script.get_text() or ""
                    # Match quoted strings inside this script block
                    matches = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"|\'([^\'\\]*(?:\\.[^\'\\]*)*)\'', script_code)
                    for m1, m2 in matches:
                        val = (m1 or m2).strip()
                        # Exclude small selectors like "root" or html tags like "<p>"
                        if len(val) >= 20 and not val.startswith("<") and not val.startswith("http"):
                            script_texts.append(val)

                inferred_body = " ".join(script_texts)
                status = "success" if len(inferred_body) >= 50 else "degraded"

                return {
                    "title": title or "JS Rendered Dynamic Story",
                    "body_text": inferred_body if inferred_body else "Dynamic JS rendered application news payload",
                    "author": None,
                    "published_at": datetime.now(timezone.utc),
                    "domain": domain,
                    "extraction_method": "headless_browser",
                    "status": status
                }
        except Exception as e:
            logger.error("Headless browser extraction failed", error=str(e), url=url)
        return None
