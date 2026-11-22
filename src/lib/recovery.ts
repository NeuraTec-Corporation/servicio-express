import {createCipheriv,createDecipheriv,randomBytes,scryptSync} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {db,TENANT} from './db';
export const backupTables=['sources','variants','offers','purchases','sales','management_entries','work_orders','stock_batches','work_order_parts','work_order_quotes','work_order_events','work_order_media','workshop_commands','stock_movements','workshop_ledger_links','stock_reorder_rules'] as const;
type Table=typeof backupTables[number];
type Row=Record<string,unknown>;
type Archive={format:'servicio-express-backup-v1';created_at:string;tenant:string;migrations:string[];tables:Record<Table,Row[]>;audit:Row[]};
const magic=Buffer.from('SEB1');
export function encryptBackup(archive:Archive,passphrase:string){
 const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(passphrase,salt,32),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);
 const bytes=gzipSync(Buffer.from(JSON.stringify(archive)));const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
 return Buffer.concat([magic,salt,iv,cipher.getAuthTag(),encrypted]);
}
function decryptBackup(bytes:Buffer,passphrase:string):Archive {
 if(bytes.length<49||bytes.length>128*1024*1024||!bytes.subarray(0,4).equals(magic))throw new Error('Archivo de respaldo no reconocido.');
 let decoded:unknown;try{const key=scryptSync(passphrase,bytes.subarray(4,20),32);const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(20,32));cipher.setAAD(magic);cipher.setAuthTag(bytes.subarray(32,48));const compressed=Buffer.concat([cipher.update(bytes.subarray(48)),cipher.final()]);decoded=JSON.parse(gunzipSync(compressed,{maxOutputLength:256*1024*1024}).toString('utf8'))}catch{throw new Error('No se pudo abrir: clave de respaldo incorrecta o archivo dañado.');}
 if(!decoded||typeof decoded!=='object')throw new Error('Respaldo inválido');const a=decoded as Archive;
 if(a.format!=='servicio-express-backup-v1'||a.tenant!==TENANT||!a.tables||!Array.isArray(a.migrations)||!Array.isArray(a.audit))throw new Error('Formato u organización del respaldo incorrectos.');
 let count=a.audit.length;for(const table of backupTables){const rows=a.tables[table];if(!Array.isArray(rows))throw new Error(`Falta la tabla ${table}`);count+=rows.length;for(const r of rows){if(!r||typeof r!=='object'||Array.isArray(r)||r.tenant_id!==TENANT)throw new Error('El respaldo contiene registros de otra organización.');}}
 if(a.audit.some(r=>!r||r.tenant_id!==TENANT||typeof r.actor!=='string'||typeof r.action!=='string'||typeof r.entity_id!=='string'||typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at))))throw new Error('Auditoría de respaldo inválida.');
 if(count>100000)throw new Error('El respaldo supera el volumen del recuperador del piloto.');return a;
}
export async function createBackup(passphrase:string){
 return db().begin('isolation level repeatable read read only',async sql=>{
  const columns=await sql`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ${sql([...backupTables])}`;
  const tables={} as Record<Table,Row[]>;let count=0;
  for(const table of backupTables){const rows=await sql`SELECT * FROM ${sql(table)} WHERE tenant_id=${TENANT} ORDER BY 1 LIMIT 100001`;count+=rows.length;if(count>100000)throw new Error('Exporta por el procedimiento de base de datos: el volumen supera el recuperador del piloto.');tables[table]=rows.map(r=>{const copy:Row={...r};for(const c of columns.filter(c=>c.table_name===table&&c.data_type==='bytea'))copy[c.column_name]=Buffer.from(copy[c.column_name] as Uint8Array).toString('base64');return copy});}
  const audit=await sql`SELECT * FROM audit_events WHERE tenant_id=${TENANT} ORDER BY id LIMIT 100001`;if(count+audit.length>100000)throw new Error('El respaldo supera el volumen del recuperador del piloto.');
  const migrations=await sql`SELECT version FROM schema_migrations ORDER BY version`;
  const archive:Archive={format:'servicio-express-backup-v1',created_at:new Date().toISOString(),tenant:TENANT,migrations:migrations.map(m=>m.version),tables,audit};
  const bytes=encryptBackup(archive,passphrase);if(bytes.length>128*1024*1024)throw new Error('El respaldo requiere el procedimiento de base de datos por su tamaño.');return bytes;
 });
}
const relations:[Table,string,Table,string][]=[['offers','variant_id','variants','id'],['offers','source_id','sources','id'],['purchases','variant_id','variants','id'],['sales','variant_id','variants','id'],['work_order_parts','order_id','work_orders','id'],['work_order_parts','batch_id','stock_batches','id'],['work_order_quotes','order_id','work_orders','id'],['work_order_events','order_id','work_orders','id'],['work_order_media','order_id','work_orders','id'],['stock_movements','batch_id','stock_batches','id'],['stock_movements','order_id','work_orders','id'],['workshop_ledger_links','entry_id','management_entries','id']];
export async function recoverBackup(bytes:Buffer,passphrase:string,apply:boolean){
 const a=decryptBackup(bytes,passphrase);
 for(const [child,key,parent,pk]of relations){const ids=new Set(a.tables[parent].map(r=>r[pk]));if(a.tables[child].some(r=>r[key]!==null&&r[key]!==undefined&&!ids.has(r[key])))throw new Error(`Referencia incompleta en ${child}.${key}`);}
 for(const l of a.tables.workshop_ledger_links){const parent=l.kind==='receive'?a.tables.stock_batches:a.tables.work_orders;if(!parent.some(r=>r.id===l.source_id))throw new Error('Referencia financiera incompleta.');}
 return db().begin(async sql=>{
  const current=(await sql`SELECT version FROM schema_migrations ORDER BY version`).map(r=>r.version);
  if(JSON.stringify(current)!==JSON.stringify(a.migrations))throw new Error('La versión del respaldo difiere del esquema instalado. Se requiere una migración de recuperación; no se aplicó ningún cambio.');
  if(apply){await sql`SELECT pg_advisory_xact_lock(812622)`;await sql`SELECT pg_advisory_xact_lock(812623)`;await sql`SELECT pg_advisory_xact_lock(812624)`;await sql`LOCK TABLE ${sql([...backupTables])} IN EXCLUSIVE MODE`;for(const table of backupTables)if(table!=='workshop_commands'&&(await sql`SELECT 1 FROM ${sql(table)} WHERE tenant_id=${TENANT} LIMIT 1`).length)throw new Error('La base contiene datos. La recuperación no sobrescribe ni borra información; úsala únicamente en una instancia vacía.');}
  const columns=await sql`SELECT table_name,column_name,data_type,is_identity FROM information_schema.columns WHERE table_schema='public' AND table_name IN ${sql([...backupTables])} ORDER BY ordinal_position`;
  const counts:Record<string,number>={};
  for(const table of backupTables){
   const metadata=columns.filter(c=>c.table_name===table);const names=metadata.filter(c=>c.is_identity!=='YES').map(c=>String(c.column_name));
   const target=apply?table:'se_recovery_'+table;
   if(!apply)await sql`CREATE TEMP TABLE ${sql(target)} (LIKE ${sql(table)} INCLUDING ALL) ON COMMIT DROP`;
   const records=a.tables[table].map(row=>{if(Object.keys(row).some(k=>!metadata.some(c=>c.column_name===k)))throw new Error(`Columnas no reconocidas en ${table}`);const result:Row={};for(const c of metadata){if(c.is_identity==='YES')continue;const value=row[c.column_name];if(value===undefined)throw new Error(`Falta una columna de ${table}`);result[c.column_name]=c.data_type==='bytea'?Buffer.from(String(value),'base64'):c.data_type==='jsonb'?sql.json(value as never):value;}return result;});
   if(apply&&table==='workshop_commands'){for(const row of records){const [existing]=await sql`SELECT digest FROM workshop_commands WHERE tenant_id=${TENANT} AND id=${String(row.id)}`;if(existing&&existing.digest!==row.digest)throw new Error('Conflicto de idempotencia: la recuperación no se aplicó.');}for(let i=0;i<records.length;i+=100)await sql`INSERT INTO ${sql(target)} ${sql(records.slice(i,i+100),...names)} ON CONFLICT(tenant_id,id) DO NOTHING`;}
   else for(let i=0;i<records.length;i+=100)await sql`INSERT INTO ${sql(target)} ${sql(records.slice(i,i+100),...names)}`;
   counts[table]=records.length;
  }
  if(apply){for(let i=0;i<a.audit.length;i+=100){const rows=a.audit.slice(i,i+100).map(r=>{if(r.tenant_id!==TENANT||typeof r.actor!=='string'||typeof r.action!=='string'||typeof r.entity_id!=='string')throw new Error('Auditoría de respaldo inválida');return {tenant_id:TENANT,actor:r.actor,action:r.action,entity_id:r.entity_id,created_at:String(r.created_at),detail:sql.json({restored_from:a.created_at,original_id:r.id,detail:r.detail} as never)}});if(rows.length)await sql`INSERT INTO audit_events ${sql(rows)}`;}await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador','backup_restore',${TENANT},${sql.json({created_at:a.created_at,counts})})`;}
  return {ok:true,mode:apply?'restored':'validated',created_at:a.created_at,counts,audit_count:a.audit.length,originalDataUntouched:!apply};
 });
}
