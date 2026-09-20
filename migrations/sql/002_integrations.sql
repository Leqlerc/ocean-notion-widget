-- Additive integration state. Existing Notion data is never rewritten by migration.
CREATE TABLE nocean.provider_accounts (
 owner_id uuid NOT NULL REFERENCES nocean.owners(id),
 provider text NOT NULL CHECK (provider IN ('outlook','brightspace')),
 account_id text NOT NULL,
 label text NOT NULL DEFAULT '',
 secret_ciphertext text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}',
 last_sync_at timestamptz,
 sync_status text NOT NULL DEFAULT 'connected' CHECK (sync_status IN ('connected','ok','error')),
 sync_error text,
 PRIMARY KEY(owner_id,provider)
);
CREATE TABLE nocean.provider_items (
 owner_id uuid NOT NULL, provider text NOT NULL,
 external_id text NOT NULL, account_id text NOT NULL,
 local_id text, payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,provider,external_id),
 FOREIGN KEY(owner_id,provider) REFERENCES nocean.provider_accounts(owner_id,provider)
);
CREATE TABLE nocean.provider_operations (
 owner_id uuid NOT NULL, provider text NOT NULL, operation_id uuid NOT NULL,
 request_hash text NOT NULL, external_id text,
 PRIMARY KEY(owner_id,provider,operation_id),
 FOREIGN KEY(owner_id,provider) REFERENCES nocean.provider_accounts(owner_id,provider)
);
CREATE TABLE nocean.oauth_requests (
 owner_id uuid NOT NULL REFERENCES nocean.owners(id), state_hash text NOT NULL,
 verifier_ciphertext text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(owner_id,state_hash)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['provider_accounts','provider_items','provider_operations','oauth_requests'] LOOP
  EXECUTE format('ALTER TABLE nocean.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE nocean.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_scope ON nocean.%I USING
   (owner_id = nullif(current_setting(''nocean.owner_id'', true),'''')::uuid)
   WITH CHECK (owner_id = nullif(current_setting(''nocean.owner_id'', true),'''')::uuid)',t);
 END LOOP;
END $$;
