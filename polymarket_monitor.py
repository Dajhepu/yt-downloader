"""
Polymarket Monitor - To'liq Telegram bot boshqaruvi
"""

import asyncio
import logging
import httpx
import json
import time
import threading
import html
import re
import os
import dateparser
from datetime import datetime, timedelta, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, ContextTypes
)

logging.basicConfig(level=logging.INFO)

# ─── CONFIG ─────────────────────────────────────────────────────────────────
BOT_TOKEN  = os.environ.get("BOT_TOKEN", "7256069971:AAHNTBZZipJI9mF1K1lRyNiQb2n7qEEDEDY")
CHAT_ID    = int(os.environ.get("CHAT_ID", 798283148))
GEOCODE_CACHE_FILE = "geocode_cache.json"
# ────────────────────────────────────────────────────────────────────────────

# Shared state
state = {
    "running": False,
    "interval": 60,
    "limit": 1000,
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
    "seen_arb_urls": set(),
    "seen_cross_urls": set(),
    "seen_kalshi_urls": set(),
    "arb_threshold": 0.98,
    "cross_threshold": 0.05,
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

# ─── WEATHER UTILS ──────────────────────────────────────────────────────────

def load_geocode_cache():
    if os.path.exists(GEOCODE_CACHE_FILE):
        try:
            with open(GEOCODE_CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Error loading geocode cache: {e}")
    return {}

def save_geocode_cache(cache):
    try:
        with open(GEOCODE_CACHE_FILE, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        logging.error(f"Error saving geocode cache: {e}")

geocode_cache = load_geocode_cache()

async def get_coordinates(client, city_name):
    city_name = city_name.strip().lower()
    if city_name in geocode_cache:
        return geocode_cache[city_name]

    url = f"https://geocoding-api.open-meteo.com/v1/search?name={city_name}&count=1&language=en&format=json"
    try:
        response = await client.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if "results" in data and len(data["results"]) > 0:
            result = data["results"][0]
            coords = (result.get("latitude"), result.get("longitude"), result.get("country_code"))
            geocode_cache[city_name] = coords
            save_geocode_cache(geocode_cache)
            return coords
    except Exception as e:
        logging.error(f"Geocoding error for {city_name}: {e}")
    return None

async def fetch_weather_forecast(client, lat, lon, date, weather_type, model="ecmwf"):
    if not date:
        date = datetime.now(timezone.utc)
    date_str = date.strftime("%Y-%m-%d")
    model_mapping = {"ecmwf": "ecmwf_ifs04", "gfs": "gfs_seamless", "ensemble": "best_match"}
    api_model = model_mapping.get(model, "ecmwf_ifs04")

    base_url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date_str,
        "end_date": date_str,
        "models": api_model,
        "hourly": "temperature_2m,precipitation_probability,precipitation,wind_speed_10m"
    }
    try:
        response = await client.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        hourly = data.get("hourly", {})
        if not hourly:
            return None
        return {
            "temp": hourly.get("temperature_2m", []),
            "precip_prob": hourly.get("precipitation_probability", []),
            "precip": hourly.get("precipitation", []),
            "wind": hourly.get("wind_speed_10m", []),
            "model_used": api_model
        }
    except Exception as e:
        logging.error(f"Weather fetch error: {e}")
    return None

def calculate_weather_probability(parsed, forecast):
    if not forecast:
        return 0.5
    w_type = parsed["type"]
    threshold = parsed["threshold"]

    if w_type in ["rain", "snow"]:
        probs = forecast.get("precip_prob", [])
        if not probs:
            return 0.5
        avg_prob = sum(probs) / len(probs)
        if avg_prob > 60:
            return 0.8
        if 30 <= avg_prob <= 60:
            return 0.5
        return 0.2
    elif w_type == "temperature":
        temps = forecast.get("temp", [])
        if not temps:
            return 0.5
        diff = max(temps) - threshold
        if diff >= 3:
            return 0.9
        if 1 <= diff < 3:
            return 0.7
        if -1 <= diff < 1:
            return 0.5
        if -3 <= diff < -1:
            return 0.3
        return 0.1
    elif w_type == "wind":
        winds = forecast.get("wind", [])
        if not winds:
            return 0.5
        diff = max(winds) - threshold
        if diff >= 10:
            return 0.9
        if 5 <= diff < 10:
            return 0.7
        if -5 <= diff < 5:
            return 0.5
        return 0.2
    return 0.5

def parse_weather_market(question):
    question = question.strip()
    result = {"is_weather": False, "type": None, "city": None, "threshold": None, "target_date": None, "original_question": question}

    # Rain
    rain_match = re.search(r"Will it rain in (.*?) (?:on|by) (.*?)\?$", question, re.I) or re.search(r"Will it rain in (.*?)\?$", question, re.I)
    if rain_match and "temperature" not in question.lower():
        result.update({"is_weather": True, "type": "rain"})
        city_candidate = rain_match.group(1).strip()
        if len(rain_match.groups()) == 1 or not rain_match.group(2):
            for word in ["tomorrow", "today", "next week", "this Friday"]:
                if word in city_candidate.lower():
                    result["target_date"] = dateparser.parse(word, settings={'PREFER_DATES_FROM': 'future'})
                    city_candidate = city_candidate.lower().replace(word, "").strip()
                    break
        result["city"] = city_candidate
        if len(rain_match.groups()) > 1 and rain_match.group(2):
            result["target_date"] = dateparser.parse(rain_match.group(2).strip(), settings={'PREFER_DATES_FROM': 'future'})
        if " on " in result["city"].lower():
            parts = re.split(r" on ", result["city"], flags=re.I)
            result["city"] = parts[0].strip()
            if not result["target_date"]:
                result["target_date"] = dateparser.parse(parts[1].strip(), settings={'PREFER_DATES_FROM': 'future'})
        return result

    # Temperature
    temp_match = re.search(r"Will (?:the\s+)?temperature in (.*?) exceed ([\d\.]+)\s*(?:°C|C)?", question, re.I)
    if temp_match:
        result.update({"is_weather": True, "type": "temperature", "city": temp_match.group(1).strip(), "threshold": float(temp_match.group(2))})
        date_part = question[temp_match.end():].strip()
        if date_part:
            result["target_date"] = dateparser.parse(date_part, settings={'PREFER_DATES_FROM': 'future'})
        return result

    # Wind
    wind_match = re.search(r"Will wind speed in (.*?) exceed ([\d\.]+)\s*(?:km/h|mph)?", question, re.I)
    if wind_match:
        result.update({"is_weather": True, "type": "wind", "city": wind_match.group(1).strip(), "threshold": float(wind_match.group(2))})
        date_part = question[wind_match.end():].strip()
        if date_part:
            result["target_date"] = dateparser.parse(date_part, settings={'PREFER_DATES_FROM': 'future'})
        return result

    # Snow
    snow_match = re.search(r"Will it snow in (.*?) (?:on|by) (.*?)\?$", question, re.I) or re.search(r"Will it snow in (.*?)\?$", question, re.I)
    if snow_match and "temperature" not in question.lower():
        result.update({"is_weather": True, "type": "snow"})
        city_candidate = snow_match.group(1).strip()
        if len(snow_match.groups()) == 1 or not snow_match.group(2):
            for word in ["tomorrow", "today", "next week", "this Friday"]:
                if word in city_candidate.lower():
                    result["target_date"] = dateparser.parse(word, settings={'PREFER_DATES_FROM': 'future'})
                    city_candidate = city_candidate.lower().replace(word, "").strip()
                    break
        result["city"] = city_candidate
        if len(snow_match.groups()) > 1 and snow_match.group(2):
            result["target_date"] = dateparser.parse(snow_match.group(2).strip(), settings={'PREFER_DATES_FROM': 'future'})
        if " on " in result["city"].lower():
            parts = re.split(r" on ", result["city"], flags=re.I)
            result["city"] = parts[0].strip()
            if not result["target_date"]:
                result["target_date"] = dateparser.parse(parts[1].strip(), settings={'PREFER_DATES_FROM': 'future'})
        return result

    return result

# ─── POLYMARKET HELPERS ──────────────────────────────────────────────────────

def parse_json_field(field):
    if isinstance(field, str):
        try:
            return json.loads(field)
        except json.JSONDecodeError:
            return None
    return field

async def fetch_markets(client):
    url = f"https://gamma-api.polymarket.com/markets?active=true&closed=false&limit={state['limit']}"
    try:
        r = await client.get(url, timeout=15)
        r.raise_for_status()
        markets = r.json()
        logging.info(f"Fetched {len(markets)} markets from Polymarket")
        return markets
    except Exception as e:
        logging.error(f"Polymarket fetch error: {e}")
        return []

async def fetch_myriad_markets(client):
    url = f"https://api-v2.myriadprotocol.com/markets?state=open&limit=1000"
    try:
        r = await client.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()
        markets = data.get('data', [])
        logging.info(f"Fetched {len(markets)} markets from Myriad")
        return markets
    except Exception as e:
        logging.error(f"Myriad fetch error: {e}")
        return []

async def fetch_kalshi_markets(client):
    url = "https://api.elections.kalshi.com/trade-api/v2/markets?status=active&limit=100"
    try:
        r = await client.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()
        markets = data.get('markets', [])
        logging.info(f"Fetched {len(markets)} markets from Kalshi")
        return markets
    except Exception as e:
        logging.error(f"Kalshi fetch error: {e}")
        return []

def filter_trending_markets(markets):
    filtered = []
    if not state["trending_enabled"]:
        return filtered

    for m in markets:
        try:
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

            filtered.append({'question': m.get('question', 'Nomsiz'), 'url': murl, 'category': matched_category, 'vol24': vol24, 'prices': prices, 'outcomes': outcomes})
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

                    filtered.append({'question': m.get('question', 'Nomsiz'), 'yes': yes_p, 'no':  no_p, 'url': murl, 'endDate': end_date_str})
        except Exception:
            continue
    return filtered

def build_trending_message(markets):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    lines = [f"<b>🔥 Trending & Faol Savdolar</b>", f"📅 {ts}", f"📊 Minimal 24s hajm: <b>${state['min_volume_24h']:,}</b>", f"🔍 Topildi: <b>{len(markets)}</b>", ""]
    for i, m in enumerate(markets, 1):
        price_str = ""
        try:
            for idx, outcome in enumerate(m['outcomes']):
                if idx < len(m['prices']):
                    price_str += f" | {outcome}: {float(m['prices'][idx])*100:.1f}%"
        except Exception:
            pass
        safe_q = html.escape(m['question'])
        status_tag = "🚀 YANGI"
        if m.get('is_update'):
            increase = m['vol24'] - m['prev_vol']
            status_tag = f"📈 FAOL (+$ {increase:,.0f})"
        entry = (f"{i}. {status_tag} [{m['category']}] <b>{safe_q}</b>\n"
                 f"   💰 24s Hajm: <b>${m['vol24']:,.0f}</b>\n"
                 f"   📊 Narxlar: {price_str.lstrip(' | ')}\n"
                 f"   🔗 <a href=\"{m['url']}\">Polymarket'da ko'rish</a>\n\n")
        if len("\n".join(lines) + entry) > 4000:
            break
        lines.append(entry)
    return "\n".join(lines)

def build_message(markets, title="🟢 Polymarket Yangi Savdolar"):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    lines = [f"<b>{title}</b>", f"📅 {ts}", f"🔍 Yes {state['yes_min']*100:.0f}-{state['yes_max']*100:.0f}% | No {state['no_min']*100:.0f}-{state['no_max']*100:.0f}%",
             f"⏳ Davr filtri: <b>{state['time_filter'].upper()}</b>", f"📊 Savdolar: <b>{len(markets)}</b>", ""]
    for i, m in enumerate(markets, 1):
        end_date = m.get('endDate', '')
        end_str = f"⏳ Tugaydi: {end_date[:10]} {end_date[11:16]} (UTC)" if end_date and len(end_date) >= 16 else (f"⏳ Tugaydi: {end_date}" if end_date else "⏳ Tugaydi: Noma'lum")
        safe_q = html.escape(m['question'])
        entry = (f"{i}. <b>{safe_q}</b>\n"
                 f"   {end_str}\n"
                 f"   ✅ Yes: {m['yes']*100:.1f}%  ❌ No: {m['no']*100:.1f}%\n"
                 f"   🔗 <a href=\"{m['url']}\">Polymarket'da ko'rish</a>\n")
        if len("\n".join(lines) + entry) > 4000:
            break
        lines.append(entry)
    return "\n".join(lines)

async def send_tg(app, text):
    try:
        await app.bot.send_message(chat_id=CHAT_ID, text=text, parse_mode="HTML", disable_web_page_preview=True)
    except Exception as e:
        logging.warning(f"TG send error: {e}")

# ─── MONITORING LOOP ─────────────────────────────────────────────────────────

async def process_weather_market(client, m):
    question = m.get('question', '')
    parsed = parse_weather_market(question)
    if not parsed["is_weather"]:
        return None
    coords = await get_coordinates(client, parsed["city"])
    if not coords:
        return None
    lat, lon, cc = coords
    target_date = parsed["target_date"]
    if not target_date:
        end_date_str = m.get('endDate', '')
        try:
            target_date = datetime.strptime(end_date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc) if end_date_str else datetime.now(timezone.utc)
        except Exception:
            target_date = datetime.now(timezone.utc)
    forecast = await fetch_weather_forecast(client, lat, lon, target_date, parsed["type"], model=state["weather_model"])
    if not forecast:
        return None
    prob = calculate_weather_probability(parsed, forecast)
    prices = parse_json_field(m.get('outcomePrices'))
    if not prices or len(prices) < 2:
        return None
    yes_price = float(prices[0])
    edge = prob - yes_price
    slug = m.get('slug') or ''
    gs = m.get('groupSlug') or ''
    murl = f"https://polymarket.com/event/{gs}" if gs else (f"https://polymarket.com/market/{slug}" if slug else "")
    return {"question": question, "city": parsed["city"], "yes_price": yes_price, "model_prob": prob, "edge": edge, "url": murl, "type": parsed["type"]}

def build_weather_message(results):
    lines = ["🌦 <b>Ob-Havo Tahlili</b>\n"]
    for r in results:
        recommendation = "✅ BUY YES" if r['edge'] > 0.1 else ("❌ BUY NO" if r['edge'] < -0.1 else "◽ SKIP")
        lines.append(f"📍 {r['city'].capitalize()} {r['type'].capitalize()} Market\n"
                     f"YES price: {r['yes_price']:.2f}\n"
                     f"Model: {r['model_prob']:.2f}\n"
                     f"Edge: {r['edge']:+.2f}\n\n"
                     f"👉 <b>{recommendation}</b>\n"
                     f"🔗 <a href=\"{r['url']}\">Polymarket</a>\n"
                     f"──────────────────")
    return "\n".join(lines)

def find_internal_arbitrage(markets):
    opportunities = []
    for m in markets:
        try:
            prices = parse_json_field(m.get('outcomePrices'))
            outcomes = parse_json_field(m.get('outcomes'))
            if not prices or len(prices) < 2:
                continue
            p_float = [float(p) for p in prices]
            total_p = sum(p_float)
            if 0.1 < total_p < state.get("arb_threshold", 0.98):
                slug = m.get('slug') or ''
                gs = m.get('groupSlug') or ''
                murl = f"https://polymarket.com/event/{gs}" if gs else (f"https://polymarket.com/market/{slug}" if slug else "")
                opportunities.append({
                    "question": m.get('question'),
                    "total_p": total_p,
                    "prices": p_float,
                    "outcomes": outcomes,
                    "url": murl,
                    "profit": (1.0 - total_p) * 100
                })
        except Exception:
            continue
    return opportunities

def build_arbitrage_message(opportunities):
    lines = ["⚖️ <b>Ichki Arbitraj Imkoniyati</b>\n"]
    for o in opportunities:
        price_lines = ""
        for i, outcome in enumerate(o['outcomes']):
            if i < len(o['prices']):
                price_lines += f"  • {outcome}: {o['prices'][i]:.3f}\n"
        lines.append(f"<b>{o['question']}</b>\n"
                     f"{price_lines}"
                     f"💰 Jami narx: <b>{o['total_p']:.3f}</b>\n"
                     f"📈 Taxminiy foyda: <b>{o['profit']:.1f}%</b>\n"
                     f"🔗 <a href=\"{o['url']}\">Polymarket</a>\n"
                     f"──────────────────")
    return "\n".join(lines)

def normalize_title(title):
    title = title.lower()
    fillers = ["will", "it", "the", "be", "on", "in", "by", "at", "to", "is", "a", "of"]
    words = re.findall(r'\w+', title)
    filtered = [w for w in words if w not in fillers]
    return "".join(filtered)

def find_cross_arbitrage(poly_markets, myriad_markets):
    opportunities = []
    myriad_data = []
    for mm in myriad_markets:
        myriad_data.append({
            'norm': normalize_title(mm.get('title', '')),
            'market': mm,
            'outcomes': {normalize_title(o.get('title', '')): o for o in mm.get('outcomes', [])}
        })

    for pm in poly_markets:
        try:
            p_q = pm.get('question', '')
            norm_p = normalize_title(p_q)

            # 1. Direct Match
            match = next((m for m in myriad_data if m['norm'] == norm_p), None)
            if match:
                mm = match['market']
                p_prices = parse_json_field(pm.get('outcomePrices'))
                if p_prices and len(p_prices) >= 2:
                    p_yes = float(p_prices[0])
                    m_yes_obj = match['outcomes'].get(normalize_title("Yes")) or (mm.get('outcomes') or [{}])[0]
                    m_yes = float(m_yes_obj.get('price', 0))
                    diff = abs(p_yes - m_yes)
                    if diff > state.get("cross_threshold", 0.05):
                        opportunities.append({"question": p_q, "p_yes": p_yes, "m_yes": m_yes, "diff": diff,
                            "url_p": f"https://polymarket.com/market/{pm.get('slug', '')}",
                            "url_m": f"https://myriad.markets/markets/{mm.get('slug', '')}"})

            # 2. Binary vs Categorical Match
            else:
                for md in myriad_data:
                    if md['norm'] in norm_p or norm_p in md['norm']:
                        for o_norm, o_obj in md['outcomes'].items():
                            if (o_norm in norm_p and len(o_norm) > 2) or (o_norm != "" and o_norm == norm_p):
                                p_prices = parse_json_field(pm.get('outcomePrices'))
                                if p_prices and len(p_prices) >= 2:
                                    p_yes = float(p_prices[0])
                                    m_yes = float(o_obj.get('price', 0))
                                    diff = abs(p_yes - m_yes)
                                    if diff > state.get("cross_threshold", 0.05):
                                        opportunities.append({"question": p_q, "p_yes": p_yes, "m_yes": m_yes, "diff": diff,
                                            "url_p": f"https://polymarket.com/market/{pm.get('slug', '')}",
                                            "url_m": f"https://myriad.markets/markets/{md['market'].get('slug', '')}"})
                                break
        except Exception: continue
    return opportunities

def build_cross_message(opportunities, title="Poly vs Myriad"):
    lines = [f"🌐 <b>Platformalar-aro Arbitraj ({title})</b>\n"]
    for o in opportunities:
        better = title.split(" vs ")[0] if o['p_yes'] < o['m_yes'] else title.split(" vs ")[1]
        lines.append(f"<b>{o['question']}</b>\n🔹 {title.split(' vs ')[0]} YES: <b>{o['p_yes']:.2f}</b>\n🔸 {title.split(' vs ')[1]} YES: <b>{o['m_yes']:.2f}</b>\n📊 Farq: <b>{o['diff']*100:.1f}%</b>\n\n👉 {better}'da arzonroq!\n🔗 <a href=\"{o['url_p']}\">Link 1</a> | <a href=\"{o['url_m']}\">Link 2</a>\n──────────────────")
    return "\n".join(lines)

def find_kalshi_arbitrage(poly_markets, kalshi_markets):
    """
    Matches Polymarket and Kalshi and calculates price gaps.
    """
    opportunities = []
    kalshi_map = {normalize_title(k.get('title', '')): k for k in kalshi_markets}

    for pm in poly_markets:
        try:
            p_q = pm.get('question', '')
            norm_p = normalize_title(p_q)

            if norm_p in kalshi_map:
                km = kalshi_map[norm_p]

                p_prices = parse_json_field(pm.get('outcomePrices'))
                if not p_prices or len(p_prices) < 2: continue

                p_yes = float(p_prices[0])
                # Kalshi prices are in cents (0.0 to 1.0 represented as dollars)
                k_yes = float(km.get('yes_bid_dollars', 0) or km.get('last_price_dollars', 0))

                diff = abs(p_yes - k_yes)
                if diff > state.get("cross_threshold", 0.05):
                    opportunities.append({
                        "question": p_q,
                        "p_yes": p_yes,
                        "m_yes": k_yes,
                        "diff": diff,
                        "url_p": f"https://polymarket.com/market/{pm.get('slug', '')}",
                        "url_m": f"https://kalshi.com/markets/{km.get('ticker', '')}"
                    })
        except Exception: continue
    return opportunities

async def monitor_loop(app):
    async with httpx.AsyncClient() as client:
        while True:
            if state["running"]:
                markets = await fetch_markets(client)
                myriad_markets = await fetch_myriad_markets(client)
                kalshi_markets = await fetch_kalshi_markets(client)

                # Kalshi vs Poly
                k_arbs = find_kalshi_arbitrage(markets, kalshi_markets)
                new_k = [o for o in k_arbs if o['url_p'] not in state["seen_kalshi_urls"]]
                if new_k:
                    state["seen_kalshi_urls"].update(o['url_p'] for o in new_k)
                    await send_tg(app, build_cross_message(new_k, title="Poly vs Kalshi"))

                # Poly vs Myriad
                cross_arbs = find_cross_arbitrage(markets, myriad_markets)
                new_cross = [o for o in cross_arbs if o['url_p'] not in state["seen_cross_urls"]]
                if new_cross:
                    state["seen_cross_urls"].update(o['url_p'] for o in new_cross)
                    await send_tg(app, build_cross_message(new_cross))

                arbs = find_internal_arbitrage(markets)
                new_arbs = [o for o in arbs if o['url'] not in state["seen_arb_urls"]]
                if new_arbs:
                    state["seen_arb_urls"].update(o['url'] for o in new_arbs)
                    await send_tg(app, build_arbitrage_message(new_arbs))

                weather_results = []
                weather_urls_processed = set()
                for m in markets:
                    murl = f"https://polymarket.com/market/{m.get('slug', '')}"
                    if murl in state["seen_urls"]: continue
                    res = await process_weather_market(client, m)
                    if res:
                        weather_results.append(res)
                        weather_urls_processed.add(murl)
                if weather_results:
                    state["seen_urls"].update(weather_urls_processed)
                    await send_tg(app, build_weather_message(weather_results))

                filtered = filter_markets(markets)
                state["last_update"] = time.strftime('%H:%M:%S')
                state["last_count"]  = len(filtered)
                new_markets = [m for m in filtered if m['url'] not in state["seen_urls"]]
                if new_markets:
                    state["seen_urls"].update(m['url'] for m in new_markets)
                    await send_tg(app, build_message(new_markets))

                trending = filter_trending_markets(markets)
                trending_to_alert = []
                for m in trending:
                    url = m['url']
                    vol = m['vol24']
                    last_vol = state["trending_volumes"].get(url, 0)
                    if url not in state["seen_trending_urls"] or (vol > last_vol * 1.5 and vol > last_vol + 5000):
                        m['is_update'] = url in state["seen_trending_urls"]
                        m['prev_vol'] = last_vol
                        trending_to_alert.append(m)
                        state["seen_trending_urls"].add(url)
                        state["trending_volumes"][url] = vol
                if trending_to_alert:
                    await send_tg(app, build_trending_message(trending_to_alert))

            await asyncio.sleep(state["interval"])

# ─── KEYBOARDS ───────────────────────────────────────────────────────────────

def main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("▶️ Boshlash",  callback_data="start_mon"), InlineKeyboardButton("⏹ To'xtatish", callback_data="stop_mon")],
        [InlineKeyboardButton("📊 Status",      callback_data="status"), InlineKeyboardButton("🔍 Hozir skanir", callback_data="scan_now")],
        [InlineKeyboardButton("🔥 Trending", callback_data="trending_menu"), InlineKeyboardButton("🌦 Ob-havo", callback_data="weather_menu"), InlineKeyboardButton("⚖️ Arbitraj", callback_data="arb_menu")],
        [InlineKeyboardButton("⏱ Interval o'zgartirish", callback_data="set_interval")],
        [InlineKeyboardButton("📈 Yes filtri",  callback_data="set_yes"), InlineKeyboardButton("📉 No filtri",   callback_data="set_no")],
        [InlineKeyboardButton("📅 Davr filtri", callback_data="set_time"), InlineKeyboardButton("🔄 Tozalash", callback_data="clear_seen")],
        [InlineKeyboardButton("📋 Filtrlarni ko'rish", callback_data="show_filters")],
    ])

def time_keyboard():
    return InlineKeyboardMarkup([[InlineKeyboardButton("Hamma vaqt (All)", callback_data="time_all")], [InlineKeyboardButton("1 Kunlik (Bugun/Ertaga)", callback_data="time_day")], [InlineKeyboardButton("1 Haftalik", callback_data="time_week")], [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]])

def interval_keyboard():
    intervals = [("30s", 30), ("1d", 60), ("2d", 120), ("5d", 300), ("10d", 600), ("30d", 1800)]
    rows = []; row = []
    for label, val in intervals:
        row.append(InlineKeyboardButton(label, callback_data=f"interval_{val}"))
        if len(row) == 3: rows.append(row); row = []
    if row: rows.append(row)
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
    return InlineKeyboardMarkup(rows)

def yes_keyboard():
    presets = [("Yes 10-20%", (0.10, 0.20)), ("Yes 20-30%", (0.20, 0.30)), ("Yes 30-40%", (0.30, 0.40)), ("Yes 40-50%", (0.40, 0.50)), ("Yes 50-60%", (0.50, 0.60)), ("Yes 60-70%", (0.60, 0.70))]
    rows = [[InlineKeyboardButton(label, callback_data=f"yes_{int(mn*100)}_{int(mx*100)}")] for label, (mn, mx) in presets]
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
    return InlineKeyboardMarkup(rows)

def no_keyboard():
    presets = [("No 30-50%", (0.30, 0.50)), ("No 50-60%", (0.50, 0.60)), ("No 55-70%", (0.55, 0.70)), ("No 60-75%", (0.60, 0.75)), ("No 65-80%", (0.65, 0.80)), ("No 70-90%", (0.70, 0.90))]
    rows = [[InlineKeyboardButton(label, callback_data=f"no_{int(mn*100)}_{int(mx*100)}")] for label, (mn, mx) in presets]
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="back")])
    return InlineKeyboardMarkup(rows)

def trending_keyboard():
    status = "✅ YOQILGAN" if state["trending_enabled"] else "❌ O'CHIRILGAN"
    return InlineKeyboardMarkup([[InlineKeyboardButton(f"Trending: {status}", callback_data="toggle_trending")], [InlineKeyboardButton("💰 Min Hajm (24s)", callback_data="set_min_vol")], [InlineKeyboardButton("📂 Kategoriyalar", callback_data="categories_menu")], [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]])

def categories_keyboard():
    rows = []; categories = list(CATEGORY_KEYWORDS.keys())
    for i in range(0, len(categories), 2):
        row = [InlineKeyboardButton(f"{'✅' if categories[i] in state['active_categories'] else '❌'} {categories[i]}", callback_data=f"toggle_cat_{categories[i]}")]
        if i + 1 < len(categories): row.append(InlineKeyboardButton(f"{'✅' if categories[i+1] in state['active_categories'] else '❌'} {categories[i+1]}", callback_data=f"toggle_cat_{categories[i+1]}"))
        rows.append(row)
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="trending_menu")])
    return InlineKeyboardMarkup(rows)

def volume_keyboard():
    volumes = [("$1k", 1000), ("$5k", 5000), ("$10k", 10000), ("$25k", 25000), ("$50k", 50000), ("$100k", 100000)]
    rows = []; row = []
    for label, val in volumes:
        row.append(InlineKeyboardButton(label, callback_data=f"vol_{val}"))
        if len(row) == 3: rows.append(row); row = []
    if row: rows.append(row)
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="trending_menu")])
    return InlineKeyboardMarkup(rows)

def weather_keyboard():
    return InlineKeyboardMarkup([[InlineKeyboardButton(f"Model: {state['weather_model'].upper()}", callback_data="set_weather_model")], [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]])

def weather_model_keyboard():
    return InlineKeyboardMarkup([[InlineKeyboardButton("ECMWF (Eng aniq)", callback_data="wmodel_ecmwf")], [InlineKeyboardButton("GFS (Tezkor)", callback_data="wmodel_gfs")], [InlineKeyboardButton("Ensemble (Stabil)", callback_data="wmodel_ensemble")], [InlineKeyboardButton("◀️ Orqaga", callback_data="weather_menu")]])

def arb_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(f"Ichki: {state['arb_threshold']*100:.1f}%", callback_data="set_arb_threshold")],
        [InlineKeyboardButton(f"Cross: {state['cross_threshold']*100:.1f}%", callback_data="set_cross_threshold")],
        [InlineKeyboardButton("◀️ Orqaga", callback_data="back")]
    ])

def arb_threshold_keyboard():
    thresholds = [("95%", 0.95), ("96%", 0.96), ("97%", 0.97), ("98%", 0.98), ("99%", 0.99)]
    rows = []
    for label, val in thresholds:
        rows.append([InlineKeyboardButton(label, callback_data=f"arbt_{val}")])
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="arb_menu")])
    return InlineKeyboardMarkup(rows)

def cross_threshold_keyboard():
    thresholds = [("2%", 0.02), ("3%", 0.03), ("5%", 0.05), ("7%", 0.07), ("10%", 0.10)]
    rows = []
    for label, val in thresholds:
        rows.append([InlineKeyboardButton(label, callback_data=f"cth_{val}")])
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data="arb_menu")])
    return InlineKeyboardMarkup(rows)

# ─── HANDLERS ────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🤖 <b>Polymarket Monitor Bot</b>\n\nQuyidagi tugmalar orqali botni boshqaring:", parse_mode="HTML", reply_markup=main_keyboard())

async def cmd_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📋 Boshqaruv paneli:", reply_markup=main_keyboard())

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logging.error(f"Update {update} caused error {context.error}")

async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query; data = q.data
    try:
        await q.answer()
    except Exception:
        pass
    if data == "start_mon":
        state["running"] = True; state["seen_urls"] = set(); state["seen_trending_urls"] = set(); state["seen_arb_urls"] = set(); state["seen_cross_urls"] = set(); state["seen_kalshi_urls"] = set(); state["trending_volumes"] = {}
        await q.edit_message_text(f"▶️ <b>Monitoring boshlandi!</b>\nHar {state['interval']} soniyada skanirlanadi.", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "stop_mon":
        state["running"] = False; await q.edit_message_text("⏹ <b>Monitoring to'xtatildi.</b>", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "status":
        status_text = "🟢 Ishlamoqda" if state["running"] else "🔴 To'xtatilgan"
        last_upd = state['last_update'] if state['last_update'] else "hali yo'q"
        text = (f"📊 <b>Status</b>\n\nHolat:        {status_text}\nInterval:     {state['interval']} soniya\nLimit:        {state['limit']} savdo\nYes filtr:    {state['yes_min']*100:.0f}% – {state['yes_max']*100:.0f}%\nNo filtr:     {state['no_min']*100:.0f}% – {state['no_max']*100:.0f}%\n"
                f"Oxirgi skan:  {last_upd}\nTopilgan:     {state['last_count']} ta savdo\nKo'rilgan:    {len(state['seen_urls'])} ta URL")
        await q.edit_message_text(text, parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "scan_now":
        await q.edit_message_text("🔍 Skanirlanmoqda...", parse_mode="HTML")
        async with httpx.AsyncClient() as client:
            markets = await fetch_markets(client)
            filtered = filter_markets(markets)
            state["last_update"] = time.strftime('%H:%M:%S')
            state["last_count"] = len(filtered)
            if filtered:
                await send_tg(ctx.application, build_message(filtered, title="🔍 Qo'lda Skanir Natijalari"))
                await q.edit_message_text(f"✅ {len(filtered)} ta savdo topildi va yuborildi.", parse_mode="HTML", reply_markup=main_keyboard())
            else:
                await q.edit_message_text("❌ Filtrga mos savdolar topilmadi.", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "set_interval": await q.edit_message_text("⏱ Yangilanish intervalini tanlang:", reply_markup=interval_keyboard())
    elif data.startswith("interval_"): state["interval"] = int(data.split("_")[1]); await q.edit_message_text(f"✅ Interval <b>{state['interval']} soniya</b> ga o'zgartirildi.", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "set_yes": await q.edit_message_text("📈 Yes ehtimollik oraliqini tanlang:", reply_markup=yes_keyboard())
    elif data.startswith("yes_"): _, mn, mx = data.split("_"); state["yes_min"] = int(mn)/100; state["yes_max"] = int(mx)/100; await q.edit_message_text(f"✅ Yes filtr: <b>{mn}% – {mx}%</b>", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "set_no": await q.edit_message_text("📉 No ehtimollik oraliqini tanlang:", reply_markup=no_keyboard())
    elif data.startswith("no_"): _, mn, mx = data.split("_"); state["no_min"] = int(mn)/100; state["no_max"] = int(mx)/100; await q.edit_message_text(f"✅ No filtr: <b>{mn}% – {mx}%</b>", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "set_time": await q.edit_message_text("📅 Savdo tugash vaqt oraliqini tanlang:", reply_markup=time_keyboard())
    elif data.startswith("time_"): state["time_filter"] = data.split("_")[1]; await q.edit_message_text(f"✅ Davr filtri <b>{state['time_filter'].upper()}</b> ga o'zgartirildi.", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "clear_seen":
        count = len(state["seen_urls"]); count_t = len(state["seen_trending_urls"]); count_a = len(state["seen_arb_urls"]); count_c = len(state["seen_cross_urls"]); count_k = len(state["seen_kalshi_urls"])
        state["seen_urls"] = set(); state["seen_trending_urls"] = set(); state["seen_arb_urls"] = set(); state["seen_cross_urls"] = set(); state["seen_kalshi_urls"] = set(); state["trending_volumes"] = {}
        await q.edit_message_text(f"🔄 {count} ta oddiy, {count_t} ta trending, {count_a} ta ichki, {count_c} ta cross va {count_k} ta Kalshi URL tozalandi.", parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "trending_menu": await q.edit_message_text("🔥 <b>Trending & Kategoriyalar Sozlamalari</b>\n\nBu bo'limda siz tanlangan kategoriyalar bo'yicha hajmi yuqori bo'lgan (tez va ko'p pul kirayotgan) savdolarni kuzatishni sozlashingiz mumkin.", parse_mode="HTML", reply_markup=trending_keyboard())
    elif data == "toggle_trending": state["trending_enabled"] = not state["trending_enabled"]; await q.edit_message_text("🔥 Trending sozlamalari:", reply_markup=trending_keyboard())
    elif data == "set_min_vol": await q.edit_message_text(f"💰 <b>Minimal 24s hajmni tanlang:</b>\n\nHozirgi: ${state['min_volume_24h']:,}", parse_mode="HTML", reply_markup=volume_keyboard())
    elif data.startswith("vol_"): state["min_volume_24h"] = float(data.split("_")[1]); await q.edit_message_text(f"✅ Minimal hajm <b>${state['min_volume_24h']:,}</b> ga o'rnatildi.", parse_mode="HTML", reply_markup=trending_keyboard())
    elif data == "categories_menu": await q.edit_message_text("📂 <b>Kuzatiladigan kategoriyalarni tanlang:</b>", parse_mode="HTML", reply_markup=categories_keyboard())
    elif data.startswith("toggle_cat_"):
        cat = data.replace("toggle_cat_", "")
        if cat in state["active_categories"]: state["active_categories"].remove(cat)
        else: state["active_categories"].append(cat)
        await q.edit_message_text("📂 <b>Kuzatiladigan kategoriyalarni tanlang:</b>", parse_mode="HTML", reply_markup=categories_keyboard())
    elif data == "weather_menu": await q.edit_message_text("🌦 <b>Ob-havo Tahlili Sozlamalari</b>\n\nBot avtomatik ravishda ob-havo bozorlarini aniqlaydi va Open-Meteo orqali tahlil qiladi.", parse_mode="HTML", reply_markup=weather_keyboard())
    elif data == "set_weather_model": await q.edit_message_text("🌦 <b>Ob-havo modelini tanlang:</b>", parse_mode="HTML", reply_markup=weather_model_keyboard())
    elif data.startswith("wmodel_"): state["weather_model"] = data.replace("wmodel_", ""); await q.edit_message_text(f"✅ Ob-havo modeli <b>{state['weather_model'].upper()}</b> ga o'zgartirildi.", parse_mode="HTML", reply_markup=weather_keyboard())

    elif data == "arb_menu":
        await q.edit_message_text(
            "⚖️ <b>Arbitraj Sozlamalari</b>\n\n"
            "Bot barcha bozorlardagi natijalar narxini qo'shib chiqadi. "
            "Agar jami narx 100% dan kam bo'lsa, bu arbitraj imkoniyati hisoblanadi.",
            parse_mode="HTML", reply_markup=arb_keyboard())

    elif data == "set_arb_threshold":
        await q.edit_message_text("⚖️ <b>Ichki arbitraj chegarasini tanlang:</b>", parse_mode="HTML", reply_markup=arb_threshold_keyboard())

    elif data.startswith("arbt_"):
        state["arb_threshold"] = float(data.replace("arbt_", ""))
        await q.edit_message_text(f"✅ Ichki arbitraj chegarasi <b>{state['arb_threshold']*100:.1f}%</b> ga o'rnatildi.", parse_mode="HTML", reply_markup=arb_keyboard())

    elif data == "set_cross_threshold":
        await q.edit_message_text("⚖️ <b>Cross-platform farq chegarasini tanlang:</b>", parse_mode="HTML", reply_markup=cross_threshold_keyboard())

    elif data.startswith("cth_"):
        state["cross_threshold"] = float(data.replace("cth_", ""))
        await q.edit_message_text(f"✅ Cross farq chegarasi <b>{state['cross_threshold']*100:.1f}%</b> ga o'rnatildi.", parse_mode="HTML", reply_markup=arb_keyboard())

    elif data == "show_filters":
        trending_status = "✅ YOQILGAN" if state['trending_enabled'] else "❌ O'CHIRILGAN"
        cats = ', '.join(state['active_categories']) if state['active_categories'] else 'Yoq'
        text = (f"📋 <b>Hozirgi filtrlar</b>\n\n✅ Yes:  {state['yes_min']*100:.0f}% – {state['yes_max']*100:.0f}%\n❌ No:   {state['no_min']*100:.0f}% – {state['no_max']*100:.0f}%\n📅 Davr:   {state['time_filter'].upper()}\n⏱ Interval: {state['interval']} soniya\n📦 Limit: {state['limit']} savdo\n\n🔥 Trending: {trending_status}\n💰 Min Hajm: ${state['min_volume_24h']:,}\n📂 Kategoriyalar: {cats}\n🌦 Ob-havo modeli: {state['weather_model'].upper()}\n⚖️ Arbitraj: {state['arb_threshold']*100:.1f}%\n⚖️ Cross: {state['cross_threshold']*100:.1f}%")
        await q.edit_message_text(text, parse_mode="HTML", reply_markup=main_keyboard())
    elif data == "back": await q.edit_message_text("📋 Boshqaruv paneli:", reply_markup=main_keyboard())

# ─── MAIN ────────────────────────────────────────────────────────────────────

async def post_init(app):
    asyncio.create_task(monitor_loop(app))
    await app.bot.send_message(chat_id=CHAT_ID, text="🤖 <b>Polymarket Monitor Bot ishga tushdi!</b>\n\nQuyidagi tugmalar bilan boshqaring 👇", parse_mode="HTML", reply_markup=main_keyboard())

def main():
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_error_handler(error_handler)
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("menu",   cmd_menu))
    app.add_handler(CallbackQueryHandler(button_handler))
    print("Bot ishga tushdi. To'xtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
