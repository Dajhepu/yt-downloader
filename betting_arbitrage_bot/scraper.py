import asyncio
import random
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from loguru import logger
from .config import settings

class BaseScraper:
    def __init__(self, name, url):
        self.name = name
        self.url = url
        self.data = []

    async def get_browser_context(self, playwright):
        proxy = None
        if settings.PROXY_ENABLED and settings.PAID_PROXY_URL:
            proxy = {"server": settings.PAID_PROXY_URL}

        browser = await playwright.chromium.launch(headless=settings.HEADLESS)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            proxy=proxy
        )
        return browser, context

class BetpandaScraper(BaseScraper):
    def __init__(self):
        super().__init__("Betpanda", settings.BETPANDA_URL)

    async def fetch_odds(self):
        async with async_playwright() as p:
            browser, context = await self.get_browser_context(p)
            page = await context.new_page()
            await stealth_async(page)

            try:
                logger.info(f"Navigating to {self.url}")
                await page.goto(self.url, wait_until="networkidle", timeout=60000)

                # Betpanda typically uses an iframe or specific JS components for sports.
                # Here we attempt to capture network responses to find a JSON API.
                api_responses = []
                page.on("response", lambda response: api_responses.append(response) if "api" in response.url else None)

                await asyncio.sleep(10) # Wait for initial load

                # Fallback: Scrape DOM if no API found
                # Note: Real implementation would need precise selectors based on 2026 site layout.
                events = await page.query_selector_all(".sport-event-item")
                scraped_data = []

                for event in events:
                    # Generic placeholder scraping logic
                    title = await event.inner_text()
                    # Parse teams and odds from text
                    scraped_data.append({"raw": title})

                self.data = scraped_data
                logger.success(f"Fetched {len(scraped_data)} events from Betpanda")

            except Exception as e:
                logger.error(f"Betpanda scraping error: {e}")
            finally:
                await browser.close()

class CoinCasinoScraper(BaseScraper):
    def __init__(self):
        super().__init__("CoinCasino", settings.COINCASINO_URL)

    async def fetch_odds(self):
        async with async_playwright() as p:
            browser, context = await self.get_browser_context(p)
            page = await context.new_page()
            await stealth_async(page)

            try:
                logger.info(f"Navigating to {self.url}")
                await page.goto(self.url, wait_until="networkidle", timeout=60000)
                await asyncio.sleep(10)

                events = await page.query_selector_all(".match-row")
                scraped_data = []

                for event in events:
                    title = await event.inner_text()
                    scraped_data.append({"raw": title})

                self.data = scraped_data
                logger.success(f"Fetched {len(scraped_data)} events from CoinCasino")

            except Exception as e:
                logger.error(f"CoinCasino scraping error: {e}")
            finally:
                await browser.close()

async def run_scrapers():
    bp = BetpandaScraper()
    cc = CoinCasinoScraper()
    await asyncio.gather(bp.fetch_odds(), cc.fetch_odds())
    return bp.data, cc.data
