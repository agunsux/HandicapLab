"""
HandicapLab - ScoreRoom Scraper Client
=====================================
Asynchronous Playwright client for extracting historical/live match data,
odds movements, and in-game statistics from ScoreRoom (scoreroom.com).

Features:
- Anti-bot stealth (navigator spoofing, webgl emulation, chrome runtime mocks).
- Network XHR/Fetch request interception (captures hidden JSON payloads).
- Dynamic DOM fallback when JSON APIs are not exposed.
- Resilient exponential backoff with jitter and rate-limit mitigation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, List, Optional
from urllib.parse import urlparse

try:
    from playwright.async_api import (
        Browser,
        BrowserContext,
        Page,
        Response,
        async_playwright,
        TimeoutError as PlaywrightTimeoutError,
    )
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    Browser = Any  # type: ignore
    BrowserContext = Any  # type: ignore
    Page = Any  # type: ignore
    Response = Any  # type: ignore
    async_playwright = None  # type: ignore
    PlaywrightTimeoutError = Exception  # type: ignore

# Optional playwright-stealth integration
try:
    from playwright_stealth import stealth_async
    HAS_PLAYWRIGHT_STEALTH = True
except ImportError:
    HAS_PLAYWRIGHT_STEALTH = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("HandicapLab.ScoreRoomClient")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

# Keywords indicating API responses carrying match/odds/stats payload
API_URL_KEYWORDS = [
    "/api/",
    "/match",
    "/fixture",
    "/odds",
    "/stats",
    "/h2h",
    "/asian-handicap",
    "/over-under",
    "/pressure-index",
    "_next/data",
]


@dataclass
class ScrapedPayload:
    url: str
    status: int
    content_type: str
    json_data: Optional[Dict[str, Any]] = None
    html_content: Optional[str] = None
    intercepted_api_responses: List[Dict[str, Any]] = field(default_factory=list)


class SkoreroomScraperClient:
    """Production-grade Playwright scraper client with stealth and interception."""

    def __init__(
        self,
        headless: bool = True,
        min_delay: float = 2.0,
        max_delay: float = 5.0,
        timeout_ms: int = 35000,
        proxy: Optional[Dict[str, str]] = None,
    ):
        self.headless = headless
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.timeout_ms = timeout_ms
        self.proxy = proxy

        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._intercepted_json_buffer: List[Dict[str, Any]] = []

    async def __aenter__(self) -> "SkoreroomScraperClient":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self) -> None:
        """Launch browser and configure stealth context."""
        if not HAS_PLAYWRIGHT:
            raise RuntimeError(
                "Playwright is not installed. Please run:\n"
                "  pip install playwright\n"
                "  playwright install chromium"
            )
        logger.info("Initializing Playwright browser context with stealth...")
        self._playwright = await async_playwright().start()

        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--window-size=1920,1080",
            "--disable-web-security",
        ]

        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=launch_args,
            proxy=self.proxy,
        )

        user_agent = random.choice(USER_AGENTS)
        self._context = await self._browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            has_touch=False,
            is_mobile=False,
            locale="en-US",
            timezone_id="Europe/London",
            permissions=["geolocation"],
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
            },
        )

        # Apply JavaScript evasion scripts before any webpage script executes
        await self._context.add_init_script("""
            // Mask navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Mock window.chrome
            window.chrome = {
                app: { isInstalled: false },
                webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
                runtime: { PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' } },
                loadTimes: function() {},
                csi: function() {}
            };

            // Mock navigator.plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });

            // Mock navigator.languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Mock permissions query
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        """)

    async def close(self) -> None:
        """Tear down browser session and release memory."""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("Playwright session closed successfully.")

    async def _handle_response(self, response: Response) -> None:
        """Inspect and capture relevant XHR/Fetch API responses."""
        url = response.url
        content_type = response.headers.get("content-type", "").lower()

        # Check if URL matches target sports API patterns and is JSON
        if "application/json" in content_type and any(kw in url for kw in API_URL_KEYWORDS):
            try:
                body = await response.json()
                logger.debug("Intercepted JSON endpoint: %s", url)
                self._intercepted_json_buffer.append({
                    "url": url,
                    "status": response.status,
                    "data": body,
                })
            except Exception as e:
                logger.debug("Failed to decode JSON from %s: %s", url, e)

    async def _apply_human_delay(self) -> None:
        """Sleep with random jitter to avoid predictable rate-limit triggers."""
        delay = random.uniform(self.min_delay, self.max_delay)
        await asyncio.sleep(delay)

    async def _detect_bot_block(self, page: Page) -> bool:
        """Detect Cloudflare or anti-bot challenge screens."""
        title = await page.title()
        content = await page.content()
        block_markers = [
            "Just a moment...",
            "Attention Required!",
            "Cloudflare",
            "Access Denied",
            "Please verify you are a human",
            "cf-chl-widget",
        ]
        for marker in block_markers:
            if marker in title or marker in content[:3000]:
                return True
        return False

    async def fetch_page(
        self,
        url: str,
        wait_selector: Optional[str] = None,
        retries: int = 3,
        backoff_factor: float = 2.0,
    ) -> ScrapedPayload:
        """
        Navigate to a ScoreRoom page with retry logic, anti-bot handling,
        and simultaneous Network API interception + DOM fallback.
        """
        if not self._context:
            raise RuntimeError("Client not started. Use 'async with SkoreroomScraperClient():'")

        self._intercepted_json_buffer.clear()
        page = await self._context.new_page()

        if HAS_PLAYWRIGHT_STEALTH:
            await stealth_async(page)

        # Attach response listener for XHR/Fetch interception
        page.on("response", self._handle_response)

        last_error = None
        for attempt in range(1, retries + 1):
            try:
                logger.info("Navigating to %s (Attempt %d/%d)", url, attempt, retries)
                response = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=self.timeout_ms,
                )

                if response is None:
                    raise PlaywrightTimeoutError("Empty response received")

                status = response.status

                # Check for rate-limiting or anti-bot challenges
                if status in (403, 429, 503) or await self._detect_bot_block(page):
                    logger.warning(
                        "Anti-bot or rate-limit detected on %s (HTTP %d). Backing off...",
                        url,
                        status,
                    )
                    await asyncio.sleep(backoff_factor ** attempt + random.uniform(1.0, 3.0))
                    continue

                # Wait for optional selector or network stability
                if wait_selector:
                    try:
                        await page.wait_for_selector(wait_selector, timeout=8000)
                    except PlaywrightTimeoutError:
                        logger.warning("Timeout waiting for selector '%s'. Continuing with DOM extraction.", wait_selector)
                else:
                    # Brief settling window for dynamic single-page applications (Next.js/React)
                    await asyncio.sleep(1.5)

                # Scroll down slightly to trigger lazy-loaded odds / statistics tables
                try:
                    await page.evaluate("window.scrollBy(0, 600);")
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

                html_content = await page.content()
                content_type = response.headers.get("content-type", "text/html")

                # Snapshot intercepted responses
                intercepted_list = list(self._intercepted_json_buffer)

                await self._apply_human_delay()

                return ScrapedPayload(
                    url=url,
                    status=status,
                    content_type=content_type,
                    html_content=html_content,
                    intercepted_api_responses=intercepted_list,
                )

            except Exception as e:
                last_error = e
                logger.warning("Attempt %d failed for %s: %s", attempt, url, e)
                await asyncio.sleep(backoff_factor ** attempt + random.uniform(0.5, 1.5))
            finally:
                if attempt == retries:
                    await page.close()

        await page.close()
        raise RuntimeError(f"Failed to fetch {url} after {retries} attempts: {last_error}")
