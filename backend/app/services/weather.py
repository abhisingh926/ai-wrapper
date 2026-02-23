"""
Weather Service — Fetches weather data from wttr.in (no API key needed).
"""

import httpx


async def get_weather(city: str) -> dict:
    """Fetch current weather for a given city using wttr.in."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # wttr.in JSON API — no key required
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
