import requests
import json
import os
import logging
import re
import dateparser
from datetime import datetime, timezone

GEOCODE_CACHE_FILE = "geocode_cache.json"

def load_cache():
    if os.path.exists(GEOCODE_CACHE_FILE):
        try:
            with open(GEOCODE_CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Error loading geocode cache: {e}")
    return {}

def save_cache(cache):
    try:
        with open(GEOCODE_CACHE_FILE, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        logging.error(f"Error saving geocode cache: {e}")

geocode_cache = load_cache()

def get_coordinates(city_name):
    """
    Converts city name to (lat, lon, country_code) using Open-Meteo Geocoding API.
    Uses local cache to avoid redundant API calls.
    """
    city_name = city_name.strip().lower()
    if city_name in geocode_cache:
        return geocode_cache[city_name]

    url = f"https://geocoding-api.open-meteo.com/v1/search?name={city_name}&count=1&language=en&format=json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        if "results" in data and len(data["results"]) > 0:
            result = data["results"][0]
            lat = result.get("latitude")
            lon = result.get("longitude")
            country_code = result.get("country_code")

            coords = (lat, lon, country_code)
            geocode_cache[city_name] = coords
            save_cache(geocode_cache)
            return coords
    except Exception as e:
        logging.error(f"Geocoding error for {city_name}: {e}")

    return None

def fetch_weather_forecast(lat, lon, date, weather_type, model="ecmwf"):
    """
    Fetches forecast from Open-Meteo for a specific date and type.
    """
    if not date:
        date = datetime.now(timezone.utc)

    date_str = date.strftime("%Y-%m-%d")

    # Open-Meteo supports models: ecmwf_ifs04, gfs_seamless, etc.
    # mapping our simple names to API model names
    model_mapping = {
        "ecmwf": "ecmwf_ifs04",
        "gfs": "gfs_seamless",
        "ensemble": "best_match" # Open-Meteo's internal ensemble-like selection
    }

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
        response = requests.get(base_url, params=params, timeout=10)
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
    """
    Calculates probability (0-1) based on forecast data and heuristic rules.
    """
    if not forecast:
        return 0.5

    weather_type = parsed["type"]
    threshold = parsed["threshold"]

    if weather_type in ["rain", "snow"]:
        probs = forecast.get("precip_prob", [])
        if not probs: return 0.5
        avg_prob = sum(probs) / len(probs)
        # Rule-based conversion:
        if avg_prob > 60: return 0.8
        if 30 <= avg_prob <= 60: return 0.5
        return 0.2

    elif weather_type == "temperature":
        temps = forecast.get("temp", [])
        if not temps: return 0.5
        max_temp = max(temps)
        diff = max_temp - threshold

        # Heuristic:
        # If max_temp is way above threshold, probability is high
        if diff >= 3: return 0.9
        if 1 <= diff < 3: return 0.7
        if -1 <= diff < 1: return 0.5
        if -3 <= diff < -1: return 0.3
        return 0.1

    elif weather_type == "wind":
        winds = forecast.get("wind", [])
        if not winds: return 0.5
        max_wind = max(winds)
        diff = max_wind - threshold

        if diff >= 10: return 0.9
        if 5 <= diff < 10: return 0.7
        if -5 <= diff < 5: return 0.5
        return 0.2

    return 0.5

def parse_weather_market(question):
    """
    Parses a Polymarket question to extract weather-related details.
    Returns a dict with: type, city, threshold, target_date, is_weather
    """
    question = question.strip()
    result = {
        "is_weather": False,
        "type": None,
        "city": None,
        "threshold": None,
        "target_date": None,
        "original_question": question
    }

    # 1. Rain Parsing
    # Example: "Will it rain in New York on March 29?"
    rain_match = re.search(r"Will it rain in (.*?) (?:on|by) (.*?)\?$", question, re.I)
    if not rain_match:
        rain_match = re.search(r"Will it rain in (.*?)\?$", question, re.I)

    if rain_match and "temperature" in question.lower():
        rain_match = None # Avoid false positive for temperature markets

    if rain_match:
        result["is_weather"] = True
        result["type"] = "rain"
        city_candidate = rain_match.group(1).strip()
        # If city_candidate contains a date-like word at the end, it might have captured too much
        # But usually our regex (.*?) with (?:on|by) should handle it.
        # Let's check for "tomorrow", "today" in city if no target_date
        if len(rain_match.groups()) == 1 or not rain_match.group(2):
            for word in ["tomorrow", "today", "next week", "this Friday"]:
                if word in city_candidate.lower():
                    result["target_date"] = dateparser.parse(word, settings={'PREFER_DATES_FROM': 'future'})
                    city_candidate = city_candidate.lower().replace(word, "").strip()
                    break

        result["city"] = city_candidate
        if len(rain_match.groups()) > 1 and rain_match.group(2):
            result["target_date"] = dateparser.parse(rain_match.group(2).strip(), settings={'PREFER_DATES_FROM': 'future'})

        # fallback if city still contains "on ..."
        if " on " in result["city"].lower():
            parts = re.split(r" on ", result["city"], flags=re.I)
            result["city"] = parts[0].strip()
            if not result["target_date"]:
                result["target_date"] = dateparser.parse(parts[1].strip(), settings={'PREFER_DATES_FROM': 'future'})
        return result

    # 2. Temperature Parsing
    # Example: "Will temperature in London exceed 22°C?"
    temp_match = re.search(r"Will (?:the\s+)?temperature in (.*?) exceed ([\d\.]+)\s*(?:°C|C)?", question, re.I)
    if temp_match:
        result["is_weather"] = True
        result["type"] = "temperature"
        result["city"] = temp_match.group(1).strip()
        result["threshold"] = float(temp_match.group(2))
        # Look for date in the rest of the string if any
        date_part = question[temp_match.end():].strip()
        if date_part:
            result["target_date"] = dateparser.parse(date_part, settings={'PREFER_DATES_FROM': 'future'})
        return result

    # 3. Wind Speed Parsing
    # Example: "Will wind speed in NYC exceed 30 km/h?"
    wind_match = re.search(r"Will wind speed in (.*?) exceed ([\d\.]+)\s*(?:km/h|mph)?", question, re.I)
    if wind_match:
        result["is_weather"] = True
        result["type"] = "wind"
        result["city"] = wind_match.group(1).strip()
        result["threshold"] = float(wind_match.group(2))
        date_part = question[wind_match.end():].strip()
        if date_part:
            result["target_date"] = dateparser.parse(date_part, settings={'PREFER_DATES_FROM': 'future'})
        return result

    # 4. Snow Parsing
    # Example: "Will it snow in Tokyo on Friday?"
    snow_match = re.search(r"Will it snow in (.*?) (?:on|by) (.*?)\?$", question, re.I)
    if not snow_match:
        snow_match = re.search(r"Will it snow in (.*?)\?$", question, re.I)

    if snow_match and "temperature" in question.lower():
        snow_match = None

    if snow_match:
        result["is_weather"] = True
        result["type"] = "snow"
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

if __name__ == "__main__":
    test_questions = [
        "Will it rain in New York tomorrow?",
        "Will temperature in London exceed 22°C on June 15?",
        "Will wind speed in Miami exceed 50 km/h?",
        "Will it snow in Tokyo on Friday?",
        "Will the stock market go up tomorrow?" # Not weather
    ]

    for q in test_questions:
        parsed = parse_weather_market(q)
        print(f"Q: {q}")
        print(f"  Is Weather: {parsed['is_weather']}")
        if parsed['is_weather']:
            print(f"  Type: {parsed['type']}")
            print(f"  City: {parsed['city']}")
            print(f"  Threshold: {parsed['threshold']}")
            print(f"  Date: {parsed['target_date']}")
        print("-" * 20)
