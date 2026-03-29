"""
DEXScreener Whale Monitor Bot - Production Ready
Barcha xatolar tuzatilgan va yaxshilangan versiya.
"""

import asyncio
import logging
import httpx
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    ContextTypes, MessageHandler, filters
)

# ─── LOGGING ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger(__name__)

# ─── CONFIG ─────────────────────────────────────────────────────────────────
# MUHIM: Token va CHAT_ID ni faqat environment variable orqali bering!
# Terminal: export BOT_TOKEN="tokeningiz"  &&  export CHAT_ID="chat_id"
BOT_TOKEN = os.environ["BOT_TOKEN"]   # .get o'rniga [] — agar yo'q bo'lsa darhol xato beradi
CHAT_ID   = int(os.environ["CHAT_ID"])
# ─────────────────────────────────────────────────────────────────────────────

# Global holat
state: dict = {
    "client": None,
    "running": True,
    "seen_pairs": set(),
    "alert_count": 0,
}

# ─── KEYBOARD BUILDER ────────────────────────────────────────────────────────

def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 Hozir tekshirish",     callback_data="check_now")],
        [InlineKeyboardButton("⏸ To'xtatish / ▶️ Davom", callback_data="toggle")],
        [InlineKeyboardButton("📚 Strategiya",           callback_data="strategy")],
        [InlineKeyboardButton("📈 Statistika",           callback_data="stats")],
    ])

def back_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("◀️ Orqaga", callback_data="main_menu")]])

# ─── DEXSCREENER API ─────────────────────────────────────────────────────────

async def fetch_latest_boosted() -> list:
    """DEXScreener'dan oxirgi boosted tokenlarni olish."""
    url = "https://api.dexscreener.com/token-boosts/latest/v1"
    try:
        r = await state["client"].get(url, timeout=15)
        r.raise_for_status()
        data = r.json()
        # API list yoki dict qaytarishi mumkin
        return data if isinstance(data, list) else data.get("tokenBoosts", [])
    except httpx.HTTPStatusError as e:
        log.warning(f"DEXScreener boosted HTTP xato: {e.response.status_code}")
    except Exception as e:
        log.warning(f"DEXScreener boosted fetch xato: {e}")
    return []

async def fetch_token_pairs(token_address: str) -> list:
    """Token manzili orqali juftliklarni olish."""
    url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
    try:
        r = await state["client"].get(url, timeout=15)
        r.raise_for_status()
        return r.json().get("pairs") or []
    except httpx.HTTPStatusError as e:
        log.warning(f"DEXScreener pairs HTTP xato: {e.response.status_code}")
    except Exception as e:
        log.warning(f"DEXScreener pairs fetch xato: {e}")
    return []

# ─── WHALE TAHLILI ───────────────────────────────────────────────────────────

def analyze_whale_activity(pair: dict) -> dict | None:
    """
    Whale aktivligini aniqlash.
    Mezonlar:
      - Vol/MCap nisbati > 0.3  (yirik o'yinchilar harakati)
      - Buy bosimi    > 55%     (sotib olishlar ustunligi)
      - Likvidlik     > $10,000 (rug pull xavfidan himoya)
    """
    try:
        mcap      = float(pair.get("fdv") or 0)
        vol24     = float((pair.get("volume") or {}).get("h24") or 0)
        liquidity = float((pair.get("liquidity") or {}).get("usd") or 0)
        price_chg = float((pair.get("priceChange") or {}).get("h24") or 0)

        if mcap < 10_000 or liquidity < 10_000:
            return None

        vol_mcap_ratio = vol24 / mcap
        txns = (pair.get("txns") or {}).get("h24") or {}
        buys  = int(txns.get("buys") or 0)
        sells = int(txns.get("sells") or 0)
        total = buys + sells
        buy_ratio = buys / total if total > 0 else 0

        if vol_mcap_ratio > 0.3 and buy_ratio > 0.55:
            return {
                "symbol":    (pair.get("baseToken") or {}).get("symbol", "???"),
                "name":      (pair.get("baseToken") or {}).get("name", "Noma'lum"),
                "mcap":      mcap,
                "vol24":     vol24,
                "liquidity": liquidity,
                "ratio":     vol_mcap_ratio,
                "buy_ratio": buy_ratio,
                "price_chg": price_chg,
                "url":       pair.get("url", ""),
                "address":   (pair.get("baseToken") or {}).get("address", ""),
                "chainId":   pair.get("chainId", "").upper(),
                "dex":       pair.get("dexId", "").capitalize(),
            }
    except (TypeError, ValueError, ZeroDivisionError) as e:
        log.debug(f"analyze_whale_activity xato: {e}")
    return None

# ─── XABAR FORMATI ───────────────────────────────────────────────────────────

def build_whale_alert(d: dict) -> str:
    price_arrow = "📈" if d["price_chg"] >= 0 else "📉"
    return (
        f"<b>🐋 WHALE ALERT — {d['symbol']} ({d['chainId']})</b>\n\n"
        f"💎 <b>Token:</b> {d['name']}\n"
        f"🏦 <b>DEX:</b> {d['dex']}\n"
        f"📊 <b>Market Cap:</b> ${d['mcap']:>12,.0f}\n"
        f"💰 <b>24s Hajm:</b>   ${d['vol24']:>12,.0f}\n"
        f"🌊 <b>Likvidlik:</b>  ${d['liquidity']:>12,.0f}\n\n"
        f"🔥 <b>Vol/MCap:</b>    {d['ratio']:.2f}\n"
        f"📈 <b>Buy Bosimi:</b>  {d['buy_ratio']*100:.1f}%\n"
        f"{price_arrow} <b>24s O'zgarish:</b> {d['price_chg']:+.2f}%\n\n"
        f"<code>{d['address']}</code>\n\n"
        f"🔗 <a href=\"{d['url']}\">DEXScreener'da ko'rish</a>"
    )

# ─── TELEGRAM YORDAMCHI ──────────────────────────────────────────────────────

async def send_tg(app: Application, text: str) -> None:
    try:
        await app.bot.send_message(
            chat_id=CHAT_ID,
            text=text,
            parse_mode="HTML",
            disable_web_page_preview=True
        )
        state["alert_count"] += 1
    except Exception as e:
        log.warning(f"TG yuborish xatosi: {e}")

# ─── MONITORING LOOP ─────────────────────────────────────────────────────────

async def monitor_dex(app: Application) -> None:
    """Asosiy monitoring sikli — har 60 soniyada yangilanadi."""
    log.info("Whale monitor ishga tushdi ✅")
    while True:
        try:
            if state["running"]:
                boosted = await fetch_latest_boosted()
                for token in boosted:
                    addr = token.get("tokenAddress") or token.get("address")
                    if not addr or addr in state["seen_pairs"]:
                        continue

                    pairs = await fetch_token_pairs(addr)
                    if pairs:
                        # Eng ko'p likvidli juftlikni tanlaymiz
                        main_pair = max(
                            pairs,
                            key=lambda x: float((x.get("liquidity") or {}).get("usd") or 0)
                        )
                        analysis = analyze_whale_activity(main_pair)
                        if analysis:
                            await send_tg(app, build_whale_alert(analysis))
                            log.info(f"Alert yuborildi: {analysis['symbol']} ({analysis['chainId']})")

                    state["seen_pairs"].add(addr)

                # Xotirani tozalash
                if len(state["seen_pairs"]) > 2000:
                    state["seen_pairs"] = set(list(state["seen_pairs"])[-1000:])
                    log.info("Seen pairs xotira tozalandi")

        except Exception as e:
            log.error(f"Monitor xatosi: {e}", exc_info=True)

        await asyncio.sleep(60)

# ─── COMMAND HANDLERS ────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    status = "✅ Faol" if state["running"] else "⏸ To'xtatilgan"
    await update.message.reply_text(
        f"<b>🚀 DEXScreener Whale Monitor</b>\n\n"
        f"DEX bozorlarida 'smart money' harakatlarini real vaqtda kuzatadi.\n\n"
        f"Holat: {status} | Alertlar: {state['alert_count']}",
        parse_mode="HTML",
        reply_markup=main_menu_kb()
    )

async def cmd_stop(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    state["running"] = False
    await update.message.reply_text("⏸ Monitor to'xtatildi.")

async def cmd_resume(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    state["running"] = True
    await update.message.reply_text("▶️ Monitor davom ettirildi.")

# ─── CALLBACK HANDLER ────────────────────────────────────────────────────────

async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    await q.answer()
    data = q.data

    # ── Bosh menyu ──
    if data == "main_menu":
        status = "✅ Faol" if state["running"] else "⏸ To'xtatilgan"
        await q.edit_message_text(
            f"<b>🚀 DEXScreener Whale Monitor</b>\n\n"
            f"Holat: {status} | Alertlar: {state['alert_count']}",
            parse_mode="HTML",
            reply_markup=main_menu_kb()
        )

    # ── Qo'lda tekshirish ──
    elif data == "check_now":
        await q.edit_message_text("🔍 Whale aktivligi tahlil qilinmoqda...")
        boosted = await fetch_latest_boosted()
        found = 0
        errors = 0
        for token in boosted[:15]:
            addr = token.get("tokenAddress") or token.get("address")
            if not addr:
                continue
            try:
                pairs = await fetch_token_pairs(addr)
                if pairs:
                    main_pair = max(
                        pairs,
                        key=lambda x: float((x.get("liquidity") or {}).get("usd") or 0)
                    )
                    analysis = analyze_whale_activity(main_pair)
                    if analysis:
                        await send_tg(ctx.application, build_whale_alert(analysis))
                        found += 1
            except Exception as e:
                errors += 1
                log.warning(f"check_now xatosi: {e}")

        msg = f"✅ Tekshiruv yakunlandi.\n\n🐋 {found} ta whale aktivligi topildi."
        if errors:
            msg += f"\n⚠️ {errors} ta token tekshirilmadi."
        await q.edit_message_text(msg, reply_markup=back_kb())

    # ── Monitor on/off ──
    elif data == "toggle":
        state["running"] = not state["running"]
        status = "▶️ Monitor davom ettirildi." if state["running"] else "⏸ Monitor to'xtatildi."
        await q.edit_message_text(status, reply_markup=back_kb())

    # ── Strategiya ──
    elif data == "strategy":
        text = (
            "<b>💡 Whale Tracker Strategiyasi</b>\n\n"
            "<b>1. Vol/MCap Ratio (≥ 0.3)</b>\n"
            "Hajm market cap-dan katta bo'lsa, yirik o'yinchilar faol.\n\n"
            "<b>2. Buy Bosimi (≥ 55%)</b>\n"
            "Sotib olishlar soni sotishlardan ko'p bo'lsa — bullish signal.\n\n"
            "<b>3. Likvidlik (≥ $10,000)</b>\n"
            "Kichik likvidlik = rug pull xavfi. Shu chegara ostidagilar o'tkazib yuboriladi.\n\n"
            "<b>4. Boosted tokenlar</b>\n"
            "DEXScreener'da reklama qilingan tokenlar ko'pincha whale nishonida.\n\n"
            "⚠️ <i>Bu tahlil moliyaviy maslahat emas.</i>"
        )
        await q.edit_message_text(text, parse_mode="HTML", reply_markup=back_kb())

    # ── Statistika ──
    elif data == "stats":
        text = (
            f"<b>📈 Bot Statistikasi</b>\n\n"
            f"🔔 Jami alertlar: <b>{state['alert_count']}</b>\n"
            f"👁 Ko'rilgan tokenlar: <b>{len(state['seen_pairs'])}</b>\n"
            f"🟢 Holat: <b>{'Faol' if state['running'] else 'To\\'xtatilgan'}</b>"
        )
        await q.edit_message_text(text, parse_mode="HTML", reply_markup=back_kb())

    else:
        await q.edit_message_text("❓ Noma'lum buyruq.", reply_markup=back_kb())

# ─── NOMAʼLUM XABAR ──────────────────────────────────────────────────────────

async def unknown_msg(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "ℹ️ /start bilan boshqaruv menyusini oching.",
        reply_markup=main_menu_kb()
    )

# ─── INIT ────────────────────────────────────────────────────────────────────

async def post_init(app: Application) -> None:
    """Ilova ishga tushganda chaqiriladi."""
    state["client"] = httpx.AsyncClient(
        headers={"User-Agent": "WhaleMonitorBot/1.0"},
        follow_redirects=True,
    )
    # Monitor vazifasini ishga tushirish
    asyncio.create_task(monitor_dex(app))
    log.info("Bot tayyor ✅")

async def post_shutdown(app: Application) -> None:
    """Ilova to'xtaganda chaqiriladi."""
    if state["client"]:
        await state["client"].aclose()
    log.info("Bot to'xtatildi.")

# ─── MAIN ────────────────────────────────────────────────────────────────────

def main() -> None:
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    # Handlerlar
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("stop",   cmd_stop))
    app.add_handler(CommandHandler("resume", cmd_resume))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, unknown_msg))

    log.info("Polling boshlandi...")
    app.run_polling(allowed_updates=["message", "callback_query"])

if __name__ == "__main__":
    main()
