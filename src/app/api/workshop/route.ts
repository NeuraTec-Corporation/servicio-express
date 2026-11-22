import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {authenticated,sameOrigin} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
import {orderInput,publicOrder,validateOrder,type WorkOrder} from '@/lib/workshop';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function hydrate(row:Record<string,unknown>):WorkOrder {
  return {...row.data as WorkOrder,id:String(row.id),pos_reference:String(row.pos_reference),public_code:String(row.public_code),version:Number(row.version),created_at:String(row.created_at),updated_at:String(row.updated_at)};
}
export async function GET(request:Request){
  if(!await authenticated())return new Response(null,{status:401});
  try{
    await ensureWorkshopSchema();
    const tv=new URL(request.url).searchParams.get('view')==='tv';
    const rows=await db()`SELECT id,public_code,pos_reference,data,version,created_at::text,updated_at::text FROM work_orders WHERE tenant_id=${TENANT} ORDER BY updated_at DESC LIMIT 2001`;
    if(rows.length>2000)return NextResponse.json({error:'El taller supera 2.000 órdenes. Se requiere paginación antes de mostrar totales.'},{status:422});
    const orders=rows.map(hydrate);
    return NextResponse.json({orders:tv?orders.filter(o=>o.stage!=='delivered').map(publicOrder):orders,asOf:new Date().toISOString()});
  }catch{return NextResponse.json({error:'No se pudo cargar el taller. Reintenta para comprobar la conexión.'},{status:503})}
}
export async function POST(request:Request){
  if(!await authenticated())return new Response(null,{status:401});
  if(!sameOrigin(request))return new Response(null,{status:403});
  try{
    const parsed=orderInput.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:'Completa número POS, equipo, falla, técnico y oficina. Revisa los límites de los campos.'},{status:400});
    const input=parsed.data;
    await ensureWorkshopSchema();
    const result=await db().begin(async sql=>{
      await sql`SELECT pg_advisory_xact_lock(812624)`;
      const id=input.action==='create'?randomUUID():input.id;
      const before=input.action==='update'?(await sql`SELECT id,public_code,pos_reference,data,version,created_at::text,updated_at::text FROM work_orders WHERE tenant_id=${TENANT} AND id=${id} FOR UPDATE`)[0]:null;
      if(input.action==='update'&&!before)return {error:'La orden ya no está disponible.',status:404};
      if(before&&before.version!==(input.action==='update'?input.version:0))return {error:'Otra pantalla modificó la orden. Actualiza antes de guardar para conservar sus cambios.',status:409};
      const [quote]=before?await sql`SELECT status,response_evidence,lines FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY revision DESC LIMIT 1`:[];
      if(quote&&(input.data.approval_state!==quote.status||input.data.approval_evidence!==quote.response_evidence))return {error:'La autorización se modifica respondiendo la versión del presupuesto en Operación.',status:400};
      const allocations=before?await sql`SELECT state,batch_id,quantity FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${id} AND state!='returned'`:[];
      if(before&&input.data.stage!==before.data.stage&&(await sql`SELECT entry_id FROM workshop_ledger_links WHERE tenant_id=${TENANT} AND source_id=${id} AND kind='settle'`).length)return {error:'La orden tiene cobro consolidado. Registra una nueva orden vinculada al POS para garantía o trabajo adicional.',status:400};
      if(allocations.length&&before?.data.office!==input.data.office)return {error:'Devuelve las piezas asignadas antes de cambiar la oficina de la orden.',status:400};
      if(['ready','delivered'].includes(input.data.stage)&&allocations.some(p=>p.state==='reserved'))return {error:'Registra el consumo o devuelve las piezas reservadas antes de marcar el equipo listo.',status:400};
      if(['ready','delivered'].includes(input.data.stage)&&quote&&(quote.lines as {kind:string;batch_id?:string;quantity:number}[]).some(l=>l.kind==='part'&&l.batch_id&&allocations.filter(p=>p.state==='consumed'&&p.batch_id===l.batch_id).reduce((n,p)=>n+p.quantity,0)<l.quantity))return {error:'Confirma el uso de las piezas incluidas en el presupuesto antes de marcar el equipo listo.',status:400};
      const invalid=validateOrder(input.data,before?.data);
      if(invalid)return {error:invalid,status:400};
      const code=before?.public_code??`SE-${randomUUID().slice(0,8).toUpperCase()}`;
      const [saved]=before
        ?await sql`UPDATE work_orders SET data=${sql.json(input.data)},pos_reference=${input.data.pos_reference},version=version+1,updated_at=now() WHERE tenant_id=${TENANT} AND id=${id} RETURNING id,public_code,pos_reference,data,version,created_at::text,updated_at::text`
        :await sql`INSERT INTO work_orders(id,tenant_id,public_code,pos_reference,data) VALUES(${id},${TENANT},${code},${input.data.pos_reference},${sql.json(input.data)}) RETURNING id,public_code,pos_reference,data,version,created_at::text,updated_at::text`;
      await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador',${before?'workshop_update':'workshop_create'},${id},${sql.json({before:before?.data??null,after:input.data,version:saved.version})})`;
      await sql`INSERT INTO work_order_events(tenant_id,order_id,action,detail,stage,paused) VALUES(${TENANT},${id},${before?'update':'create'},${sql.json({technician:input.data.technician,office:input.data.office,pause_reason:input.data.pause_reason,tests_notes:input.data.tests_notes})},${input.data.stage},${Boolean(input.data.pause_reason)||['pending','declined'].includes(input.data.approval_state)||['pending','ordered'].includes(input.data.parts_state)})`;
      return {order:hydrate(saved)};
    });
    if('error'in result)return NextResponse.json({error:result.error},{status:result.status});
    return NextResponse.json(result,{status:input.action==='create'?201:200});
  }catch(error){
    if(error&&typeof error==='object'&&'code'in error&&error.code==='23505')return NextResponse.json({error:'Ya existe una orden con ese número POS. Busca y actualiza la existente.'},{status:409});
    return NextResponse.json({error:'No se pudo guardar la orden. Tus cambios permanecen en el formulario.'},{status:503});
  }
}
