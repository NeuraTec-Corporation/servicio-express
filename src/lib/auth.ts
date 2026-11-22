import {cookies} from 'next/headers';
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import {db,TENANT} from './db';
import type {Account} from './access';
export function passwordMatches(password:string,stored:string){try{const [salt,hash]=stored.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(hash,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected)}catch{return false}}
export function sessionToken(identity?:{uid:string;sid:string}){const payload=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,nonce:randomBytes(16).toString('hex'),...identity})).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url')}
function secret(){const s=process.env.AUTH_SECRET;if(!s||s.length<32)throw new Error('Acceso pendiente de configuración');return s}
export function validToken(token:string){try{const [p,s]=token.split('.');const expected=createHmac('sha256',secret()).update(p).digest();const received=Buffer.from(s,'base64url');if(expected.length!==received.length||!timingSafeEqual(expected,received))return false;const data=JSON.parse(Buffer.from(p,'base64url').toString());return Number.isFinite(data.exp)&&data.exp>Date.now()&&data.exp<Date.now()+9*3600000}catch{return false}}
export async function userFromToken(token:string):Promise<Account|null>{
 if(!validToken(token))return null;const p=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 if(typeof p.uid!=='string'||typeof p.sid!=='string'||!/^[-a-f0-9]{36}$/.test(p.uid)||!/^[-a-f0-9]{36}$/.test(p.sid))return null;
 // Login initializes accounts; session checks must not execute filesystem migrations in Proxy.
 const [u]=await db()`SELECT u.id,u.code,u.role,u.display_name,u.office,u.active,u.must_change,u.session_epoch FROM app_users u JOIN app_sessions s ON s.user_id=u.id AND s.tenant_id=u.tenant_id WHERE u.tenant_id=${TENANT} AND u.id=${p.uid} AND s.id=${p.sid} AND s.expires_at>now() AND s.epoch=u.session_epoch AND u.active=true`;
 return u?u as Account:null;
}
export async function currentUser(){return userFromToken((await cookies()).get('se_session')?.value??'')}
export async function authenticated(){const u=await currentUser();return !!u&&!u.must_change}
export async function issueSession(u:Account){const sid=randomUUID();await db()`INSERT INTO app_sessions(id,tenant_id,user_id,epoch,expires_at) VALUES(${sid},${TENANT},${u.id},${u.session_epoch},now()+interval '8 hours')`;return sessionToken({uid:u.id,sid})}
export async function requireAuth(){if(!await authenticated())throw new Error('UNAUTHORIZED')}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin}
