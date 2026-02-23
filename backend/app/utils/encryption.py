from cryptography.fernet import Fernet
from app.config import get_settings
import json
import base64

settings = get_settings()


def get_fernet():
    """Get or create a Fernet encryption instance."""
    key = settings.ENCRYPTION_KEY
    # If the key is not a valid Fernet key, derive one
    if len(key) != 44:
        # Pad/hash to create a valid 32-byte key
        key_bytes = key.encode()[:32].ljust(32, b'\0')
        key = base64.urlsafe_b64encode(key_bytes).decode()
    return Fernet(key.encode())


def encrypt_credentials(data: dict) -> str:
    """Encrypt a dictionary of credentials."""
    f = get_fernet()
    json_bytes = json.dumps(data).encode()
    return f.encrypt(json_bytes).decode()


def decrypt_credentials(encrypted: str) -> dict:
    """Decrypt an encrypted credentials string back to a dictionary."""
    f = get_fernet()
    decrypted = f.decrypt(encrypted.encode())
    return json.loads(decrypted.decode())
