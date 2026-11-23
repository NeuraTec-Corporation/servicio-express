'use client';
import { useLocale } from "./locale";
import { useCallback, useEffect, useState } from 'react';
import StockMovement from './stock-movement';
import {canManage} from '@/lib/access';
import {conditionLabels,verifiedStock} from '@/lib/workshop-v2';
import { StockInspection } from './workshop-reference';
import SupplierSettings from './workshop-suppliers';
import { EditStock, Replenishment } from './stock-controls';
import { api, money } from '@/lib/ui-data';
import { stockAvailable, type StockBatch } from '@/lib/workshop-operations';
export default function WorkshopInventory() {
    const { t: tr } = useLocale();
    const [movement,setMovement]=useState<{batch:StockBatch;action:'receive'|'transfer'|'supplier_return'}|null>(null),[manager,setManager]=useState(false);useEffect(()=>{void api('/api/me').then(j=>setManager(canManage(j.user.role)))},[]);
    const [inspecting, setInspecting] = useState<StockBatch | null>(null);
    const [editing, setEditing] = useState<StockBatch | null>(null), [generation, setGeneration] = useState(0), [showCancelled, setShowCancelled] = useState(false);
    const [batches, setBatches] = useState<StockBatch[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [showForm, setShowForm] = useState(false), [search, setSearch] = useState(''), [office, setOffice] = useState('');
    const [draft, setDraft] = useState({ part: '', brand: '', model: '', office: '', supplier: '', invoice: '', unit_cost: 0, currency: 'USD', ordered_quantity: 1 });
    const load = useCallback(async () => {
        try {
            setBatches((await api('/api/workshop/operations')).batches);
            setGeneration(v => v + 1);
            setError('');
        }
        catch (e) {
            setError(String(e));
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const filtered = batches.filter(b => (showCancelled || !b.cancelled) && (!office || b.office === office) && `${b.part} ${b.brand} ${b.model} ${b.supplier} ${b.invoice}`.toLowerCase().includes(search.toLowerCase()));
    return <section className="workshop-inventory"><div className="workshop-heading"><div><h2>{tr("Repuestos e inventario")}</h2><p>{tr("Pedidos, recepci\u00F3n f\u00EDsica y existencias reservadas por oficina.")}</p></div><button className="primary" onClick={() => setShowForm(!showForm)}>{showForm ? tr("Cerrar formulario") : tr("\uFF0B Registrar pedido / lote")}</button></div>{error && <p className="error banner" role="alert">{tr(error)}</p>}{showForm && <form className="workshop-stock-form" onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                    await api('/api/workshop/operations', { action: 'batch', request_id: crypto.randomUUID(), ...draft });
                    setShowForm(false);
                    await load();
                }
                catch (err) {
                    setError(String(err));
                }
                finally {
                    setBusy(false);
                }
            }}><div className="workshop-form-grid">{([['part', 'Pieza / parte'], ['brand', 'Marca compatible'], ['model', 'Modelo compatible'], ['office', 'Oficina del stock'], ['supplier', 'Proveedor'], ['invoice', 'Factura / referencia de compra']] as const).map(([key, label]) => <label key={key}>{tr(label)}<input required={['part', 'office', 'supplier'].includes(key)} maxLength={160} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))}/></label>)}<label>{tr("Costo original por unidad")}<input type="number" min={0} max={10000000} step="0.01" required value={draft.unit_cost} onChange={e => setDraft(old => ({ ...old, unit_cost: Number(e.target.value) }))}/></label><label>{tr("Moneda")}<input required maxLength={3} pattern="[A-Z]{3}" value={draft.currency} onChange={e => setDraft(old => ({ ...old, currency: e.target.value.toUpperCase() }))}/></label><label>{tr("Cantidad pedida")}<input type="number" required min={1} max={10000} step={1} value={draft.ordered_quantity} onChange={e => setDraft(old => ({ ...old, ordered_quantity: Number(e.target.value) }))}/></label></div><p>{tr("Este registro no env\u00EDa pedidos al proveedor. Guardar el pedido no confirma que la pieza haya llegado. Registra la recepci\u00F3n al verificar la factura y la pieza f\u00EDsica.")}</p><button className="primary" disabled={busy}>{tr("Guardar pedido")}</button></form>}
 <SupplierSettings /><Replenishment batches={batches} generation={generation}/><div className="workshop-filters"><label>{tr("Oficina de inventario")}<select value={office} onChange={e => setOffice(e.target.value)}><option value="">{tr("Todas")}</option>{[...new Set(batches.map(b => b.office))].sort().map(v => <option key={v}>{tr(v)}</option>)}</select></label><label className="workshop-search">{tr("Buscar pieza o proveedor")}<input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("Pieza, modelo, proveedor o factura")}/></label><label className="workshop-delivered"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)}/>{tr("Ver cancelados")}</label><button onClick={() => void load()}>{tr("Actualizar inventario")}</button></div>
 <div className="workshop-stock-grid">{filtered.map(b => <article key={b.id} className="workshop-stock-card"><span className="eyebrow">{b.office}</span><h3>{b.part}</h3>{b.cancelled && <b>{tr("Pedido cancelado")}</b>}<p>{b.brand} {b.model}</p><strong>{money(b.unit_cost, b.currency)} <small>{tr("costo unitario")}</small></strong><div className="workshop-stock-counts"><span><b>{verifiedStock(b)?stockAvailable(b):0}</b>{tr("Disponibles")}</span><span><b>{b.reserved}</b>{tr("Reservadas")}</span><span><b>{b.cancelled ? 0 : b.ordered_quantity - b.received_quantity}</b>{tr("Por llegar")}</span></div><p>{tr("Físicas sin reservar")}: {stockAvailable(b)} · {tr(conditionLabels[b.condition??'unknown'])} · {b.inspected ? tr("Verificada") : tr("Por verificar")}{tr(" \u00B7 SKU: ")}{b.sku || '—'}</p><button type="button" disabled={busy} onClick={() => setInspecting(b)}>{tr("Verificar condici\u00F3n y compatibilidad")}</button><small>{b.supplier} · {b.invoice || tr("Sin referencia")}</small>{!b.cancelled&&b.received_quantity<b.ordered_quantity&&<button disabled={busy} onClick={()=>setMovement({batch:b,action:'receive'})}>{tr('Confirmar recepción','Confirm receipt')}</button>}{manager&&stockAvailable(b)>0&&<div className="workshop-actions"><button disabled={busy} onClick={()=>setMovement({batch:b,action:'transfer'})}>{tr('Trasladar a otra oficina','Transfer to another office')}</button><button disabled={busy} onClick={()=>setMovement({batch:b,action:'supplier_return'})}>{tr('Devolver al proveedor','Return to supplier')}</button></div>}{!b.cancelled && b.received_quantity === 0 && <div className="workshop-actions"><button disabled={busy} onClick={() => setEditing(b)}>{tr("Corregir pedido")}</button><button disabled={busy} onClick={async () => {
                    if (!confirm('¿Cancelar este pedido sin recepción? Se conservará el historial y no se enviará ningún mensaje al proveedor.'))
                        return;
                    setBusy(true);
                    try {
                        await api('/api/workshop/inventory-controls', { action: 'cancel', id: b.id, version: b.version });
                        await load();
                    }
                    catch (e) {
                        setError(String(e));
                    }
                    finally {
                        setBusy(false);
                    }
                }}>{tr("Cancelar pedido")}</button></div>}</article>)}</div>{!filtered.length && <p className="workshop-empty">{tr("No hay repuestos en esta selecci\u00F3n. Registra tu primer pedido para comenzar.")}</p>}
 {movement&&<StockMovement batch={movement.batch} action={movement.action} offices={[...new Set(batches.map(b=>b.office))]} onClose={()=>setMovement(null)} onSaved={load}/>} {inspecting && <StockInspection batch={inspecting} onClose={() => setInspecting(null)} onSaved={load}/>} {editing && <EditStock batch={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }}/>}</section>;
}
