"""
DEXScreener Whale Monitor - Professional Crypto Tracking Bot
"""

import asyncio
import logging
import httpx
import os
import json
import time
import html
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters
)

logging.basicConfig(level=logging.INFO)

# ─── CONFIG ─────────────────────────────────────────────────────────────────
# Professional tip: Use environment variables for sensitive data.
BOT_TOKEN  = os.getenv("BOT_TOKEN", "8489499074:AAEbc1ZNVEBprLhPhnoiY0orE4oRmno9UYM")
CHAT_ID    = int(os.getenv("CHAT_ID", "798283148"))
# ────────────────────────────────────────────────────────────────────────────

state = {
    "client": None,
    "running": True,
    "seen_pairs": set(),
    "waiting_for_ca": False,
}

# ─── DEXSCREENER HELPERS ───────────────────────────────────────────────────

async def fetch_latest_boosted():
    """DEXScreener'dan oxirgi boosted (reklama qilingan/trenddagi) tokenlarni olish."""
    url = "https://api.dexscreener.com/token-boosts/latest/v1"
    try:
        r = await state["client"].get(url, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logging.warning(f"DEXScreener boosted fetch error: {e}")
        return []

async def fetch_token_pairs(token_address):
    """Token manzili orqali barcha juftliklarni olish."""
    url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
    try:
        r = await state["client"].get(url, timeout=15)
        r.raise_for_status()
        return r.json().get('pairs', [])
    except Exception as e:
        logging.warning(f"DEXScreener pair fetch error: {e}")
        return []

# ─── WHALE LOGIC ────────────────────────────────────────────────────────────

def analyze_whale_activity(pair):
    """
    Token juftligini whale aktivligi bo'yicha tahlil qilish.
    Whale aktivligi belgilari:
    1. Yuqori hajm (Volume) nisbatan past market cap-ga.
    2. Buy/Sell nisbati (Bulls pressure).
    3. Liquidity/MCap nisbati.
    """
    try:
        mcap = float(pair.get('fdv') or 0)
        vol24 = float(pair.get('volume', {}).get('h24', 0))
        liquidity = float(pair.get('liquidity', {}).get('usd', 0))

        if mcap == 0: return None

        # Whale ko'rsatkichi: 24s hajm / market cap > 0.5 (juda faol)
        vol_mcap_ratio = vol24 / mcap

        buys = pair.get('txns', {}).get('h24', {}).get('buys', 0)
        sells = pair.get('txns', {}).get('h24', {}).get('sells', 0)
        total_txns = buys + sells

        buy_ratio = buys / total_txns if total_txns > 0 else 0

        if vol_mcap_ratio > 0.3 and buy_ratio > 0.55 and liquidity > 10000:
            return {
                'symbol': pair.get('baseToken', {}).get('symbol'),
                'name': pair.get('baseToken', {}).get('name'),
                'mcap': mcap,
                'vol24': vol24,
                'liquidity': liquidity,
                'ratio': vol_mcap_ratio,
                'buy_ratio': buy_ratio,
                'url': pair.get('url'),
                'address': pair.get('baseToken', {}).get('address'),
                'chainId': pair.get('chainId')
            }
    except:
        pass
    return None

# ─── MONITORING ─────────────────────────────────────────────────────────────

async def monitor_dex(app):
    while True:
        if state["running"]:
            boosted = await fetch_latest_boosted()
            for token in boosted:
                addr = token.get('tokenAddress')
                if addr in state["seen_pairs"]: continue

                pairs = await fetch_token_pairs(addr)
                if not pairs: continue

                # Eng ko'p likvidlikka ega juftlikni tanlaymiz
                main_pair = sorted(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)), reverse=True)[0]

                analysis = analyze_whale_activity(main_pair)
                if analysis:
                    msg = build_whale_alert(analysis)
                    await send_tg(app, msg)

                state["seen_pairs"].add(addr)
                # Xotirani tejash
                if len(state["seen_pairs"]) > 1000:
                    state["seen_pairs"] = set(list(state["seen_pairs"])[-500:])

        await asyncio.sleep(60)

def build_whale_alert(data):
    return (
        f"<b>🐋 WHALE ALERT: {data['symbol']} ({data['chainId'].upper()})</b>\n\n"
        f"💎 Token: {data['name']}\n"
        f"📊 Market Cap: <b>${data['mcap']:,.0f}</b>\n"
        f"💰 24s Hajm: <b>${data['vol24']:,.0f}</b>\n"
        f"🌊 Liquidity: <b>${data['liquidity']:,.0f}</b>\n\n"
        f"🔥 Vol/MCap Ratio: <b>{data['ratio']:.2f}</b>\n"
        f"📈 Buy Pressure: <b>{data['buy_ratio']*100:.1f}%</b>\n\n"
        f"<code>{data['address']}</code>\n\n"
        f"🔗 <a href=\"{data['url']}\">DEXScreener'da ko'rish</a>"
    )

async def send_tg(app, text):
    try:
        await app.bot.send_message(chat_id=CHAT_ID, text=text, parse_mode="HTML", disable_web_page_preview=True)
    except Exception as e:
        logging.warning(f"TG send error: {e}")

# ─── UI ─────────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 Hozirgi Whale Trendlar", callback_data="check_now")],
        [InlineKeyboardButton("🔍 Token Whale Scan", callback_data="scan_prompt")],
        [InlineKeyboardButton("📚 Whale Strategiyasi", callback_data="strategy")],
    ])
    text = (
        "<b>🚀 DEXScreener Professional Whale Monitor</b>\n\n"
        "Ushbu tizim real vaqt rejimida on-chain ma'lumotlarni tahlil qilib, whalelar "
        "va 'smart money' oqimini aniqlaydi.\n\n"
        "Siz token manzilini yuborib, uning whale ko'rsatkichlarini tekshirishingiz mumkin."
    )
    if update.message:
        await update.message.reply_text(text, parse_mode="HTML", reply_markup=kb)
    else:
        await update.callback_query.edit_message_text(text, parse_mode="HTML", reply_markup=kb)

async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()

    if q.data == "check_now":
        await q.edit_message_text("🔍 Whale aktivligi tahlil qilinmoqda (Top 10 Boosted)...")
        boosted = await fetch_latest_boosted()
        found = 0
        for token in boosted[:10]:
            pairs = await fetch_token_pairs(token.get('tokenAddress'))
            if pairs:
                main_pair = sorted(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)), reverse=True)[0]
                analysis = analyze_whale_activity(main_pair)
                if analysis:
                    await send_tg(ctx.application, build_whale_alert(analysis))
                    found += 1
        await q.edit_message_text(f"✅ Tekshiruv yakunlandi. {found} ta whale aktivligi topildi.",
                                  reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("◀️ Orqaga", callback_data="back")]]))

    elif q.data == "scan_prompt":
        await q.edit_message_text("📝 Menga tekshirmoqchi bo'lgan token manzilingizni (CA) yuboring:")
        state["waiting_for_ca"] = True

    elif q.data == "strategy":
        text = (
            "<b>💡 Whale Tracker Strategiyasi:</b>\n\n"
            "1. <b>Vol/MCap Ratio</b>: Agar hajm market cap-ga nisbatan yuqori bo'lsa (0.3+), bu yirik o'yinchilar kirayotganini bildiradi.\n"
            "2. <b>Buy Pressure</b>: Sotib olishlar soni sotishlardan sezilarli ko'p bo'lishi kerak.\n"
            "3. <b>Boosted Tokens</b>: DEXScreener'da pullik reklama qilingan tokenlar ko'pincha whalelar nishonida bo'ladi."
        )
        await q.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("◀️ Orqaga", callback_data="back")]]))

    elif q.data == "back":
        state["waiting_for_ca"] = False
        await cmd_start(update, ctx)

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if state.get("waiting_for_ca") and update.message.text:
        ca = update.message.text.strip()
        state["waiting_for_ca"] = False
        await update.message.reply_text(f"🔍 Token tahlil qilinmoqda: <code>{ca}</code>", parse_mode="HTML")

        pairs = await fetch_token_pairs(ca)
        if not pairs:
            await update.message.reply_text("❌ Token topilmadi yoki DEXScreener ma'lumoti yo'q.")
            return

        main_pair = sorted(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)), reverse=True)[0]
        analysis = analyze_whale_activity(main_pair)

        if analysis:
            await update.message.reply_text(build_whale_alert(analysis), parse_mode="HTML")
        else:
            await update.message.reply_text(
                "ℹ️ Bu tokenda whale aktivligi (Vol/MCap > 0.3) aniqlanmadi, lekin ma'lumotlar quyidagicha:\n\n"
                f"Market Cap: ${float(main_pair.get('fdv') or 0):,.0f}\n"
                f"24s Hajm: ${float(main_pair.get('volume', {}).get('h24', 0)):,.0f}\n"
                f"Likvidlik: ${float(main_pair.get('liquidity', {}).get('usd', 0)):,.0f}"
            )

async def post_init(app):
    state["client"] = httpx.AsyncClient()
    asyncio.create_task(monitor_dex(app))

def main():
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()

if __name__ == "__main__":
    main()
