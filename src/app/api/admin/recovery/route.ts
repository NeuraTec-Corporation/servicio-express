import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,currentUser} from '@/lib/auth';
import {verifyAdminPassword} from '@/lib/admin-auth';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
import {db,TENANT} from '@/lib/db';
import {createBackup,recoverBackup} from '@/lib/recovery';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const credentials={password:z.string().min(1).max(1024),passphrase:z.string().min(12).max(256)};
export async function POST(request:Request){
 if(!await authenticated())return new Response(null,{status:401});if((await currentUser())?.role!=='it')return new Response(null,{status:403});if(!sameOrigin(request))return new Response(null,{status:403});
 try{
  await ensureWorkshopSchema();
  if(request.headers.get('content-type')?.includes('multipart/form-data')){
   const f=await request.formData();const input=z.object({password:credentials.password,id:z.uuid(),chunk:z.coerce.number().int().min(0).max(63)}).parse(Object.fromEntries(f));
   const denied=await verifyAdminPassword(request,input.password);if(denied)return NextResponse.json({error:denied.error},{status:denied.status});
   const file=f.get('file');if(!(file instanceof File)||!file.size||file.size>2097152)throw new Error('Fragmento de respaldo inválido.');
   await db().begin(async sql=>{await sql`SELECT pg_advisory_xact_lock(812625)`;await sql`DELETE FROM recovery_uploads WHERE tenant_id=${TENANT} AND created_at<now()-interval '1 hour'`;const [usage]=await sql`SELECT coalesce(sum(octet_length(content)),0)::float8 AS bytes FROM recovery_uploads WHERE tenant_id=${TENANT}`;if(usage.bytes+file.size>128*1024*1024)throw new Error('Ya hay una recuperación en curso o se alcanzó el tamaño admitido.');await sql`INSERT INTO recovery_uploads(tenant_id,id,chunk,content) VALUES(${TENANT},${input.id},${input.chunk},${Buffer.from(await file.arrayBuffer())}) ON CONFLICT(tenant_id,id,chunk) DO UPDATE SET content=excluded.content,created_at=now()`;});return NextResponse.json({ok:true});
  }
  const input=z.discriminatedUnion('action',[
   z.object({action:z.literal('export'),...credentials}),
   z.object({action:z.enum(['validate','restore']),...credentials,id:z.uuid(),chunks:z.number().int().min(1).max(64),confirmation:z.string().optional()}),
  ]).parse(await request.json());
  const denied=await verifyAdminPassword(request,input.password);if(denied)return NextResponse.json({error:denied.error},{status:denied.status});
  if(input.action==='export'){
   const bytes=await createBackup(input.passphrase);await db()`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador','backup_export',${TENANT},${db().json({bytes:bytes.length})})`;
   const stream=new ReadableStream({start(c){for(let n=0;n<bytes.length;n+=65536)c.enqueue(new Uint8Array(bytes.subarray(n,n+65536)));c.close()}});
   return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="servicio-express-${new Date().toISOString().slice(0,10)}.sebackup"`,'Cache-Control':'private, no-store'}});
  }
  if(input.action==='restore'&&input.confirmation!=='RESTAURAR')throw new Error('Escribe RESTAURAR para confirmar. No se borrarán datos existentes.');
  const chunks=await db()`SELECT chunk,content FROM recovery_uploads WHERE tenant_id=${TENANT} AND id=${input.id} ORDER BY chunk`;
  if(chunks.length!==input.chunks||chunks.some((c,i)=>c.chunk!==i))throw new Error('La carga está incompleta. Selecciona de nuevo el archivo.');
  try{return NextResponse.json(await recoverBackup(Buffer.concat(chunks.map(c=>c.content)),input.passphrase,input.action==='restore'))}
  finally{await db()`DELETE FROM recovery_uploads WHERE tenant_id=${TENANT} AND id=${input.id}`;}
 }catch(e){if(e&&typeof e==='object'&&'code'in e)console.error('Recovery failed',{code:e.code,name:e instanceof Error?e.name:'unknown'});return NextResponse.json({error:e instanceof z.ZodError?'Completa la clave de acceso y una clave de respaldo de al menos 12 caracteres.':e instanceof Error&&!(e as {code?:string}).code?e.message:'No se pudo completar la recuperación. No se aplicaron cambios parciales.'},{status:400})}
}
