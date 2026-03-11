"""
Solar Calculator Service — India-focused solar power estimation tool.
Uses NASA POWER API for solar irradiance + Indian subsidy/pricing logic.
"""

import httpx
import json
import math
from typing import Optional


# ─── Built-in fallback: average solar irradiance by latitude band (kWh/m²/day) ───
LATITUDE_IRRADIANCE = [
    (0, 10, 5.5), (10, 20, 5.8), (20, 30, 5.2), (30, 40, 4.5),
    (40, 50, 3.8), (50, 60, 3.0), (60, 70, 2.2), (70, 90, 1.5),
]
MONTHLY_FACTORS = {
    1: 0.65, 2: 0.78, 3: 0.95, 4: 1.10, 5: 1.20, 6: 1.25,
    7: 1.18, 8: 1.10, 9: 1.00, 10: 0.85, 11: 0.68, 12: 0.58,
}
MONTH_NAMES = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}
MONTH_DAYS = {
    1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
    7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
}

# ─── Indian Solar Pricing & Subsidies ───

# Average cost per kW (installed) in India
COST_PER_KW = {
    "residential": 55000,   # ₹55,000/kW for residential
    "commercial": 48000,    # ₹48,000/kW for commercial
}

# PM-Surya Ghar Yojana subsidy (as of 2024-25)
PM_SURYA_GHAR_SUBSIDY = {
    "upto_2kw": 30000,      # ₹30,000/kW for first 2 kW
    "2_to_3kw": 18000,      # ₹18,000/kW for 2-3 kW portion
    "above_3kw": 0,          # No subsidy above 3 kW
    "max_total": 78000,      # Maximum ₹78,000 total subsidy
}

# State subsidy (approximate averages)
STATE_SUBSIDY_PCT = {
    "rural": 0.40,     # 40% additional subsidy in some rural schemes
    "city": 0.0,       # No additional city subsidy (PM scheme covers it)
    "pm_surya_ghar": 0.0,  # PM scheme subsidy calculated separately
}

# Average electricity rates
ELECTRICITY_RATE = {
    "rural": 5.0,       # ₹5/kWh rural
    "city": 8.0,        # ₹8/kWh city/urban
    "commercial": 10.0, # ₹10/kWh commercial
}

# Backup costs
BACKUP_COSTS = {
    "diesel": {"per_hour": 50, "maintenance_per_month": 2000},
    "battery_inverter": {"per_kwh_capacity": 12000, "lifespan_years": 5},
    "none": {"per_hour": 0, "maintenance_per_month": 0},
}


def _get_fallback_irradiance(lat: float) -> float:
    abs_lat = abs(lat)
    for low, high, irr in LATITUDE_IRRADIANCE:
        if low <= abs_lat < high:
            return irr
    return 3.5


async def geocode_location(query: str) -> Optional[dict]:
    """Convert a pincode, city name, or address to lat/lon."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": "SolarCalculator/1.0"},
            )
            results = resp.json()
            if results:
                return {
                    "lat": float(results[0]["lat"]),
                    "lon": float(results[0]["lon"]),
                    "display_name": results[0].get("display_name", query),
                }
    except Exception as e:
        print(f"[Solar] Geocoding error: {e}")
    return None


async def get_nasa_solar_data(lat: float, lon: float) -> Optional[dict]:
    """Fetch monthly solar irradiance from NASA POWER API."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://power.larc.nasa.gov/api/temporal/climatology/point",
                params={
                    "parameters": "ALLSKY_SFC_SW_DWN",
                    "community": "RE",
                    "longitude": round(lon, 3),
                    "latitude": round(lat, 3),
                    "format": "JSON",
                },
            )
            data = resp.json()
        irr = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
        return {
            "source": "NASA POWER",
            "monthly_irradiance": {
                i: irr.get(k, 0)
                for i, k in enumerate(["JAN","FEB","MAR","APR","MAY","JUN",
                                        "JUL","AUG","SEP","OCT","NOV","DEC"], 1)
            },
            "annual_avg": irr.get("ANN", 0),
        }
    except Exception as e:
        print(f"[Solar] NASA API error: {e}")
        return None


def _built_in_irradiance(lat: float) -> dict:
    base = _get_fallback_irradiance(lat)
    is_southern = lat < 0
    monthly = {}
    for month in range(1, 13):
        factor_month = ((month + 5) % 12) + 1 if is_southern else month
        monthly[month] = round(base * MONTHLY_FACTORS[factor_month], 2)
    return {
        "source": "Built-in estimate",
        "monthly_irradiance": monthly,
        "annual_avg": round(base, 2),
    }


def _calculate_pm_subsidy(system_kw: float) -> float:
    """Calculate PM-Surya Ghar Yojana subsidy."""
    subsidy = 0
    if system_kw <= 2:
        subsidy = system_kw * PM_SURYA_GHAR_SUBSIDY["upto_2kw"]
    elif system_kw <= 3:
        subsidy = 2 * PM_SURYA_GHAR_SUBSIDY["upto_2kw"] + (system_kw - 2) * PM_SURYA_GHAR_SUBSIDY["2_to_3kw"]
    else:
        subsidy = 2 * PM_SURYA_GHAR_SUBSIDY["upto_2kw"] + 1 * PM_SURYA_GHAR_SUBSIDY["2_to_3kw"]
    return min(subsidy, PM_SURYA_GHAR_SUBSIDY["max_total"])


def _recommend_system_size(
    rooftop_area_sqm: float,
    monthly_consumption_kwh: float,
    annual_generation_per_kw: float,
) -> float:
    """Recommend optimal system size based on rooftop area and consumption."""
    # 1 kW needs ~10 sq meters of rooftop
    max_from_roof = rooftop_area_sqm / 10.0
    # Size to cover consumption
    monthly_per_kw = annual_generation_per_kw / 12
    needed_for_consumption = monthly_consumption_kwh / monthly_per_kw if monthly_per_kw > 0 else 5.0
    # Take the smaller of the two, round to 2 decimal places
    recommended = min(max_from_roof, needed_for_consumption)
    return round(max(1.0, recommended), 2)  # minimum 1 kW


async def calculate_solar_power(
    location: str,
    rooftop_area: float,
    rooftop_area_unit: str = "sqm",
    monthly_consumption_kwh: float = 300,
    monthly_bill_rs: float = 2400,
    scheme: str = "pm_surya_ghar",
    backup_type: str = "none",
    backup_hours_per_day: float = 0,
    system_size_kw: Optional[float] = None,
) -> dict:
    """
    Generate a comprehensive solar power report.

    Args:
        location: Pincode, city, or "lat,lon"
        rooftop_area: Available rooftop area
        rooftop_area_unit: "sqm" (square meters) or "sqft" (square feet)
        monthly_consumption_kwh: Monthly electricity consumption in kWh
        monthly_bill_rs: Average monthly electricity bill in ₹
        scheme: "rural", "city", or "pm_surya_ghar"
        backup_type: "diesel", "battery_inverter", or "none"
        backup_hours_per_day: Hours of backup needed per day
        system_size_kw: Override system size (auto-calculated if not provided)
    """
    # 1. Geocode
    lat, lon, location_name = None, None, location
    if "," in location:
        parts = location.split(",")
        try:
            lat, lon = float(parts[0].strip()), float(parts[1].strip())
            location_name = f"{lat}, {lon}"
        except ValueError:
            pass
    if lat is None:
        geo = await geocode_location(location)
        if not geo:
            return {"error": f"Could not find location: '{location}'. Try a pincode, city name, or lat,lon."}
        lat, lon, location_name = geo["lat"], geo["lon"], geo["display_name"]

    # 2. Convert rooftop area to sqm
    rooftop_sqm = rooftop_area
    if rooftop_area_unit == "sqft":
        rooftop_sqm = rooftop_area * 0.0929

    # 3. Get solar irradiance
    solar_data = await get_nasa_solar_data(lat, lon)
    if not solar_data:
        solar_data = _built_in_irradiance(lat)

    # 4. Calculate generation per kW
    performance_ratio = 0.80
    tilt_factor = min(1.0 + 0.1 * math.sin(math.radians(abs(lat))), 1.15)
    annual_gen_per_kw = sum(
        solar_data["monthly_irradiance"][m] * performance_ratio * tilt_factor * MONTH_DAYS[m]
        for m in range(1, 13)
    )

    # 5. Recommend or use given system size
    if system_size_kw is None or system_size_kw <= 0:
        system_size_kw = _recommend_system_size(rooftop_sqm, monthly_consumption_kwh, annual_gen_per_kw)

    # 6. Monthly generation
    monthly_gen = []
    total_annual_kwh = 0
    for m in range(1, 13):
        irr = solar_data["monthly_irradiance"][m]
        daily = irr * system_size_kw * performance_ratio * tilt_factor
        monthly_kwh = round(daily * MONTH_DAYS[m], 1)
        total_annual_kwh += monthly_kwh
        monthly_gen.append({
            "month": MONTH_NAMES[m],
            "generation_kwh": monthly_kwh,
        })
    total_annual_kwh = round(total_annual_kwh, 1)
    avg_monthly_gen = round(total_annual_kwh / 12, 2)

    # 7. Electricity rate
    elec_rate = monthly_bill_rs / monthly_consumption_kwh if monthly_consumption_kwh > 0 else ELECTRICITY_RATE.get(scheme, 8.0)

    # 8. Savings
    monthly_saving = round(avg_monthly_gen * elec_rate, 2)
    annual_saving = round(monthly_saving * 12, 2)
    coverage_pct = round((avg_monthly_gen / monthly_consumption_kwh) * 100, 1) if monthly_consumption_kwh > 0 else 0

    # 9. Cost & Subsidy
    total_cost = round(system_size_kw * COST_PER_KW["residential"])
    subsidy = 0
    subsidy_details = ""

    if scheme == "pm_surya_ghar":
        subsidy = round(_calculate_pm_subsidy(system_size_kw))
        subsidy_details = f"PM-Surya Ghar Yojana subsidy: ₹{subsidy:,.0f}"
    elif scheme == "rural":
        subsidy = round(total_cost * STATE_SUBSIDY_PCT["rural"])
        subsidy_details = f"Rural scheme subsidy (~40%): ₹{subsidy:,.0f}"
    else:
        subsidy_details = "No government subsidy applied (city/commercial)"

    cost_after_subsidy = max(0, total_cost - subsidy)
    payback_years = round(cost_after_subsidy / annual_saving, 2) if annual_saving > 0 else 99

    # 10. Backup analysis
    backup_info = {"type": backup_type, "monthly_cost_without_solar": 0, "savings_from_solar": ""}
    if backup_type == "diesel" and backup_hours_per_day > 0:
        diesel_monthly = round(backup_hours_per_day * 30 * BACKUP_COSTS["diesel"]["per_hour"] + BACKUP_COSTS["diesel"]["maintenance_per_month"])
        backup_info["monthly_cost_without_solar"] = diesel_monthly
        backup_info["savings_from_solar"] = f"Solar can eliminate ₹{diesel_monthly:,}/month diesel cost"
    elif backup_type == "battery_inverter" and backup_hours_per_day > 0:
        battery_kwh = (monthly_consumption_kwh / 30 / 24) * backup_hours_per_day  # hourly load × hours
        battery_cost = round(battery_kwh * BACKUP_COSTS["battery_inverter"]["per_kwh_capacity"])
        backup_info["battery_capacity_kwh"] = round(battery_kwh, 1)
        backup_info["battery_cost_rs"] = battery_cost
        backup_info["savings_from_solar"] = f"Solar + battery can provide {backup_hours_per_day}hr backup, reducing grid dependency"

    # 11. CO2 & Environmental
    co2_offset_kg = round(total_annual_kwh * 0.82)
    trees_equivalent = round(co2_offset_kg / 22)

    # 12. 25-year projection
    yearly_projection = []
    cumulative_saving = 0
    for year in range(1, 26):
        degradation = 1 - (0.005 * (year - 1))  # 0.5% annual panel degradation
        year_gen = round(total_annual_kwh * degradation)
        year_saving = round(year_gen * elec_rate)
        cumulative_saving += year_saving
        net_position = cumulative_saving - cost_after_subsidy
        yearly_projection.append({
            "year": year,
            "generation_kwh": year_gen,
            "annual_saving_rs": year_saving,
            "cumulative_saving_rs": cumulative_saving,
            "net_position_rs": net_position,
        })

    lifetime_saving = cumulative_saving
    lifetime_roi = round((lifetime_saving / cost_after_subsidy) * 100, 1) if cost_after_subsidy > 0 else 0

    # ─── Build Report ───
    return {
        "report_title": f"{system_size_kw} kW Solar PV — Customized Report",
        "location": location_name,
        "coordinates": {"latitude": round(lat, 4), "longitude": round(lon, 4)},

        "system_recommendation": {
            "recommended_system_size_kw": system_size_kw,
            "rooftop_area_used": f"{rooftop_sqm:.0f} sq.m ({rooftop_area} {rooftop_area_unit})",
            "panels_approx": f"{math.ceil(system_size_kw / 0.54)} panels (540W each)",
            "area_needed_sqm": round(system_size_kw * 10, 1),
        },

        "key_metrics": {
            "estimated_cost_rs": total_cost,
            "avg_monthly_generation_kwh": avg_monthly_gen,
            "payback_period_years": payback_years,
            "monthly_saving_rs": monthly_saving,
            "coverage_of_consumption_pct": coverage_pct,
        },

        "subsidy": {
            "scheme": scheme,
            "subsidy_amount_rs": subsidy,
            "cost_after_subsidy_rs": cost_after_subsidy,
            "details": subsidy_details,
        },

        "monthly_generation": monthly_gen,

        "financial_summary": {
            "annual_saving_rs": annual_saving,
            "lifetime_saving_25yr_rs": lifetime_saving,
            "lifetime_roi_pct": lifetime_roi,
            "electricity_rate_used_rs_per_kwh": round(elec_rate, 2),
        },

        "backup_analysis": backup_info,

        "environmental_impact": {
            "co2_offset_kg_per_year": co2_offset_kg,
            "equivalent_trees_planted": trees_equivalent,
            "co2_offset_25yr_tonnes": round(co2_offset_kg * 25 / 1000, 1),
        },

        "yearly_projection_25yr": yearly_projection,

        "notes": [
            "Solar estimation is based on your available area, electricity usage & relevant state policy.",
            "Tax benefit in the form of Accelerated Depreciation can be availed by commercial and industrial customers.",
            "For residential, hospital and educational institute capital subsidy is available.",
            "Please contact an installer for exact sizing.",
            f"Data source: {solar_data['source']}",
        ],
    }


# ─── LLM Function-Calling Schema ───

SOLAR_CALCULATOR_SCHEMA = {
    "type": "function",
    "function": {
        "name": "calculate_solar_power",
        "description": (
            "Calculate solar panel power generation and generate a detailed report. "
            "Use this when the user wants a solar estimate, solar quote, or rooftop solar calculation. "
            "You MUST ask the user for ALL of these details before calling this tool:\n"
            "1. Location (pincode or city)\n"
            "2. Rooftop area (in sq meters or sq feet)\n"
            "3. Monthly electricity consumption (kWh/month)\n"
            "4. Average monthly electricity bill (₹/month)\n"
            "5. Scheme type: 'rural', 'city', or 'pm_surya_ghar'\n"
            "6. Backup type: 'diesel', 'battery_inverter', or 'none', and hours per day if applicable\n"
            "Do NOT call this tool until you have gathered ALL inputs from the user."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "Pincode (e.g. '110001'), city name (e.g. 'Mumbai'), or 'lat,lon'",
                },
                "rooftop_area": {
                    "type": "number",
                    "description": "Available rooftop area for solar panels",
                },
                "rooftop_area_unit": {
                    "type": "string",
                    "enum": ["sqm", "sqft"],
                    "description": "Unit of rooftop area: 'sqm' (square meters) or 'sqft' (square feet)",
                },
                "monthly_consumption_kwh": {
                    "type": "number",
                    "description": "Monthly electricity consumption in kWh",
                },
                "monthly_bill_rs": {
                    "type": "number",
                    "description": "Average monthly electricity bill in ₹ (Indian Rupees)",
                },
                "scheme": {
                    "type": "string",
                    "enum": ["rural", "city", "pm_surya_ghar"],
                    "description": "Scheme type: 'rural' (village/agricultural), 'city' (urban), or 'pm_surya_ghar' (PM Surya Ghar Yojana government subsidy)",
                },
                "backup_type": {
                    "type": "string",
                    "enum": ["diesel", "battery_inverter", "none"],
                    "description": "Current backup power type: 'diesel' generator, 'battery_inverter', or 'none'",
                },
                "backup_hours_per_day": {
                    "type": "number",
                    "description": "Hours of backup power used per day (0 if no backup)",
                },
                "system_size_kw": {
                    "type": "number",
                    "description": "Override system size in kW (leave empty for auto-recommendation based on rooftop area and consumption)",
                },
            },
            "required": ["location", "rooftop_area", "rooftop_area_unit", "monthly_consumption_kwh", "monthly_bill_rs", "scheme", "backup_type"],
        },
    },
}
