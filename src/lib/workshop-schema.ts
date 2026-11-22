import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {db} from './db';
import {ensureManagementSchema} from './management-schema';
let ready:Promise<void>|undefined;
export function ensureWorkshopSchema(){return ready??=ensureManagementSchema().then(apply).catch(error=>{ready=undefined;console.error('Workshop schema failed',{name:error?.name,code:error?.code});throw error})}
async function apply(){
  await db().begin(async sql=>{
    await sql`SELECT pg_advisory_xact_lock(812621)`;
    for(const file of ['003_workshop.sql','004_workshop_operations.sql','005_recovery_and_replenishment.sql','006_accounts_and_backup_gate.sql','007_workshop_v2.sql']){
      if((await sql`SELECT version FROM schema_migrations WHERE version=${file}`).length)continue;
      await sql.unsafe(await readFile(join(process.cwd(),'db',file),'utf8'));
      await sql`INSERT INTO schema_migrations(version) VALUES(${file})`;
    }
  });
}
