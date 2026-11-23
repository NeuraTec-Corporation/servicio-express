ALTER TABLE work_order_quotes ADD COLUMN issue_authorization jsonb;
ALTER TABLE stock_batches ADD COLUMN origin text NOT NULL DEFAULT 'purchase' CHECK(origin IN ('purchase','initial','transfer'));
ALTER TABLE stock_batches ADD COLUMN cost_known boolean NOT NULL DEFAULT true;
ALTER TABLE stock_batches ADD COLUMN barcode text NOT NULL DEFAULT '';
CREATE INDEX stock_barcode_office ON stock_batches(tenant_id,office,barcode) WHERE barcode<>'';
CREATE TABLE user_preferences(
 tenant_id uuid NOT NULL REFERENCES organizations,user_code text NOT NULL,name text NOT NULL,
 value jsonb NOT NULL CHECK(jsonb_typeof(value)='array'),version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,user_code,name)
);
CREATE TABLE inventory_counts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,office text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','applied')),version integer NOT NULL DEFAULT 1,
 lines jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(lines)='array'),created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz
);
CREATE TABLE operational_signals(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,user_code text NOT NULL,
 module text NOT NULL,status integer NOT NULL,occurrences integer NOT NULL DEFAULT 1,
 last_seen timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,user_code,module)
);
CREATE TRIGGER se_revision AFTER INSERT OR UPDATE OR DELETE ON user_preferences FOR EACH ROW EXECUTE FUNCTION se_data_changed();
CREATE TRIGGER se_revision AFTER INSERT OR UPDATE OR DELETE ON inventory_counts FOR EACH ROW EXECUTE FUNCTION se_data_changed();
