import asyncio
import sys
import json
import os
from loguru import logger
from .scraper import run_scrapers
from .engine import ArbitrageEngine
from .bot import TelegramBot
from .config import settings

async def main_loop():
    engine = ArbitrageEngine()
    bot = TelegramBot()

    # Initialize background bot
    asyncio.create_task(bot.app.initialize())
    if bot.app.post_init:
        await bot.app.post_init(bot.app)
    await bot.app.start()

    logger.info("Main arbitrage loop started.")

    while True:
        try:
            logger.info("Starting a new scan cycle...")

            # 1. Fetch Odds
            bp_data, cc_data = await run_scrapers()

            # 2. Analyze
            opportunities = engine.analyze_markets(bp_data, cc_data)

            # 3. Save for Dashboard
            with open(settings.DATA_FILE, "w") as f:
                json.dump(opportunities, f)

            # 4. Alert
            for arb in opportunities:
                await bot.send_alert(arb)

            logger.info(f"Scan cycle finished. Sleeping for {settings.POLLING_INTERVAL_SECONDS}s")
            await asyncio.sleep(settings.POLLING_INTERVAL_SECONDS)

        except Exception as e:
            logger.exception(f"Error in main loop: {e}")
            await asyncio.sleep(30)

if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user.")
        sys.exit(0)
