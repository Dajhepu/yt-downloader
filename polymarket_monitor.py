"""
Polymarket Monitor - Whale Tracker & Monitoring Bot
"""

import asyncio
import logging
import httpx
import os
import json
import time
import html
from datetime import datetime, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes
)

logging.basicConfig(level=logging.INFO)

# ─── CONFIG ─────────────────────────────────────────────────────────────────
BOT_TOKEN  = os.getenv("BOT_TOKEN", "7256069971:AAHNTBZZipJI9mF1K1lRyNiQb2n7qEEDEDY")
CHAT_ID    = int(os.getenv("CHAT_ID", "798283148"))
# ────────────────────────────────────────────────────────────────────────────

state = {
    "client": None,
    "running": False,
    "interval": 60,
    "tracked_whales": [], # List of addresses
    "seen_trade_ids": set(),
    "whale_names": {}, # address -> name
}

# ─── WHALE HELPERS ──────────────────────────────────────────────────────────

async def fetch_top_whales(limit=10):
    """Polymarket leaderboard'dan eng yaxshi traderlarni olish."""
    url = "https://data-api.polymarket.com/v1/leaderboard"
    params = {
        "category": "OVERALL",
        "timePeriod": "WEEK",
        "orderBy": "PNL",
        "limit": limit
    }
    try:
        r = await state["client"].get(url, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logging.warning(f"Whale fetch error: {e}")
        return []

async def fetch_whale_trades(address, limit=5):
    """Ma'lum bir hamyonning oxirgi savdolarini olish."""
    url = f"https://data-api.polymarket.com/v1/trades"
    params = {
        "userAddress": address,
        "limit": limit
    }
    try:
        r = await state["client"].get(url, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logging.warning(f"Whale trades fetch error for {address}: {e}")
        return []

# ─── MONITORING ─────────────────────────────────────────────────────────────

async def monitor_whales(app):
    while True:
        if state["running"] and state["tracked_whales"]:
            for address in state["tracked_whales"]:
                trades = await fetch_whale_trades(address)
                name = state["whale_names"].get(address, address[:8])

                new_trades = []
                for t in trades:
                    trade_id = t.get('id') or f"{address}_{t.get('timestamp')}_{t.get('payout')}"
                    if trade_id not in state["seen_trade_ids"]:
                        new_trades.append(t)
                        state["seen_trade_ids"].add(trade_id)

                # Prevent memory leak by keeping only the last 10,000 trade IDs
                if len(state["seen_trade_ids"]) > 10000:
                    state["seen_trade_ids"] = set(list(state["seen_trade_ids"])[-5000:])

                if new_trades:
                    msg = build_whale_trade_message(name, address, new_trades)
                    await send_tg(app, msg)

        await asyncio.sleep(state["interval"])

def build_whale_trade_message(name, address, trades):
    lines = [f"<b>🐋 Whale Signal: {name}</b>", f"<code>{address}</code>", ""]
    for t in trades:
        side = "🟢 BUY" if t.get('side') == 'BUY' else "🔴 SELL"
        amount = float(t.get('size', 0))
        price = float(t.get('price', 0))
        outcome = t.get('outcome', 'Noma\'lum')
        market = html.escape(t.get('title', 'Market'))

        lines.append(
            f"{side} <b>{outcome}</b> @ {price:.2f}\n"
            f"💰 Hajm: ${amount:,.2f}\n"
            f"📊 Market: {market}\n"
        )
    return "\n".join(lines)

async def send_tg(app, text):
    try:
        await app.bot.send_message(
            chat_id=CHAT_ID,
            text=text,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
    except Exception as e:
        logging.warning(f"TG send error: {e}")

# ─── UI ─────────────────────────────────────────────────────────────────────

def main_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("▶️ Monitor Yoqish", callback_data="start_whales"),
            InlineKeyboardButton("⏹ To'xtatish", callback_data="stop_whales"),
        ],
        [
            InlineKeyboardButton("🏆 Top Whalelar", callback_data="top_whales"),
            InlineKeyboardButton("📋 Ro'yxatim", callback_data="my_whales"),
        ],
    ])

async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    data = q.data
    await q.answer()

    if data == "start_whales":
        state["running"] = True
        await q.edit_message_text("✅ Whale monitoring yoqildi!", reply_markup=main_keyboard())

    elif data == "stop_whales":
        state["running"] = False
        await q.edit_message_text("⏹ Whale monitoring to'xtatildi.", reply_markup=main_keyboard())

    elif data == "top_whales":
        whales = await fetch_top_whales(10)
        lines = ["<b>🏆 Haftalik Top Traderlar:</b>\n"]
        kb = []
        for w in whales:
            addr = w['proxyWallet']
            pnl = float(w['pnl'])
            name = w.get('userName') or addr[:8]
            lines.append(f"• {name}: <b>${pnl:,.0f} PNL</b>")
            kb.append([InlineKeyboardButton(f"➕ {name} kuzatish", callback_data=f"track_{addr}")])

        kb.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
        await q.edit_message_text("\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb))

    elif data.startswith("track_"):
        addr = data.split("_")[1]
        if addr not in state["tracked_whales"]:
            state["tracked_whales"].append(addr)
            await q.edit_message_text(f"✅ Hamyon qo'shildi: {addr}", reply_markup=main_keyboard())
        else:
            await q.edit_message_text(f"ℹ️ Bu hamyon allaqachon ro'yxatda.", reply_markup=main_keyboard())

    elif data == "back":
        await q.edit_message_text("📋 Boshqaruv paneli:", reply_markup=main_keyboard())

async def post_init(app):
    state["client"] = httpx.AsyncClient()
    asyncio.create_task(monitor_whales(app))

def main():
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CallbackQueryHandler(button_handler))
    app.run_polling()

if __name__ == "__main__":
    main()
