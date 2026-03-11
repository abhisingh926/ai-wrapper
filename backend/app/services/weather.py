"""
Weather Service — Supports OpenWeatherMap (with API key) or wttr.in (free fallback).
"""

import httpx


from typing import Optional

async def get_weather(city: str, api_key: Optional[str] = None) -> dict:
    """Fetch current weather for a given city."""
    if api_key:
        return await _openweathermap(city, api_key)
    return await _wttr(city)


async def _openweathermap(city: str, api_key: str) -> dict:
    """Fetch weather from OpenWeatherMap API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": api_key, "units": "metric"},
            )
            resp.raise_for_status()
            data = resp.json()

            main = data.get("main", {})
            wind = data.get("wind", {})
            weather_desc = data.get("weather", [{}])[0].get("description", "N/A")
            country = data.get("sys", {}).get("country", "")

            return {
                "location": f"{data.get('name', city)}, {country}",
                "temperature_c": str(round(main.get("temp", 0))),
                "feels_like_c": str(round(main.get("feels_like", 0))),
                "humidity": str(main.get("humidity", "N/A")),
                "description": weather_desc.title(),
                "wind_speed_kmh": str(round(wind.get("speed", 0) * 3.6)),
                "wind_dir": str(wind.get("deg", "N/A")),
                "visibility_km": str(round(data.get("visibility", 0) / 1000, 1)),
                "pressure_mb": str(main.get("pressure", "N/A")),
                "cloud_cover": str(data.get("clouds", {}).get("all", "N/A")),
            }
    except Exception as e:
        return {"error": f"Could not fetch weather for '{city}': {str(e)}"}


async def _wttr(city: str) -> dict:
    """Fetch weather from wttr.in (no API key needed)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://wttr.in/{city}",
                params={"format": "j1"},
                headers={"User-Agent": "AIWrapper/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()

            current = data.get("current_condition", [{}])[0]
            area = data.get("nearest_area", [{}])[0]
            area_name = area.get("areaName", [{}])[0].get("value", city)
            country = area.get("country", [{}])[0].get("value", "")

            return {
                "location": f"{area_name}, {country}",
                "temperature_c": current.get("temp_C", "N/A"),
                "temperature_f": current.get("temp_F", "N/A"),
                "feels_like_c": current.get("FeelsLikeC", "N/A"),
                "humidity": current.get("humidity", "N/A"),
                "description": current.get("weatherDesc", [{}])[0].get("value", "N/A"),
                "wind_speed_kmh": current.get("windspeedKmph", "N/A"),
                "wind_dir": current.get("winddir16Point", "N/A"),
                "visibility_km": current.get("visibility", "N/A"),
                "uv_index": current.get("uvIndex", "N/A"),
                "pressure_mb": current.get("pressure", "N/A"),
                "cloud_cover": current.get("cloudcover", "N/A"),
            }
    except Exception as e:
        return {"error": f"Could not fetch weather for '{city}': {str(e)}"}


# LLM function-calling schema
WEATHER_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city or location. Use this whenever a user asks about weather, temperature, or climate conditions for any place.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city or location to get weather for, e.g. 'London', 'New York', 'Tokyo'"
                }
            },
            "required": ["city"]
        }
    }
}
