"""Cryptographic service for encrypting/decrypting sensitive data."""

import base64
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings


class CryptoService:
    """Service for AES-256 encryption using Fernet."""

    # Static salt - key changes with APP_SECRET_KEY
    SALT = b"ghostarr_encryption_salt_v1"
    ITERATIONS = 100_000

    def __init__(self, secret_key: str):
        """Initialize with secret key."""
        self._key = self._derive_key(secret_key)
        self._fernet = Fernet(self._key)

    def _derive_key(self, secret: str) -> bytes:
        """Derive encryption key from secret using PBKDF2."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.SALT,
            iterations=self.ITERATIONS,
        )
        key = kdf.derive(secret.encode())
        return base64.urlsafe_b64encode(key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext string and return base64-encoded ciphertext."""
        if not plaintext:
            return ""
        encrypted = self._fernet.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext and return plaintext."""
        if not ciphertext:
            return ""
        try:
            decrypted = self._fernet.decrypt(ciphertext.encode())
            return decrypted.decode()
        except InvalidToken:
            raise ValueError("Invalid or corrupted encrypted data")

    def is_encrypted(self, value: str) -> bool:
        """Check if a value appears to be encrypted (Fernet format)."""
        if not value:
            return False
        try:
            # Fernet tokens start with 'gAAAAA'
            return value.startswith("gAAAAA") and len(value) > 50
        except Exception:
            return False


@lru_cache
def get_crypto_service() -> CryptoService:
    """Get cached crypto service instance."""
    return CryptoService(settings.app_secret_key)


crypto_service = get_crypto_service()
