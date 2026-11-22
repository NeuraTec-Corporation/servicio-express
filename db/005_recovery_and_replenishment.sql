ALTER TABLE stock_batches ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
CREATE TABLE stock_reorder_rules (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,
 part text NOT NULL,office text NOT NULL,minimum integer NOT NULL CHECK(minimum>=0),
 target integer NOT NULL CHECK(target>=minimum),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,part,office)
);
CREATE TABLE recovery_uploads (
 tenant_id uuid NOT NULL REFERENCES organizations,id uuid NOT NULL,chunk integer NOT NULL CHECK(chunk BETWEEN 0 AND 63),
 content bytea NOT NULL CHECK(octet_length(content)<=2097152),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id,chunk)
);
