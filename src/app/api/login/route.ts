import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {passwordMatches,sameOrigin,issueSession} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureIdentity} from '@/lib/identity';
import type {Account} from '@/lib/access';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Origen no permitido'},{status:403});
 try{
  if(!process.env.AUTH_SECRET)return NextResponse.json({error:'Acceso pendiente de configuración'},{status:503});
  const form=await request.formData(),code=String(form.get('code')??'').trim().toUpperCase().slice(0,20),password=String(form.get('password')??'');
  const key='login-failure:'+createHash('sha256').update((request.headers.get('x-forwarded-for')?.split(',')[0]??'local')+'|'+code).digest('hex');
  const sql=db();const [limit]=await sql`SELECT attempts FROM login_attempts WHERE key=${key} AND reset_at>now()`;
  if(limit?.attempts>=10)return NextResponse.json({error:'Demasiados intentos incorrectos. Espera 15 minutos.'},{status:429});
  await ensureIdentity();const [user]=await sql`SELECT * FROM app_users WHERE tenant_id=${TENANT} AND code=${code} AND active=true`;
  if(password.length>1024||!user||!passwordMatches(password,user.password_hash)){
   await sql`INSERT INTO login_attempts(key,attempts,reset_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.reset_at<now() THEN 1 ELSE login_attempts.attempts+1 END,reset_at=CASE WHEN login_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END`;
   return NextResponse.json({error:'Cuenta o clave incorrecta'},{status:401});
  }
  await sql`DELETE FROM login_attempts WHERE key=${key}`;
  const response=NextResponse.json({ok:true});response.cookies.set('se_session',await issueSession(user as Account),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600,path:'/'});return response;
 }catch{return NextResponse.json({error:'Servicio temporalmente no disponible'},{status:503})}
}
