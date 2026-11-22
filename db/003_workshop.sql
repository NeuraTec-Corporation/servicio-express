CREATE TABLE work_orders (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES organizations,
 public_code text NOT NULL,
 pos_reference text NOT NULL,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,pos_reference),
 UNIQUE(tenant_id,public_code)
);
CREATE INDEX work_orders_recent ON work_orders(tenant_id,updated_at DESC);
