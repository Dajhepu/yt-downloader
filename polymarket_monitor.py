"""
Polymarket Monitor - To'liq Telegram bot boshqaruvi
"""

import asyncio
import logging
import requests
import json
import time
import threading
import html
from datetime import datetime, timedelta, timezone
from weather_utils import (
    get_coordinates, fetch_weather_forecast,
    calculate_weather_probability, parse_weather_market
)
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
    "trending_enabled": True,
    "weather_model": "ecmwf",
    "min_volume_24h": 5000.0,
    "active_categories": ["Geopolitics", "Finance", "Iran", "Politics", "Sports", "Economy", "Elections", "Weather", "Mentions", "Crypto"],
    "seen_trending_urls": set(),
    "trending_volumes": {}, # url -> last_alert_vol
}

CATEGORY_KEYWORDS = {
    "Geopolitics": ["war", "conflict", "nato", "russia", "china", "ukraine", "israel", "palestine", "middle east", "geopolitics"],
    "Finance": ["stock", "market", "nasdaq", "dow jones", "s&p", "bank", "interest rate", "inflation", "recession", "finance"],
    "Iran": ["iran", "tehran", "khamenei", "raisi", "irgc"],
    "Politics": ["election", "biden", "trump", "senate", "house", "republican", "democrat", "government", "policy", "politics"],
    "Sports": ["nba", "nfl", "mlb", "soccer", "football", "tennis", "olympics", "ufc", "boxing", "sports"],
    "Economy": ["gdp", "unemployment", "cpi", "fed", "fomc", "economy", "economic"],
    "Elections": ["vote", "poll", "primary", "candidate", "elections"],
    "Weather": ["hurricane", "storm", "temperature", "climate", "snow", "rain", "weather"],
    "Mentions": ["tweet", "post", "says", "mention", "truth social", "x.com", "mentions"],
    "Crypto": ["bitcoin", "eth", "crypto", "binance", "coinbase", "solana", "doge", "token", "blockchain"]
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

def filter_trending_markets(markets):
    filtered = []
    if not state["trending_enabled"]:
        return filtered

    for m in markets:
        try:
            # Volume check
            vol24 = float(m.get('volume24hr') or 0)
            if vol24 < state["min_volume_24h"]:
                continue

            question = m.get('question', '').lower()
            description = m.get('description', '').lower()

            matched_category = None
            for cat in state["active_categories"]:
                keywords = CATEGORY_KEYWORDS.get(cat, [])
                if any(kw in question or kw in description for kw in keywords):
                    matched_category = cat
                    break

            if not matched_category:
                continue

            prices = parse_json_field(m.get('outcomePrices'))
            outcomes = parse_json_field(m.get('outcomes'))
            if not prices or not outcomes:
                continue

            slug = m.get('slug') or ''
            gs = m.get('groupSlug') or ''
            if gs:
                murl = f"https://polymarket.com/event/{gs}"
            elif slug:
                murl = f"https://polymarket.com/market/{slug}"
            else:
                murl = f"https://polymarket.com/?conditionId={m.get('conditionId', '')}"

            filtered.append({
                'question': m.get('question', 'Nomsiz'),
                'url': murl,
                'category': matched_category,
                'vol24': vol24,
                'prices': prices,
                'outcomes': outcomes
            })
        except Exception:
            continue
    return filtered

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

def build_trending_message(markets):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    lines = [
        f"<b>🔥 Trending & Faol Savdolar</b>",
        f"📅 {ts}",
        f"📊 Minimal 24s hajm: <b>${state['min_volume_24h']:,}</b>",
        f"🔍 Topildi: <b>{len(markets)}</b>",
        "",
    ]
    for i, m in enumerate(markets, 1):
        price_str = ""
        try:
            for idx, outcome in enumerate(m['outcomes']):
                if idx < len(m['prices']):
                    price_str += f" | {outcome}: {float(m['prices'][idx])*100:.1f}%"
        except:
            pass

        safe_q = html.escape(m['question'])

        status_tag = "🚀 YANGI"
        if m.get('is_update'):
            increase = m['vol24'] - m['prev_vol']
            status_tag = f"📈 FAOL (+$ {increase:,.0f})"

        entry = (
            f"{i}. {status_tag} [{m['category']}] <b>{safe_q}</b>\n"
            f"   💰 24s Hajm: <b>${m['vol24']:,.0f}</b>\n"
            f"   📊 Narxlar: {price_str.lstrip(' | ')}\n"
            f"   🔗 <a href=\"{m['url']}\">Polymarket'da ko'rish</a>\n\n"
        )
        if len("\n".join(lines) + entry) > 4000:
            break
        lines.append(entry)
    return "\n".join(lines)

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

        safe_q = html.escape(m['question'])
        entry = (
            f"{i}. <b>{safe_q}</b>\n"
            f"   {end_str}\n"
            f"   ✅ Yes: {m['yes']*100:.1f}%  ❌ No: {m['no']*100:.1f}%\n"
            f"   🔗 <a href=\"{m['url']}\">Polymarket'da ko'rish</a>\n"
        )
        if len("\n".join(lines) + entry) > 4000:
            break
        lines.append(entry)
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

async def process_weather_market(m):
    """
    Checks if a market is a weather market and performs forecast analysis.
    """
    question = m.get('question', '')
    parsed = parse_weather_market(question)
    if not parsed["is_weather"]:
        return None

    coords = get_coordinates(parsed["city"])
    if not coords:
        return None

    lat, lon, cc = coords
    target_date = parsed["target_date"]
    if not target_date:
        # Fallback to market end date
        end_date_str = m.get('endDate', '')
        if end_date_str:
            try:
                target_date = datetime.strptime(end_date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except:
                target_date = datetime.now(timezone.utc)
        else:
            target_date = datetime.now(timezone.utc)

    forecast = fetch_weather_forecast(lat, lon, target_date, parsed["type"], model=state["weather_model"])
    if not forecast:
        return None

    prob = calculate_weather_probability(parsed, forecast)

    # Get market price
    prices = parse_json_field(m.get('outcomePrices'))
    if not prices or len(prices) < 2:
        return None

    yes_price = float(prices[0])
    edge = prob - yes_price

    murl = ""
    slug = m.get('slug') or ''
    gs = m.get('groupSlug') or ''
    if gs: murl = f"https://polymarket.com/event/{gs}"
    elif slug: murl = f"https://polymarket.com/market/{slug}"

    return {
        "question": question,
        "city": parsed["city"],
        "yes_price": yes_price,
        "model_prob": prob,
        "edge": edge,
        "url": murl,
        "type": parsed["type"]
    }

def build_weather_message(results):
    lines = ["🌦 <b>Ob-Havo Tahlili</b>\n"]
    for r in results:
        recommendation = "✅ BUY YES" if r['edge'] > 0.1 else ("❌ BUY NO" if r['edge'] < -0.1 else "◽ SKIP")

        lines.append(
            f"📍 {r['city'].capitalize()} {r['type'].capitalize()} Market\n"
            f"YES price: {r['yes_price']:.2f}\n"
            f"Model: {r['model_prob']:.2f}\n"
            f"Edge: {r['edge']:+.2f}\n\n"
            f"👉 <b>{recommendation}</b>\n"
            f"🔗 <a href=\"{r['url']}\">Polymarket</a>\n"
            f"──────────────────"
        )
    return "\n".join(lines)

async def monitor_loop(app):
    while True:
        if state["running"]:
            markets  = fetch_markets()

            # 1. Ob-havo tahlili
            weather_results = []
            weather_urls_processed = set()
            for m in markets:
                slug = m.get('slug') or ''
                gs = m.get('groupSlug') or ''
                murl = ""
                if gs: murl = f"https://polymarket.com/event/{gs}"
                elif slug: murl = f"https://polymarket.com/market/{slug}"

                if not murl or murl in state["seen_urls"]:
                    continue

                res = await process_weather_market(m)
                if res:
                    weather_results.append(res)
                    weather_urls_processed.add(murl)

            if weather_results:
                state["seen_urls"].update(weather_urls_processed)
                msg_w = build_weather_message(weather_results)
                await send_tg(app, msg_w)

            # 2. Standart filtr
            filtered = filter_markets(markets)
            state["last_update"] = time.strftime('%H:%M:%S')
            state["last_count"]  = len(filtered)

            new_markets = [m for m in filtered if m['url'] not in state["seen_urls"]]
            if new_markets:
                state["seen_urls"].update(m['url'] for m in new_markets)
                msg = build_message(new_markets)
                await send_tg(app, msg)

            # 3. Trending filtr
            trending = filter_trending_markets(markets)
            trending_to_alert = []
            for m in trending:
                url = m['url']
                vol = m['vol24']
                last_vol = state["trending_volumes"].get(url, 0)

                # Alert if new OR volume increased by 50% AND at least $5,000 increase
                if url not in state["seen_trending_urls"] or (vol > last_vol * 1.5 and vol > last_vol + 5000):
                    m['is_update'] = url in state["seen_trending_urls"]
                    m['prev_vol'] = last_vol
                    trending_to_alert.append(m)
                    state["seen_trending_urls"].add(url)
                    state["trending_volumes"][url] = vol

            if trending_to_alert:
                msg_trending = build_trending_message(trending_to_alert)
                await send_tg(app, msg_trending)

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
            InlineKeyboardButton("🔥 Trending/Kategoriyalar", callback_data="trending_menu"),
            InlineKeyboardButton("🌦 Ob-havo", callback_data="weather_menu"),
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

def trending_keyboard():
    status = "✅ YOQILGAN" if state["trending_enabled"] else "❌ O'CHIRILGAN"
    rows = [
        [InlineKeyboardButton(f"Trending: {status}", callback_data="toggle_trending")],
        [InlineKeyboardButton("💰 Min Hajm (24s)", callback_data="set_min_vol")],
        [InlineKeyboardButton("📂 Kategoriyalar", callback_data="categories_menu")],
        [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]
    ]
    return InlineKeyboardMarkup(rows)

def categories_keyboard():
    rows = []
    # Display 2 categories per row
    categories = list(CATEGORY_KEYWORDS.keys())
    for i in range(0, len(categories), 2):
        row = []
        cat1 = categories[i]
        mark1 = "✅" if cat1 in state["active_categories"] else "❌"
        row.append(InlineKeyboardButton(f"{mark1} {cat1}", callback_data=f"toggle_cat_{cat1}"))

        if i + 1 < len(categories):
            cat2 = categories[i+1]
            mark2 = "✅" if cat2 in state["active_categories"] else "❌"
            row.append(InlineKeyboardButton(f"{mark2} {cat2}", callback_data=f"toggle_cat_{cat2}"))
        rows.append(row)

    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="trending_menu")])
    return InlineKeyboardMarkup(rows)

def volume_keyboard():
    volumes = [
        ("$1k", 1000), ("$5k", 5000), ("$10k", 10000),
        ("$25k", 25000), ("$50k", 50000), ("$100k", 100000),
    ]
    rows = []
    row = []
    for label, val in volumes:
        row.append(InlineKeyboardButton(label, callback_data=f"vol_{val}"))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="trending_menu")])
    return InlineKeyboardMarkup(rows)

def weather_keyboard():
    rows = [
        [InlineKeyboardButton(f"Model: {state['weather_model'].upper()}", callback_data="set_weather_model")],
        [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]
    ]
    return InlineKeyboardMarkup(rows)

def weather_model_keyboard():
    rows = [
        [InlineKeyboardButton("ECMWF (Eng aniq)", callback_data="wmodel_ecmwf")],
        [InlineKeyboardButton("GFS (Tezkor)", callback_data="wmodel_gfs")],
        [InlineKeyboardButton("Ensemble (Stabil)", callback_data="wmodel_ensemble")],
        [InlineKeyboardButton("◀️ Orqaga", callback_data="weather_menu")]
    ]
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
        state["seen_trending_urls"] = set()
        state["trending_volumes"] = {}
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
        count_t = len(state["seen_trending_urls"])
        state["seen_urls"] = set()
        state["seen_trending_urls"] = set()
        state["trending_volumes"] = {}
        await q.edit_message_text(
            f"🔄 {count} ta oddiy va {count_t} ta trending URL tozalandi. "
            "Keyingi skanda hammasi qayta yuboriladi.",
            parse_mode="HTML", reply_markup=main_keyboard())

    elif data == "trending_menu":
        await q.edit_message_text(
            "🔥 <b>Trending & Kategoriyalar Sozlamalari</b>\n\n"
            "Bu bo'limda siz tanlangan kategoriyalar bo'yicha "
            "hajmi yuqori bo'lgan (tez va ko'p pul kirayotgan) "
            "savdolarni kuzatishni sozlashingiz mumkin.",
            parse_mode="HTML", reply_markup=trending_keyboard())

    elif data == "toggle_trending":
        state["trending_enabled"] = not state["trending_enabled"]
        await q.edit_message_text(
            "🔥 Trending sozlamalari:",
            reply_markup=trending_keyboard())

    elif data == "set_min_vol":
        await q.edit_message_text(
            f"💰 <b>Minimal 24s hajmni tanlang:</b>\n\nHozirgi: ${state['min_volume_24h']:,}",
            parse_mode="HTML", reply_markup=volume_keyboard())

    elif data.startswith("vol_"):
        vol = float(data.split("_")[1])
        state["min_volume_24h"] = vol
        await q.edit_message_text(
            f"✅ Minimal hajm <b>${vol:,}</b> ga o'rnatildi.",
            parse_mode="HTML", reply_markup=trending_keyboard())

    elif data == "categories_menu":
        await q.edit_message_text(
            "📂 <b>Kuzatiladigan kategoriyalarni tanlang:</b>",
            parse_mode="HTML", reply_markup=categories_keyboard())

    elif data.startswith("toggle_cat_"):
        cat = data.replace("toggle_cat_", "")
        if cat in state["active_categories"]:
            state["active_categories"].remove(cat)
        else:
            state["active_categories"].append(cat)
        await q.edit_message_text(
            "📂 <b>Kuzatiladigan kategoriyalarni tanlang:</b>",
            parse_mode="HTML", reply_markup=categories_keyboard())

    elif data == "weather_menu":
        await q.edit_message_text(
            "🌦 <b>Ob-havo Tahlili Sozlamalari</b>\n\n"
            "Bot avtomatik ravishda ob-havo bozorlarini aniqlaydi va "
            "Open-Meteo orqali tahlil qiladi.",
            parse_mode="HTML", reply_markup=weather_keyboard())

    elif data == "set_weather_model":
        await q.edit_message_text(
            "🌦 <b>Ob-havo modelini tanlang:</b>",
            parse_mode="HTML", reply_markup=weather_model_keyboard())

    elif data.startswith("wmodel_"):
        model = data.replace("wmodel_", "")
        state["weather_model"] = model
        await q.edit_message_text(
            f"✅ Ob-havo modeli <b>{model.upper()}</b> ga o'zgartirildi.",
            parse_mode="HTML", reply_markup=weather_keyboard())

    elif data == "show_filters":
        trending_s = "✅ YOQILGAN" if state["trending_enabled"] else "❌ O'CHIRILGAN"
        text = (
            f"📋 <b>Hozirgi filtrlar</b>\n\n"
            f"✅ Yes:  {state['yes_min']*100:.0f}% – {state['yes_max']*100:.0f}%\n"
            f"❌ No:   {state['no_min']*100:.0f}% – {state['no_max']*100:.0f}%\n"
            f"📅 Davr:   {state['time_filter'].upper()}\n"
            f"⏱ Interval: {state['interval']} soniya\n"
            f"📦 Limit: {state['limit']} savdo\n\n"
            f"🔥 Trending: {trending_s}\n"
            f"💰 Min Hajm: ${state['min_volume_24h']:,}\n"
            f"📂 Kategoriyalar: {', '.join(state['active_categories']) if state['active_categories'] else 'Yoq'}\n"
            f"🌦 Ob-havo modeli: {state['weather_model'].upper()}"
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
