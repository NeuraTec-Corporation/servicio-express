import {NextResponse} from 'next/server';
import {authenticated,sameOrigin} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {assertBulkCurrencies,bulkPolicySchema} from '@/lib/pricing';

export async function POST(request:Request){
 if(!await authenticated())return new Response(null,{status:401});
 if(!sameOrigin(request))return new Response(null,{status:403});
 try{
  const parsed=bulkPolicySchema.safeParse(await request.json());if(!parsed.success)throw new Error('Selecciona de 1 a 500 ofertas y un recargo válido entre 0 y 1.000.000, con hasta dos decimales.');
  const p=parsed.data;
  await db().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(812622)`;
   const before=await sql`SELECT id,currency,markup_type,markup_value FROM offers WHERE tenant_id=${TENANT} AND id IN ${sql(p.ids)} AND superseded_at IS NULL ORDER BY id FOR UPDATE`;
   if(before.length!==p.ids.length)throw new Error('Una oferta ya no está vigente. Actualiza el catálogo y selecciona nuevamente. No se aplicó ningún cambio.');
   assertBulkCurrencies(before.map(o=>String(o.currency)),p.type);
   await sql`UPDATE offers SET markup_type=${p.type},markup_value=${p.value} WHERE tenant_id=${TENANT} AND id IN ${sql(p.ids)}`;
   for(const row of before)await sql`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},'operador','pricing_policy',${row.id},${sql.json({scope:'offer',before:row,after:{type:p.type,value:p.value},bulkCount:p.ids.length})})`;
  });
  return NextResponse.json({ok:true,count:p.ids.length,updates:p.ids.map(id=>({id,scope:'offer',type:p.type,value:p.value}))});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudo aplicar el recargo. No se guardaron cambios parciales.'},{status:400});}
}
