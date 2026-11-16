import {NextResponse} from 'next/server';
import {authenticated} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
export async function GET(){if(!await authenticated())return new Response(null,{status:401});try{const rows=await db()`SELECT o.*,v.brand,v.model,v.variant,v.markup_type AS default_markup_type,v.markup_value AS default_markup_value,s.filename,s.received_at,
 (SELECT p.cost FROM offers p WHERE p.tenant_id=o.tenant_id AND p.variant_id=o.variant_id AND lower(p.supplier)=lower(o.supplier) AND p.currency=o.currency AND p.published_at<o.published_at ORDER BY p.published_at DESC LIMIT 1) AS previous_cost,
 (SELECT json_build_object('cost',p.unit_cost,'date',p.occurred_at) FROM purchases p WHERE p.tenant_id=o.tenant_id AND p.variant_id=o.variant_id AND p.currency=o.currency ORDER BY p.occurred_at DESC LIMIT 1) AS last_purchase,
 (SELECT json_build_object('price',p.unit_price,'date',p.occurred_at) FROM sales p WHERE p.tenant_id=o.tenant_id AND p.variant_id=o.variant_id AND p.currency=o.currency ORDER BY p.occurred_at DESC LIMIT 1) AS last_sale
 FROM offers o JOIN variants v ON v.id=o.variant_id AND v.tenant_id=o.tenant_id JOIN sources s ON s.id=o.source_id AND s.tenant_id=o.tenant_id WHERE o.tenant_id=${TENANT} AND o.superseded_at IS NULL ORDER BY v.brand,v.model,v.variant,o.cost`;return NextResponse.json(rows)}catch{return NextResponse.json({error:'No se pudo cargar el catálogo. Comprueba la conexión y las migraciones.'},{status:503})}}
