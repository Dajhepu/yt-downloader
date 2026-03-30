"""
Professional Crypto Suite - Whale Tracker, Betting Arbitrage & DEX Alpha
Consolidated into a single file for maximum efficiency.
"""

import asyncio
import logging
import httpx
import os
import json
import time
import html
import difflib
from datetime import datetime, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters
)

logging.basicConfig(level=logging.INFO)

# ─── CONFIG ─────────────────────────────────────────────────────────────────
# Use environment variables for sensitive data.
# Defaults provided for immediate functionality but should be moved to .env
BOT_TOKEN  = os.getenv("BOT_TOKEN", "8489499074:AAEbc1ZNVEBprLhPhnoiY0orE4oRmno9UYM")
CHAT_ID    = int(os.getenv("CHAT_ID", "798283148"))
# ────────────────────────────────────────────────────────────────────────────

state = {
    "client": None,
    "running": True,
    "seen_whales": {}, # token_addr -> last_alert_time
    "seen_trade_ids": set(),
    "seen_arb_ids": set(),
    "hot_tokens": {},
    "tracked_whales": [], # addresses
    "whale_names": {},
    "waiting_for_ca": False,
    "min_ratio": 0.3,
    "min_liquidity": 10000,
}

# ─── GENERIC HELPERS ─────────────────────────────────────────────────────────

def get_similarity(s1, s2):
    return difflib.SequenceMatcher(None, s1.lower(), s2.lower()).ratio()

def extract_teams(title):
    if ' - ' in title:
        parts = title.split(' - ')
        return parts[0].strip(), parts[1].strip()
    return None, None

def parse_json_field(field):
    if isinstance(field, str):
        try: return json.loads(field)
        except: return None
    return field

# ─── POLYMARKET HELPERS ──────────────────────────────────────────────────────

async def fetch_poly_markets():
    url = "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1000"
    try:
        r = await state["client"].get(url, timeout=15)
        return r.json()
    except: return []

async def fetch_top_whales(limit=10):
    url = "https://data-api.polymarket.com/v1/leaderboard"
    params = {"category": "OVERALL", "timePeriod": "WEEK", "orderBy": "PNL", "limit": limit}
    try:
        r = await state["client"].get(url, params=params, timeout=15)
        return r.json()
    except: return []

async def fetch_whale_trades(address, limit=5):
    url = "https://data-api.polymarket.com/v1/trades"
    params = {"userAddress": address, "limit": limit}
    try:
        r = await state["client"].get(url, params=params, timeout=15)
        return r.json()
    except: return []

# ─── AZURO HELPERS ──────────────────────────────────────────────────────────

async def fetch_azuro_games():
    url = "https://api.onchainfeed.org/api/v1/public/market-manager/games-by-filters"
    params = {
        "environment": "PolygonUSDT",
        "gameState": "Prematch",
        "orderBy": "startsAt",
        "orderDirection": "asc",
        "page": 1,
        "perPage": 50
    }
    try:
        r = await state["client"].get(url, params=params, timeout=15)
        return r.json().get('games', [])
    except: return []

async def fetch_azuro_conditions(game_ids):
    if not game_ids: return []
    url = "https://api.onchainfeed.org/api/v1/public/market-manager/conditions-by-game-ids"
    try:
        r = await state["client"].post(url, json={"gameIds": game_ids, "environment": "PolygonUSDT"}, timeout=15)
        return r.json().get('conditions', [])
    except: return []

# ─── DEXSCREENER HELPERS ───────────────────────────────────────────────────

async def fetch_dex_boosted():
    url = "https://api.dexscreener.com/token-boosts/latest/v1"
    try:
        r = await state["client"].get(url, timeout=15)
        return r.json()
    except: return []

async def fetch_token_pairs(token_address):
    url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
    try:
        r = await state["client"].get(url, timeout=15)
        return r.json().get('pairs', [])
    except: return []

# ─── ANALYTICS ENGINES ───────────────────────────────────────────────────────

async def find_betting_arbitrage():
    """Polymarket vs Azuro cross-platform arbitrage."""
    poly_raw = await fetch_poly_markets()
    azuro_games = await fetch_azuro_games()
    if not poly_raw or not azuro_games: return []

    game_ids = [g['gameId'] for g in azuro_games]
    azuro_conditions = await fetch_azuro_conditions(game_ids)

    # Map azuro conditions to games
    az_data = {g['gameId']: {'title': g['title'], 'conditions': []} for g in azuro_games}
    for c in azuro_conditions:
        if c['game']['gameId'] in az_data:
            az_data[c['game']['gameId']]['conditions'].append(c)

    results = []
    for pm in poly_raw:
        q = pm.get('question', '')
        outcomes = parse_json_field(pm.get('outcomes'))
        prices = parse_json_field(pm.get('outcomePrices'))
        if not outcomes or not prices or len(outcomes) != 2: continue

        # Match with Azuro
        for gid, adata in az_data.items():
            score = get_similarity(q, adata['title'])
            if score > 0.65:
                t1, t2 = extract_teams(adata['title'])
                if not t1: continue

                # Check mentioned team in Polymarket
                t1_in_q = t1.lower() in q.lower()
                t2_in_q = t2.lower() in q.lower()
                if t1_in_q == t2_in_q: continue # Risk avoidance

                mentioned = t1 if t1_in_q else t2
                other = t2 if t1_in_q else t1

                for cond in adata['conditions']:
                    if cond['state'] != 'Active': continue
                    o_map = {o['outcomeId']: float(o['odds']) for o in cond['outcomes']}
                    if '1' in o_map and '2' in o_map and '3' not in o_map: # Binary sports
                        p_yes = float(prices[0])
                        p_no = float(prices[1])
                        az_p1 = 1 / o_map['1']
                        az_p2 = 1 / o_map['2']

                        az_mentioned = az_p1 if mentioned == t1 else az_p2
                        az_other = az_p2 if mentioned == t1 else az_p1

                        # Arb 1: Poly Yes + Azuro Other
                        if p_yes + az_other < 0.95:
                            results.append({
                                'market': q, 'poly_out': f"Yes ({mentioned})", 'poly_p': p_yes,
                                'az_out': f"Away ({other})", 'az_p': az_other, 'profit': (1-(p_yes+az_other))*100
                            })
                        # Arb 2: Poly No + Azuro Mentioned
                        if p_no + az_mentioned < 0.95:
                            results.append({
                                'market': q, 'poly_out': f"No ({mentioned})", 'poly_p': p_no,
                                'az_out': f"Home ({mentioned})", 'az_p': az_mentioned, 'profit': (1-(p_no+az_mentioned))*100
                            })
    return results

def analyze_dex_whale(pair):
    """Analyze token for whale accumulation."""
    try:
        mcap = float(pair.get('fdv') or 0)
        vol24 = float(pair.get('volume', {}).get('h24', 0))
        liquidity = float(pair.get('liquidity', {}).get('usd', 0))
        if mcap < 10000 or liquidity < state["min_liquidity"]: return None

        ratio = vol24 / mcap
        buys = pair.get('txns', {}).get('h24', {}).get('buys', 0)
        sells = pair.get('txns', {}).get('h24', {}).get('sells', 0)
        buy_ratio = buys / (buys + sells) if (buys + sells) > 0 else 0

        if ratio > state["min_ratio"] and buy_ratio > 0.55:
            addr = pair.get('baseToken', {}).get('address')
            state["hot_tokens"][addr] = state["hot_tokens"].get(addr, 0) + 1
            return {
                'symbol': pair.get('baseToken', {}).get('symbol'),
                'mcap': mcap, 'vol': vol24, 'liq': liquidity,
                'ratio': ratio, 'buy_ratio': buy_ratio, 'heat': state["hot_tokens"][addr],
                'url': pair.get('url'), 'addr': addr, 'chain': pair.get('chainId')
            }
    except: pass
    return None

# ─── MONITORING LOOP ─────────────────────────────────────────────────────────

async def monitor_task(app):
    initialized_whales = set()
    while True:
        if state["running"]:
            # 1. Polymarket Whale Tracker
            if state["tracked_whales"]:
                for addr in state["tracked_whales"]:
                    trades = await fetch_whale_trades(addr)
                    is_new_whale = addr not in initialized_whales
                    if is_new_whale: initialized_whales.add(addr)

                    for t in trades:
                        tid = t.get('transactionHash') or f"{addr}_{t.get('timestamp')}"
                        if tid not in state["seen_trade_ids"]:
                            state["seen_trade_ids"].add(tid)
                            if not is_new_whale:
                                name = state["whale_names"].get(addr, addr[:8])
                                await send_tg(app, f"🐋 <b>Whale Trade ({name}):</b> {t.get('side')} {t.get('outcome')} on {t.get('title')}\n💰 ${float(t.get('size', 0)):,.0f}")

            # 2. Betting Arbitrage (every 5 mins)
            if time.time() % 300 < 60:
                arbs = await find_betting_arbitrage()
                for a in arbs:
                    aid = f"{a['market']}_{a['poly_out']}"
                    if aid not in state["seen_arb_ids"]:
                        state["seen_arb_ids"].add(aid)
                        await send_tg(app, f"⚖️ <b>Arbitraj ({a['profit']:.1f}%):</b> {a['market']}\n🅿️ Poly: {a['poly_out']} @ {a['poly_p']:.2f}\n🅰️ Azuro: {a['az_out']} @ {a['az_p']:.2f}")

            # 3. DEX Whale Monitor
            boosted = await fetch_dex_boosted()
            for b in boosted[:10]:
                addr = b.get('tokenAddress')
                if time.time() - state["seen_whales"].get(addr, 0) > 14400: # 4h cooldown
                    pairs = await fetch_token_pairs(addr)
                    if pairs:
                        main = sorted(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)), reverse=True)[0]
                        analysis = analyze_dex_whale(main)
                        if analysis:
                            state["seen_whales"][addr] = time.time()
                            stars = "🔥" * min(5, analysis['heat'])
                            await send_tg(app, f"🚀 <b>DEX Whale {stars}:</b> {analysis['symbol']} ({analysis['chain'].upper()})\n💎 Heat: {analysis['heat']}x\n📊 Vol/MCap: {analysis['ratio']:.2f}\n🌊 Liq: ${analysis['liq']:,.0f}\n<code>{addr}</code>")

            # Memory Pruning
            if len(state["seen_trade_ids"]) > 10000: state["seen_trade_ids"] = set(list(state["seen_trade_ids"])[-5000:])
            if len(state["seen_arb_ids"]) > 2000: state["seen_arb_ids"] = set(list(state["seen_arb_ids"])[-1000:])

        await asyncio.sleep(60)

async def send_tg(app, text):
    try: await app.bot.send_message(chat_id=CHAT_ID, text=text, parse_mode="HTML", disable_web_page_preview=True)
    except: pass

# ─── UI ─────────────────────────────────────────────────────────────────────

def main_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 Whales (Poly)", callback_data="top_poly"), InlineKeyboardButton("⚖️ Arbitrage", callback_data="check_arb")],
        [InlineKeyboardButton("🔥 DEX Heat", callback_data="dex_heat"), InlineKeyboardButton("🔍 CA Scan", callback_data="ca_scan")],
        [InlineKeyboardButton("⚙️ Settings", callback_data="settings")]
    ])

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = "💎 <b>Professional Crypto Suite</b>\n\nWhale tracking, Cross-platform arbitrage, and On-chain Alpha."
    if update.message: await update.message.reply_text(text, parse_mode="HTML", reply_markup=main_kb())
    else: await update.callback_query.edit_message_text(text, parse_mode="HTML", reply_markup=main_kb())

async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    if q.data == "top_poly":
        whales = await fetch_top_whales(5)
        lines = ["<b>🏆 Top Traders:</b>\n"]
        for w in whales: lines.append(f"• {w.get('userName') or w['proxyWallet'][:8]}: ${float(w['pnl']):,.0f} PNL")
        await q.edit_message_text("\n".join(lines), parse_mode="HTML", reply_markup=main_kb())
    elif q.data == "ca_scan":
        await q.edit_message_text("📝 Token manzilini (CA) yuboring:")
        state["waiting_for_ca"] = True
    elif q.data == "settings":
        await q.edit_message_text(f"⚙️ <b>Settings:</b>\n\nMin Ratio: {state['min_ratio']}\nMin Liq: ${state['min_liquidity']:,}", parse_mode="HTML", reply_markup=main_kb())

async def msg_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if state["waiting_for_ca"] and update.message.text:
        ca = update.message.text.strip()
        state["waiting_for_ca"] = False
        pairs = await fetch_token_pairs(ca)
        if not pairs: await update.message.reply_text("❌ Data not found.")
        else:
            main = sorted(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)), reverse=True)[0]
            await update.message.reply_text(f"🔍 <b>Analysis:</b> {main.get('baseToken',{}).get('symbol')}\nMCap: ${float(main.get('fdv',0)):,.0f}\nVol: ${float(main.get('volume',{}).get('h24',0)):,.0f}\nLiq: ${float(main.get('liquidity',{}).get('usd',0)):,.0f}", parse_mode="HTML")

# ─── BOOTSTRAP ──────────────────────────────────────────────────────────────

async def post_init(app):
    state["client"] = httpx.AsyncClient()
    # Auto-subscribe to top 3 traders
    whales = await fetch_top_whales(limit=3)
    for w in whales:
        addr = w['proxyWallet']
        state["tracked_whales"].append(addr)
        state["whale_names"][addr] = w.get('userName') or addr[:8]
    asyncio.create_task(monitor_task(app))

def main():
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, msg_handler))
    app.run_polling()

if __name__ == "__main__":
    main()
