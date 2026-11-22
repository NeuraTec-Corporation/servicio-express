import {canManage,orderVisible} from '@/lib/access';
import {NextResponse} from 'next/server';
import {authenticated,currentUser} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 if(!await authenticated())return new Response(null,{status:401});const user=(await currentUser())!;
 try{await ensureWorkshopSchema();const sql=db();const [orders,parts,quotes,events]=await Promise.all([
  sql`SELECT id,public_code,coalesce(data->'workflow'->>'received_at',created_at::text) AS created_at,created_at::text AS registered_at,data->>'brand' AS brand,data->>'model' AS model,data->>'technician' AS technician,data->>'office' AS office,data->>'stage' AS stage,data->'workflow'->'schedule' AS schedule,data->'workflow'->'issues' AS issues,data->'workflow'->'requests' AS requests FROM work_orders WHERE tenant_id=${TENANT} LIMIT 2001`,
  sql`SELECT p.order_id,b.part,b.supplier,p.quantity,p.state,p.unit_cost::float8,p.currency FROM work_order_parts p JOIN stock_batches b ON b.id=p.batch_id AND b.tenant_id=p.tenant_id WHERE p.tenant_id=${TENANT} LIMIT 10001`,
  sql`SELECT DISTINCT ON(order_id) order_id,total::float8,currency,status FROM work_order_quotes WHERE tenant_id=${TENANT} ORDER BY order_id,revision DESC LIMIT 2001`,
  sql`SELECT id::text,order_id,action,detail,stage,paused,created_at::text FROM work_order_events WHERE tenant_id=${TENANT} ORDER BY created_at,id LIMIT 10001`,
 ]);if(orders.length>2000||parts.length>10000||quotes.length>2000||events.length>10000)return NextResponse.json({error:'El reporte requiere agregación por servidor antes de ampliar su volumen. No se muestran totales parciales.'},{status:422});const visible=orders.filter(o=>orderVisible(user,o)),ids=new Set(visible.map(o=>o.id));return NextResponse.json({orders:visible,parts:parts.filter(p=>ids.has(p.order_id)),quotes:quotes.filter(p=>ids.has(p.order_id)),events:events.filter(p=>ids.has(p.order_id)),asOf:new Date().toISOString()})}catch{return NextResponse.json({error:'No se pudo cargar la analítica del taller'},{status:503})}
}
