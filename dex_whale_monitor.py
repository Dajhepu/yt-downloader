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
# Use environment variables for sensitive data.
BOT_TOKEN  = os.getenv("BOT_TOKEN")
CHAT_ID    = os.getenv("CHAT_ID")
if CHAT_ID: CHAT_ID = int(CHAT_ID)
# ────────────────────────────────────────────────────────────────────────────

state = {
    "client": None,
    "running": True,
    "seen_whales": {}, # addr -> last_alert_time
    "waiting_for_ca": False,
    "min_ratio": 0.3,
    "min_buy_pressure": 0.55,
    "min_liquidity": 10000,
    "scan_interval": 60,
    "waiting_for_setting": None, # 'ratio', 'pressure', 'liquidity', 'interval'
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

        # Social links check (Verification of token quality)
        has_socials = len(pair.get('info', {}).get('socials', [])) > 0

        if vol_mcap_ratio > state["min_ratio"] and buy_ratio > state["min_buy_pressure"] and liquidity > state["min_liquidity"]:
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
                'chainId': pair.get('chainId'),
                'has_socials': has_socials
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
                last_alert = state["seen_whales"].get(addr, 0)

                # Har 4 soatda faqat bir marta bir xil token uchun ogohlantirish
                if time.time() - last_alert < 14400: continue

                pairs = await fetch_token_pairs(addr)
                if not pairs: continue

                # Eng ko'p likvidlikka ega juftlikni tanlaymiz
                main_pair = sorted(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)), reverse=True)[0]

                analysis = analyze_whale_activity(main_pair)
                if analysis:
                    msg = build_whale_alert(analysis)
                    await send_tg(app, msg)
                    state["seen_whales"][addr] = time.time()

                # Xotirani tejash (1 oydan o'tganlarni o'chirish)
                if len(state["seen_whales"]) > 2000:
                    state["seen_whales"] = {k: v for k, v in list(state["seen_whales"].items())[-1000:]}

        await asyncio.sleep(state["scan_interval"])

def build_whale_alert(data):
    social_tag = "✅ Socials verified" if data['has_socials'] else "⚠️ No social info"
    return (
        f"<b>🐋 WHALE ALERT: {data['symbol']} ({data['chainId'].upper()})</b>\n\n"
        f"💎 Token: {data['name']} [{social_tag}]\n"
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
        [InlineKeyboardButton("⚙️ Sozlamalar", callback_data="settings")],
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

def settings_keyboard():
    status = "🟢 Yoqilgan" if state["running"] else "🔴 O'chirilgan"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(f"Monitor: {status}", callback_data="toggle_mon")],
        [InlineKeyboardButton(f"Ratio: {state['min_ratio']}", callback_data="set_ratio"),
         InlineKeyboardButton(f"Liquidity: {state['min_liquidity']}", callback_data="set_liq")],
        [InlineKeyboardButton(f"Interval: {state['scan_interval']}s", callback_data="set_int")],
        [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]
    ])

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

    elif q.data == "settings":
        await q.edit_message_text("⚙️ <b>Bot Sozlamalari:</b>\n\nWhale aniqlash parametrlarini o'zgartiring:",
                                  parse_mode="HTML", reply_markup=settings_keyboard())

    elif q.data == "toggle_mon":
        state["running"] = not state["running"]
        await q.edit_message_reply_markup(reply_markup=settings_keyboard())

    elif q.data == "set_ratio":
        await q.edit_message_text("🔢 Yangi <b>Vol/MCap Ratio</b> ni yuboring (masalan: 0.5):", parse_mode="HTML")
        state["waiting_for_setting"] = "ratio"

    elif q.data == "set_liq":
        await q.edit_message_text("💰 Minimal <b>Liquidity</b> ni yuboring (USD, masalan: 50000):", parse_mode="HTML")
        state["waiting_for_setting"] = "liquidity"

    elif q.data == "set_int":
        await q.edit_message_text("⏱ Skanerlash <b>Interval</b> ini yuboring (soniya, masalan: 30):", parse_mode="HTML")
        state["waiting_for_setting"] = "interval"

    elif q.data == "strategy":
        text = (
            "<b>💡 Whale Tracker & Copy Trading Strategiyasi:</b>\n\n"
            "1. <b>Vol/MCap Ratio</b>: Agar hajm market cap-ga nisbatan yuqori bo'lsa (0.3+), bu yirik o'yinchilar kirayotganini bildiradi.\n"
            "2. <b>Buy Pressure</b>: Sotib olishlar soni sotishlardan sezilarli ko'p bo'lishi kerak.\n"
            "3. <b>Social Check</b>: Whalelar kirayotgan tokenning Twitter/Telegrami faolligini tekshiring.\n\n"
            "<b>⚠️ Professional Maslahat:</b>\n"
            "Whale savdosini takrorlashdan oldin (Copy Trading), hamyonning oldingi savdolari "
            "foydali bo'lganini (Win Rate) tekshiring. Whalelar ham ba'zida adashishi yoki "
            "'exit liquidity' sifatida foydalanishi mumkin."
        )
        await q.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("◀️ Orqaga", callback_data="back")]]))

    elif q.data == "back":
        state["waiting_for_ca"] = False
        state["waiting_for_setting"] = None
        await cmd_start(update, ctx)

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()

    if state.get("waiting_for_setting") and text:
        setting = state["waiting_for_setting"]
        state["waiting_for_setting"] = None
        try:
            val = float(text)
            if setting == "ratio": state["min_ratio"] = val
            elif setting == "liquidity": state["min_liquidity"] = val
            elif setting == "interval": state["scan_interval"] = max(10, int(val))

            await update.message.reply_text(f"✅ Sozlama yangilandi: <b>{setting}</b> = {val}",
                                            parse_mode="HTML", reply_markup=settings_keyboard())
        except ValueError:
            await update.message.reply_text("❌ Xato: Faqat raqam yuboring.")
        return

    if state.get("waiting_for_ca") and text:
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
