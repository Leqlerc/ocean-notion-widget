"""Offline migration tooling. No deployed API imports this module."""
from hashlib import sha256
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations' / 'sql'


def migrate(connection, directory=MIGRATIONS):
    """Apply all pending migrations atomically under a transaction advisory lock."""
    applied = []
    with connection.transaction():
        connection.execute('SELECT pg_advisory_xact_lock(726032019)')
        connection.execute('CREATE SCHEMA IF NOT EXISTS nocean')
        connection.execute('''CREATE TABLE IF NOT EXISTS nocean.schema_migrations
            (version text PRIMARY KEY, checksum text NOT NULL,
             applied_at timestamptz NOT NULL DEFAULT now())''')
        known = dict(connection.execute('SELECT version,checksum FROM nocean.schema_migrations'))
        files = sorted(directory.glob('*.sql'))
        if set(known) - {f.name for f in files}:
            raise ValueError('Database contains migrations absent from this checkout.')
        for file in files:
            body = file.read_text()
            digest = sha256(body.encode()).hexdigest()
            if file.name in known:
                if known[file.name] != digest:
                    raise ValueError('Applied migration checksum changed: ' + file.name)
                continue
            connection.execute(body)
            connection.execute('INSERT INTO nocean.schema_migrations(version,checksum) VALUES (%s,%s)',
                               (file.name, digest))
            applied.append(file.name)
    return applied
