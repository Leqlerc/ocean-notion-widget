#!/usr/bin/env python3
"""Apply additive migrations, grant runtime access and prove committed SQL read/write.

Credentials come only from the operator environment. Never runs at request time.
Notion remains authoritative; no existing Tasks/Projects are imported or edited.
"""
import argparse
import os
import secrets
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))


def setup(environment):
    import psycopg
    from psycopg import sql
    from psycopg.conninfo import conninfo_to_dict
    from lib.sql_migrations import migrate
    from lib.integrations import store
    from lib.integrations.security import owner_id, session_key
    if os.environ.get('NOCEAN_DB_ENV')!=environment:
        raise ValueError('NOCEAN_DB_ENV must match --environment.')
    if not store.configured(): raise ValueError('Runtime configuration is incomplete.')
    session_key()
    admin=os.environ['NOCEAN_MIGRATION_DATABASE_URL']
    if conninfo_to_dict(admin).get('sslmode') not in ('require','verify-ca','verify-full'):
        raise ValueError('Migration connection requires TLS.')
    # Read the provisioned runtime identity from its own connection, never from untrusted CLI SQL.
    with store.connection() as runtime:
        runtime_role=runtime.execute('SELECT current_user AS name').fetchone()['name']
    with psycopg.connect(admin,connect_timeout=8) as db:
        if db.execute('SELECT current_user').fetchone()[0]==runtime_role:
            raise ValueError('Migration and runtime must use separate database roles.')
        versions=migrate(db)
        db.execute('''INSERT INTO nocean.owners(id,auth_issuer,auth_subject,timezone)
            VALUES (%s,'nocean-owner-key',%s,'America/Indiana/Indianapolis') ON CONFLICT(id) DO NOTHING''',(owner_id(),owner_id()))
        db.execute(sql.SQL('GRANT USAGE ON SCHEMA nocean TO {}').format(sql.Identifier(runtime_role)))
        for table in ('provider_accounts','provider_items','provider_operations','oauth_requests'):
            db.execute(sql.SQL('GRANT SELECT,INSERT,UPDATE,DELETE ON nocean.{} TO {}').format(sql.Identifier(table),sql.Identifier(runtime_role)))
    probe=secrets.token_hex(32); value=store.encrypt('durable-read-write-check')
    try:
        with store.connection() as db:
            db.execute("INSERT INTO nocean.oauth_requests VALUES (%s,%s,%s,now()+interval '1 minute')",(owner_id(),probe,value))
        with store.connection() as db:
            result=db.execute('SELECT verifier_ciphertext FROM nocean.oauth_requests WHERE owner_id=%s AND state_hash=%s',(owner_id(),probe)).fetchone()
            if not result or store.decrypt(result['verifier_ciphertext'])!='durable-read-write-check':
                raise RuntimeError('Committed read/write verification failed.')
    finally:
        with store.connection() as db:
            db.execute('DELETE FROM nocean.oauth_requests WHERE owner_id=%s AND state_hash=%s',(owner_id(),probe))
    return versions


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment',choices=('preview','production'),required=True)
    parser.add_argument('--confirm-additive-migration',action='store_true',required=True)
    args=parser.parse_args()
    try:
        applied=setup(args.environment)
        print('Applied:',', '.join(applied) or 'already current')
        print('PASS: encrypted value committed, read from a second connection, and cleaned up.')
    except Exception:
        print('Setup failed. Check separate role grants, TLS connection, environment and migration prerequisites; no credentials printed.',file=sys.stderr)
        sys.exit(1)
