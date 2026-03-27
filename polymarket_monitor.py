"""
Polymarket Monitor - To'liq Telegram bot boshqaruvi
"""

import asyncio
import logging
import requests
import json
import time
import threading
import os
import re
import google.generativeai as genai
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes
)

logging.basicConfig(level=logging.WARNING)
load_dotenv()

# ─── CONFIG ─────────────────────────────────────────────────────────────────
BOT_TOKEN  = os.getenv("BOT_TOKEN", "7256069971:AAHNTBZZipJI9mF1K1lRyNiQb2n7qEEDEDY")
CHAT_ID    = int(os.getenv("CHAT_ID", 798283148))
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
# ────────────────────────────────────────────────────────────────────────────

# Shared state
state = {
    "running": False,
    "interval": 900,  # 15 minutes default
    "limit": 500,
    "yes_min": 0.30,
    "yes_max": 0.40,
    "no_min":  0.55,
    "no_max":  0.70,
    "time_filter": "all",
    "seen_urls": set(),
    "last_update": None,
    "last_count": 0,
}

# ─── GEMINI HELPER ──────────────────────────────────────────────────────────

async def get_gemini_probability(question, description, end_date):
    if not GEMINI_KEY:
        return None, "Gemini API key is not set."

    prompt = (
        f"Market: {question}\n"
        f"Description: {description}\n"
        f"End Date: {end_date}\n\n"
        "Bu Polymarket bozori bo'yicha voqea sodir bo'lish haqiqiy ehtimoli (true probability) nechada? "
        "0% dan 100% gacha aniq raqam bilan javob ber. "
        "Faqat raqam emas, qisqa tushuntirish ham qo'sh."
    )

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text

        # Extract number using regex
        match = re.search(r"(\d+)%", text)
        if match:
            prob = int(match.group(1))
            return prob, text

        # Try finding a decimal or just a number if % is missing but clearly intended
        match = re.search(r"(\d+(\.\d+)?)", text)
        if match:
            prob = float(match.group(1))
            if 0 <= prob <= 100:
                return prob, text

        return None, text
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        return None, str(e)

# ─── POLYMARKET HELPERS ──────────────────────────────────────────────────────

def parse_json_field(field):
    if isinstance(field, str):
        try:
            return json.loads(field)
        except json.JSONDecodeError:
            return None
    return field

def fetch_markets():
    # We'll fetch more markets to ensure we find Economic/Fed ones
    url = (f"https://gamma-api.polymarket.com/markets"
           f"?active=true&closed=false&limit=1000")
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logging.error(f"Fetch error: {e}")
        return []

async def filter_and_evaluate_markets(markets):
    filtered = []
    now = datetime.now(timezone.utc)

    # Sort markets by endDate for "Ending Soon"
    sorted_markets = sorted(
        [m for m in markets if m.get('endDate')],
        key=lambda x: x.get('endDate')
    )

    for m in sorted_markets:
        try:
            question = m.get('question', '')
            description = m.get('description', '')

            # 1. Filter by "Economic" or "Fed"
            is_target = any(word in (question + description).lower() for word in ["economic", "fed", "fomc", "inflation", "gdp"])
            if not is_target:
                continue

            # 2. Filter by Liquidity >= $50,000
            liquidity = float(m.get('liquidity', 0))
            if liquidity < 50000:
                continue

            # 3. Filter by Duration 1-30 days
            end_date_str = m.get('endDate', '')
            if not end_date_str:
                continue

            ed = datetime.strptime(end_date_str[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
            diff = ed - now
            days_to_end = diff.total_seconds() / 86400
            if not (0 <= days_to_end <= 30):
                continue

            # 4. Filter by Price 82-88c or lower
            outcomes = parse_json_field(m.get('outcomes'))
            prices   = parse_json_field(m.get('outcomePrices'))
            if not outcomes or not prices or len(outcomes) != 2:
                continue

            yes_p = float(prices[0])
            no_p  = float(prices[1])

            # User said "Narx 82–88¢ oralig'ida (yoki pastroq)".
            # Usually this refers to the outcome price we are interested in.
            # If we are looking for positive EV, we should check both Yes and No?
            # Or usually "Yes" if it's a binary bet. Let's check both if they meet price criteria.

            targets = []
            if yes_p <= 0.88: # Covers 82-88 and lower
                targets.append(("Yes", yes_p))
            if no_p <= 0.88:
                targets.append(("No", no_p))

            if not targets:
                continue

            # 5. Gemini Assessment & EV Calculation
            # We only evaluate if it passed previous filters to save API calls
            gemini_prob, gemini_text = await get_gemini_probability(question, description, end_date_str)

            if gemini_prob is None:
                continue

            for side, price in targets:
                # EV = (True Prob * 1.0) - Price
                # If True Prob is for "Yes", then for "No" it is (100 - True Prob)
                true_prob = gemini_prob / 100.0 if side == "Yes" else (100 - gemini_prob) / 100.0

                ev = (true_prob - price) / price * 100 if price > 0 else 0

                if ev >= 5:
                    slug = m.get('slug') or ''
                    gs = m.get('groupSlug') or ''
                    if gs:
                        murl = f"https://polymarket.com/event/{gs}"
                    elif slug:
                        murl = f"https://polymarket.com/market/{slug}"
                    else:
                        murl = f"https://polymarket.com/?conditionId={m.get('conditionId', '')}"

                    filtered.append({
                        'question': question,
                        'side': side,
                        'price': price,
                        'true_prob': true_prob * 100,
                        'ev': ev,
                        'gemini_explanation': gemini_text,
                        'url': murl,
                        'endDate': end_date_str,
                        'liquidity': liquidity
                    })
                    # Found a good EV on this market, can move to next market
                    break

        except (ValueError, TypeError, IndexError) as e:
            logging.error(f"Filter error: {e}")
            continue

    return filtered

def build_message(markets, title="🟢 Positive EV Opportunity"):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    lines = [
        f"<b>{title}</b>",
        f"📅 {ts}",
        f"📊 Topildi: <b>{len(markets)}</b>",
        "",
    ]
    for i, m in enumerate(markets, 1):
        end_date = m.get('endDate', '')
        if end_date and len(end_date) >= 16:
            end_str = f"⏳ Tugaydi: {end_date[:10]} {end_date[11:16]} (UTC)"
        else:
            end_str = f"⏳ Tugaydi: {end_date or 'Noma\'lum'}"

        lines.append(
            f"{i}. <b>{m['question']}</b>\n"
            f"   {end_str}\n"
            f"   💰 Narx: <b>{m['side']} @ {m['price']:.2f}</b>\n"
            f"   🤖 Gemini Bahosi: <b>{m['true_prob']:.1f}%</b>\n"
            f"   📈 EV: <b>+{m['ev']:.1f}%</b>\n"
            f"   💧 Liquidity: ${m['liquidity']:,.0f}\n"
            f"   📝 Izoh: <i>{m['gemini_explanation'][:200]}...</i>\n"
            f"   🔗 <a href=\"{m['url']}\">Polymarket'da ko'rish</a>\n"
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

# ─── MONITORING LOOP ─────────────────────────────────────────────────────────

async def monitor_loop(app):
    while True:
        if state["running"]:
            markets  = fetch_markets()
            filtered = await filter_and_evaluate_markets(markets)
            state["last_update"] = time.strftime('%H:%M:%S')
            state["last_count"]  = len(filtered)

            new_markets = [m for m in filtered if f"{m['url']}_{m['side']}" not in state["seen_urls"]]
            if new_markets:
                state["seen_urls"].update(f"{m['url']}_{m['side']}" for m in new_markets)
                msg = build_message(new_markets)
                await send_tg(app, msg)

        await asyncio.sleep(state["interval"])

# ─── KEYBOARDS ───────────────────────────────────────────────────────────────

def main_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("▶️ Boshlash",  callback_data="start_mon"),
            InlineKeyboardButton("⏹ To'xtatish", callback_data="stop_mon"),
        ],
        [
            InlineKeyboardButton("📊 Status",      callback_data="status"),
            InlineKeyboardButton("🔍 Hozir skanir", callback_data="scan_now"),
        ],
        [
            InlineKeyboardButton("⏱ Interval o'zgartirish", callback_data="set_interval"),
            InlineKeyboardButton("🔄 Tozalash", callback_data="clear_seen"),
        ],
    ])

def time_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Hamma vaqt (All)", callback_data="time_all")],
        [InlineKeyboardButton("1 Kunlik (Bugun/Ertaga)", callback_data="time_day")],
        [InlineKeyboardButton("1 Haftalik", callback_data="time_week")],
        [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]
    ])

def interval_keyboard():
    intervals = [
        ("30s", 30), ("1d", 60), ("2d", 120), ("5d", 300),
        ("10d", 600), ("30d", 1800),
    ]
    rows = []
    row = []
    for label, val in intervals:
        row.append(InlineKeyboardButton(label, callback_data=f"interval_{val}"))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
    return InlineKeyboardMarkup(rows)

def yes_keyboard():
    presets = [
        ("Yes 10-20%", (0.10, 0.20)),
        ("Yes 20-30%", (0.20, 0.30)),
        ("Yes 30-40%", (0.30, 0.40)),
        ("Yes 40-50%", (0.40, 0.50)),
        ("Yes 50-60%", (0.50, 0.60)),
        ("Yes 60-70%", (0.60, 0.70)),
    ]
    rows = [[InlineKeyboardButton(label, callback_data=f"yes_{int(mn*100)}_{int(mx*100)}")]
            for label, (mn, mx) in presets]
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
    return InlineKeyboardMarkup(rows)

def no_keyboard():
    presets = [
        ("No 30-50%", (0.30, 0.50)),
        ("No 50-60%", (0.50, 0.60)),
        ("No 55-70%", (0.55, 0.70)),
        ("No 60-75%", (0.60, 0.75)),
        ("No 65-80%", (0.65, 0.80)),
        ("No 70-90%", (0.70, 0.90)),
    ]
    rows = [[InlineKeyboardButton(label, callback_data=f"no_{int(mn*100)}_{int(mx*100)}")]
            for label, (mn, mx) in presets]
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
    return InlineKeyboardMarkup(rows)

# ─── HANDLERS ────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "🤖 <b>Polymarket Monitor Bot</b>\n\n"
        "Quyidagi tugmalar orqali botni boshqaring:"
    )
    await update.message.reply_text(text, parse_mode="HTML",
                                    reply_markup=main_keyboard())

async def cmd_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📋 Boshqaruv paneli:",
                                    reply_markup=main_keyboard())

async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q    = update.callback_query
    data = q.data
    await q.answer()

    if data == "start_mon":
        state["running"] = True
        state["seen_urls"] = set()          # reset so alerts fire immediately
        await q.edit_message_text(
            "▶️ <b>Monitoring boshlandi!</b>\n"
            f"Har {state['interval']} soniyada skanirlanadi.",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "stop_mon":
        state["running"] = False
        await q.edit_message_text(
            "⏹ <b>Monitoring to'xtatildi.</b>",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "status":
        mon_status = "🟢 Ishlamoqda" if state["running"] else "🔴 To'xtatilgan"
        gemini_status = "✅ Sozlangan" if GEMINI_KEY else "❌ Kalit yo'q"
        text = (
            f"📊 <b>EV Bot Status</b>\n\n"
            f"Holat:        {mon_status}\n"
            f"Gemini:       {gemini_status}\n"
            f"Interval:     {state['interval']} soniya\n"
            f"Filtrlar:\n"
            f" - Bo'lim: Economic/Fed\n"
            f" - Likvidlik: >= $50,000\n"
            f" - Muddat: 1-30 kun\n"
            f" - Narx: <= 88¢\n"
            f" - EV: >= +5%\n"
        )
        last_upd = state['last_update'] or "hali yo'q"
        text += (
            f"\nOxirgi skan:  {last_upd}\n"
            f"Topilgan EV:  {state['last_count']} ta\n"
            f"Ko'rilgan:    {len(state['seen_urls'])} ta"
        )
        await q.edit_message_text(text, parse_mode="HTML",
                                  reply_markup=main_keyboard())

    elif data == "scan_now":
        await q.edit_message_text("🔍 Skanirlanmoqda...", parse_mode="HTML")
        markets  = fetch_markets()
        filtered = await filter_and_evaluate_markets(markets)
        state["last_update"] = time.strftime('%H:%M:%S')
        state["last_count"]  = len(filtered)
        if filtered:
            msg = build_message(filtered, title="🔍 Qo'lda Skanir Natijalari")
            await send_tg(ctx.application, msg)
            await q.edit_message_text(
                f"✅ {len(filtered)} ta savdo topildi va yuborildi.",
                parse_mode="HTML", reply_markup=main_keyboard())
        else:
            await q.edit_message_text(
                "❌ Filtrga mos savdolar topilmadi.",
                parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "set_interval":
        await q.edit_message_text(
            "⏱ Yangilanish intervalini tanlang:",
            reply_markup=interval_keyboard())

    elif data.startswith("interval_"):
        secs = int(data.split("_")[1])
        state["interval"] = secs
        await q.edit_message_text(
            f"✅ Interval <b>{secs} soniya</b> ga o'zgartirildi.",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "set_yes":
        await q.edit_message_text(
            "📈 Yes ehtimollik oraliqini tanlang:",
            reply_markup=yes_keyboard())

    elif data.startswith("yes_"):
        _, mn, mx = data.split("_")
        state["yes_min"] = int(mn) / 100
        state["yes_max"] = int(mx) / 100
        await q.edit_message_text(
            f"✅ Yes filtr: <b>{mn}% – {mx}%</b>",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "set_no":
        await q.edit_message_text(
            "📉 No ehtimollik oraliqini tanlang:",
            reply_markup=no_keyboard())

    elif data.startswith("no_"):
        _, mn, mx = data.split("_")
        state["no_min"] = int(mn) / 100
        state["no_max"] = int(mx) / 100
        await q.edit_message_text(
            f"✅ No filtr: <b>{mn}% – {mx}%</b>",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "set_time":
        await q.edit_message_text(
            "📅 Savdo tugash vaqt oraliqini tanlang:",
            reply_markup=time_keyboard())

    elif data.startswith("time_"):
        t_filter = data.split("_")[1]
        state["time_filter"] = t_filter
        await q.edit_message_text(
            f"✅ Davr filtri <b>{t_filter.upper()}</b> ga o'zgartirildi.",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "clear_seen":
        count = len(state["seen_urls"])
        state["seen_urls"] = set()
        await q.edit_message_text(
            f"🔄 {count} ta ko'rilgan URL tozalandi. Keyingi skanda hammasi qayta yuboriladi.",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "show_filters":
        text = (
            f"📋 <b>Hozirgi filtrlar</b>\n\n"
            f"✅ Yes:  {state['yes_min']*100:.0f}% – {state['yes_max']*100:.0f}%\n"
            f"❌ No:   {state['no_min']*100:.0f}% – {state['no_max']*100:.0f}%\n"
            f"📅 Davr:   {state['time_filter'].upper()}\n"
            f"⏱ Interval: {state['interval']} soniya\n"
            f"📦 Limit: {state['limit']} savdo"
        )
        await q.edit_message_text(text, parse_mode="HTML",
                                  reply_markup=main_keyboard())

    elif data == "back":
        await q.edit_message_text(
            "📋 Boshqaruv paneli:",
            reply_markup=main_keyboard())

# ─── MAIN ────────────────────────────────────────────────────────────────────

async def post_init(app):
    asyncio.create_task(monitor_loop(app))
    await app.bot.send_message(
        chat_id=CHAT_ID,
        text=(
            "🤖 <b>Polymarket Monitor Bot ishga tushdi!</b>\n\n"
            "Quyidagi tugmalar bilan boshqaring 👇"
        ),
        parse_mode="HTML",
        reply_markup=main_keyboard(),
    )

def main():
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("menu",   cmd_menu))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("Bot ishga tushdi. To'xtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
