import {currentUser,passwordMatches,issueSession,sameOrigin} from '@/lib/auth';
import {hashPassword} from '@/lib/identity';
import {db,TENANT} from '@/lib/db';
import {NextResponse} from 'next/server';
export async function POST(request:Request){
 const u=await currentUser();if(!u)return new Response(null,{status:401});if(!sameOrigin(request))return new Response(null,{status:403});
 const input=await request.json();if(typeof input.password!=='string'||input.password.length<7||input.password.length>128||typeof input.current!=='string'||input.current.length>1024)return Response.json({error:'Usa una clave nueva de 7 a 128 caracteres.'},{status:400});
 const [account]=await db()`SELECT password_hash FROM app_users WHERE tenant_id=${TENANT} AND id=${u.id}`;
 if(!passwordMatches(input.current,account.password_hash))return Response.json({error:'Clave actual incorrecta'},{status:403});
 if(input.current===input.password)return Response.json({error:'La clave nueva debe ser diferente.'},{status:400});
 const [updated]=await db()`UPDATE app_users SET password_hash=${hashPassword(input.password)},must_change=false,session_epoch=session_epoch+1 WHERE tenant_id=${TENANT} AND id=${u.id} AND password_hash=${account.password_hash} RETURNING session_epoch`;
 if(!updated)return Response.json({error:'La cuenta cambió. Inicia sesión nuevamente.'},{status:409});
 const r=NextResponse.json({ok:true});r.cookies.set('se_session',await issueSession({...u,session_epoch:updated.session_epoch,must_change:false}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600,path:'/'});return r;
}
