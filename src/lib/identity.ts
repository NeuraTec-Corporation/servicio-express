import {randomBytes,scryptSync} from 'node:crypto';
import {db,TENANT} from './db';
import {ensureWorkshopSchema} from './workshop-schema';
import {rolePrefixes,type Role} from './access';
let ready:Promise<void>|undefined;
export function ensureIdentity(){return ready??=bootstrap().catch(e=>{ready=undefined;throw e})}
async function bootstrap(){
 await ensureWorkshopSchema();await db().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(812626)`;
  if((await sql`SELECT id FROM app_users WHERE tenant_id=${TENANT} LIMIT 1`).length)return;
  const initial=JSON.parse(process.env.SE_INITIAL_USERS_JSON??'[]') as {id:string;code:string;role:Role;display_name:string;office:string;password_hash:string}[];
  if(initial.length!==5||!initial.some(u=>u.role==='it')||initial.some(u=>!rolePrefixes[u.role]||u.code!==`SE${rolePrefixes[u.role]}001`||!/^\w{32}:[a-f0-9]{128}$/.test(u.password_hash)))throw new Error('Cuentas iniciales pendientes de configuración privada.');
  for(const u of initial)await sql`INSERT INTO app_users ${sql({...u,tenant_id:TENANT,must_change:u.role!=='it'})}`;
 });
}
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
