import {NextResponse} from 'next/server';

import {authenticated,sameOrigin,currentUser} from '@/lib/auth';

import {canManage} from '@/lib/access';

import {backupTables} from '@/lib/recovery';

import {db,TENANT} from '@/lib/db';

import {ensureManagementSchema} from '@/lib/management-schema';

import {ensureWorkshopSchema} from '@/lib/workshop-schema';

import {resetSchema} from '@/lib/analytics';

import {verifyAdminPassword} from '@/lib/admin-auth';

export const runtime='nodejs';

export async function GET(){if(!await authenticated())return new Response(null,{status:401});const user=await currentUser();if(!user||!canManage(user.role))return new Response(null,{status:403});try{await ensureManagementSchema();await ensureWorkshopSchema();const [counts]=await db()`SELECT (SELECT count(*)::int FROM stock_batches WHERE tenant_id=${TENANT}) AS batches,(SELECT count(*)::int FROM work_order_media WHERE tenant_id=${TENANT}) AS media,(SELECT count(*)::int FROM work_orders WHERE tenant_id=${TENANT}) AS work_orders,(SELECT count(*)::int FROM offers WHERE tenant_id=${TENANT}) AS offers,(SELECT count(*)::int FROM sources WHERE tenant_id=${TENANT}) AS sources,(SELECT count(*)::int FROM variants WHERE tenant_id=${TENANT}) AS variants,(SELECT count(*)::int FROM management_entries WHERE tenant_id=${TENANT}) AS entries,(SELECT count(*)::int FROM purchases WHERE tenant_id=${TENANT}) AS purchases,(SELECT count(*)::int FROM sales WHERE tenant_id=${TENANT}) AS sales`;return NextResponse.json(counts)}catch{return NextResponse.json({error:'No se pudo consultar el alcance de la limpieza'},{status:503})}}

export async function POST(request:Request){if(!await authenticated())return new Response(null,{status:401});const user=await currentUser();if(!user||!canManage(user.role))return new Response(null,{status:403});if(!sameOrigin(request))return new Response(null,{status:403});try{const input=resetSchema.safeParse(await request.clone().json());if(!input.success)return NextResponse.json({error:'Escribe BORRAR y confirma tu clave para continuar'},{status:400});const sql=db();const denied=await verifyAdminPassword(request,input.data.password);if(denied)return NextResponse.json({error:denied.error},{status:denied.status});await ensureManagementSchema();await ensureWorkshopSchema();const deleted=await sql.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(812622)`;await tx`SELECT pg_advisory_xact_lock(812623)`;await tx`SELECT pg_advisory_xact_lock(812624)`;await tx`LOCK TABLE ${tx([...backupTables])} IN EXCLUSIVE MODE`;const body=await request.json();const backupId=typeof body.backup_id==='string'&&/^[-a-f0-9]{36}$/.test(body.backup_id)?body.backup_id:'00000000-0000-0000-0000-000000000000';const [receipt]=await tx`SELECT b.id FROM external_backups b JOIN app_data_revision r ON r.tenant_id=b.tenant_id AND r.revision=b.revision WHERE b.tenant_id=${TENANT} AND b.id=${backupId} AND b.status='verified' AND b.consumed_at IS NULL AND b.verified_at>now()-interval '15 minutes' FOR UPDATE OF b`;if(!receipt)throw new Error('BACKUP_REQUIRED');await tx`UPDATE external_backups SET consumed_at=now() WHERE tenant_id=${TENANT} AND id=${backupId}`;const counts:Record<string,number>={};if(input.data.scope==='all'){await tx`DELETE FROM inventory_counts WHERE tenant_id=${TENANT}`;await tx`DELETE FROM stock_reorder_rules WHERE tenant_id=${TENANT}`;await tx`DELETE FROM recovery_uploads WHERE tenant_id=${TENANT}`;await tx`DELETE FROM workshop_ledger_links WHERE tenant_id=${TENANT}`;

counts.media=(await tx`DELETE FROM work_order_media WHERE tenant_id=${TENANT} RETURNING id`).length;

await tx`DELETE FROM work_order_events WHERE tenant_id=${TENANT}`;

await tx`DELETE FROM work_order_quotes WHERE tenant_id=${TENANT}`;

await tx`DELETE FROM work_order_parts WHERE tenant_id=${TENANT}`;

await tx`DELETE FROM stock_movements WHERE tenant_id=${TENANT}`;

counts.batches=(await tx`DELETE FROM stock_batches WHERE tenant_id=${TENANT} RETURNING id`).length;

counts.work_orders=(await tx`DELETE FROM work_orders WHERE tenant_id=${TENANT} RETURNING id`).length;await tx`DELETE FROM customers WHERE tenant_id=${TENANT}`;counts.entries=(await tx`DELETE FROM management_entries WHERE tenant_id=${TENANT} RETURNING id`).length;counts.purchases=(await tx`DELETE FROM purchases WHERE tenant_id=${TENANT} RETURNING id`).length;counts.sales=(await tx`DELETE FROM sales WHERE tenant_id=${TENANT} RETURNING id`).length}counts.offers=(await tx`DELETE FROM offers WHERE tenant_id=${TENANT} RETURNING id`).length;counts.sources=(await tx`DELETE FROM sources WHERE tenant_id=${TENANT} RETURNING id`).length;counts.variants=(await tx`DELETE FROM variants v WHERE v.tenant_id=${TENANT} AND NOT EXISTS(SELECT 1 FROM purchases p WHERE p.tenant_id=v.tenant_id AND p.variant_id=v.id) AND NOT EXISTS(SELECT 1 FROM sales s WHERE s.tenant_id=v.tenant_id AND s.variant_id=v.id) RETURNING id`).length;await tx`INSERT INTO audit_events(tenant_id,actor,action,entity_id,detail) VALUES(${TENANT},${user.code},'laboratory_reset',${TENANT},${tx.json({scope:input.data.scope,deleted:counts})})`;return counts});return NextResponse.json({ok:true,deleted})}catch(error){if(error instanceof Error&&error.message==='BACKUP_REQUIRED')return NextResponse.json({error:'Se requiere un respaldo externo confirmado de los datos actuales. Solicítalo antes de borrar.',code:'BACKUP_REQUIRED'},{status:409});return NextResponse.json({error:'No se pudo completar la limpieza. La operación es transaccional.'},{status:500})}}

