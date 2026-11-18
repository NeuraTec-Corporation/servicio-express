CREATE TABLE IF NOT EXISTS management_entries (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES organizations,
 entry_type text NOT NULL CHECK(entry_type IN ('purchase','sale','repair','expense')),
 category text NOT NULL CHECK(category IN ('phone','part','piece','service','other')),
 occurred_on date NOT NULL,
 brand text NOT NULL DEFAULT '', model text NOT NULL DEFAULT '', variant text NOT NULL DEFAULT '',
 part text NOT NULL DEFAULT '', piece text NOT NULL DEFAULT '', technician text NOT NULL DEFAULT '',
 office text NOT NULL DEFAULT '', supplier text NOT NULL DEFAULT '',
 quantity numeric(14,3) NOT NULL CHECK(quantity>0),
 unit_cost numeric(14,2) CHECK(unit_cost>=0), unit_price numeric(14,2) CHECK(unit_price>=0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((entry_type IN ('purchase','expense') AND unit_cost IS NOT NULL) OR (entry_type IN ('sale','repair') AND unit_price IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS management_period ON management_entries(tenant_id,occurred_on DESC);
