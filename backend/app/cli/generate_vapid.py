"""One-shot VAPID keypair generator.

Run:
    docker compose exec backend python -m app.cli.generate_vapid

Prints two lines you paste into the backend's environment (e.g., into
``docker-compose.override.yml`` or a real ``.env``).
"""
from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def main() -> None:
    private = ec.generate_private_key(ec.SECP256R1())
    public = private.public_key()

    # VAPID public key: uncompressed SEC1 (0x04 + X + Y), 65 bytes -> 87 base64url chars.
    public_bytes = public.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )

    # VAPID private key: raw 32-byte secret value (so pywebpush can ingest it
    # without us also shipping the PEM around).
    private_value = private.private_numbers().private_value
    private_bytes = private_value.to_bytes(32, "big")

    print("VAPID_PUBLIC_KEY=" + _b64url(public_bytes))
    print("VAPID_PRIVATE_KEY=" + _b64url(private_bytes))
    print("# (also set VAPID_SUBJECT to a mailto: or https:// URL identifying you)")


if __name__ == "__main__":
    main()
