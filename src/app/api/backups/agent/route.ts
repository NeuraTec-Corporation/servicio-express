import {createHash,randomUUID} from 'node:crypto';
import {db,TENANT} from '@/lib/db';
import {ensureIdentity} from '@/lib/identity';
import {captureBackup} from '@/lib/recovery';
export const runtime='nodejs';export const maxDuration=60;
async function agent(request:Request){await ensureIdentity();const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';if(token.length!==43)return null;const [a]=await db()`SELECT a.id FROM backup_agents a JOIN app_users u ON u.id=a.owner_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=${TENANT} AND a.token_hash=${createHash('sha256').update(token).digest('hex')} AND a.active=true AND u.active=true AND u.role='it'`;return a}
export async function POST(request:Request){
 const a=await agent(request);if(!a)return new Response(null,{status:401});const input=await request.json();const sql=db();await sql`UPDATE backup_agents SET last_seen=now() WHERE id=${a.id} AND tenant_id=${TENANT}`;
 if(input.action==='copied'&&typeof input.id==='string'&&/^[-a-f0-9]{36}$/.test(input.id)){
  const [job]=await sql`UPDATE external_backups SET status='copied',copied_at=now() WHERE tenant_id=${TENANT} AND id=${input.id} AND agent_id=${a.id} AND status='capturing' AND sha256=${String(input.sha256)} RETURNING id`;return Response.json({ok:!!job},{status:job?200:409});
 }
 if(input.action!=='capture'||typeof input.passphrase!=='string'||input.passphrase.length<24||input.passphrase.length>128)return new Response(null,{status:400});
 let id:string|undefined;
 try{
  id=await sql.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(812627)`;await tx`UPDATE external_backups SET status='failed',error='capture_timeout' WHERE tenant_id=${TENANT} AND status='capturing' AND created_at<now()-interval '10 minutes'`;
   let pendingCreate:string|undefined;const [pending]=await tx`SELECT id FROM external_backups WHERE tenant_id=${TENANT} AND status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE`;
   if(!pending){const [today]=await tx`SELECT id FROM external_backups WHERE tenant_id=${TENANT} AND status IN ('capturing','copied','verified') AND created_at>now()-interval '23 hours' LIMIT 1`;if(today)return undefined;const job=randomUUID();await tx`INSERT INTO external_backups(id,tenant_id,requested_by,reason) VALUES(${job},${TENANT},'backup_agent','daily')`;pendingCreate=job;}
   const jobId=pending?.id??pendingCreate;await tx`UPDATE external_backups SET status='capturing',agent_id=${a.id} WHERE tenant_id=${TENANT} AND id=${jobId}`;return String(jobId);
  });
  if(!id)return new Response(null,{status:204});
  const {bytes,revision}=await captureBackup(input.passphrase),sha256=createHash('sha256').update(bytes).digest('hex'),md5=createHash('md5').update(bytes).digest('hex'),filename=`servicio-express-${id}.sebackup`;
  await sql`UPDATE external_backups SET revision=${revision},sha256=${sha256},md5=${md5},bytes=${bytes.length},filename=${filename} WHERE tenant_id=${TENANT} AND id=${id} AND agent_id=${a.id}`;
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/octet-stream','X-Backup-Id':id,'X-Backup-Sha256':sha256,'Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'}});
 }catch{if(id)await sql`UPDATE external_backups SET status='failed',error='capture_failed' WHERE tenant_id=${TENANT} AND id=${id}`;return Response.json({error:'No se pudo crear el respaldo completo.'},{status:503})}
}
