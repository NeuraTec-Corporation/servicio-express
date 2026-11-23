'use client';
import {Presets} from './workshop-quick';
import {canManage,type Account} from '@/lib/access';
import { useLocale } from "./locale";
import { useCallback, useEffect, useState } from 'react';
import { api, money, date } from '@/lib/ui-data';
import { quoteTotal, stageDurations, stockAvailable, type OrderDetail, type QuoteLine, type StockBatch } from '@/lib/workshop-operations';
import { stages, type WorkOrder } from '@/lib/workshop';
const newLine = (): QuoteLine => ({ description: '', kind: 'part', quantity: 1, unit_cost: 0, markup_type: 'percent', markup_value: 0 });
const actions: Record<string, string> = { handoff_front_desk:'Taller entregó a recepción',handoff_client:'Recepción entregó al cliente',create: 'Orden recibida', update: 'Ficha actualizada', reserve: 'Pieza reservada', consume: 'Pieza utilizada', return: 'Pieza devuelta', quote: 'Presupuesto creado', decide: 'Respuesta registrada', settle: 'Cobro consolidado',v2_adopt:'Flujo V2 activado',v2_issue:'Daño actualizado',v2_request:'Pieza planificada',v2_order_part:'Pedido autorizado registrado',v2_receive_part:'Recepción comparada',v2_resolve:'Daño resuelto',v2_settings:'Recepción y jornada actualizadas',v2_cancel_request:'Borrador retirado',v2_transition:'Proceso actualizado' };
export default function WorkshopOperations({ order, disabled, onChanged, onBusyChange,activeTab }: {
    activeTab?:string;order: WorkOrder;
    disabled: boolean;
    onChanged: () => Promise<void>;
    onBusyChange: (busy: boolean) => void;
}) {
    const { t: tr } = useLocale();const [profile,setProfile]=useState<Account|null>(null);useEffect(()=>{void api('/api/me').then(j=>setProfile(j.user))},[]);
    const [detail, setDetail] = useState<OrderDetail | null>(null), [batches, setBatches] = useState<StockBatch[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState('parts');
    useEffect(()=>{if(activeTab)setTab(activeTab)},[activeTab]);
    const [batchId, setBatchId] = useState(''), [quantity, setQuantity] = useState(1), [lines, setLines] = useState<QuoteLine[]>([newLine()]), [currency, setCurrency] = useState('USD'), [evidence, setEvidence] = useState(''), [caption, setCaption] = useState('');
    const [channel, setChannel] = useState('onsite'), [respondent, setRespondent] = useState(order.customer_name);
    const [collected, setCollected] = useState(0), [laborCost, setLaborCost] = useState(''), [receipt, setReceipt] = useState(''), [correctionPassword, setCorrectionPassword] = useState('');
    const load = useCallback(async () => { try {
        const [d, b] = await Promise.all([api(`/api/workshop/operations?orderId=${order.id}`), api('/api/workshop/operations')]);
        setDetail(d);
        setBatches(b.batches);
        setError('');
    }
    catch (e) {
        setError(String(e));
    } }, [order.id]);
    useEffect(() => { void load(); }, [load, order.version]);
    const perform = async (input: Record<string, unknown>) => { if (disabled || busy)
        return; setBusy(true); onBusyChange(true); setError(''); try {
        await api('/api/workshop/operations', { request_id: crypto.randomUUID(), order_id: order.id, version: order.version, ...input });
        await onChanged();
        await load();
        setEvidence('');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
        onBusyChange(false);
    } };
    const latest = detail?.quotes[0];
    const available = batches.filter(b => !b.cancelled && b.office === order.office && stockAvailable(b) > 0 && (!order.workflow || order.workflow.requests.some(r => r.batch_id === b.id && r.status !== 'cancelled')));
    return <section className="workshop-operation" onKeyDown={e => { if (e.key === 'Enter' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement))
        e.preventDefault(); }}><h3>{tr("Operaci\u00F3n de la orden")}</h3><p className="workshop-footnote">{tr('Aquí creas el presupuesto, registras su aprobación, adjuntas evidencias y consultas quién cambió cada etapa.','Create estimates, record approval, attach evidence and see who changed each stage here.')}</p><div className="workshop-tabs" role="group" aria-label={tr("Secciones de la orden")}>{[['parts', 'Repuestos'], ['quotes', 'Presupuesto'], ['media', 'Fotos y documentos'], ['history', 'Historial y tiempos'], ['settle', 'Cierre y cobro']].filter(([id])=>id!=='settle'||profile&&canManage(profile.role)).map(([id, label]) => <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{tr(label)}</button>)}</div>
 {disabled && <p className="warning">{tr("Guarda los cambios de la ficha antes de operar repuestos, presupuesto o evidencias.")}</p>}{error && <p className="error banner" role="alert">{tr(error)}</p>}
 <fieldset disabled={disabled || busy}>
 {tab === 'parts' && <><p>{tr("Reserva existencias de esta oficina y confirma su uso cuando instales la pieza.")}</p><div className="workshop-form-grid"><label>{tr("Pieza disponible")}<select value={batchId} onChange={e => setBatchId(e.target.value)}><option value="">{tr("Seleccionar pieza")}</option>{available.map(b => <option key={b.id} value={b.id}>{b.part} · {b.model} · {stockAvailable(b)}{tr(" disponibles \u00B7 ")}{money(b.unit_cost, b.currency)}</option>)}</select></label><label>{tr("Unidades a reservar")}<input type="number" min={1} max={10000} value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label></div><button type="button" disabled={!batchId||profile?.role==='staff'} onClick={() => void perform({ action: 'reserve', batch_id: batchId, quantity })}>{tr("Reservar para este equipo")}</button>{!available.length && <p className="workshop-footnote">{tr("Registra el pedido y la recepci\u00F3n en Inventario para disponer de piezas.")}</p>}
 <div className="workshop-list">{detail?.parts.map(p => <div key={p.id}><span><b>{p.part}</b><small>{p.quantity}{tr(" unidades \u00B7 ")}{money(p.unit_cost, p.currency)}{tr(" c/u \u00B7 ")}{p.state === 'reserved' ? tr("Reservada") : p.state === 'consumed' ? tr("Utilizada") : tr("Devuelta")}</small></span><div>{p.state === 'reserved' && profile?.role!=='staff' && <button type="button" onClick={() => void perform({ action: 'consume', allocation_id: p.id })}>{tr("Confirmar uso")}</button>}{p.state !== 'returned' && profile?.role!=='staff' && <button type="button" onClick={() => { if (confirm('¿Confirmas que la pieza está físicamente disponible y en condiciones de volver al stock?'))
            void perform({ action: 'return', allocation_id: p.id, confirmed_usable: true }); }}>{tr("Devolver al stock")}</button>}</div></div>)}</div></>}
 {tab === 'quotes' && <><p>{tr("Cada versi\u00F3n conserva sus importes y la respuesta del cliente. Incluye el alcance completo de la reparaci\u00F3n en la nueva versi\u00F3n.")}</p>{latest && <div className="workshop-quote-summary"><span>{tr("Versi\u00F3n ")}{latest.revision} · {latest.status === 'pending' ? tr("Pendiente de respuesta") : latest.status === 'approved' ? tr("Aprobada") : tr("Rechazada")}</span><strong>{money(latest.total, latest.currency)}</strong><small>{latest.previous_total === null ? tr("Sin importe aprobado anterior") : tr("Anterior aprobado: {0} \u00B7 Diferencia: {1}", undefined, [money(latest.previous_total, latest.currency), money(latest.total - latest.previous_total, latest.currency)])}</small><ul>{latest.lines.map((l, i) => <li key={i}>{l.quantity} × {l.description}</li>)}</ul>{latest.response_evidence && <p>{latest.response_evidence}</p>}{latest.status === 'pending' && <><div className="quick-choices">{[['onsite','Presencial','In person'],['phone','Teléfono','Phone'],['whatsapp','WhatsApp','WhatsApp'],['sms','SMS','SMS'],['pos','Constancia POS manual','Manual POS evidence']].map(([v,es,en])=><button type="button" key={v} className={channel===v?'selected':''} onClick={()=>setChannel(v)}>{tr(es,en)}</button>)}</div><div className="workshop-form-grid"><label>{tr("Canal de respuesta")}<select value={channel} onChange={e => setChannel(e.target.value)}><option value="onsite">{tr("Presencial")}</option><option value="phone">{tr("Tel\u00E9fono")}</option><option value="sms">{tr("SMS")}</option><option value="whatsapp">{tr("WhatsApp")}</option><option value="pos">{tr("Constancia POS manual")}</option></select></label><label>{tr("Persona que respondi\u00F3")}<input value={respondent} maxLength={160} onChange={e => setRespondent(e.target.value)}/></label></div><button type="button" onClick={() => setEvidence(`Respuesta registrada manualmente de ${respondent} por ${channel}, versión ${latest.revision}, ${new Date().toLocaleString()}. Confirmada por el operador; sin envío automático.`)}>{tr("Completar constancia de respuesta")}</button><label>{tr("Respuesta y evidencia del cliente")}<textarea value={evidence} maxLength={2000} onChange={e => setEvidence(e.target.value)} placeholder={tr("Nombre, fecha, canal y versi\u00F3n/alcance aprobado o rechazado. Si viene autorizado del POS, registra su referencia.")}/></label><div className="workshop-actions"><button type="button" disabled={evidence.trim().length < 8} onClick={() => void perform({ action: 'decide', quote_id: latest.id, status: 'approved', evidence, channel, respondent })}>{tr("Registrar aprobaci\u00F3n")}</button><button type="button" disabled={evidence.trim().length < 8} onClick={() => void perform({ action: 'decide', quote_id: latest.id, status: 'declined', evidence, channel, respondent })}>{tr("Registrar rechazo")}</button></div></>}</div>}
 <details className="workshop-new-quote"><summary>{tr("Preparar ")}{latest ? tr("nueva versi\u00F3n") : tr("presupuesto")}</summary>{latest && <button type="button" onClick={() => { setLines(latest.lines); setCurrency(latest.currency); }}>{tr("Copiar versi\u00F3n anterior")}</button>}{order.workflow && <button type="button" onClick={() => { const w = order.workflow!; const reqs = w.requests.filter(r => r.status !== 'cancelled'); setCurrency(reqs[0]?.currency ?? 'USD'); setLines([...reqs.map(r => ({ description: r.description, kind: 'part' as const, quantity: r.quantity, unit_cost: r.unit_cost, markup_type: 'fixed' as const, markup_value: 0, request_id: r.id, issue_id: r.issue_id, ...(r.source === 'stock' && r.batch_id ? { batch_id: r.batch_id } : {}) })), { description: 'Mano de obra / Labor', kind: 'labor', quantity: 1, unit_cost: 0, markup_type: 'fixed', markup_value: 0 }]); }}>{tr("Cargar piezas del plan V2")}</button>}<label>{tr("Moneda")}<input maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}/></label>{lines.map((line, index) => <div className="workshop-quote-line" key={index}><label>{tr("Pieza de inventario (opcional)")}<select value={line.batch_id ?? ''} onChange={e => { const batch = batches.find(b => b.id === e.target.value); if (batch && batch.currency !== currency) {
            setError('La moneda de la pieza no coincide con el presupuesto.');
            return;
        } setLines(old => old.map((l, i) => i === index ? { ...l, batch_id: batch?.id, description: batch?.part ?? l.description, unit_cost: batch?.unit_cost ?? l.unit_cost } : l)); }}><option value="">{tr("Concepto manual / mano de obra")}</option>{batches.filter(b => b.office === order.office).map(b => <option key={b.id} value={b.id}>{b.part} · {money(b.unit_cost, b.currency)}</option>)}</select></label><label>{tr("Concepto")}<input maxLength={160} value={line.description} onChange={e => setLines(old => old.map((l, i) => i === index ? { ...l, description: e.target.value } : l))}/></label><div className="workshop-form-grid"><label>{tr("Tipo")}<select value={line.kind} onChange={e => setLines(old => old.map((l, i) => i === index ? { ...l, kind: e.target.value as 'part' | 'labor' } : l))}><option value="part">{tr("Pieza")}</option><option value="labor">{tr("Mano de obra")}</option></select></label><label>{tr("Cantidad")}<input type="number" min={1} value={line.quantity} onChange={e => setLines(old => old.map((l, i) => i === index ? { ...l, quantity: Number(e.target.value) } : l))}/></label><label>{tr("Costo o base por unidad")}<input type="number" min={0} step="0.01" value={line.unit_cost} onChange={e => setLines(old => old.map((l, i) => i === index ? { ...l, unit_cost: Number(e.target.value) } : l))}/></label><label>{tr("Recargo")}<Presets label={tr('Porcentajes frecuentes','Common percentages')} values={[[10,'10%'],[20,'20%'],[25,'25%'],[30,'30%'],[50,'50%']]} value={line.markup_type==='percent'?line.markup_value:null} onChange={v=>setLines(old=>old.map((l,i)=>i===index?{...l,markup_type:'percent',markup_value:v}:l))}/><input type="number" min={0} step="0.01" value={line.markup_value} onChange={e => setLines(old => old.map((l, i) => i === index ? { ...l, markup_value: Number(e.target.value) } : l))}/></label><label>{tr("Tipo de recargo")}<select value={line.markup_type} onChange={e => setLines(old => old.map((l, i) => i === index ? { ...l, markup_type: e.target.value as 'fixed' | 'percent' } : l))}><option value="percent">{tr("Porcentaje %")}</option><option value="fixed">{tr("Importe fijo por unidad")}</option></select></label></div><button type="button" onClick={() => setLines(old => old.filter((_, i) => i !== index))}>{tr("Quitar concepto")}</button></div>)}<div className="workshop-actions"><button type="button" onClick={() => setLines(old => [...old, newLine()])}>{tr("\uFF0B Concepto")}</button><strong>{tr("Vista previa: ")}{money(quoteTotal(lines), currency)}</strong><button type="button" className="primary" disabled={!lines.length||profile?.role==='staff'} onClick={() => void perform({ action: 'quote', currency, lines })}>{tr("Crear versi\u00F3n pendiente")}</button></div></details>
 {detail && detail.quotes.length > 1 && <details><summary>{tr("Versiones anteriores (")}{detail.quotes.length - 1})</summary>{detail.quotes.slice(1).map(q => <p key={q.id}>{tr("Versi\u00F3n ")}{q.revision} · {money(q.total, q.currency)} · {q.status === 'approved' ? tr("Aprobada") : q.status === 'declined' ? tr("Rechazada") : tr("Pendiente")} · {q.response_evidence || tr("Sin respuesta registrada")}</p>)}</details>}</>}
 {tab === 'media' && <><p className="banner">{tr('Puedes adjuntar desde la recepción inicial o aquí en cualquier momento. Escribe una descripción para habilitar el selector.','Attach during initial intake or here at any time. Enter a description to enable file selection.')}</p><p>{tr("Fotograf\u00EDas privadas del diagn\u00F3stico y piezas, factura u orden original. No aparecen en la TV.")}</p><div className="quick-choices">{['Ticket de recepción','Estado físico recibido','Diagnóstico técnico','Pieza dañada','Pieza recibida','Pruebas finales','Constancia de entrega'].map(v=><button type="button" key={v} onClick={()=>setCaption(v)}>{tr(v)}</button>)}</div><label>{tr("Descripci\u00F3n de la evidencia")}<input value={caption} maxLength={500} onChange={e => setCaption(e.target.value)} placeholder={tr("Pantalla da\u00F1ada, pieza recibida, orden POS\u2026")}/></label><label className="workshop-upload">{tr("Adjuntar fotograf\u00EDa o PDF")}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={!caption.trim()} onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; setBusy(true); onBusyChange(true); setError(''); try {
        const form = new FormData();
        form.set('order_id', order.id);
        form.set('caption', caption);
        form.set('file', await compressPhoto(file));
        const r = await fetch('/api/workshop/media', { method: 'POST', body: form });
        const j = await r.json();
        if (!r.ok)
            throw new Error(j.error);
        setCaption('');
        await load();
    }
    catch (err) {
        setError(String(err));
    }
    finally {
        setBusy(false);
        onBusyChange(false);
        e.target.value = '';
    } }}/></label><div className="workshop-media-grid">{detail?.media.map(m => <a key={m.id} href={`/api/workshop/media?id=${m.id}`} target="_blank" rel="noopener noreferrer">{m.media_type.startsWith('image/') ? <img src={`/api/workshop/media?id=${m.id}`} alt={m.caption} loading="lazy"/> : <span>{tr("PDF")}</span>}<b>{m.caption}</b><small>{m.filename}</small></a>)}</div></>}
 {tab === 'settle' && <><h4>{tr("Consolidar cobro confirmado en el POS")}</h4>{detail?.settled ? <div><p className="banner success">{tr("Este cobro ya est\u00E1 registrado en Operaciones reales. No se duplicar\u00E1.")}</p><details><summary>{tr("Corregir registro de cobro")}</summary><p>{tr("Elimina \u00FAnicamente la consolidaci\u00F3n de esta orden, conservando auditor\u00EDa. No realiza una devoluci\u00F3n en el POS ni devuelve dinero al cliente.")}</p><label>{tr("Clave para corregir el cobro")}<input type="password" autoComplete="current-password" value={correctionPassword} onChange={e => setCorrectionPassword(e.target.value)}/></label><button type="button" disabled={!correctionPassword} onClick={async () => { if (!confirm('¿Eliminar el registro consolidado para volver a registrar el cobro correcto?'))
        return; setBusy(true); onBusyChange(true); try {
        const r = await fetch('/api/workshop/operations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'settlement', id: order.id, confirmation: 'BORRAR', password: correctionPassword }) });
        const j = await r.json();
        if (!r.ok)
            throw new Error(j.error);
        setCorrectionPassword('');
        await load();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
        onBusyChange(false);
    } }}>{tr("Eliminar registro para corregir")}</button></details></div> : <><p>{tr("Registra el importe final efectivamente cobrado una vez entregado el equipo. No registra anticipos ni realiza ning\u00FAn cargo.")}</p><div className="workshop-form-grid"><label>{tr("Importe cobrado")}<input type="number" min={0} step="0.01" value={collected} onChange={e => setCollected(Number(e.target.value))}/></label><label>{tr("Moneda del cobro")}<input maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}/></label><label>{tr("Costo real de mano de obra (vac\u00EDo = desconocido)")}<input type="number" min={0} step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)}/></label><label>{tr("Referencia del recibo / cobro POS")}<input maxLength={160} value={receipt} onChange={e => setReceipt(e.target.value)}/></label></div><p>{tr("Se sumar\u00E1 el costo de las piezas consumidas en la misma moneda. Si la mano de obra es desconocida o hay costos en otra moneda, el costo total quedar\u00E1 desconocido y no se calcular\u00E1 utilidad.")}</p><button type="button" disabled={order.stage !== 'delivered' || !receipt.trim()} onClick={() => { if (confirm('¿Confirmas que este importe final fue cobrado en el POS y no está registrado manualmente en el dashboard?'))
        void perform({ action: 'settle', amount: collected, currency, labor_cost: laborCost === '' ? null : Number(laborCost), pos_receipt: receipt, confirmed_collected: true }); }}>{tr("Confirmar cobro y consolidar")}</button>{order.stage !== 'delivered' && <small>{tr("Completa las pruebas, marca listo y registra la entrega primero.")}</small>}</>}</>}
 {tab === 'history' && <><h4>{tr("Tiempo registrado por etapa")}</h4><p className="workshop-footnote">{tr("Se calcula entre las horas guardadas al pulsar acciones. V2 cuenta diagnóstico, reparación, pruebas y limpieza solo dentro de la jornada (15:00–20:00 por defecto); excluye pausas. Secado es tiempo de calendario. V1 conserva intervalos antiguos. Los datos DEMO no son tiempos reales de reparación.")}</p><div className="workshop-duration">{Object.entries(stageDurations(detail?.events ?? [], Date.now(), order.workflow?.schedule)).map(([stage, min]) => <span key={stage}>{stages[stage as keyof typeof stages] ?? stage}<b>{Math.round(min)}{tr(" min")}</b></span>)}</div><ol className="workshop-timeline">{detail?.events.map(e => <li key={e.id}><b>{actions[e.action] ?? e.action}</b><span>{typeof e.detail.actor==='string'?e.detail.actor+' · ':''}{date(e.created_at)} · {stages[e.stage as keyof typeof stages] ?? e.stage}{e.paused ? tr(" \u00B7 En espera") : ''}</span></li>)}</ol></>}
 </fieldset></section>;
}
export async function compressPhoto(file: File): Promise<File> {
    if (!file.type.startsWith('image/'))
        return file;
    if (file.size > 16 * 1024 * 1024)
        throw new Error('La foto supera 16 MB. Recórtala antes de cargarla.');
    const bitmap = await createImageBitmap(file);
    try {
        if (bitmap.width * bitmap.height > 32000000)
            throw new Error('Recorta la imagen antes de cargarla.');
        const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('No se pudo preparar la foto');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo comprimir la foto')), 'image/jpeg', .82));
        return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    }
    finally {
        bitmap.close();
    }
}
