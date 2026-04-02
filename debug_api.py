import asyncio
import aiohttp
import json

async def test_discovery():
    headers = {"User-Agent": "Mozilla/5.0"}
    async with aiohttp.ClientSession(headers=headers) as session:
        # Test profiles
        async with session.get("https://api.dexscreener.com/token-profiles/latest/v1") as r:
            profiles = await r.json()
            print(f"Profiles found: {len(profiles) if isinstance(profiles, list) else 'Error'}")

        # Test boosts
        async with session.get("https://api.dexscreener.com/token-boosts/latest/v1") as r:
            boosts = await r.json()
            print(f"Boosts found: {len(boosts) if isinstance(boosts, list) else 'Error'}")

if __name__ == "__main__":
    asyncio.run(test_discovery())
