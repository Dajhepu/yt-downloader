import asyncio
import logging
import json
import time
import html
import math
import random
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Union

import httpx
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
    MessageHandler
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from colorama import Fore, Style, init

# Init colorama
init(autoreset=True)

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
# Use environment variables without hardcoded defaults for security.
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
MORALIS_API_KEY = os.getenv("MORALIS_API_KEY")

# Default Monitoring Settings
SCAN_INTERVAL = 45
MIN_USD_VALUE = 5000
MIN_LIQUIDITY = 15000
AGE_MIN_MINS = 15
AGE_MAX_HOURS = 6

# Constants
DEXSCREENER_API = "https://api.dexscreener.com"
MORALIS_EVM_API = "https://deep-index.moralis.io/api/v2.2"

# ─── LOGGING ────────────────────────────────────────────────────────────────
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class Config:
    def __init__(self):
        self.running = False
        self.min_usd = MIN_USD_VALUE
        self.min_lp = MIN_LIQUIDITY
        self.expert_only = True
        self.moonshot_bias = True
        self.learning_rate = 0.05
        self.scan_interval = SCAN_INTERVAL
        self.chains = ["ethereum", "bsc", "base", "arbitrum", "solana"]

config = Config()

# ─── STATE ──────────────────────────────────────────────────────────────────
class State:
    def __init__(self):
        self.seen_txs = set()
        self.trades = [] # List of analyzed trades
        self.stats = {
            "total_signals": 0,
            "expert_hits": 0,
            "avg_score": 0.0,
            "total_vol": 0.0,
            "start_time": datetime.now(timezone.utc)
        }

state = State()

# ─── UTILS ──────────────────────────────────────────────────────────────────
def format_usd(val: float) -> str:
    if val >= 1_000_000: return f"${val/1_000_000:.2f}M"
    if val >= 1_000: return f"${val/1_000:.1f}K"
    return f"${val:.2f}"

def safe_html(text: Any) -> str:
    return html.escape(str(text))

def is_auth(update: Update) -> bool:
    chat_id = str(update.effective_chat.id) if update.effective_chat else None
    return chat_id == TELEGRAM_CHAT_ID

# ─── NEURAL SCORING ENGINE ──────────────────────────────────────────────────
class NeuralScorer:
    def __init__(self, learning_rate: float = 0.05):
        self.lr = learning_rate
        self.weights = {
            "vol_mcap_ratio": 0.85, "buy_pressure": 0.95, "wallet_expert_score": 1.2,
            "token_age_score": 0.65, "social_trending": 0.5, "moonshot_alpha": 1.5
        }

    def _sigmoid(self, x: float) -> float:
        return 100 / (1 + math.exp(-0.1 * (x - 50)))

    def calculate_score(self, token_data: Dict[str, Any], chain: str) -> Dict[str, Any]:
        raw_score = 50.0
        factors = {}

        vol_mcap = token_data.get('vol_mcap', 0)
        factors['vol_mcap'] = min(vol_mcap * 50, 100)
        raw_score += (factors['vol_mcap'] - 50) * self.weights['vol_mcap_ratio']

        buy_ratio = token_data.get('buy_ratio', 0.5)
        factors['buy_ratio'] = (buy_ratio - 0.5) * 200
        raw_score += factors['buy_ratio'] * self.weights['buy_pressure']

        expert_score = token_data.get('expert_score', 0)
        factors['expert'] = expert_score * 20
        raw_score += factors['expert'] * self.weights['wallet_expert_score']

        age_hours = token_data.get('age_hours', 1)
        factors['age'] = 80 if age_hours < 1 else 40 if age_hours < 6 else 0
        raw_score += factors['age'] * self.weights['token_age_score']

        mcap = token_data.get('mcap', 1_000_000)
        if 5000 <= mcap <= 600000:
            raw_score += 15 * self.weights['moonshot_alpha']
            factors['moonshot'] = 100
        else:
            factors['moonshot'] = 0

        final_score = self._sigmoid(raw_score)
        return {
            "score": round(final_score, 1),
            "factors": factors,
            "confidence": "High" if final_score > 85 else "Medium" if final_score > 65 else "Low"
        }

scorer = NeuralScorer()

# ─── DISCOVERY ENGINE ───────────────────────────────────────────────────────
class DiscoveryEngine:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30, follow_redirects=True)
        self.semaphore = asyncio.Semaphore(5)

    async def get_token_metrics(self, chain: str, token_addr: str) -> Optional[Dict[str, Any]]:
        try:
            async with self.semaphore:
                url = f"{DEXSCREENER_API}/latest/dex/tokens/{token_addr}"
                resp = await self.client.get(url)
                data = resp.json()
                pairs = data.get('pairs', [])
                if not pairs: return None
                pair = sorted(pairs, key=lambda x: x.get('liquidity', {}).get('usd', 0), reverse=True)[0]
                h24 = pair.get('volume', {}).get('h24', 0)
                mcap = pair.get('fdv') or pair.get('marketCap', 0)
                buys = pair.get('txns', {}).get('h24', {}).get('buys', 1)
                sells = pair.get('txns', {}).get('h24', {}).get('sells', 1)
                return {
                    "price": float(pair.get('priceUsd', 0)), "mcap": mcap,
                    "liquidity": pair.get('liquidity', {}).get('usd', 0),
                    "vol_mcap": h24 / mcap if mcap > 0 else 0,
                    "buy_ratio": buys / (buys + sells) if (buys + sells) > 0 else 0.5,
                    "age_hours": (time.time() - (pair.get('pairCreatedAt', 0) / 1000)) / 3600 if pair.get('pairCreatedAt') else 1,
                    "symbol": pair.get('baseToken', {}).get('symbol', 'UNK'),
                    "pair_addr": pair.get('pairAddress'), "dex": pair.get('dexId')
                }
        except Exception: return None

    async def check_expert_status(self, wallet_addr: str, chain: str) -> int:
        """Determines if a wallet is an 'Expert' via Moralis profitability heuristics."""
        if not MORALIS_API_KEY or wallet_addr == "Expert Whale": return 3 # Baseline for discovery
        try:
            # PRO v4.5: Analysis of net_profit and trade_count to determine 'Expert' level
            url = f"{MORALIS_EVM_API}/wallets/{wallet_addr}/profitability?chain={chain}"
            resp = await self.client.get(url, headers={"X-API-Key": MORALIS_API_KEY})
            data = resp.json()

            # Smart money cluster: high win rate and consistent volume
            win_rate = data.get('win_rate', 0)
            trades = data.get('trade_count', 0)

            if win_rate > 0.75 and trades > 10: return 5
            if win_rate > 0.60: return 3
            if trades > 5: return 1
            return 0
        except Exception as e:
            logger.error(f"Expert analysis error for {wallet_addr}: {e}")
            return 0

    async def process_discovery(self, token_addr: str, chain: str, wallet_addr: str = "Expert Whale"):
        if token_addr in state.seen_txs: return
        state.seen_txs.add(token_addr)
        metrics = await self.get_token_metrics(chain, token_addr)
        if not metrics: return
        expert_score = await self.check_expert_status(wallet_addr, chain)
        if config.expert_only and expert_score == 0: return
        metrics['expert_score'] = expert_score
        score_res = scorer.calculate_score(metrics, chain)
        if score_res['score'] >= 70:
            await self.signal_alpha(token_addr, chain, metrics, score_res, wallet_addr)

    async def signal_alpha(self, addr: str, chain: str, metrics: dict, score_res: dict, wallet: str):
        state.stats['total_signals'] += 1
        state.stats['total_vol'] += metrics['liquidity']
        state.stats['avg_score'] = (state.stats['avg_score'] * (state.stats['total_signals'] - 1) + score_res['score']) / state.stats['total_signals']

        trade = {
            "id": f"{chain}_{addr}_{int(time.time())}", "type": "buy", "wallet": wallet,
            "chain": chain, "token": metrics['symbol'], "usdValue": metrics['liquidity'],
            "timestamp": datetime.now(timezone.utc).isoformat(), "score": score_res['score']
        }
        state.trades.insert(0, trade)

        if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
            emoji = "🚀" if score_res['score'] > 85 else "📈"
            msg = (f"{emoji} <b>PRO ALPHA DETECTED</b>\n\n💎 <b>Token:</b> ${metrics['symbol']} ({chain.upper()})\n"
                   f"📊 <b>Score:</b> <code>{score_res['score']}/100</code>\n🐋 <b>Expert:</b> {safe_html(wallet)}\n\n"
                   f"💰 <b>MCap:</b> {format_usd(metrics['mcap'])}\n🏊 <b>LP:</b> {format_usd(metrics['liquidity'])}\n"
                   f"🔗 <a href=\"https://dexscreener.com/{chain}/{metrics['pair_addr']}\">DexScreener</a>")
            try:
                if hasattr(self, 'bot_app'):
                    await self.bot_app.bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=msg, parse_mode=ParseMode.HTML)
            except Exception: pass

    async def monitor_all(self):
        """DexScreener monitoring job."""
        if not config.running: return
        try:
            url = f"{DEXSCREENER_API}/token-profiles/latest/v1"
            resp = await self.client.get(url)
            profiles = resp.json()
            # Only process the most recent 20 for performance
            for p in profiles[:20]:
                await self.process_discovery(p.get('tokenAddress'), p.get('chainId'))
        except Exception as e:
            logger.debug(f"Monitor error: {e}")

discovery = DiscoveryEngine()

# ─── WEB SERVER ─────────────────────────────────────────────────────────────
async def handle_dashboard(request):
    return web.Response(text=DASHBOARD_HTML, content_type='text/html')

async def handle_api(request):
    # Convert datetime to string for JSON serialization
    serialized_stats = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in state.stats.items()}
    data = {
        "stats": serialized_stats,
        "trades": state.trades[:50]
    }
    return web.json_response(data)

async def start_web_server():
    app = web.Application()
    app.router.add_get('/', handle_dashboard)
    app.router.add_get('/api/data', handle_api)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    logger.info(f"{Fore.CYAN}Dashboard active at http://localhost:8080{Style.RESET_ALL}")

# ─── TELEGRAM BOT ───────────────────────────────────────────────────────────
class BotInterface:
    def __init__(self, token: str):
        self.app = Application.builder().token(token).build()
        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CallbackQueryHandler(self.btn_callback))

    def main_keyboard(self):
        keys = [[InlineKeyboardButton("▶️ Start", callback_data="mon_start"), InlineKeyboardButton("⏹ Stop", callback_data="mon_stop")],
                [InlineKeyboardButton("📊 Status", callback_data="status")]]
        return InlineKeyboardMarkup(keys)

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_auth(update): return
        await update.message.reply_text("🐋 <b>Whale Tracker Pro v4.5 Activated.</b>", parse_mode=ParseMode.HTML, reply_markup=self.main_keyboard())

    async def btn_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_auth(update): return
        query = update.callback_query
        if query.data == "mon_start": config.running = True
        elif query.data == "mon_stop": config.running = False
        await query.answer(f"Monitor: {'Started' if config.running else 'Stopped'}")

# ─── WEB SERVER ─────────────────────────────────────────────────────────────
# Simple dashboard string to be populated via API
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>chainEDGE — Smart Money Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=JetBrains+Mono:wght@300;400;500;600&family=Space+Grotesk:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #04050d; --surface: #080b18; --surface2: #0d1121; --border: #151c30; --border2: #1e2840;
  --buy: #00e87a; --sell: #ff3358; --accent: #00b4ff; --warn: #ffa500; --text: #d4ddf7;
}
body { background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; margin: 0; padding: 20px; }
.topbar { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; }
.logo { font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 24px; color: var(--accent); }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
.stat-card { background: var(--surface2); padding: 20px; border-radius: 8px; border: 1px solid var(--border); }
.trade-card { background: var(--surface); padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid var(--buy); display: flex; justify-content: space-between; align-items: center; }
.badge { font-family: 'JetBrains Mono', monospace; background: rgba(0, 180, 255, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 12px; }
</style>
</head>
<body>
    <div class="topbar"><div class="logo">chainEDGE PRO v4.5</div></div>
    <div class="stat-grid" id="stats"></div>
    <div id="feed"></div>
    <script>
        function formatUsd(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toFixed(2); }
        async function update() {
            try {
                const res = await fetch('/api/data');
                const data = await res.json();
                document.getElementById('stats').innerHTML = `
                    <div class="stat-card">Signals: ${data.stats.total_signals}</div>
                    <div class="stat-card">Volume: $${formatUsd(data.stats.total_vol)}</div>
                    <div class="stat-card">Avg Score: ${data.stats.avg_score.toFixed(1)}</div>
                `;
                document.getElementById('feed').innerHTML = data.trades.map(t => `
                    <div class="trade-card">
                        <div>
                            <span class="logo">$${t.token}</span>
                            <span class="badge">${t.chain.toUpperCase()}</span>
                        </div>
                        <div style="text-align:right">
                            <div class="logo" style="color:var(--buy)">${t.score}/100</div>
                            <div style="font-size:11px;color:var(--text);opacity:0.6">${new Date(t.timestamp).toLocaleTimeString()}</div>
                        </div>
                    </div>
                `).join('');
            } catch(e) { console.error(e); }
        }
        setInterval(update, 5000); update();
    </script>
</body>
</html>
"""

# ─── MAIN ───────────────────────────────────────────────────────────────────
async def main():
    # Start Web Server
    await start_web_server()

    if TELEGRAM_TOKEN:
        bot = BotInterface(TELEGRAM_TOKEN)
        discovery.bot_app = bot.app
        await bot.app.initialize()
        await bot.app.start_polling()

    scheduler = AsyncIOScheduler(timezone=timezone.utc)
    # Run monitoring loop every SCAN_INTERVAL seconds
    scheduler.add_job(discovery.monitor_all, 'interval', seconds=config.scan_interval)
    scheduler.start()
    # Trigger first run immediately
    asyncio.create_task(discovery.monitor_all())

    logger.info(f"{Fore.GREEN}PRO v4.5 Services Active.{Style.RESET_ALL}")
    while True: await asyncio.sleep(3600)

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
