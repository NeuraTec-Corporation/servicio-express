'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
import { approvalStates, blankOrder, partsStates, stages, type OrderFields, type WorkOrder } from '@/lib/workshop';
import WorkshopOperations from './workshop-operations';
import WorkshopV2Panel from './workshop-v2-panel';
import { CatalogInput } from './workshop-reference';
import { emptyWorkflow } from '@/lib/workshop-v2';
export default function OrderEditor({ order, officeOptions, technicianOptions, onClose, onSaved }: {
    order?: WorkOrder;
    officeOptions: string[];
    technicianOptions: string[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t: tr } = useLocale();
    const [current, setCurrent] = useState(order);
    const [draft, setDraft] = useState<OrderFields>({ ...blankOrder(), ...order });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [operationsBusy, setOperationsBusy] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const initial = useRef(JSON.stringify({ ...blankOrder(), ...order }));
    const close = () => { if (busy || operationsBusy)
        return; if (JSON.stringify(draft) !== initial.current && !confirm('Tienes cambios sin guardar. ¿Cerrar la orden?'))
        return; onClose(); };
    useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); previous?.focus(); }; }, []);
    useEffect(() => { if (order)
        return; void fetch('/api/me').then(r => r.json()).then(j => { const u = j.user; if (u)
        setDraft(d => ({ ...d, office: u.office, technician: u.role === 'technician' ? u.code : d.technician })); }); void fetch('/api/directory').then(r => r.json()).then(j => setDirectory(j.users ?? [])); }, [order]);
    const [directory, setDirectory] = useState<{
        code: string;
        display_name: string;
        office: string;
    }[]>([]);
    const field = <K extends keyof OrderFields>(key: K, value: OrderFields[K]) => setDraft(old => ({ ...old, [key]: value }));
    return <dialog aria-label={tr("Ficha de trabajo")} ref={dialog} className="workshop-dialog" onCancel={e => { e.preventDefault(); close(); }}><form onSubmit={async (e) => { e.preventDefault(); if (busy || operationsBusy)
        return; setBusy(true); setError(''); try {
        const r = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: current ? 'update' : 'create', ...(current ? { id: current.id, version: current.version } : {}), data: draft }) });
        if (r.status === 401)
            throw new Error('La sesión venció. Conserva tus notas e inicia sesión de nuevo.');
        const result = await r.json();
        if (!r.ok)
            throw new Error(result.error);
        onSaved();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
    finally {
        setBusy(false);
    } }}>
    <header><div><span className="eyebrow">{order?.public_code ?? tr("NUEVA ORDEN")}</span><h2>{order ? tr("Ficha de trabajo") : tr("Recibir equipo")}</h2></div><button type="button" aria-label={tr("Cerrar ficha")} onClick={close} disabled={busy || operationsBusy}>✕</button></header>
    <div className="workshop-editor-body"><p className="workshop-footnote">{tr("Ingreso manual \u00B7 Sin conexi\u00F3n con POS")}</p><fieldset disabled={busy || operationsBusy}><legend>{tr("Orden y equipo")}</legend><div className="workshop-form-grid"><label>{tr("Referencia externa \u00B7 opcional")}<input maxLength={160} value={draft.pos_reference} onChange={e => field('pos_reference', e.target.value)}/></label><label>{tr("Tipo de equipo")}<select value={draft.device_type} onChange={e => field('device_type', e.target.value as OrderFields['device_type'])}><option value="phone">{tr("Tel\u00E9fono")}</option><option value="tablet">{tr("Tablet / iPad")}</option><option value="laptop">{tr("Laptop")}</option><option value="desktop">{tr("PC")}</option><option value="other">{tr("Otro")}</option></select></label><CatalogInput kind="brand" label={tr("Marca")} required disabled={Boolean(current?.workflow?.requests.length)} value={draft.brand} onChange={value => field('brand', value)}/><CatalogInput kind="model" label={tr("Modelo")} required disabled={Boolean(current?.workflow?.requests.length)} value={draft.model} onChange={value => field('model', value)}/>{!current && <CatalogInput kind="device" label={tr("\uFF0B Tipo personalizado")} value={draft.workflow?.device_label ?? ''} onChange={value => setDraft(d => ({ ...d, device_type: 'other', workflow: { ...(d.workflow ?? emptyWorkflow()), device_label: value } }))}/>}<label>{tr("Oficina")}<input required list="workshop-offices" maxLength={160} value={draft.office} onChange={e => field('office', e.target.value)}/><datalist id="workshop-offices">{officeOptions.map(o => <option key={o} value={o}/>)}</datalist></label><label>{tr("T\u00E9cnico")}<input placeholder={tr("Sin asignar")} list="workshop-technicians" maxLength={160} value={draft.technician} onChange={e => field('technician', e.target.value)}/><datalist id="workshop-technicians">{[...new Set([...technicianOptions, ...directory.filter(u => u.office === draft.office).map(u => u.code)])].map(o => <option key={o} value={o}/>)}</datalist></label><label>{tr("Cliente \u00B7 privado")}<input required maxLength={160} autoComplete="off" value={draft.customer_name} onChange={e => field('customer_name', e.target.value)}/></label><label>{tr("Tel\u00E9fono \u00B7 b\u00FAsqueda principal")}<input required type="tel" autoComplete="off" maxLength={160} value={draft.customer_phone} onBlur={async () => { if (!draft.customer_phone)
        return; try {
        const r = await fetch('/api/customers?phone=' + encodeURIComponent(draft.customer_phone));
        const j = await r.json();
        if (r.ok && j.customer)
            setDraft(d => ({ ...d, customer_name: d.customer_name || j.customer.name }));
    }
    catch { } }} onChange={e => field('customer_phone', e.target.value)}/></label></div><label>{tr("Estimaci\u00F3n restante \u00B7 minutos")}<input type="number" min={0} max={43200} value={draft.estimated_minutes ?? ''} onChange={e => field('estimated_minutes', e.target.value === '' ? null : Number(e.target.value))}/></label><label>{tr("Garant\u00EDa ofrecida \u00B7 d\u00EDas")}<input type="number" min={0} max={730} value={draft.warranty_days} onChange={e => field('warranty_days', Number(e.target.value))}/></label><label>{tr("Falla reportada por el cliente")}<textarea required maxLength={4000} rows={3} value={draft.reported_fault} onChange={e => field('reported_fault', e.target.value)}/></label><label>{tr("Accesorios y estado recibido")}<textarea maxLength={2000} rows={2} value={draft.accessories} onChange={e => field('accessories', e.target.value)}/></label></fieldset>
    {!current?.workflow && current && <fieldset disabled={busy || operationsBusy}><legend>{tr("Diagn\u00F3stico y seguimiento")}</legend><label>{tr("Diagn\u00F3stico t\u00E9cnico")}<textarea maxLength={8000} rows={4} value={draft.diagnosis} onChange={e => field('diagnosis', e.target.value)} placeholder={tr("Hallazgo, reparaci\u00F3n propuesta y piezas necesarias")}/></label><div className="workshop-form-grid"><label>{tr("Etapa")}<select disabled={!order} value={draft.stage} onChange={e => field('stage', e.target.value as OrderFields['stage'])}>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</select></label><label>{tr("Piezas \u00B7 seguimiento manual")}<select value={draft.parts_state} onChange={e => field('parts_state', e.target.value as OrderFields['parts_state'])}>{Object.entries(partsStates).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</select></label><label>{tr("Autorizaci\u00F3n")}<select disabled={Boolean(current)} value={draft.approval_state} onChange={e => field('approval_state', e.target.value as OrderFields['approval_state'])}>{Object.entries(approvalStates).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</select></label><label>{tr("Estimaci\u00F3n restante \u00B7 minutos")}<input type="number" min={0} max={43200} step={1} value={draft.estimated_minutes ?? ''} onChange={e => field('estimated_minutes', e.target.value === '' ? null : Number(e.target.value))} placeholder={tr("Por confirmar")}/></label></div>{draft.approval_state !== 'pos' && <label>{tr("Evidencia de respuesta del cliente")}<textarea readOnly={Boolean(current)} required={draft.approval_state === 'approved'} maxLength={2000} rows={2} value={draft.approval_evidence} onChange={e => field('approval_evidence', e.target.value)} placeholder={tr("Qui\u00E9n respondi\u00F3, fecha, canal y alcance aceptado o rechazado. Presupuesto versionado pendiente de la siguiente etapa.")}/></label>}<label>{tr("Motivo de pausa o espera")}<input maxLength={1000} value={draft.pause_reason} onChange={e => field('pause_reason', e.target.value)}/></label><label className="workshop-check"><input type="checkbox" checked={draft.tests_passed} onChange={e => field('tests_passed', e.target.checked)}/>{tr("Pruebas finales realizadas y aprobadas")}</label><label>{tr("Detalle de pruebas finales")}<textarea value={draft.tests_notes} maxLength={4000} onChange={e => field('tests_notes', e.target.value)} placeholder={tr("Carga, pantalla, c\u00E1maras, audio, conectividad\u2026")}/></label><label>{tr("Entrega y referencia de cobro")}<textarea value={draft.delivery_notes} maxLength={4000} onChange={e => field('delivery_notes', e.target.value)}/></label><label>{tr("Garant\u00EDa ofrecida \u00B7 d\u00EDas")}<input type="number" min={0} max={730} value={draft.warranty_days} onChange={e => field('warranty_days', Number(e.target.value))}/></label></fieldset>}
    {current && <WorkshopV2Panel order={current} disabled={busy || operationsBusy || JSON.stringify(draft) !== initial.current} onBusyChange={setOperationsBusy} onChanged={async () => { const r = await fetch('/api/workshop'); const j = await r.json(); if (!r.ok)
        throw new Error(j.error); const updated = j.orders.find((o: WorkOrder) => o.id === current.id); if (!updated)
        throw new Error('Orden no encontrada'); setCurrent(updated); const next = { ...blankOrder(), ...updated }; setDraft(next); initial.current = JSON.stringify(next); }}/>}{current && <WorkshopOperations order={current} disabled={busy || operationsBusy || JSON.stringify(draft) !== initial.current} onBusyChange={setOperationsBusy} onChanged={async () => { const r = await fetch('/api/workshop'); const j = await r.json(); if (!r.ok)
        throw new Error(j.error); const updated = j.orders.find((o: WorkOrder) => o.id === current.id); if (!updated)
        throw new Error('Orden no encontrada'); setCurrent(updated); const next = { ...blankOrder(), ...updated }; setDraft(next); initial.current = JSON.stringify(next); }}/>}
    {error && <p role="alert" className="error banner">{tr(error)}</p>}<p className="workshop-footnote">{tr("La autorizaci\u00F3n inicial se registra al recibir el equipo; no hay integraci\u00F3n con el POS. Para trabajos adicionales utiliza la versi\u00F3n del presupuesto y registra la respuesta. El contenido de esta ficha es privado.")}</p></div><footer>{current && <a href={`/taller/orden/${current.id}`} target="_blank" rel="noopener noreferrer" className="workshop-link">{tr("Reporte / imprimir \u2197")}</a>}<button type="button" onClick={close} disabled={busy || operationsBusy}>{tr("Cancelar")}</button><button className="primary" type="submit" disabled={busy || operationsBusy}>{busy ? tr("Guardando\u2026") : tr("Guardar orden")}</button></footer>
  </form></dialog>;
}
