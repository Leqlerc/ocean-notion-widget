"""Explicit Preview-only operator tool; dry-run never opens a database connection."""
import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.project_import import prepare, import_preview
from lib.sql_migrations import migrate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['dry-run', 'migrate', 'import'])
    parser.add_argument('--snapshot', type=Path)
    parser.add_argument('--owner')
    parser.add_argument('--confirm-preview', action='store_true')
    args = parser.parse_args()
    rows = None
    if args.action in ('dry-run', 'import'):
        if not args.snapshot:
            parser.error('--snapshot is required')
        snapshot = json.loads(args.snapshot.read_text())
        rows = prepare(snapshot['projects'], snapshot['tasks'])
        print(json.dumps({'projects': len(rows), 'taskLinks': sum(len(r['taskIds']) for r in rows),
                          'mode': args.action}))
    if args.action == 'dry-run':
        return
    if not args.confirm_preview or os.getenv('NOCEAN_DB_ENV') != 'preview':
        parser.error('Set NOCEAN_DB_ENV=preview and --confirm-preview; production writes are not supported.')
    # Deliberately separate from a production DATABASE_URL.
    url = os.getenv('NOCEAN_PREVIEW_DATABASE_URL', '')
    if not url:
        parser.error('NOCEAN_PREVIEW_DATABASE_URL is missing')
    if args.action == 'import' and not args.owner:
        parser.error('--owner is required; never infer an identity from imported data')
    import psycopg
    with psycopg.connect(url, connect_timeout=10, sslmode='require', autocommit=True) as connection:
        if args.action == 'migrate':
            print(json.dumps({'applied': migrate(connection)}))
        else:
            print(json.dumps({'inserted': import_preview(connection, args.owner, rows)}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Driver exceptions can contain connection strings or imported values.
        print('Operation failed. No credentials or record contents were logged. Check configuration and snapshot validation.', file=sys.stderr)
        sys.exit(1)
