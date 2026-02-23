from app.services.integrations.base import BaseIntegration
from app.services.integrations.providers import (
    WhatsAppIntegration,
    TelegramIntegration,
    GmailIntegration,
    SlackIntegration,
    OpenAIIntegration,
    NotionIntegration,
)

# Registry maps integration slugs to their implementation class
INTEGRATION_REGISTRY: dict[str, type[BaseIntegration]] = {
    "whatsapp": WhatsAppIntegration,
    "telegram": TelegramIntegration,
    "gmail": GmailIntegration,
    "slack": SlackIntegration,
    "openai": OpenAIIntegration,
    "notion": NotionIntegration,
}


def get_integration(slug: str) -> BaseIntegration:
    """Get an integration instance by its slug."""
    cls = INTEGRATION_REGISTRY.get(slug)
    if not cls:
        raise ValueError(f"Unknown integration: {slug}")
    return cls()


def list_available_integrations() -> list[dict]:
    """Return metadata for all registered integrations."""
    integrations = []
    for slug, cls in INTEGRATION_REGISTRY.items():
        instance = cls()
        integrations.append({
            "slug": instance.slug,
            "name": instance.name,
            "category": instance.category,
        })
    return integrations
