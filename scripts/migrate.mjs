import postgres from 'postgres';
import {readFile,readdir} from 'node:fs/promises';
const sql=postgres(process.env.DATABASE_URL,{ssl:'require',max:1});
try {
 await sql`CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
 for(const file of (await readdir('db')).filter(f=>f.endsWith('.sql')).sort()) {
  await sql.begin(async tx=>{
   await tx`SELECT pg_advisory_xact_lock(812621)`;
   if((await tx`SELECT version FROM schema_migrations WHERE version=${file}`).length)return;
   await tx.unsafe(await readFile('db/'+file,'utf8'));
   await tx`INSERT INTO schema_migrations(version) VALUES(${file})`;
  });
  console.log('Migración verificada:',file);
 }
} finally {await sql.end()}
