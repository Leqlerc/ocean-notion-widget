"""Single-owner integration boundary; existing public Tasks routes are unchanged."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from uuid import UUID

COOKIE = '__Host-nocean_owner'


def owner_id():
    return str(UUID(os.environ['NOCEAN_OWNER_ID']))


def session_key():
    key = os.getenv('NOCEAN_OWNER_SECRET', '')
    if len(key) < 32:
        raise RuntimeError('Owner access is not configured.')
    return key.encode()


def sign(payload):
    value = base64.urlsafe_b64encode(json.dumps(payload, separators=(',', ':')).encode()).decode()
    return value + '.' + hmac.new(session_key(), value.encode(), hashlib.sha256).hexdigest()


def new_session(secret):
    if not isinstance(secret, str) or not hmac.compare_digest(secret.encode(), session_key()):
        raise PermissionError('Owner access denied.')
    return sign({'owner': owner_id(), 'exp': int(time.time()) + 28800, 'csrf': secrets.token_urlsafe(32)})


def session(headers):
    try:
        cookies = SimpleCookie(); cookies.load(headers.get('Cookie', ''))
        value, signature = cookies[COOKIE].value.rsplit('.', 1)
        if not hmac.compare_digest(signature, hmac.new(session_key(), value.encode(), hashlib.sha256).hexdigest()):
            return None
        data = json.loads(base64.urlsafe_b64decode(value))
        if data['owner'] != owner_id() or data['exp'] <= time.time():
            return None
        return data
    except (KeyError, ValueError, TypeError, RuntimeError):
        return None


def check_origin(headers):
    origin = os.environ.get('NOCEAN_PUBLIC_ORIGIN', '').rstrip('/')
    if not origin.startswith('https://') or urlsplit(origin).path:
        raise RuntimeError('Canonical HTTPS origin is not configured.')
    if headers.get('Origin') != origin or headers.get('Sec-Fetch-Site') == 'cross-site':
        raise PermissionError('Cross-origin request denied.')


def require_owner(headers, write=False):
    data = session(headers)
    if not data:
        raise PermissionError('Unlock Integrations first.')
    if write:
        check_origin(headers)
        if not hmac.compare_digest(headers.get('X-NOcean-CSRF', ''), data['csrf']):
            raise PermissionError('Session expired. Unlock Integrations again.')
    return data


def cookie_header(value, clear=False):
    return f'{COOKIE}={value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age={0 if clear else 28800}'
