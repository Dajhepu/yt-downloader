"""
Polymarket Monitor - To'liq Telegram bot boshqaruvi
"""

import asyncio
import logging
import requests
import json
import time
import threading
from datetime import datetime, timedelta, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes
)

logging.basicConfig(level=logging.WARNING)

# ─── CONFIG ─────────────────────────────────────────────────────────────────
BOT_TOKEN  = "7256069971:AAHNTBZZipJI9mF1K1lRyNiQb2n7qEEDEDY"
CHAT_ID    = 798283148
# ────────────────────────────────────────────────────────────────────────────

# Shared state
state = {
    "running": False,
    "interval": 60,
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

# ─── POLYMARKET HELPERS ──────────────────────────────────────────────────────

def parse_json_field(field):
    if isinstance(field, str):
        try:
            return json.loads(field)
        except json.JSONDecodeError:
            return None
    return field

def fetch_markets():
    url = (f"https://gamma-api.polymarket.com/markets"
           f"?active=true&closed=false&limit={state['limit']}")
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception:
        return []

def filter_markets(markets):
    filtered = []
    for m in markets:
        try:
            outcomes = parse_json_field(m.get('outcomes'))
            prices   = parse_json_field(m.get('outcomePrices'))
            if not outcomes or not prices:
                continue
            if len(outcomes) == 2 and outcomes[0] == "Yes" and outcomes[1] == "No":
                yes_p = float(prices[0])
                no_p  = float(prices[1])
                if (state['yes_min'] <= yes_p <= state['yes_max'] and
                        state['no_min'] <= no_p <= state['no_max']):
                    slug = m.get('slug') or ''
                    gs = m.get('groupSlug') or ''
                    if gs:
                        murl = f"https://polymarket.com/event/{gs}"
                    elif slug:
                        murl = f"https://polymarket.com/market/{slug}"
                    else:
                        murl = f"https://polymarket.com/?conditionId={m.get('conditionId', '')}"

                    end_date_str = m.get('endDate', '')
                    
                    if state['time_filter'] != "all" and end_date_str:
                        try:
                            ed = datetime.strptime(end_date_str[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
                            now = datetime.now(timezone.utc)
                            if state['time_filter'] == "day" and ed > now + timedelta(days=1):
                                continue
                            elif state['time_filter'] == "week" and ed > now + timedelta(days=7):
                                continue
                        except Exception:
                            pass

                    filtered.append({
                        'question': m.get('question', 'Nomsiz'),
                        'yes': yes_p,
                        'no':  no_p,
                        'url': murl,
                        'endDate': end_date_str
                    })
        except (ValueError, TypeError, IndexError):
            continue
    return filtered

def build_message(markets, title="🟢 Polymarket Yangi Savdolar"):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    lines = [
        f"<b>{title}</b>",
        f"📅 {ts}",
        f"🔍 Yes {state['yes_min']*100:.0f}-{state['yes_max']*100:.0f}%"
        f" | No {state['no_min']*100:.0f}-{state['no_max']*100:.0f}%",
        f"⏳ Davr filtri: <b>{state['time_filter'].upper()}</b>",
        f"📊 Savdolar: <b>{len(markets)}</b>",
        "",
    ]
    for i, m in enumerate(markets, 1):
        end_date = m.get('endDate', '')
        if end_date and len(end_date) >= 16:
            end_str = f"⏳ Tugaydi: {end_date[:10]} {end_date[11:16]} (UTC)"
        elif end_date:
            end_str = f"⏳ Tugaydi: {end_date}"
        else:
            end_str = f"⏳ Tugaydi: Noma'lum"

        lines.append(
            f"{i}. <b>{m['question']}</b>\n"
            f"   {end_str}\n"
            f"   ✅ Yes: {m['yes']*100:.1f}%  ❌ No: {m['no']*100:.1f}%\n"
            f"   🔗 <a href=\"{m['url']}\">Polymarket'da ko'rish</a>"
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
            filtered = filter_markets(markets)
            state["last_update"] = time.strftime('%H:%M:%S')
            state["last_count"]  = len(filtered)

            new_markets = [m for m in filtered if m['url'] not in state["seen_urls"]]
            if new_markets:
                state["seen_urls"].update(m['url'] for m in new_markets)
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
        ],
        [
            InlineKeyboardButton("📈 Yes filtri",  callback_data="set_yes"),
            InlineKeyboardButton("📉 No filtri",   callback_data="set_no"),
        ],
        [
            InlineKeyboardButton("📅 Davr filtri", callback_data="set_time"),
            InlineKeyboardButton("🔄 Tozalash", callback_data="clear_seen"),
        ],
        [
            InlineKeyboardButton("📋 Filtrlarni ko'rish", callback_data="show_filters"),
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
        text = (
            f"📊 <b>Status</b>\n\n"
            f"Holat:        {mon_status}\n"
            f"Interval:     {state['interval']} soniya\n"
            f"Limit:        {state['limit']} savdo\n"
            f"Yes filtr:    {state['yes_min']*100:.0f}% \u2013 {state['yes_max']*100:.0f}%\n"
            f"No filtr:     {state['no_min']*100:.0f}% \u2013 {state['no_max']*100:.0f}%\n"
        )
        last_upd = state['last_update'] or "hali yo'q"
        text += (
            f"Oxirgi skan:  {last_upd}\n"
            f"Topilgan:     {state['last_count']} ta savdo\n"
            f"Ko'rilgan:    {len(state['seen_urls'])} ta URL"
        )
        await q.edit_message_text(text, parse_mode="HTML",
                                  reply_markup=main_keyboard())

    elif data == "scan_now":
        await q.edit_message_text("🔍 Skanirlanmoqda...", parse_mode="HTML")
        markets  = fetch_markets()
        filtered = filter_markets(markets)
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
