import {cookies} from 'next/headers';
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export function passwordMatches(password:string,stored:string){try{const [salt,hash]=stored.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(hash,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected)}catch{return false}}
export function sessionToken(){const payload=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url')}
function secret(){const s=process.env.AUTH_SECRET;if(!s||s.length<32)throw new Error('Acceso pendiente de configuración');return s}
export function validToken(token:string){try{const [p,s]=token.split('.');const expected=createHmac('sha256',secret()).update(p).digest();const received=Buffer.from(s,'base64url');if(expected.length!==received.length||!timingSafeEqual(expected,received))return false;const data=JSON.parse(Buffer.from(p,'base64url').toString());return Number.isFinite(data.exp)&&data.exp>Date.now()&&data.exp<Date.now()+9*3600000}catch{return false}}
export async function authenticated(){return validToken((await cookies()).get('se_session')?.value??'')}
export async function requireAuth(){if(!await authenticated())throw new Error('UNAUTHORIZED')}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin}
