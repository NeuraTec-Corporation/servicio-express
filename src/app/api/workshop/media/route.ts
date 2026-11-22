import {canManage,orderVisible} from '@/lib/access';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,currentUser} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await authenticated())return new Response(null,{status:401});const user=(await currentUser())!;
 const id=new URL(request.url).searchParams.get('id');if(!z.uuid().safeParse(id).success)return new Response(null,{status:400});
 try{await ensureWorkshopSchema();const [file]=await db()`SELECT m.original,m.filename,m.media_type,w.data FROM work_order_media m JOIN work_orders w ON w.tenant_id=m.tenant_id AND w.id=m.order_id WHERE m.tenant_id=${TENANT} AND m.id=${id}`;if(!file||!orderVisible(user,file.data))return new Response(null,{status:404});return new Response(new Uint8Array(file.original),{headers:{'Content-Type':file.media_type,'Content-Disposition':`${file.media_type==='application/pdf'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}catch{return NextResponse.json({error:'No se pudo recuperar la evidencia'},{status:503})}
}
export async function POST(request:Request){
 if(!await authenticated())return new Response(null,{status:401});const user=(await currentUser())!;if(!sameOrigin(request))return new Response(null,{status:403});
 try{
  if(Number(request.headers.get('content-length'))>4.2*1024*1024)throw new Error('El archivo supera 4 MB.');
  const form=await request.formData();const id=z.uuid().parse(form.get('order_id'));const caption=z.string().trim().min(1).max(500).parse(form.get('caption'));const file=form.get('file');
  if(!(file instanceof File)||!file.size||file.size>4*1024*1024)throw new Error('Selecciona una imagen o PDF de hasta 4 MB.');
  const bytes=Buffer.from(await file.arrayBuffer());let type='';
  if(bytes.subarray(0,5).toString()==='%PDF-')type='application/pdf';
  else if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)type='image/jpeg';
  else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))type='image/png';
  else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')type='image/webp';
  if(!type)throw new Error('Solo se admiten fotografías PNG/JPG/WEBP o PDF.');
  await ensureWorkshopSchema();await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(812624)`;
   const [order]=await sql`SELECT data FROM work_orders WHERE tenant_id=${TENANT} AND id=${id}`;if(!order||!orderVisible(user,order.data))throw new Error('Orden no disponible.');
   const [size]=await sql`SELECT coalesce(sum(octet_length(original)),0)::float8 AS bytes,count(*) FILTER(WHERE order_id=${id})::int AS files FROM work_order_media WHERE tenant_id=${TENANT}`;
   if(size.files>=12)throw new Error('La orden ya tiene 12 evidencias. Selecciona las fotografías necesarias.');
   if(size.bytes+bytes.length>100*1024*1024)throw new Error('Se alcanzó el espacio de evidencias reservado para el laboratorio. Revisa el almacenamiento antes de ampliarlo.');
   const mediaId=randomUUID();await sql`INSERT INTO work_order_media(id,tenant_id,order_id,filename,media_type,caption,original) VALUES(${mediaId},${TENANT},${id},${file.name.slice(0,180)},${type},${caption},${bytes})`;
   await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},${user.code},'workshop_evidence',${id},${sql.json({media_id:mediaId,caption,bytes:bytes.length})})`;
  });return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?'Indica la orden y descripción de la evidencia.':e instanceof Error?e.message:'No se pudo guardar la evidencia'},{status:400})}
}
