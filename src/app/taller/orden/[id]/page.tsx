import {authenticated} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
import {redirect,notFound} from 'next/navigation';
import {z} from 'zod';
import {stages,type OrderFields} from '@/lib/workshop';
import {lineTotal,type QuoteLine} from '@/lib/workshop-operations';
import {money} from '@/lib/ui-data';
import PrintReport from './print-report';
export const dynamic='force-dynamic';
export default async function OrderReport({params}:{params:Promise<{id:string}>}){
 if(!await authenticated())redirect('/');const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 await ensureWorkshopSchema();const sql=db();const [order]=await sql`SELECT public_code,pos_reference,data,created_at::text FROM work_orders WHERE tenant_id=${TENANT} AND id=${id}`;if(!order)notFound();
 const d=order.data as OrderFields;const [quote]=await sql`SELECT revision,currency,lines,total::float8,status,response_evidence FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY revision DESC LIMIT 1`;
 const media=await sql`SELECT id,caption,media_type FROM work_order_media WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY created_at`;
 return <main className="workshop-report"><PrintReport/><span className="eyebrow">SERVICIO EXPRESS / REPORTE TÉCNICO</span><h1>{order.public_code}</h1><p>Orden POS: {order.pos_reference} · {stages[d.stage]} · {order.created_at.slice(0,10)}</p><h2>{d.brand} {d.model}</h2><p>{d.office} · Técnico: {d.technician}</p><dl><dt>Cliente</dt><dd>{d.customer_name||'Sin informar'}</dd><dt>Falla reportada</dt><dd>{d.reported_fault}</dd><dt>Diagnóstico</dt><dd>{d.diagnosis||'Pendiente'}</dd><dt>Pruebas</dt><dd>{d.tests_passed?'Aprobadas':'Pendientes'} — {d.tests_notes||'Sin detalle'}</dd><dt>Entrega y referencia POS</dt><dd>{d.delivery_notes||'Pendiente'}</dd><dt>Garantía ofrecida</dt><dd>{d.warranty_days??0} días. Según condiciones de la reparación.</dd></dl>
 {quote&&<section><h2>Presupuesto · versión {quote.revision}</h2><p>{quote.status==='approved'?'Aprobado':quote.status==='declined'?'Rechazado':'Pendiente de autorización'}</p><table><thead><tr><th>Trabajo / pieza</th><th>Cantidad</th><th>Importe</th></tr></thead><tbody>{(quote.lines as QuoteLine[]).map((l,i)=><tr key={i}><td>{l.description}</td><td>{l.quantity}</td><td>{money(lineTotal(l),quote.currency)}</td></tr>)}</tbody></table><h3>Total: {money(quote.total,quote.currency)}</h3><p>{quote.response_evidence}</p><small>Este presupuesto no acredita un pago. El comprobante de cobro se gestiona en el POS.</small></section>}
 <section className="workshop-report-media"><h2>Evidencias</h2>{media.map(m=><figure key={m.id}>{m.media_type.startsWith('image/')?<img src={`/api/workshop/media?id=${m.id}`} alt={m.caption}/>:<a href={`/api/workshop/media?id=${m.id}`}>Documento PDF adjunto</a>}<figcaption>{m.caption}</figcaption></figure>)}</section></main>;
}
