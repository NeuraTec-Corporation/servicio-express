import {NextRequest,NextResponse} from 'next/server';
import {userFromToken,sameOrigin} from './lib/auth';
import {routeAllowed} from './lib/access';
export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/api/backups/agent')return NextResponse.next();
 if(['/api/login','/api/logout'].includes(path))return NextResponse.next();
 try{
  const user=await userFromToken(request.cookies.get('se_session')?.value??'');
  if(!user)return NextResponse.json({error:'Inicia sesión con tu cuenta.'},{status:401});
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&!sameOrigin(request))return new Response(null,{status:403});
  if(path==='/api/me'||path==='/api/password')return NextResponse.next();
  if(user.must_change)return NextResponse.json({error:'Cambia tu clave inicial para continuar.'},{status:403});
  let action='';if(path==='/api/workshop/operations'&&request.method==='POST'){try{action=(await request.clone().json()).action}catch{return new Response(null,{status:400})}}
  if(!routeAllowed(user.role,path,request.method,action))return NextResponse.json({error:'Tu perfil no permite esta operación.'},{status:403});
  return NextResponse.next();
 }catch{return NextResponse.json({error:'No se pudo comprobar el acceso.'},{status:503})}
}
export const config={matcher:'/api/:path*'};
