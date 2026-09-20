"""Real PostgreSQL integration tests. Install requirements-db-test.txt to run."""
import tempfile
import unittest
import os
from pathlib import Path
from uuid import uuid4

from lib.project_import import prepare, import_preview
from lib.sql_migrations import migrate, MIGRATIONS

try:
    import pgserver
    import psycopg
except ImportError:
    pgserver = psycopg = None


class SnapshotTests(unittest.TestCase):
    def test_missing_and_duplicate_links_rejected(self):
        p, t = str(uuid4()), str(uuid4())
        project = {'id': p, 'name': 'Goal', 'status': 'Active', 'taskIds': [t]}
        with self.assertRaises(ValueError): prepare([project], [])
        with self.assertRaises(ValueError): prepare([project, project], [{'id': t}])
        with self.assertRaises(ValueError): prepare([{**project, 'due': '2026-09-20T15:30:00-04:00'}], [{'id': t}])

    def test_task_side_links_restore_capped_project_list(self):
        p = str(uuid4())
        tasks = [{'id': str(uuid4()), 'projectIds': [p]} for _ in range(30)]
        rows = prepare([{'id': p, 'name': 'Goal', 'status': 'Active', 'due': '2027-01-18',
                         'taskIds': [t['id'] for t in tasks[:25]]}], tasks)
        self.assertEqual(len(rows[0]['taskIds']), 30)
        self.assertEqual(rows[0]['id'], p)
        self.assertEqual(rows[0]['due'], '2027-01-18')

    def test_legacy_name_and_conflicting_relations(self):
        p, t = str(uuid4()), str(uuid4())
        project = {'id': p, 'name': 'Goal', 'status': 'Completed', 'taskIds': []}
        self.assertEqual(prepare([project], [{'id': t, 'project': 'Goal'}])[0]['taskIds'], [t])
        with self.assertRaises(ValueError): prepare([project], [{'id': t, 'project': 'Missing'}])
        with self.assertRaises(ValueError): prepare([project], [{'id': t, 'projectIds': [str(uuid4())]}])
        with self.assertRaises(ValueError): prepare([{**project, 'taskIds': [t]}], [{'id': t}])

    def test_empty_projects_are_preserved(self):
        p = str(uuid4())
        rows = prepare([{'id': p, 'name': 'Future outcome', 'status': 'Active'}], [])
        self.assertEqual(rows[0]['taskIds'], [])
        self.assertIsNone(rows[0]['due'])


TEST_URL = os.getenv('NOCEAN_TEST_DATABASE_URL')

@unittest.skipUnless(psycopg and (TEST_URL or (pgserver and os.geteuid() != 0)),
                     'Requires a disposable NOCEAN_TEST_DATABASE_URL or non-root pgserver')
class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = cls.server = None
        if TEST_URL:
            # This database is destructive test-only infrastructure, never a production URL.
            cls.url = TEST_URL
        else:
            cls.temp = tempfile.TemporaryDirectory(prefix='nocean-pg-')
            cls.server = pgserver.get_server(Path(cls.temp.name)/'data')
            cls.url = cls.server.get_uri()
        cls.connection = psycopg.connect(cls.url, autocommit=True)
        if TEST_URL and not cls.connection.execute('SELECT current_database()').fetchone()[0].endswith('_test'):
            cls.connection.close()
            raise ValueError('Destructive integration tests require a database name ending in _test.')

    @classmethod
    def tearDownClass(cls):
        cls.connection.close()
        if cls.server: cls.server.cleanup()
        if cls.temp: cls.temp.cleanup()

    def setUp(self):
        self.c = self.connection
        self.c.execute('DROP SCHEMA IF EXISTS nocean CASCADE')
        migrate(self.c)
        self.owner = str(uuid4())
        self.other = str(uuid4())
        for owner in [self.owner, self.other]:
            self.c.execute('INSERT INTO nocean.owners(id,auth_issuer,auth_subject,timezone) VALUES (%s,%s,%s,%s)',
                           (owner, 'test-only', owner, 'America/Indiana/Indianapolis'))
        self.project, self.task = str(uuid4()), str(uuid4())
        self.rows = prepare([{'id': self.project, 'name': 'Pull-ups', 'status': 'Active',
                              'due': '2026-12-01', 'taskIds': [self.task]}], [{'id': self.task, 'projectIds': [self.project]}])

    def test_migration_idempotent_and_checksum_guard(self):
        self.assertEqual(migrate(self.c), [])
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'001_goals.sql'
            p.write_text((MIGRATIONS/'001_goals.sql').read_text()+'\n-- drift')
            with self.assertRaises(ValueError): migrate(self.c, Path(folder))

    def test_failed_migration_rolls_back_entire_unit(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            (p/'001_goals.sql').write_text((MIGRATIONS/'001_goals.sql').read_text())
            (p/'002_bad.sql').write_text('CREATE TABLE nocean.partial(id int); SELECT nonexistent_column;')
            with self.assertRaises(psycopg.Error): migrate(self.c, p)
        self.assertIsNone(self.c.execute("SELECT to_regclass('nocean.partial')").fetchone()[0])
        self.assertEqual(self.c.execute('SELECT count(*) FROM nocean.schema_migrations').fetchone()[0], 1)

    def test_import_retry_and_drift_rollback(self):
        self.assertEqual(import_preview(self.c, self.owner, self.rows), 1)
        self.assertEqual(import_preview(self.c, self.owner, self.rows), 0)
        another = {**self.rows[0], 'id': str(uuid4()), 'taskIds': []}
        changed = {**self.rows[0], 'name': 'Changed upstream'}
        with self.assertRaises(ValueError): import_preview(self.c, self.owner, [another, changed])
        self.assertEqual(self.c.execute('SELECT count(*) FROM nocean.projects').fetchone()[0], 1)
        self.assertEqual(self.c.execute('SELECT name FROM nocean.projects').fetchone()[0], 'Pull-ups')
        # Persistence across a fresh connection, not just in-memory state.
        with psycopg.connect(self.url) as c:
            self.assertEqual(c.execute('SELECT count(*) FROM nocean.project_task_links').fetchone()[0], 1)

    def test_unregistered_owner_rejected(self):
        with self.assertRaises(ValueError): import_preview(self.c, str(uuid4()), self.rows)

    def test_cross_owner_and_cross_project_foreign_keys(self):
        import_preview(self.c, self.owner, self.rows)
        with self.assertRaises(psycopg.errors.ForeignKeyViolation):
            self.c.execute('INSERT INTO nocean.project_objectives(owner_id,id,project_id,title) VALUES (%s,%s,%s,%s)',
                           (self.other, str(uuid4()), self.project, 'Wrong owner'))
        p2, phase = str(uuid4()), str(uuid4())
        import_preview(self.c, self.owner, [{**self.rows[0], 'id': p2, 'taskIds': []}])
        self.c.execute('INSERT INTO nocean.project_phases(owner_id,id,project_id,title) VALUES (%s,%s,%s,%s)',
                       (self.owner, phase, self.project, 'Phase'))
        with self.assertRaises(psycopg.errors.ForeignKeyViolation):
            self.c.execute('INSERT INTO nocean.project_milestones(owner_id,id,project_id,phase_id,title) VALUES (%s,%s,%s,%s,%s)',
                           (self.owner, str(uuid4()), p2, phase, 'Wrong project'))

    def test_runtime_role_cannot_read_or_write_another_owner(self):
        import_preview(self.c, self.owner, self.rows)
        self.c.execute('DROP ROLE IF EXISTS nocean_test_runtime')
        self.c.execute('CREATE ROLE nocean_test_runtime NOSUPERUSER NOBYPASSRLS')
        self.c.execute('GRANT USAGE ON SCHEMA nocean TO nocean_test_runtime')
        self.c.execute('GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA nocean TO nocean_test_runtime')
        try:
            with self.c.transaction():
                self.c.execute('SET LOCAL ROLE nocean_test_runtime')
                self.assertEqual(self.c.execute('SELECT count(*) FROM nocean.projects').fetchone()[0], 0)
                self.c.execute("SELECT set_config('nocean.owner_id',%s,true)", (self.other,))
                self.assertEqual(self.c.execute('SELECT count(*) FROM nocean.projects').fetchone()[0], 0)
                self.c.execute("SELECT set_config('nocean.owner_id',%s,true)", (self.owner,))
                self.assertEqual(self.c.execute('SELECT count(*) FROM nocean.projects').fetchone()[0], 1)
                with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                    with self.c.transaction():
                        self.c.execute('INSERT INTO nocean.projects(owner_id,id,name,status) VALUES (%s,%s,%s,%s)',
                                       (self.other, str(uuid4()), 'Wrong owner', 'Active'))
        finally:
            self.c.execute('DROP OWNED BY nocean_test_runtime')
            self.c.execute('DROP ROLE nocean_test_runtime')


if __name__ == '__main__': unittest.main()
