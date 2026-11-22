import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {currentUser,sameOrigin} from '@/lib/auth';
import {canManage} from '@/lib/access';
import {db,TENANT} from '@/lib/db';
import {verifyAdminPassword} from '@/lib/admin-auth';
export async function GET(){
 const u=await currentUser();if(!u||u.must_change||!canManage(u.role))return new Response(null,{status:403});
 const sql=db();const [revision]=await sql`SELECT revision::text FROM app_data_revision WHERE tenant_id=${TENANT}`;
 const jobs=await sql`SELECT id,status,revision::text,created_at::text,copied_at::text,verified_at::text,consumed_at::text FROM external_backups WHERE tenant_id=${TENANT} ORDER BY created_at DESC LIMIT 10`;
 const eligible=jobs.find(j=>j.status==='verified'&&!j.consumed_at&&j.revision===revision.revision&&Date.parse(j.verified_at)>Date.now()-15*60000);
 const settings=u.role==='it'?(await sql`SELECT folder_id,folder_name,desktop_path FROM external_backup_settings WHERE tenant_id=${TENANT}`)[0]:undefined;
 const agents=u.role==='it'?await sql`SELECT id,active,last_seen::text FROM backup_agents WHERE tenant_id=${TENANT} ORDER BY created_at DESC`:undefined;
 const files=u.role==='it'?await sql`SELECT id,filename,sha256,md5,bytes::text,drive_file_id FROM external_backups WHERE tenant_id=${TENANT} ORDER BY created_at DESC LIMIT 10`:undefined;
 return Response.json({jobs,eligible:eligible?.id??null,...(settings?{settings,agents,files}:{})});
}
export async function POST(request:Request){
 const u=await currentUser();if(!u||u.must_change||!canManage(u.role)||!sameOrigin(request))return new Response(null,{status:403});
 const input=await request.json();const sql=db();
 if(input.action==='request'){
  const [pending]=await sql`SELECT id FROM external_backups WHERE tenant_id=${TENANT} AND status IN ('pending','capturing') AND created_at>now()-interval '10 minutes' LIMIT 1`;
  const id=pending?.id??randomUUID();if(!pending)await sql`INSERT INTO external_backups(id,tenant_id,requested_by,reason) VALUES(${id},${TENANT},${u.code},'pre_delete_or_manual')`;return Response.json({id,status:'pending'});
 }
 if(u.role!=='it')return new Response(null,{status:403});
 const denied=await verifyAdminPassword(request,String(input.password??''));if(denied)return Response.json({error:denied.error},{status:denied.status});
 if(input.action==='agent'){
  const token=randomBytes(32).toString('base64url'),id=randomUUID();await sql`INSERT INTO backup_agents(id,tenant_id,owner_id,token_hash) VALUES(${id},${TENANT},${u.id},${createHash('sha256').update(token).digest('hex')})`;return Response.json({id,token});
 }
 if(input.action==='revoke'&&typeof input.id==='string'&&/^[-a-f0-9]{36}$/.test(input.id)){await sql`UPDATE backup_agents SET active=false WHERE tenant_id=${TENANT} AND id=${input.id}`;return Response.json({ok:true})}
 if(input.action==='attest'&&typeof input.id==='string'&&/^[-a-f0-9]{36}$/.test(input.id)&&typeof input.drive_file_id==='string'&&/^[A-Za-z0-9_-]{10,160}$/.test(input.drive_file_id)&&input.confirmed===true){
  const [job]=await sql`UPDATE external_backups SET status='verified',drive_file_id=${input.drive_file_id},verified_by=${u.code},verified_at=now() WHERE tenant_id=${TENANT} AND id=${input.id} AND status='copied' AND copied_at>now()-interval '1 day' RETURNING id`;
  if(!job)return Response.json({error:'La copia local no está lista. No se habilitó el borrado.'},{status:409});
  await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},${u.code},'external_backup_custodian_attestation',${job.id},${sql.json({method:'IT verified remote file and encrypted archive checksum',drive_file_id:input.drive_file_id})})`;return Response.json({ok:true});
 }
 return Response.json({error:'Operación no válida.'},{status:400});
}
