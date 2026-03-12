from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from app.config import get_settings
import json
import base64
import hashlib

settings = get_settings()


def get_fernet():
    """Get or create a Fernet encryption instance with proper key derivation."""
    key = settings.ENCRYPTION_KEY
    
    # If key is empty, raise error
    if not key:
        raise ValueError("ENCRYPTION_KEY must be set in configuration")
    
    # If the key is already a valid Fernet key (44 chars, base64), use it directly
    if len(key) == 44:
        try:
            # Try to use it directly - valid Fernet keys will work
            Fernet(key.encode())
            return Fernet(key.encode())
        except Exception:
            # Not a valid Fernet key, derive one
            pass
    
    # Derive a proper 32-byte key using PBKDF2
    # Use a fixed salt - in production, store this securely or use a per-instance salt
    salt = b'ai_wrapper_v1_salt'  # Can be changed per deployment
    
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,  # OWASP recommended minimum
    )
    key_bytes = base64.urlsafe_b64encode(kdf.derive(key.encode()))
    return Fernet(key_bytes)


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
