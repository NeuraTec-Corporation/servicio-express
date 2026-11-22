import {createHash,randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,sameOrigin} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
import {operationInput,quoteTotal} from '@/lib/workshop-operations';
import {verifyAdminPassword} from '@/lib/admin-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
class Invalid extends Error {constructor(message:string,public status=400){super(message)}}
export async function GET(request:Request){
 if(!await authenticated())return new Response(null,{status:401});
 try{
  await ensureWorkshopSchema();const sql=db();const id=new URL(request.url).searchParams.get('orderId');
  if(!id){const batches=await sql`SELECT id,part,brand,model,office,supplier,invoice,unit_cost::float8,currency,ordered_quantity,received_quantity,on_hand,reserved,version,created_at::text FROM stock_batches WHERE tenant_id=${TENANT} ORDER BY created_at DESC LIMIT 2001`;if(batches.length>2000)throw new Invalid('Se requiere paginar el inventario antes de ampliar el reporte.',422);return NextResponse.json({batches})}
  if(!z.uuid().safeParse(id).success)throw new Invalid('Orden inválida');
  if(!(await sql`SELECT id FROM work_orders WHERE tenant_id=${TENANT} AND id=${id}`).length)throw new Invalid('Orden no encontrada',404);
  const [quotes,parts,events,media]=await Promise.all([
   sql`SELECT id,revision,currency,lines,total::float8,previous_total::float8,status,response_evidence,created_at::text,responded_at::text FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY revision DESC`,
   sql`SELECT p.id,p.batch_id,b.part,b.office,p.quantity,p.state,p.unit_cost::float8,p.currency FROM work_order_parts p JOIN stock_batches b ON b.tenant_id=p.tenant_id AND b.id=p.batch_id WHERE p.tenant_id=${TENANT} AND p.order_id=${id} ORDER BY p.created_at`,
   sql`SELECT id::text,action,detail,stage,paused,created_at::text FROM work_order_events WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY created_at,id`,
   sql`SELECT id,filename,media_type,caption,created_at::text FROM work_order_media WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY created_at DESC`,
  ]);const settled=(await sql`SELECT entry_id FROM workshop_ledger_links WHERE tenant_id=${TENANT} AND source_id=${id} AND kind='settle'`).length>0;return NextResponse.json({quotes,parts,events,media,settled});
 }catch(e){return NextResponse.json({error:e instanceof Invalid?e.message:'No se pudo consultar la operación del taller'},{status:e instanceof Invalid?e.status:503})}
}
export async function POST(request:Request){
 if(!await authenticated())return new Response(null,{status:401});
 if(!sameOrigin(request))return new Response(null,{status:403});
 try{
  const input=operationInput.parse(await request.json());await ensureWorkshopSchema();
  const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const result=await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(812623)`;
   await sql`SELECT pg_advisory_xact_lock(812624)`;
   const [command]=await sql`SELECT digest FROM workshop_commands WHERE tenant_id=${TENANT} AND id=${input.request_id}`;
   if(command){if(command.digest!==digest)throw new Invalid('Identificador de operación reutilizado con otros datos',409);return {ok:true,replayed:true}}
   if(input.action==='batch'){
    await sql`INSERT INTO stock_batches ${sql({id:randomUUID(),tenant_id:TENANT,part:input.part,brand:input.brand,model:input.model,office:input.office,supplier:input.supplier,invoice:input.invoice,unit_cost:input.unit_cost,currency:input.currency,ordered_quantity:input.ordered_quantity})}`;
   }else if(input.action==='receive'||input.action==='transfer'||input.action==='supplier_return'){
    const [batch]=await sql`SELECT * FROM stock_batches WHERE tenant_id=${TENANT} AND id=${input.batch_id} FOR UPDATE`;
    if(!batch)throw new Invalid('Lote no encontrado',404);
    if(batch.version!==input.batch_version)throw new Invalid('El lote cambió. Actualiza antes de recibir.',409);
    if(input.action==='receive'){
    if(batch.received_quantity+input.quantity>batch.ordered_quantity)throw new Invalid('La recepción supera la cantidad pedida. Registra otro lote si corresponde.');
    const invoice=input.invoice??batch.invoice;
    if(!invoice.trim())throw new Invalid('Registra una referencia de factura o recibo antes de confirmar su recepción.');
    await sql`UPDATE stock_batches SET invoice=${invoice},received_quantity=received_quantity+${input.quantity},on_hand=on_hand+${input.quantity},version=version+1 WHERE tenant_id=${TENANT} AND id=${batch.id}`;
    await sql`INSERT INTO stock_movements(id,tenant_id,batch_id,kind,quantity) VALUES(${randomUUID()},${TENANT},${batch.id},'receive',${input.quantity})`;
    const entryId=randomUUID();await sql`INSERT INTO management_entries ${sql({id:entryId,tenant_id:TENANT,entry_type:'purchase',category:'part',occurred_on:new Date().toISOString().slice(0,10),brand:batch.brand,model:batch.model,part:batch.part,piece:batch.part,office:batch.office,supplier:batch.supplier,quantity:input.quantity,unit_cost:batch.unit_cost,unit_price:null,currency:batch.currency,notes:`Recepción de taller. Factura: ${invoice}`})}`;
    await sql`INSERT INTO workshop_ledger_links(tenant_id,entry_id,source_id,kind) VALUES(${TENANT},${entryId},${batch.id},'receive')`;
    }else{
     if(batch.on_hand-batch.reserved<input.quantity)throw new Invalid('Solo puedes trasladar o devolver unidades disponibles sin reserva.');
     if(input.action==='transfer'&&batch.office===input.office)throw new Invalid('Selecciona una oficina distinta.');
     await sql`UPDATE stock_batches SET on_hand=on_hand-${input.quantity},version=version+1 WHERE tenant_id=${TENANT} AND id=${batch.id}`;
     await sql`INSERT INTO stock_movements(id,tenant_id,batch_id,kind,quantity) VALUES(${randomUUID()},${TENANT},${batch.id},${input.action},${input.quantity})`;
     if(input.action==='transfer'){
      const destination=randomUUID();await sql`INSERT INTO stock_batches ${sql({id:destination,tenant_id:TENANT,part:batch.part,brand:batch.brand,model:batch.model,office:input.office,supplier:batch.supplier,invoice:batch.invoice,unit_cost:batch.unit_cost,currency:batch.currency,ordered_quantity:input.quantity,received_quantity:input.quantity,on_hand:input.quantity,reserved:0})}`;
      await sql`INSERT INTO stock_movements(id,tenant_id,batch_id,kind,quantity) VALUES(${randomUUID()},${TENANT},${destination},'transfer_in',${input.quantity})`;
     }
    }
   }else{
    const [order]=await sql`SELECT * FROM work_orders WHERE tenant_id=${TENANT} AND id=${input.order_id} FOR UPDATE`;
    if(!order)throw new Invalid('Orden no encontrada',404);
    if(order.version!==input.version)throw new Invalid('La orden cambió. Actualiza la ficha antes de continuar.',409);
    if(order.data.stage==='delivered'&&input.action!=='settle')throw new Invalid('La orden está entregada. Reábrela explícitamente antes de modificar su operación.');
    const [latest]=await sql`SELECT * FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${order.id} ORDER BY revision DESC LIMIT 1`;
    let next={...order.data};
    if(input.action==='settle'){
     if(order.data.stage!=='delivered')throw new Invalid('Marca el equipo entregado antes de registrar el cobro final.');
     if((await sql`SELECT entry_id FROM workshop_ledger_links WHERE tenant_id=${TENANT} AND source_id=${order.id} AND kind='settle'`).length)throw new Invalid('El cobro de esta orden ya está consolidado.',409);
     if(latest&&(latest.status!=='approved'||latest.currency!==input.currency||input.amount>Number(latest.total)))throw new Invalid('El cobro debe respetar la moneda y el máximo del presupuesto aprobado vigente.');
     const used=await sql`SELECT quantity,unit_cost::float8,currency FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${order.id} AND state='consumed'`;
     const known=input.labor_cost!==null&&used.every(p=>p.currency===input.currency);const cost=known?Math.round((used.reduce((n,p)=>n+p.quantity*p.unit_cost,0)+input.labor_cost!)*100)/100:null;
     const entryId=randomUUID();await sql`INSERT INTO management_entries ${sql({id:entryId,tenant_id:TENANT,entry_type:'repair',category:'service',occurred_on:new Date().toISOString().slice(0,10),brand:order.data.brand,model:order.data.model,technician:order.data.technician,office:order.data.office,quantity:1,unit_cost:cost,unit_price:input.amount,currency:input.currency,notes:`Orden ${order.public_code}. Cobro confirmado en POS: ${input.pos_receipt}`})}`;
     await sql`INSERT INTO workshop_ledger_links(tenant_id,entry_id,source_id,kind) VALUES(${TENANT},${entryId},${order.id},'settle')`;
    }else if(input.action==='quote'){
     const total=quoteTotal(input.lines);if(total>100000000)throw new Invalid('El presupuesto supera el importe permitido.');
     if(latest&&latest.currency!==input.currency)throw new Invalid('La moneda de la orden no puede cambiar entre versiones de presupuesto.');
     const [approved]=await sql`SELECT total FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${order.id} AND status='approved' ORDER BY revision DESC LIMIT 1`;
     await sql`INSERT INTO work_order_quotes(id,tenant_id,order_id,revision,currency,lines,total,previous_total) VALUES(${randomUUID()},${TENANT},${order.id},${(latest?.revision??0)+1},${input.currency},${sql.json(input.lines)},${total},${approved?.total??null})`;
     next={...next,approval_state:'pending',approval_evidence:''};
     if(next.stage==='ready')next={...next,stage:'diagnosis',tests_passed:false};
    }else if(input.action==='decide'){
     if(!latest||latest.id!==input.quote_id||latest.status!=='pending')throw new Invalid('Solo se responde la última versión pendiente del presupuesto.',409);
     await sql`UPDATE work_order_quotes SET status=${input.status},response_evidence=${input.evidence},responded_at=now() WHERE tenant_id=${TENANT} AND id=${latest.id}`;
     next={...next,approval_state:input.status,approval_evidence:input.evidence};
    }else{
     let allocation;
     if(input.action!=='reserve'){
      [allocation]=await sql`SELECT * FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${order.id} AND id=${input.allocation_id} FOR UPDATE`;
      if(!allocation)throw new Invalid('Pieza no encontrada en esta orden',404);
      if(input.action==='consume'&&allocation.state!=='reserved')throw new Invalid('La pieza debe estar reservada para registrar su consumo.');
      if(input.action==='return'&&allocation.state==='returned')throw new Invalid('La devolución ya está registrada.');
     }
     const batchId=input.action==='reserve'?input.batch_id:allocation!.batch_id;
     const [batch]=await sql`SELECT * FROM stock_batches WHERE tenant_id=${TENANT} AND id=${batchId} FOR UPDATE`;
     if(!batch)throw new Invalid('Lote no encontrado',404);
     const quantity=input.action==='reserve'?input.quantity:allocation!.quantity;
     if(input.action!=='return'){
      if(['pending','declined'].includes(next.approval_state)||latest&&latest.status!=='approved')throw new Invalid('Falta la aprobación vigente del trabajo antes de reservar o consumir.');
      if(batch.office!==next.office)throw new Invalid('La pieza está en otra oficina. Registra su traslado físico antes de asignarla.');
      if(latest&&batch.currency!==latest.currency)throw new Invalid('La pieza y el presupuesto deben estar expresados en la misma moneda.');
     }
     if(input.action==='reserve'){
      if(latest){const lines=latest.lines as {batch_id?:string;quantity:number}[];const approved=lines.filter(l=>l.batch_id===batchId).reduce((n,l)=>n+l.quantity,0);const [assigned]=await sql`SELECT coalesce(sum(quantity),0)::int AS quantity FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${order.id} AND batch_id=${batchId} AND state!='returned'`;if(assigned.quantity+quantity>approved)throw new Invalid('La pieza o cantidad no está incluida en el presupuesto vigente aprobado. Crea y autoriza una nueva versión.');}
      if(batch.on_hand-batch.reserved<quantity)throw new Invalid('No hay existencias disponibles suficientes. Comprueba recepción y reservas.');
      await sql`UPDATE stock_batches SET reserved=reserved+${quantity},version=version+1 WHERE tenant_id=${TENANT} AND id=${batchId}`;
      await sql`INSERT INTO work_order_parts(id,tenant_id,order_id,batch_id,quantity,state,unit_cost,currency) VALUES(${randomUUID()},${TENANT},${order.id},${batchId},${quantity},'reserved',${batch.unit_cost},${batch.currency})`;
     }else if(input.action==='consume'){
      if(!next.diagnosis.trim()||!['repair','drying','assembly','testing'].includes(next.stage))throw new Invalid('Registra el diagnóstico e inicia la reparación antes de confirmar el uso.');
      await sql`UPDATE stock_batches SET reserved=reserved-${quantity},on_hand=on_hand-${quantity},version=version+1 WHERE tenant_id=${TENANT} AND id=${batchId}`;
      await sql`UPDATE work_order_parts SET state='consumed',updated_at=now() WHERE tenant_id=${TENANT} AND id=${allocation!.id}`;
     }else{
      if(allocation!.state==='reserved')await sql`UPDATE stock_batches SET reserved=reserved-${quantity},version=version+1 WHERE tenant_id=${TENANT} AND id=${batchId}`;
      else await sql`UPDATE stock_batches SET on_hand=on_hand+${quantity},version=version+1 WHERE tenant_id=${TENANT} AND id=${batchId}`;
      await sql`UPDATE work_order_parts SET state='returned',updated_at=now() WHERE tenant_id=${TENANT} AND id=${allocation!.id}`;
     }
     await sql`INSERT INTO stock_movements(id,tenant_id,batch_id,order_id,kind,quantity) VALUES(${randomUUID()},${TENANT},${batchId},${order.id},${input.action},${quantity})`;
     next={...next,parts_state:'received'};
    }
    await sql`UPDATE work_orders SET data=${sql.json(next)},version=version+1,updated_at=now() WHERE tenant_id=${TENANT} AND id=${order.id}`;
    await sql`INSERT INTO work_order_events(tenant_id,order_id,action,detail,stage,paused) VALUES(${TENANT},${order.id},${input.action},${sql.json(input)},${next.stage},${Boolean(next.pause_reason)||['pending','declined'].includes(next.approval_state)||['pending','ordered'].includes(next.parts_state)})`;
   }
   await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador',${'workshop_'+input.action},${'order_id'in input?input.order_id:'batch_id'in input?input.batch_id:input.request_id},${sql.json(input)})`;
   await sql`INSERT INTO workshop_commands(id,tenant_id,digest) VALUES(${input.request_id},${TENANT},${digest})`;
   return {ok:true};
  });return NextResponse.json(result);
 }catch(e){if(!(e instanceof Invalid)&&!(e instanceof z.ZodError))console.error('Workshop operation failed',{name:e instanceof Error?e.name:'unknown',code:e&&typeof e==='object'&&'code'in e?e.code:undefined});return NextResponse.json({error:e instanceof Invalid?e.message:e instanceof z.ZodError?'Revisa campos, cantidades e importes; usa hasta dos decimales.':'No se pudo guardar la operación. No se aplicaron cambios parciales.'},{status:e instanceof Invalid?e.status:e instanceof z.ZodError?400:503})}
}
// Individual deletion is explicit and authenticated; it also enables cleanup of isolated laboratory checks.
export async function DELETE(request:Request){
 if(!await authenticated())return new Response(null,{status:401});if(!sameOrigin(request))return new Response(null,{status:403});
 try{
  const input=z.object({target:z.enum(['order','batch','settlement']),id:z.uuid(),confirmation:z.literal('BORRAR'),password:z.string().min(1).max(1024)}).parse(await request.json());
  const denied=await verifyAdminPassword(request,input.password);if(denied)return NextResponse.json({error:denied.error},{status:denied.status});
  await ensureWorkshopSchema();await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(812623)`;
   await sql`SELECT pg_advisory_xact_lock(812624)`;
   const financial=await sql`SELECT e.* FROM management_entries e JOIN workshop_ledger_links l ON l.entry_id=e.id AND l.tenant_id=e.tenant_id WHERE l.tenant_id=${TENANT} AND l.source_id=${input.id}`;
   if(input.target==='settlement'&&(!financial.length||financial.some(e=>e.entry_type!=='repair')))throw new Invalid('No existe un cobro de taller para corregir.',404);
   if(financial.length){await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador','workshop_financial_delete',${input.id},${sql.json({entries:financial})})`;await sql`DELETE FROM workshop_ledger_links WHERE tenant_id=${TENANT} AND source_id=${input.id}`;await sql`DELETE FROM management_entries WHERE tenant_id=${TENANT} AND id IN ${sql(financial.map(e=>e.id))}`;}
   if(input.target==='settlement'){
    // Only the consolidated record is corrected. No POS refund, stock change or external payment occurs.
   }else if(input.target==='order'){
    const [order]=await sql`SELECT * FROM work_orders WHERE tenant_id=${TENANT} AND id=${input.id} FOR UPDATE`;if(!order)throw new Invalid('Orden no encontrada',404);
    const parts=await sql`SELECT id FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${input.id} AND state!='returned'`;if(parts.length)throw new Invalid('Devuelve las piezas asignadas antes de borrar la orden.');
    const [quotes,events,allocations]=await Promise.all([sql`SELECT * FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${input.id}`,sql`SELECT * FROM work_order_events WHERE tenant_id=${TENANT} AND order_id=${input.id}`,sql`SELECT * FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${input.id}`]);
    await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador','workshop_delete',${input.id},${sql.json({order,quotes,events,allocations})})`;
    await sql`DELETE FROM work_order_media WHERE tenant_id=${TENANT} AND order_id=${input.id}`;await sql`DELETE FROM work_order_events WHERE tenant_id=${TENANT} AND order_id=${input.id}`;await sql`DELETE FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${input.id}`;await sql`DELETE FROM work_order_parts WHERE tenant_id=${TENANT} AND order_id=${input.id}`;await sql`UPDATE stock_movements SET order_id=NULL WHERE tenant_id=${TENANT} AND order_id=${input.id}`;await sql`DELETE FROM work_orders WHERE tenant_id=${TENANT} AND id=${input.id}`;
   }else{
    const [batch]=await sql`SELECT * FROM stock_batches WHERE tenant_id=${TENANT} AND id=${input.id} FOR UPDATE`;if(!batch)throw new Invalid('Lote no encontrado',404);
    if((await sql`SELECT id FROM work_order_parts WHERE tenant_id=${TENANT} AND batch_id=${input.id}`).length)throw new Invalid('El lote está vinculado con órdenes; conserva su trazabilidad.');
    const movements=await sql`SELECT * FROM stock_movements WHERE tenant_id=${TENANT} AND batch_id=${input.id}`;
    await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador','stock_delete',${input.id},${sql.json({batch,movements})})`;
    await sql`DELETE FROM stock_movements WHERE tenant_id=${TENANT} AND batch_id=${input.id}`;await sql`DELETE FROM stock_batches WHERE tenant_id=${TENANT} AND id=${input.id}`;
   }
  });return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Invalid?e.message:'No se pudo borrar. Confirma BORRAR y tu clave.'},{status:e instanceof Invalid?e.status:400})}
}
