"""
Betting Arbitrage Bot - Betpanda & CoinCasino (Single File)
"""

import asyncio
import sys
import os
import json
import time
import re
import logging
from datetime import datetime, timedelta, timezone

# ─── LIBRARIES ───
import httpx
import pandas as pd
import streamlit as st
from loguru import logger
from fuzzywuzzy import fuzz
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

load_dotenv()

# ─── CONFIGURATION ───
class Settings(BaseSettings):
    TELEGRAM_TOKEN: str = os.getenv("TELEGRAM_TOKEN", "7256069971:AAHNTBZZipJI9mF1K1lRyNiQb2n7qEEDEDY")
    CHAT_ID: int = int(os.getenv("CHAT_ID", 798283148))
    MIN_PROFIT_PERCENT: float = 1.5
    POLLING_INTERVAL: int = 180
    DATA_FILE: str = "betting_opportunities.json"
    BETPANDA_URL: str = "https://betpandacasino.io/en/sportsbook"
    COINCASINO_URL: str = "https://www.coincasino.com/en/sports"
    HEADLESS: bool = True
    PROXY_ENABLED: bool = False
    PAID_PROXY: str = os.getenv("PAID_PROXY_URL", "")

settings = Settings()

# ─── ENGINE: Arbitrage Calculations ───
class ArbitrageEngine:
    @staticmethod
    def normalize_name(name):
        return name.lower().replace("vs", "").replace("-", "").strip()

    def find_matches(self, bp_data, cc_data):
        matches = []
        for bp in bp_data:
            for cc in cc_data:
                if fuzz.token_sort_ratio(self.normalize_name(bp['title']), self.normalize_name(cc['title'])) > 85:
                    matches.append((bp, cc))
        return matches

    def calculate_arb(self, odds):
        try:
            inv_sum = sum(1.0 / o['val'] for o in odds)
            if inv_sum < 1.0:
                profit = (1.0 / inv_sum - 1.0) * 100
                if profit >= settings.MIN_PROFIT_PERCENT:
                    stakes = {o['p']: (100 / (o['val'] * inv_sum)) for o in odds}
                    return {"profit": profit, "stakes": stakes}
        except Exception: pass
        return None

    def analyze(self, bp_data, cc_data):
        opportunities = []
        matches = self.find_matches(bp_data, cc_data)
        for bp, cc in matches:
            # Example simplified 2-way analysis
            if '1' in bp['odds'] and '2' in cc['odds']:
                res = self.calculate_arb([{'p': 'Betpanda', 'val': bp['odds']['1']}, {'p': 'CoinCasino', 'val': cc['odds']['2']}])
                if res: opportunities.append({"event": bp['title'], "market": "1-2", "profit": res['profit'], "stakes": res['stakes'], "odds": {"BP": bp['odds']['1'], "CC": cc['odds']['2']}})
        return opportunities

# ─── SCRAPER: Playwright Implementation ───
async def simulate_human_behavior(page):
    """Simulates human-like interactions to bypass bot detection."""
    try:
        await page.mouse.move(100, 100)
        await asyncio.sleep(1)
        await page.mouse.wheel(0, 500)
        await asyncio.sleep(1)
        await page.mouse.wheel(0, -200)
    except Exception:
        pass

async def scrape_platform(playwright, name, url, selector):
    # Use a real user profile or specific args for better stealth
    browser = await playwright.chromium.launch(
        headless=settings.HEADLESS,
        args=["--disable-blink-features=AutomationControlled"]
    )

    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )

    page = await context.new_page()
    await stealth_async(page)

    data = []
    try:
        logger.info(f"Scraping {name}...")
        # Increase timeout for Cloudflare challenges
        await page.goto(url, wait_until="commit", timeout=90000)

        # Wait for potential Cloudflare auto-verify
        logger.info("Waiting for potential Cloudflare challenge...")
        await asyncio.sleep(random.uniform(10, 15))

        await simulate_human_behavior(page)

        # Check if we are stuck on a verification page
        content = await page.content()
        if "Verifying you are human" in content or "cf-challenge" in content:
            logger.error(f"STUCK ON VERIFICATION for {name}. Cloudflare detected.")
            # Take a screenshot for debugging
            await page.screenshot(path=f"debug_{name}_verification.png")
            return []

        # Wait until the target selector is visible or network is idle
        try:
            await page.wait_for_selector(selector, timeout=30000)
        except Exception:
            logger.warning(f"Selector {selector} not found on {name}, maybe stuck on verification.")

        elements = await page.query_selector_all(selector)
        for el in elements:
            text = await el.inner_text()
            # Simple parser logic
            data.append({"title": text.split('\n')[0], "odds": {"1": 2.1, "2": 1.9}}) # Mock parse
    except Exception as e: logger.error(f"{name} error: {e}")
    finally: await browser.close()
    return data

# ─── BOT: Telegram Interface ───
class BettingBot:
    def __init__(self):
        self.app = Application.builder().token(settings.TELEGRAM_TOKEN).build()
        self.app.add_handler(CommandHandler("start", self.start))

    async def start(self, update, context):
        await update.message.reply_text("🎯 Betting Arbitrage Bot Active")

    async def send_alert(self, arb):
        text = f"🔥 <b>ARB: {arb['profit']:.2f}%</b>\n🏆 {arb['event']}\n💰 {arb['stakes']}"
        await self.app.bot.send_message(CHAT_ID, text, parse_mode="HTML")

# ─── DASHBOARD: Streamlit ───
def run_dashboard():
    st.title("🎰 Arb Dashboard")
    if os.path.exists(settings.DATA_FILE):
        with open(settings.DATA_FILE, "r") as f:
            data = json.load(f)
            st.table(pd.DataFrame(data))
    time.sleep(10)
    st.rerun()

# ─── MAIN: Coordination ───
async def main_loop():
    engine = ArbitrageEngine()
    bot = BettingBot()
    await bot.app.initialize()
    await bot.app.start()

    async with async_playwright() as p:
        while True:
            bp_data = await scrape_platform(p, "Betpanda", settings.BETPANDA_URL, ".event")
            cc_data = await scrape_platform(p, "CoinCasino", settings.COINCASINO_URL, ".row")

            arbs = engine.analyze(bp_data, cc_data)
            with open(settings.DATA_FILE, "w") as f: json.dump(arbs, f)
            for a in arbs: await bot.send_alert(a)

            await asyncio.sleep(settings.POLLING_INTERVAL)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "dashboard":
        run_dashboard()
    else:
        asyncio.run(main_loop())
