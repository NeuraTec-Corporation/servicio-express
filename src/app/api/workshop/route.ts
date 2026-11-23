import {isDeepStrictEqual} from 'node:util';
import {emptyWorkflow,issueSchema} from '@/lib/workshop-v2';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {authenticated,sameOrigin,currentUser} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
import {orderInput,publicOrder,validateOrder,type WorkOrder} from '@/lib/workshop';
import {orderVisible,canManage,phoneKey} from '@/lib/access';
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
    const user=(await currentUser())!;const orders=rows.map(hydrate).filter(o=>orderVisible(user,o));
    return NextResponse.json({orders:tv?orders.filter(o=>!['front_desk','delivered'].includes(o.stage)).map(publicOrder):orders,asOf:new Date().toISOString()});
  }catch{return NextResponse.json({error:'No se pudo cargar el taller. Reintenta para comprobar la conexión.'},{status:503})}
}
export async function POST(request:Request){
  if(!await authenticated())return new Response(null,{status:401});
  if(!sameOrigin(request))return new Response(null,{status:403});
  try{
    const parsed=orderInput.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:'Completa teléfono, cliente, equipo, falla, técnico y oficina. Revisa los límites de los campos.'},{status:400});
    const input=parsed.data;if(input.action==='create')delete input.data.handoff;if(input.action==='create'&&input.data.workflow?.received_at&&Date.parse(input.data.workflow.received_at)>Date.now()+60000)return NextResponse.json({error:'La recepción no puede estar en el futuro.'},{status:400});if(input.action==='create'){input.data.workflow={...emptyWorkflow(),received_at:input.data.workflow?.received_at??null,preliminary:input.data.workflow?.preliminary??'',device_label:input.data.workflow?.device_label??'',issues:(input.data.workflow?.issues.length?input.data.workflow.issues:[{reported:input.data.reported_fault.slice(0,160),preliminary:''}]).map(i=>issueSchema.parse({id:randomUUID(),reported:i.reported,preliminary:i.preliminary}))};input.data.diagnosis='';input.data.approval_state='pending';input.data.approval_evidence='';input.data.tests_passed=false;input.data.parts_state='not_required';}const user=(await currentUser())!;if(!orderVisible(user,input.data))return NextResponse.json({error:'Asigna la orden a tu oficina y técnico autorizado.'},{status:403});if(input.action==='create'&&user.role==='staff'&&(input.data.diagnosis||input.data.tests_passed||!['pos','pending'].includes(input.data.approval_state)))return NextResponse.json({error:'El diagnóstico y las autorizaciones corresponden al técnico o administración.'},{status:403});if(input.action==='create'&&!input.data.pos_reference)input.data.pos_reference='SE-'+randomUUID().slice(0,12).toUpperCase();
    await ensureWorkshopSchema();
    const result=await db().begin(async sql=>{
      await sql`SELECT pg_advisory_xact_lock(812624)`;
      const id=input.action==='create'?randomUUID():input.id;
      const before=input.action==='update'?(await sql`SELECT id,public_code,pos_reference,data,version,created_at::text,updated_at::text FROM work_orders WHERE tenant_id=${TENANT} AND id=${id} FOR UPDATE`)[0]:null;
      if(input.action==='update'&&!before)return {error:'La orden ya no está disponible.',status:404};
      if(before&&!orderVisible(user,before.data))return {error:'Orden no disponible para tu perfil.',status:403};
      if(user.role==='staff'&&before){const allowed=['customer_name','customer_phone','reported_fault','accessories','device_access_code','delivery_notes','pos_reference','technician'];if(Object.keys(input.data).some(k=>!allowed.includes(k)&&JSON.stringify(input.data[k as keyof typeof input.data])!==JSON.stringify(before.data[k])))return {error:'Staff puede actualizar recepción y datos del cliente; las etapas técnicas corresponden al técnico.',status:403};}
      if(before){if(!isDeepStrictEqual(before.data.handoff,input.data.handoff)||before.data.stage!==input.data.stage&&(['front_desk','delivered'].includes(input.data.stage)||before.data.stage==='front_desk'))return {error:'Usa los botones Entregar a recepción y Entregar al cliente.',status:400};if(Boolean(before.data.workflow)!==Boolean(input.data.workflow))return {error:'Utiliza la acción de adopción V2.',status:400};if(before.data.workflow){if(before.data.workflow.issues.some((i:{confirmed:boolean})=>i.confirmed)&&['brand','model','device_type'].some(k=>before.data[k]!==input.data[k as keyof typeof input.data]))return {error:'El equipo ya tiene diagnóstico confirmado. Conserva su identidad.',status:400};const keys=['workflow','stage','diagnosis','approval_state','approval_evidence','parts_state','tests_passed','tests_notes','delivery_notes'] as const;if(keys.some(k=>!isDeepStrictEqual(before.data[k],input.data[k])))return {error:'Utiliza los botones V2 para modificar el flujo técnico.',status:400};if(before.data.office!==input.data.office&&before.data.workflow.requests.some((r:{status:string})=>r.status!=='cancelled'))return {error:'La oficina tiene solicitudes vinculadas; conserva su trazabilidad.',status:400};if(!canManage(user.role)&&before.data.technician!==input.data.technician)return {error:'Usa Tomar orden para asignarte el equipo.',status:403};}}
      if(before&&before.version!==(input.action==='update'?input.version:0))return {error:'Otra pantalla modificó la orden. Actualiza antes de guardar para conservar sus cambios.',status:409};
      const [quote]=before?await sql`SELECT status,response_evidence,lines FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY revision DESC LIMIT 1`:[];
      if(quote&&!before?.data.workflow&&(input.data.approval_state!==quote.status||input.data.approval_evidence!==quote.response_evidence))return {error:'La autorización se modifica respondiendo la versión del presupuesto en Operación.',status:400};
      const allocations=before?await sql`SELECT state,batch_id,quantity FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${id} AND state!='returned'`:[];
      if(before&&input.data.stage!==before.data.stage&&(await sql`SELECT entry_id FROM workshop_ledger_links WHERE tenant_id=${TENANT} AND source_id=${id} AND kind='settle'`).length)return {error:'La orden tiene cobro consolidado. Registra una nueva orden vinculada al POS para garantía o trabajo adicional.',status:400};
      if(allocations.length&&before?.data.office!==input.data.office)return {error:'Devuelve las piezas asignadas antes de cambiar la oficina de la orden.',status:400};
      if(['ready','delivered'].includes(input.data.stage)&&allocations.some(p=>p.state==='reserved'))return {error:'Registra el consumo o devuelve las piezas reservadas antes de marcar el equipo listo.',status:400};
      if(['ready','delivered'].includes(input.data.stage)&&quote&&(quote.lines as {kind:string;batch_id?:string;quantity:number}[]).some(l=>l.kind==='part'&&l.batch_id&&allocations.filter(p=>p.state==='consumed'&&p.batch_id===l.batch_id).reduce((n,p)=>n+p.quantity,0)<l.quantity))return {error:'Confirma el uso de las piezas incluidas en el presupuesto antes de marcar el equipo listo.',status:400};
      const invalid=validateOrder(input.data,before?.data);
      if(invalid)return {error:invalid,status:400};
      const key=phoneKey(input.data.customer_phone);const [customer]=await sql`INSERT INTO customers(id,tenant_id,phone_key,display_phone,name) VALUES(${randomUUID()},${TENANT},${key},${input.data.customer_phone},${input.data.customer_name}) ON CONFLICT(tenant_id,phone_key) DO UPDATE SET name=excluded.name,display_phone=excluded.display_phone,updated_at=now() RETURNING id`;
      const code=before?.public_code??`SE-${randomUUID().slice(0,8).toUpperCase()}`;
      const [saved]=before
        ?await sql`UPDATE work_orders SET customer_id=${customer.id},data=${sql.json(input.data)},pos_reference=${input.data.pos_reference},version=version+1,updated_at=now() WHERE tenant_id=${TENANT} AND id=${id} RETURNING id,public_code,pos_reference,data,version,created_at::text,updated_at::text`
        :await sql`INSERT INTO work_orders(id,tenant_id,public_code,pos_reference,data,customer_id) VALUES(${id},${TENANT},${code},${input.data.pos_reference},${sql.json(input.data)},${customer.id}) RETURNING id,public_code,pos_reference,data,version,created_at::text,updated_at::text`;
      await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},${user.code},${before?'workshop_update':'workshop_create'},${id},${sql.json({before:before?.data??null,after:input.data,version:saved.version})})`;
      const [lastEvent]=before?.data.workflow?await sql`SELECT paused FROM work_order_events WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY created_at DESC,id DESC LIMIT 1`:[];await sql`INSERT INTO work_order_events(tenant_id,order_id,action,detail,stage,paused) VALUES(${TENANT},${id},${before?'update':'create'},${sql.json({actor:user.code,technician:input.data.technician,office:input.data.office,pause_reason:input.data.pause_reason,tests_notes:input.data.tests_notes,...(input.data.workflow?{_schedule:input.data.workflow.schedule}:{})})},${input.data.stage},${input.data.workflow?Boolean(lastEvent?.paused??true):Boolean(input.data.pause_reason)||['pending','declined'].includes(input.data.approval_state)||['pending','ordered'].includes(input.data.parts_state)})`;
      return {order:hydrate(saved)};
    });
    if('error'in result)return NextResponse.json({error:result.error},{status:result.status});
    return NextResponse.json(result,{status:input.action==='create'?201:200});
  }catch(error){
    if(error&&typeof error==='object'&&'code'in error&&error.code==='23505')return NextResponse.json({error:'Ya existe una orden con ese número POS. Busca y actualiza la existente.'},{status:409});
    return NextResponse.json({error:'No se pudo guardar la orden. Tus cambios permanecen en el formulario.'},{status:503});
  }
}
