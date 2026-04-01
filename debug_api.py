
import asyncio
import aiohttp
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("debug-api")

async def test():
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    async with aiohttp.ClientSession(headers={"User-Agent": ua}) as session:
        # 1. Profiles
        url = "https://api.dexscreener.com/token-profiles/latest/v1"
        async with session.get(url) as r:
            log.info(f"Profiles Status: {r.status}")
            if r.status == 200:
                data = await r.json()
                log.info(f"Profiles count: {len(data)}")
            else:
                log.info(f"Body: {await r.text()}")

        # 2. Search 'ethereum trending'
        url = "https://api.dexscreener.com/latest/dex/search?q=ethereum trending"
        async with session.get(url) as r:
            log.info(f"Search 'ethereum trending' Status: {r.status}")
            if r.status == 200:
                data = await r.json()
                log.info(f"Search results: {len(data.get('pairs', []))}")

        # 3. Search 'solana'
        url = "https://api.dexscreener.com/latest/dex/search?q=solana"
        async with session.get(url) as r:
            log.info(f"Search 'solana' Status: {r.status}")
            if r.status == 200:
                data = await r.json()
                log.info(f"Search results: {len(data.get('pairs', []))}")

if __name__ == "__main__":
    asyncio.run(test())
