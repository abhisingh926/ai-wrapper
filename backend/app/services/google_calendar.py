"""
Google Calendar Service — Lets AI agents manage Google Calendar events.
Supports OAuth2 user tokens (SaaS per-user flow).
"""

import json
from datetime import datetime, timedelta, timezone
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_calendar_service(token_info: dict):
    """Build a Google Calendar API service from OAuth2 token info."""
    creds = Credentials(
        token=token_info.get("access_token"),
        refresh_token=token_info.get("refresh_token"),
        token_uri=token_info.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_info.get("client_id"),
        client_secret=token_info.get("client_secret"),
        scopes=token_info.get("scopes", SCOPES),
    )
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


async def list_events(
    token_info: dict,
    calendar_id: str = "primary",
    max_results: int = 10,
    days_ahead: int = 7,
) -> dict:
    """List upcoming calendar events."""
    try:
        service = _get_calendar_service(token_info)
        now = datetime.now(timezone.utc).isoformat()
        time_max = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).isoformat()

        result = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=now,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = result.get("items", [])
        if not events:
            return {"message": "No upcoming events found.", "events": []}

        formatted = []
        for event in events:
            start = event["start"].get("dateTime", event["start"].get("date"))
            end = event["end"].get("dateTime", event["end"].get("date"))
            formatted.append({
                "id": event["id"],
                "summary": event.get("summary", "(No title)"),
                "start": start,
                "end": end,
                "description": event.get("description", ""),
                "location": event.get("location", ""),
                "status": event.get("status", ""),
            })

        return {
            "message": f"Found {len(formatted)} upcoming event(s).",
            "events": formatted,
        }
    except Exception as e:
        return {"error": f"Failed to list events: {str(e)}"}


async def create_event(
    token_info: dict,
    calendar_id: str = "primary",
    summary: str = "",
    start_time: str = "",
    end_time: str = "",
    description: str = "",
    location: str = "",
) -> dict:
    """Create a new calendar event."""
    try:
        service = _get_calendar_service(token_info)

        # If no end_time provided, default to 1 hour after start
        if not end_time and start_time:
            try:
                start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                end_dt = start_dt + timedelta(hours=1)
                end_time = end_dt.isoformat()
            except Exception:
                end_time = start_time

        event_body = {
            "summary": summary,
            "description": description,
            "location": location,
            "start": {"dateTime": start_time, "timeZone": "UTC"},
            "end": {"dateTime": end_time, "timeZone": "UTC"},
        }

        event = service.events().insert(calendarId=calendar_id, body=event_body).execute()

        return {
            "message": f"Event '{summary}' created successfully!",
            "event_id": event.get("id"),
            "link": event.get("htmlLink", ""),
            "start": start_time,
            "end": end_time,
        }
    except Exception as e:
        return {"error": f"Failed to create event: {str(e)}"}


async def delete_event(
    token_info: dict,
    calendar_id: str = "primary",
    event_id: str = "",
) -> dict:
    """Delete a calendar event by its ID."""
    try:
        service = _get_calendar_service(token_info)
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return {"message": f"Event '{event_id}' deleted successfully."}
    except Exception as e:
        return {"error": f"Failed to delete event: {str(e)}"}


# ─── LLM Function-Calling Schemas ───

LIST_EVENTS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "list_calendar_events",
        "description": "List upcoming events from Google Calendar. Use this when the user asks about their schedule, meetings, appointments, or upcoming events.",
        "parameters": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days ahead to look for events (default 7)",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of events to return (default 10)",
                },
            },
            "required": [],
        },
    },
}

CREATE_EVENT_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_calendar_event",
        "description": "Create a new event on Google Calendar. Use when the user wants to schedule, book, or add a meeting/appointment/event.",
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Title of the event, e.g. 'Team Meeting', 'Doctor Appointment'",
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in ISO 8601 format, e.g. '2025-03-01T15:00:00+05:30'",
                },
                "end_time": {
                    "type": "string",
                    "description": "End time in ISO 8601 format. If not provided, defaults to 1 hour after start.",
                },
                "description": {
                    "type": "string",
                    "description": "Optional description or notes for the event",
                },
                "location": {
                    "type": "string",
                    "description": "Optional location for the event",
                },
            },
            "required": ["summary", "start_time"],
        },
    },
}

DELETE_EVENT_SCHEMA = {
    "type": "function",
    "function": {
        "name": "delete_calendar_event",
        "description": "Delete/cancel an event from Google Calendar. Use when the user wants to remove or cancel a scheduled event. You need the event ID which can be obtained from list_calendar_events.",
        "parameters": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "string",
                    "description": "The ID of the event to delete (get this from list_calendar_events first)",
                },
            },
            "required": ["event_id"],
        },
    },
}
