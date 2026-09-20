"""Validate a full normalized Notion snapshot before an insert-only Preview import."""
from datetime import date
from uuid import UUID


def identifier(value):
    return str(UUID(str(value)))


def prepare(projects, tasks):
    rows, task_ids, ids = [], set(), set()
    for task in tasks:
        key = identifier(task['id'])
        if key in task_ids:
            raise ValueError('Duplicate task ID in snapshot.')
        task_ids.add(key)
    for project in projects:
        key = identifier(project['id'])
        if key in ids:
            raise ValueError('Duplicate project ID in snapshot.')
        ids.add(key)
        name = project['name']
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValueError('Invalid project name.')
        status = project['status']
        if status not in ('Active', 'Completed', 'Archived'):
            raise ValueError('Invalid project status.')
        due = project.get('due')
        if due is not None:
            # Reject timed values instead of silently truncating them.
            if not isinstance(due, str) or len(due) != 10:
                raise ValueError('Project target must be a date.')
            date.fromisoformat(due)
        related = [identifier(t) for t in project.get('taskIds', [])]
        for task_id in related:
            if task_id not in task_ids:
                raise ValueError('Project references a task absent from the full snapshot.')
        if len(set(related)) != len(related):
            raise ValueError('Duplicate project task link.')
        rows.append({'id': key, 'name': name, 'status': status, 'due': due, 'taskIds': sorted(related)})
    by_id = {row['id']: row for row in rows}
    # Task-side relations avoid Notion's capped project-side inline relation list.
    linked = {key: set() for key in ids}
    for task in tasks:
        task_id = identifier(task['id'])
        project_ids = [identifier(v) for v in task.get('projectIds', [])]
        if len(project_ids) > 1 or set(project_ids) - ids:
            raise ValueError('Unresolved or multiple project relations; reconcile before importing.')
        if not project_ids and task.get('project'):
            matches = [r['id'] for r in rows if r['name'] == task['project']]
            if len(matches) != 1:
                raise ValueError('Unresolved legacy project name; reconcile before importing.')
            project_ids = matches
        for key in project_ids:
            linked[key].add(task_id)
        for row in rows:
            if task_id in row['taskIds'] and row['id'] not in project_ids:
                raise ValueError('Project/task relations disagree; reconcile before importing.')
    for key, related in linked.items():
        by_id[key]['taskIds'] = sorted(related)
    return rows


def import_preview(connection, owner_id, rows):
    """No overwrite or deletion. Retry identical data; abort atomically on drift."""
    owner_id = identifier(owner_id)
    inserted = 0
    with connection.transaction():
        connection.execute('SELECT pg_advisory_xact_lock(726032020)')
        connection.execute("SELECT set_config('nocean.owner_id',%s,true)", (owner_id,))
        if not connection.execute('SELECT 1 FROM nocean.owners WHERE id=%s', (owner_id,)).fetchone():
            raise ValueError('Register the verified owner identity before import.')
        for row in rows:
            values = (row['id'], row['name'], row['status'], row['due'])
            existing = connection.execute('''SELECT notion_id,name,status,target_date FROM nocean.projects
                WHERE owner_id=%s AND id=%s''', (owner_id, row['id'])).fetchone()
            if existing:
                normalized = (str(existing[0]), existing[1], existing[2],
                              existing[3].isoformat() if existing[3] else None)
                related = sorted(str(r[0]) for r in connection.execute('''SELECT notion_task_id
                    FROM nocean.project_task_links WHERE owner_id=%s AND project_id=%s''', (owner_id, row['id'])))
                if normalized != values or related != row['taskIds']:
                    raise ValueError('Preview differs from snapshot; reconcile before retrying. Nothing overwritten.')
                continue
            connection.execute('''INSERT INTO nocean.projects(owner_id,id,notion_id,name,status,target_date)
                VALUES (%s,%s,%s,%s,%s,%s)''', (owner_id, row['id'], *values))
            for task_id in row['taskIds']:
                connection.execute('''INSERT INTO nocean.project_task_links(owner_id,project_id,notion_task_id)
                    VALUES (%s,%s,%s)''', (owner_id, row['id'], task_id))
            inserted += 1
    return inserted
