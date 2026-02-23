from abc import ABC, abstractmethod
from typing import List


class BaseIntegration(ABC):
    """
    Abstract base class for all OpenClaw integration wrappers.
    Every integration must implement these methods.
    """

    @property
    @abstractmethod
    def slug(self) -> str:
        """Unique identifier for this integration."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Display name."""
        pass

    @property
    @abstractmethod
    def category(self) -> str:
        """Category: chat, ai, productivity, tools, smart_home, media, social."""
        pass

    @abstractmethod
    async def connect(self, credentials: dict) -> bool:
        """Validate credentials and establish connection. Return True if valid."""
        pass

    @abstractmethod
    async def get_actions(self) -> List[dict]:
        """
        Return available actions with their config schemas.
        Each action dict should have:
        {
            "name": "send_message",
            "label": "Send Message",
            "description": "Send a message via this integration",
            "config_schema": {
                "type": "object",
                "properties": {
                    "to": {"type": "string", "label": "Recipient"},
                    "message": {"type": "string", "label": "Message", "format": "textarea"}
                },
                "required": ["to", "message"]
            }
        }
        """
        pass

    @abstractmethod
    async def execute_action(self, action: str, config: dict, credentials: dict) -> dict:
        """
        Execute an action with the given configuration and user credentials.
        Return a result dict with status and any output data.
        """
        pass

    async def disconnect(self) -> bool:
        """Clean up connection. Override if needed."""
        return True
