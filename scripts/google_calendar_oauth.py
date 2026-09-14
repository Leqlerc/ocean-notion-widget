#!/usr/bin/env python3
"""Generate the Google OAuth values required by NOcean.

Usage:
    python scripts/google_calendar_oauth.py path/to/credentials.json
"""
from pathlib import Path
import sys

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    raise SystemExit(
        "Missing dependency. Run:\n"
        "  python -m pip install --upgrade google-auth-oauthlib"
    )

SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly"


def main():
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: python google_calendar_oauth.py path/to/credentials.json"
        )

    credentials_path = Path(sys.argv[1]).expanduser().resolve()
    if not credentials_path.is_file():
        raise SystemExit(f"Credentials file not found: {credentials_path}")

    flow = InstalledAppFlow.from_client_secrets_file(
        str(credentials_path),
        [SCOPE],
    )
    credentials = flow.run_local_server(
        port=0,
        access_type="offline",
        prompt="consent",
    )

    if not credentials.refresh_token:
        raise SystemExit(
            "Google did not return a refresh token. Revoke the app grant in "
            "your Google Account and run this helper again."
        )

    print("\nAuthorization complete. Keep these values private:\n")
    print(f"GOOGLE_CLIENT_ID={credentials.client_id}")
    print(f"GOOGLE_CLIENT_SECRET={credentials.client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={credentials.refresh_token}")


if __name__ == "__main__":
    main()
