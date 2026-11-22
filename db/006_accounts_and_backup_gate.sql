CREATE TABLE app_users (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,
 code text NOT NULL,role text NOT NULL CHECK(role IN ('it','owner','manager','technician','staff')),
 display_name text NOT NULL,office text NOT NULL DEFAULT 'Principal',password_hash text NOT NULL,
 active boolean NOT NULL DEFAULT true,must_change boolean NOT NULL DEFAULT true,session_epoch integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,code)
);
CREATE TABLE app_sessions (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,user_id uuid NOT NULL REFERENCES app_users,
 epoch integer NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,phone_key text NOT NULL CHECK(phone_key ~ '^[0-9]{7,15}$'),
 display_phone text NOT NULL,name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,phone_key)
);
ALTER TABLE work_orders ADD COLUMN customer_id uuid REFERENCES customers;
INSERT INTO customers(id,tenant_id,phone_key,display_phone,name)
 SELECT DISTINCT ON(tenant_id,phone_key) md5(tenant_id::text||phone_key)::uuid,tenant_id,phone_key,display_phone,name
 FROM (SELECT tenant_id,regexp_replace(regexp_replace(data->>'customer_phone','[^0-9]','','g'),'^00','') AS phone_key,data->>'customer_phone' AS display_phone,data->>'customer_name' AS name FROM work_orders) x
 WHERE phone_key ~ '^[0-9]{7,15}$' AND length(trim(coalesce(name,'')))>0 ON CONFLICT DO NOTHING;
UPDATE work_orders w SET customer_id=c.id FROM customers c WHERE c.tenant_id=w.tenant_id AND c.phone_key=regexp_replace(regexp_replace(w.data->>'customer_phone','[^0-9]','','g'),'^00','');
CREATE TABLE app_data_revision (tenant_id uuid PRIMARY KEY REFERENCES organizations,revision bigint NOT NULL DEFAULT 0);
INSERT INTO app_data_revision(tenant_id) SELECT id FROM organizations;
CREATE FUNCTION se_data_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE app_data_revision SET revision=revision+1 WHERE tenant_id=CASE WHEN TG_OP='DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sources','variants','offers','purchases','sales','management_entries','work_orders','stock_batches','work_order_parts','work_order_quotes','work_order_events','work_order_media','workshop_commands','stock_movements','workshop_ledger_links','stock_reorder_rules','customers','app_users']
 LOOP EXECUTE format('CREATE TRIGGER se_revision AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION se_data_changed()',t); END LOOP;
END $$;
CREATE TABLE external_backup_settings (
 tenant_id uuid PRIMARY KEY REFERENCES organizations,folder_id text NOT NULL,folder_name text NOT NULL,desktop_path text NOT NULL,
 provider text NOT NULL DEFAULT 'google_drive',created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO external_backup_settings(tenant_id,folder_id,folder_name,desktop_path) VALUES('00000000-0000-4000-8000-000000000001','1c7G080-rAhhDvw4pc4R6txSRZ2y5Me_b','Servicio Express — Respaldos cifrados','G:\My Drive\Servicio Express — Respaldos cifrados');
CREATE TABLE backup_agents (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,owner_id uuid NOT NULL REFERENCES app_users,
 token_hash text NOT NULL UNIQUE,active boolean NOT NULL DEFAULT true,last_seen timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE external_backups (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,requested_by text NOT NULL,reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','capturing','copied','verified','failed')),
 revision bigint,sha256 text,md5 text,bytes bigint,filename text,drive_file_id text,
 copied_at timestamptz,verified_at timestamptz,verified_by text,consumed_at timestamptz,
 agent_id uuid REFERENCES backup_agents,error text,created_at timestamptz NOT NULL DEFAULT now()
);
