-- Preview foundation only. Existing Notion stores remain authoritative.
CREATE TABLE nocean.owners (
 id uuid PRIMARY KEY,
 auth_issuer text NOT NULL CHECK (length(auth_issuer) > 0),
 auth_subject text NOT NULL CHECK (length(auth_subject) > 0),
 timezone text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (auth_issuer, auth_subject)
);
CREATE TABLE nocean.projects (
 owner_id uuid NOT NULL REFERENCES nocean.owners(id),
 id uuid NOT NULL,
 notion_id uuid,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
 outcome text NOT NULL DEFAULT '',
 overview text NOT NULL DEFAULT '',
 notes text NOT NULL DEFAULT '',
 start_date date,
 target_date date,
 status text NOT NULL CHECK (status IN ('Active','Completed','Archived')),
 revision bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (owner_id,id),
 UNIQUE (owner_id,notion_id),
 CHECK (start_date IS NULL OR target_date IS NULL OR start_date <= target_date)
);
CREATE INDEX projects_status ON nocean.projects(owner_id,status,target_date);
CREATE TABLE nocean.project_phases (
 owner_id uuid NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
 position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
 start_date date, end_date date,
 PRIMARY KEY (owner_id,id), UNIQUE (owner_id,project_id,id),
 FOREIGN KEY (owner_id,project_id) REFERENCES nocean.projects(owner_id,id),
 CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE TABLE nocean.project_objectives (
 owner_id uuid NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
 position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
 completed_at timestamptz,
 PRIMARY KEY (owner_id,id),
 FOREIGN KEY (owner_id,project_id) REFERENCES nocean.projects(owner_id,id)
);
CREATE TABLE nocean.project_milestones (
 owner_id uuid NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL, phase_id uuid,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
 target_date date, completed_at timestamptz,
 PRIMARY KEY (owner_id,id),
 FOREIGN KEY (owner_id,project_id) REFERENCES nocean.projects(owner_id,id),
 FOREIGN KEY (owner_id,project_id,phase_id) REFERENCES nocean.project_phases(owner_id,project_id,id)
);
CREATE INDEX milestones_due ON nocean.project_milestones(owner_id,project_id,target_date);
CREATE TABLE nocean.project_metrics (
 owner_id uuid NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
 unit text NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 50),
 target numeric,
 direction text NOT NULL CHECK (direction IN ('increase','decrease','maintain')),
 -- Only manual measurements until Training/Nutrition adapters are connected.
 source text NOT NULL DEFAULT 'manual' CHECK (source = 'manual'),
 PRIMARY KEY (owner_id,id),
 FOREIGN KEY (owner_id,project_id) REFERENCES nocean.projects(owner_id,id)
);
CREATE TABLE nocean.metric_samples (
 owner_id uuid NOT NULL, id uuid NOT NULL, metric_id uuid NOT NULL,
 measured_at timestamptz NOT NULL, value numeric NOT NULL,
 note text NOT NULL DEFAULT '',
 PRIMARY KEY (owner_id,id),
 FOREIGN KEY (owner_id,metric_id) REFERENCES nocean.project_metrics(owner_id,id)
);
CREATE INDEX metric_history ON nocean.metric_samples(owner_id,metric_id,measured_at DESC);
-- References only: tasks stay in their existing store. Never copy planning/deadlines here.
CREATE TABLE nocean.project_task_links (
 owner_id uuid NOT NULL, project_id uuid NOT NULL, notion_task_id uuid NOT NULL,
 PRIMARY KEY (owner_id,notion_task_id),
 FOREIGN KEY (owner_id,project_id) REFERENCES nocean.projects(owner_id,id)
);
CREATE INDEX project_tasks ON nocean.project_task_links(owner_id,project_id);
-- Defense in depth for a future non-owner runtime role. Not a substitute for HTTP authentication.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['projects','project_phases','project_objectives',
  'project_milestones','project_metrics','metric_samples','project_task_links'] LOOP
  EXECUTE format('ALTER TABLE nocean.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE nocean.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_scope ON nocean.%I USING
   (owner_id = nullif(current_setting(''nocean.owner_id'', true),'''')::uuid)
   WITH CHECK (owner_id = nullif(current_setting(''nocean.owner_id'', true),'''')::uuid)',t);
 END LOOP;
END $$;
