import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {db} from './db';
let ready:Promise<void>|undefined;
export function ensureManagementSchema(){return ready??=apply().catch(error=>{ready=undefined;throw error})}
async function apply(){await db().begin(async sql=>{await sql`SELECT pg_advisory_xact_lock(812623)`;const applied=await sql`SELECT version FROM schema_migrations WHERE version='002_management.sql'`;if(applied.length)return;await sql.unsafe(await readFile(join(process.cwd(),'db','002_management.sql'),'utf8'));await sql`INSERT INTO schema_migrations(version) VALUES('002_management.sql')`})}
