"""Small PostgreSQL repository for provider identity, encrypted secrets and snapshots."""
import json
import os
from contextlib import contextmanager
from lib.integrations.security import owner_id


def configured():
    return all(os.getenv(k) for k in ('NOCEAN_DATABASE_URL','NOCEAN_OWNER_ID','NOCEAN_TOKEN_KEY','NOCEAN_OWNER_SECRET','NOCEAN_PUBLIC_ORIGIN'))


def encrypt(value):
    from cryptography.fernet import Fernet
    return Fernet(os.environ['NOCEAN_TOKEN_KEY'].encode()).encrypt(value.encode()).decode()


def decrypt(value):
    from cryptography.fernet import Fernet
    return Fernet(os.environ['NOCEAN_TOKEN_KEY'].encode()).decrypt(value.encode()).decode()


@contextmanager
def connection():
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.conninfo import conninfo_to_dict
    url = os.environ['NOCEAN_DATABASE_URL']
    if conninfo_to_dict(url).get('sslmode') not in ('require','verify-ca','verify-full'):
        raise RuntimeError('TLS database connection required.')
    with psycopg.connect(url, connect_timeout=8, row_factory=dict_row) as db:
        role = db.execute('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user').fetchone()
        if role['rolsuper'] or role['rolbypassrls']:
            raise RuntimeError('Use a non-admin runtime database role.')
        db.execute("SELECT set_config('nocean.owner_id',%s,true)", (owner_id(),))
        db.execute("SET LOCAL statement_timeout='10s'")
        yield db


def lock(db, provider):
    # Serialize refresh-token rotation, sync and mutations across serverless instances.
    db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (owner_id()+':'+provider,))


def account(db, provider):
    return db.execute('SELECT * FROM nocean.provider_accounts WHERE owner_id=%s AND provider=%s', (owner_id(),provider)).fetchone()


def save_account(db, provider, account_id, label, secret, metadata=None):
    old = account(db, provider)
    if old and old['account_id'] != account_id:
        raise ValueError('Only the connected account can be reauthorized; switching accounts requires migrating its mappings.')
    db.execute('''INSERT INTO nocean.provider_accounts(owner_id,provider,account_id,label,secret_ciphertext,metadata)
        VALUES (%s,%s,%s,%s,%s,%s::jsonb) ON CONFLICT(owner_id,provider) DO UPDATE
        SET label=excluded.label,secret_ciphertext=excluded.secret_ciphertext,metadata=excluded.metadata''',
        (owner_id(),provider,account_id,label,encrypt(secret),json.dumps(metadata or {})))


def put_item(db, provider, account_id, external_id, payload, local_id=None):
    db.execute('''INSERT INTO nocean.provider_items(owner_id,provider,account_id,external_id,payload,local_id)
        VALUES (%s,%s,%s,%s,%s::jsonb,%s) ON CONFLICT(owner_id,provider,external_id)
        DO UPDATE SET payload=excluded.payload,local_id=coalesce(excluded.local_id,nocean.provider_items.local_id),updated_at=now()''',
        (owner_id(),provider,account_id,external_id,json.dumps(payload),local_id))


def items(db, provider):
    return db.execute('SELECT external_id,local_id,payload FROM nocean.provider_items WHERE owner_id=%s AND provider=%s', (owner_id(),provider)).fetchall()


def synced(db, provider):
    db.execute("UPDATE nocean.provider_accounts SET last_sync_at=now(),sync_status='ok',sync_error=NULL WHERE owner_id=%s AND provider=%s", (owner_id(),provider))


def failed(provider):
    # Separate transaction: retain the last complete snapshot on upstream failure.
    with connection() as db:
        db.execute("UPDATE nocean.provider_accounts SET sync_status='error',sync_error='Sync failed; previous data retained. Reconnect if access was revoked.' WHERE owner_id=%s AND provider=%s", (owner_id(),provider))


def cached_outlook():
    with connection() as db:
        row = account(db,'outlook')
        if not row: return None
        return {'events':[x['payload'] for x in items(db,'outlook')], 'lastSync':str(row['last_sync_at'] or ''), 'status':row['sync_status']}
