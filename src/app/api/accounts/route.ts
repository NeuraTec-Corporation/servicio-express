import {randomBytes,randomUUID} from 'node:crypto';
import {currentUser,sameOrigin} from '@/lib/auth';
import {hashPassword} from '@/lib/identity';
import {db,TENANT} from '@/lib/db';
import {rolePrefixes,type Role} from '@/lib/access';
export async function GET(){const u=await currentUser();if(!u||u.role!=='it'||u.must_change)return new Response(null,{status:403});const users=await db()`SELECT id,code,role,display_name,office,active,must_change FROM app_users WHERE tenant_id=${TENANT} ORDER BY code`;return Response.json({users})}
export async function POST(request:Request){
 const u=await currentUser();if(!u||u.role!=='it'||u.must_change||!sameOrigin(request))return new Response(null,{status:403});
 const input=await request.json();const sql=db();try{const result=await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(812626)`;
  if(input.action==='create'){
   const role=input.role as Role;if(!rolePrefixes[role]||typeof input.name!=='string'||!input.name.trim()||input.name.length>160||typeof input.office!=='string'||!input.office.trim()||input.office.length>160)throw new Error('Completa nombre, cargo y oficina.');
   const prefix='SE'+rolePrefixes[role];const rows=await tx`SELECT code FROM app_users WHERE tenant_id=${TENANT} AND role=${role}`;const n=Math.max(0,...rows.map(r=>Number(r.code.slice(prefix.length))||0))+1;if(n>999)throw new Error('Se agotó la numeración de este cargo.');
   const code=prefix+String(n).padStart(3,'0'),password=randomBytes(18).toString('base64url'),id=randomUUID();
   await tx`INSERT INTO app_users(id,tenant_id,code,role,display_name,office,password_hash) VALUES(${id},${TENANT},${code},${role},${input.name.trim()},${input.office.trim()},${hashPassword(password)})`;
   await tx`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},${u.code},'account_create',${id},${tx.json({code,role})})`;return {code,password};
  }
  if(!['reset','update'].includes(input.action)||typeof input.id!=='string'||!/^[-a-f0-9]{36}$/.test(input.id))throw new Error('Operación inválida.');
  const [target]=await tx`SELECT * FROM app_users WHERE tenant_id=${TENANT} AND id=${input.id} FOR UPDATE`;if(!target)throw new Error('Cuenta no encontrada.');
  if(input.action==='reset'){const password=randomBytes(18).toString('base64url');await tx`UPDATE app_users SET password_hash=${hashPassword(password)},must_change=true,session_epoch=session_epoch+1 WHERE id=${target.id} AND tenant_id=${TENANT}`;await tx`INSERT INTO audit_events(tenant_id,actor,action,entity_id) VALUES(${TENANT},${u.code},'account_password_reset',${target.id})`;return {code:target.code,password}}
  if(typeof input.active!=='boolean'||typeof input.name!=='string'||!input.name.trim()||input.name.length>160||typeof input.office!=='string'||!input.office.trim()||input.office.length>160)throw new Error('Datos de cuenta inválidos.');
  if(!input.active&&target.role==='it'&&(await tx`SELECT id FROM app_users WHERE tenant_id=${TENANT} AND role='it' AND active=true`).length<=1)throw new Error('Debe quedar al menos una cuenta IT activa.');
  await tx`UPDATE app_users SET active=${input.active},display_name=${input.name.trim()},office=${input.office.trim()},session_epoch=session_epoch+1 WHERE tenant_id=${TENANT} AND id=${target.id}`;
  await tx`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},${u.code},'account_update',${target.id},${tx.json({active:input.active,office:input.office})})`;return {ok:true};
 });return Response.json(result)}catch(e){return Response.json({error:e instanceof Error?e.message:'No se pudo administrar la cuenta.'},{status:400})}
}
