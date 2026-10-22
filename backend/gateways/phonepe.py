import os
import hmac
import hashlib
import json
from datetime import datetime

# Minimal helper functions for PhonePe/UPI flows.
# This is a lightweight helper — adapt to PhonePe's live API docs when integrating.


def sign_payload(payload: dict, secret: str) -> str:
    """Return HMAC-SHA256 hex signature for payload using secret."""
    body = json.dumps(payload, separators=(',', ':'), ensure_ascii=False)
    return hmac.new(secret.encode('utf-8'), body.encode('utf-8'), hashlib.sha256).hexdigest()


def verify_signature(body_bytes: bytes, signature: str, secret: str) -> bool:
    computed = hmac.new(secret.encode('utf-8'), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)


def build_upi_uri(vpa: str, name: str, amount: float, txn_id: str, note: str = '') -> str:
    """Build a UPI payment URI usable by GPay/PhonePe apps and for generating QR codes.

    Example: upi://pay?pa=merchant@upi&pn=Whimsy%20%26%20Weave&tn=ORDER123&am=499.00&cu=INR
    """
    pa = vpa
    pn = name.replace('&', 'and')
    tn = str(txn_id)
    am = f"{amount:.2f}"
    uri = f"upi://pay?pa={pa}&pn={pn}&tn={tn}&am={am}&cu=INR"
    if note:
        uri += f"&tn={note}"
    return uri
