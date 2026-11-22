ALTER TABLE stock_batches ADD COLUMN condition text NOT NULL DEFAULT 'unknown' CHECK(condition IN ('unknown','new','used','refurbished','defective'));
ALTER TABLE stock_batches ADD COLUMN inspected boolean NOT NULL DEFAULT false;
ALTER TABLE stock_batches ADD COLUMN sku text NOT NULL DEFAULT '';
ALTER TABLE stock_batches ADD COLUMN compatible_models jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(compatible_models)='array');
ALTER TABLE work_order_quotes ADD COLUMN plan_revision integer;
ALTER TABLE work_order_quotes ADD COLUMN approval_channel text NOT NULL DEFAULT 'unknown';
ALTER TABLE work_order_quotes ADD COLUMN respondent text NOT NULL DEFAULT '';
ALTER TABLE work_order_media ADD COLUMN issue_id uuid;
ALTER TABLE work_order_media ADD COLUMN request_id uuid;
ALTER TABLE work_order_media ADD COLUMN evidence_kind text NOT NULL DEFAULT 'general' CHECK(evidence_kind IN ('general','old_part','expected_part','received_part'));
CREATE TABLE workshop_catalog (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,
 kind text NOT NULL CHECK(kind IN ('device','brand','model','damage','solution','part')),
 label_es text NOT NULL,label_en text NOT NULL,active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,kind,label_es)
);
CREATE TABLE workshop_suppliers (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES organizations,
 slot integer NOT NULL CHECK(slot BETWEEN 1 AND 5),name text NOT NULL,url text NOT NULL,
 is_placeholder boolean NOT NULL DEFAULT true,active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,slot)
);
INSERT INTO workshop_suppliers(id,tenant_id,slot,name,url)
 SELECT overlay(overlay(md5('se-supplier-'||o.id::text||n) placing '4' from 13 for 1) placing 'a' from 17 for 1)::uuid,o.id,n,'Mayorista '||n,'https://example.com/#mayorista-'||n FROM organizations o CROSS JOIN generate_series(1,5) n;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['workshop_catalog','workshop_suppliers'] LOOP EXECUTE format('CREATE TRIGGER se_revision AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION se_data_changed()',t); END LOOP;
END $$;
INSERT INTO workshop_catalog(id,tenant_id,kind,label_es,label_en)
 SELECT overlay(overlay(md5(o.id::text||v.kind||v.es) placing '4' from 13 for 1) placing 'a' from 17 for 1)::uuid,o.id,v.kind,v.es,v.en FROM organizations o CROSS JOIN(VALUES
 ('device','Teléfono','Phone'),('device','Tablet / iPad','Tablet / iPad'),('device','Laptop','Laptop'),('device','PC','Desktop'),('device','Otro','Other'),
 ('brand','Apple','Apple'),('brand','Samsung','Samsung'),
 ('damage','Pantalla dañada','Damaged screen'),('damage','Batería agotada','Worn battery'),('damage','No carga','Not charging'),('damage','Daño por líquido','Liquid damage'),('damage','Falla de audio','Audio fault'),
 ('solution','Cambio de pantalla','Screen replacement'),('solution','Cambio de batería','Battery replacement'),('solution','Cambio de conector','Charging port replacement'),('solution','Limpieza técnica','Technical cleaning'),('solution','Diagnóstico sin repuesto','Diagnosis without parts')
 )v(kind,es,en);
