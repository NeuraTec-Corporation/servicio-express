import {authenticated,currentUser} from '@/lib/auth';
import {orderVisible} from '@/lib/access';
import {db,TENANT} from '@/lib/db';
import {ensureWorkshopSchema} from '@/lib/workshop-schema';
import {redirect,notFound} from 'next/navigation';
import {z} from 'zod';
import {stages,type OrderFields} from '@/lib/workshop';
import {authorizedQuoteTotal,lineTotal,type QuoteLine} from '@/lib/workshop-operations';
import {money} from '@/lib/ui-data';
import ReportContent from './report-content';
export const dynamic='force-dynamic';
export default async function OrderReport({params}:{params:Promise<{id:string}>}){
 if(!await authenticated())redirect('/');const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 await ensureWorkshopSchema();const sql=db();const [order]=await sql`SELECT public_code,pos_reference,data,created_at::text FROM work_orders WHERE tenant_id=${TENANT} AND id=${id}`;if(!order||!orderVisible((await currentUser())!,order.data))notFound();
 const d={...order.data} as OrderFields;delete d.device_access_code;const [quote]=await sql`SELECT revision,currency,lines,issue_authorization,total::float8,status,response_evidence FROM work_order_quotes WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY revision DESC LIMIT 1`;
 const media=await sql`SELECT id,caption,media_type FROM work_order_media WHERE tenant_id=${TENANT} AND order_id=${id} ORDER BY created_at`;
 return <ReportContent order={{public_code:order.public_code,pos_reference:order.pos_reference,created_at:order.created_at,data:d}} quote={quote?{authorized_total:authorizedQuoteTotal(quote),revision:quote.revision,currency:quote.currency,lines:quote.lines as QuoteLine[],total:quote.total,status:quote.status,response_evidence:quote.response_evidence}:undefined} media={media.map(m=>({id:m.id,caption:m.caption,media_type:m.media_type}))}/>;
}
