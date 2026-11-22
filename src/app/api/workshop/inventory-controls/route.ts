import {canManage,orderVisible} from '@/lib/access';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin,currentUser} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
export const runtime='nodejs';export const dynamic='force-dynamic';
const text=z.string().trim().min(1).max(160);
export async function GET(){if(!await authenticated())return new Response(null,{status:401});const user=(await currentUser())!;try{await ensureWorkshopSchema();const rules=await db()`SELECT r.id,r.part,r.office,r.minimum,r.target,coalesce(sum(b.on_hand-b.reserved) FILTER(WHERE NOT b.cancelled AND b.inspected=true AND b.condition IN ('new','used','refurbished')),0)::int AS available,coalesce(sum(b.ordered_quantity-b.received_quantity) FILTER(WHERE NOT b.cancelled),0)::int AS incoming FROM stock_reorder_rules r LEFT JOIN stock_batches b ON b.tenant_id=r.tenant_id AND b.part=r.part AND b.office=r.office WHERE r.tenant_id=${TENANT} GROUP BY r.id ORDER BY r.office,r.part`;return NextResponse.json({rules:canManage(user.role)?rules:rules.filter(r=>r.office===user.office)})}catch{return NextResponse.json({error:'No se pudieron cargar las alertas de inventario'},{status:503})}}
export async function POST(request:Request){
 if(!await authenticated())return new Response(null,{status:401});const user=(await currentUser())!;if(!sameOrigin(request))return new Response(null,{status:403});
 try{
  const input=z.discriminatedUnion('action',[
   z.object({action:z.literal('rule'),part:text,office:text,minimum:z.number().int().min(0).max(10000),target:z.number().int().min(0).max(10000)}),
   z.object({action:z.literal('edit'),id:z.uuid(),version:z.number().int().positive(),part:text,brand:z.string().trim().max(160),model:z.string().trim().max(160),office:text,supplier:text,invoice:z.string().trim().max(160),unit_cost:z.number().min(0).max(10000000).refine(n=>Math.abs(n*100-Math.round(n*100))<.00001),currency:z.string().regex(/^[A-Z]{3}$/),ordered_quantity:z.number().int().min(1).max(10000)}),
   z.object({action:z.literal('cancel'),id:z.uuid(),version:z.number().int().positive()}),
  ]).parse(await request.json());await ensureWorkshopSchema();await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(812624)`;
   let before=null;
   if(input.action==='rule'){if(input.target<input.minimum)throw new Error('El objetivo debe ser igual o mayor al mínimo.');await sql`INSERT INTO stock_reorder_rules(id,tenant_id,part,office,minimum,target) VALUES(${randomUUID()},${TENANT},${input.part},${input.office},${input.minimum},${input.target}) ON CONFLICT(tenant_id,part,office) DO UPDATE SET minimum=excluded.minimum,target=excluded.target,updated_at=now()`;}
   else{
    [before]=await sql`SELECT * FROM stock_batches WHERE tenant_id=${TENANT} AND id=${input.id} FOR UPDATE`;
    if(!before||before.version!==input.version)throw new Error('El pedido cambió. Actualiza antes de continuar.');
    if(before.cancelled||before.received_quantity||before.on_hand||before.reserved)throw new Error('Solo se corrigen o cancelan pedidos sin recepción. Lo recibido conserva su costo original y trazabilidad.');
    if(input.action==='cancel')await sql`UPDATE stock_batches SET cancelled=true,version=version+1 WHERE tenant_id=${TENANT} AND id=${input.id}`;
    else{const {action,id,version,...fields}=input;void action;void version;await sql`UPDATE stock_batches SET ${sql(fields)},version=version+1 WHERE tenant_id=${TENANT} AND id=${id}`;}
   }
   await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador',${'inventory_'+input.action},${'id'in input?input.id:TENANT},${sql.json({before,after:input})})`;
  });return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?'Revisa pieza, oficina, cantidades e importes.':e instanceof Error&&!(e as {code?:string}).code?e.message:'No se pudo guardar el control de inventario'},{status:400})}
}
