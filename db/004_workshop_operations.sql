CREATE TABLE stock_batches (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES organizations,
 part text NOT NULL, brand text NOT NULL DEFAULT '', model text NOT NULL DEFAULT '',
 office text NOT NULL, supplier text NOT NULL, invoice text NOT NULL DEFAULT '',
 unit_cost numeric(14,2) NOT NULL CHECK(unit_cost>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 ordered_quantity integer NOT NULL CHECK(ordered_quantity>0),
 received_quantity integer NOT NULL DEFAULT 0 CHECK(received_quantity>=0),
 on_hand integer NOT NULL DEFAULT 0 CHECK(on_hand>=0), reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), CHECK(received_quantity<=ordered_quantity)
);
CREATE TABLE work_order_parts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations, order_id uuid NOT NULL REFERENCES work_orders,
 batch_id uuid NOT NULL, quantity integer NOT NULL CHECK(quantity>0),
 state text NOT NULL CHECK(state IN ('reserved','consumed','returned')),
 unit_cost numeric(14,2) NOT NULL, currency text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES stock_batches(tenant_id,id)
);
CREATE INDEX work_order_parts_order ON work_order_parts(tenant_id,order_id);
CREATE TABLE work_order_quotes (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,order_id uuid NOT NULL REFERENCES work_orders,
 revision integer NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 lines jsonb NOT NULL, total numeric(14,2) NOT NULL CHECK(total>=0), previous_total numeric(14,2),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 response_evidence text NOT NULL DEFAULT '', responded_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,order_id,revision)
);
CREATE TABLE work_order_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,
 order_id uuid NOT NULL REFERENCES work_orders, action text NOT NULL, detail jsonb NOT NULL,
 stage text NOT NULL, paused boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_order_events_order ON work_order_events(tenant_id,order_id,created_at);
CREATE TABLE work_order_media (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,order_id uuid NOT NULL REFERENCES work_orders,
 filename text NOT NULL,media_type text NOT NULL,caption text NOT NULL,
 original bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workshop_commands (
 id uuid NOT NULL,tenant_id uuid NOT NULL REFERENCES organizations,digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id)
);
CREATE TABLE stock_movements (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,batch_id uuid NOT NULL REFERENCES stock_batches,
 order_id uuid REFERENCES work_orders,kind text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workshop_ledger_links (
 tenant_id uuid NOT NULL REFERENCES organizations,entry_id uuid PRIMARY KEY REFERENCES management_entries,
 source_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('receive','settle'))
);
CREATE UNIQUE INDEX one_workshop_settlement ON workshop_ledger_links(tenant_id,source_id) WHERE kind='settle';
