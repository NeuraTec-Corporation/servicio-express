'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/ui-data';
import type { StockBatch } from '@/lib/workshop-operations';
export function EditStock({ batch, onClose, onSaved }: {
    batch: StockBatch;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t: tr } = useLocale();
    const ref = useRef<HTMLDialogElement>(null);
    const [draft, setDraft] = useState(batch), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => previous?.focus(); }, []);
    return <dialog ref={ref} className="workshop-dialog" aria-label={tr("Corregir pedido")} onCancel={e => { if (busy)
        e.preventDefault();
    else
        onClose(); }}><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
        await api('/api/workshop/inventory-controls', { action: 'edit', ...draft });
        onSaved();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}><header><h2>{tr("Corregir pedido sin recibir")}</h2><button type="button" aria-label={tr("Cerrar correcci\u00F3n")} disabled={busy} onClick={onClose}>✕</button></header><div className="workshop-editor-body"><p>{tr("Corrige la referencia o el costo acordado antes de recibir la pieza. Los presupuestos anteriores conservan su versi\u00F3n.")}</p><div className="workshop-form-grid">{([['part', 'Pieza'], ['brand', 'Marca'], ['model', 'Modelo'], ['office', 'Oficina'], ['supplier', 'Proveedor'], ['invoice', 'Factura / referencia'], ['currency', 'Moneda']] as const).map(([key, label]) => <label key={key}>{tr(label)}<input required={['part', 'office', 'supplier', 'currency'].includes(key)} value={draft[key]} maxLength={key === 'currency' ? 3 : 160} onChange={e => setDraft(old => ({ ...old, [key]: key === 'currency' ? e.target.value.toUpperCase() : e.target.value }))}/></label>)}<label>{tr("Costo por unidad")}<input required type="number" min={0} step="0.01" value={draft.unit_cost} onChange={e => setDraft(old => ({ ...old, unit_cost: Number(e.target.value) }))}/></label><label>{tr("Cantidad pedida")}<input required type="number" min={1} max={10000} step={1} value={draft.ordered_quantity} onChange={e => setDraft(old => ({ ...old, ordered_quantity: Number(e.target.value) }))}/></label></div>{error && <p className="error" role="alert">{tr(error)}</p>}</div><footer><button type="button" disabled={busy} onClick={onClose}>{tr("Cancelar")}</button><button className="primary" disabled={busy}>{tr("Guardar correcci\u00F3n")}</button></footer></form></dialog>;
}
type Rule = {
    id: string;
    part: string;
    office: string;
    minimum: number;
    target: number;
    available: number;
    incoming: number;
};
export function Replenishment({ batches, generation }: {
    batches: StockBatch[];
    generation: number;
}) {
    const { t: tr } = useLocale();
    const settings = useRef<HTMLDetailsElement>(null);
    const [rules, setRules] = useState<Rule[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [draft, setDraft] = useState({ part: '', office: '', minimum: 1, target: 3 });
    const load = async () => { try {
        setRules((await api('/api/workshop/inventory-controls')).rules);
        setError('');
    }
    catch (e) {
        setError(String(e));
    } };
    useEffect(() => { if (generation === 0)
        return; let active = true; void api('/api/workshop/inventory-controls').then(j => { if (active)
        setRules(j.rules); }).catch(e => { if (active)
        setError(String(e)); }); return () => { active = false; }; }, [generation]);
    const shortages = rules.filter(r => r.available < r.minimum);
    return <section className="stock-replenishment"><h3>{tr("Alertas de reposici\u00F3n ")}<span>{shortages.length}</span></h3>{shortages.length ? <div className="stock-alerts">{shortages.map(r => <article key={r.id}><strong>{r.part} · {r.office}</strong><p>{r.available}{tr(" disponibles \u00B7 m\u00EDnimo ")}{r.minimum} · {r.incoming}{tr(" por llegar")}</p><b>{Math.max(0, r.target - r.available - r.incoming) > 0 ? tr("Preparar pedido de {0} unidades", undefined, [r.target - r.available - r.incoming]) : tr("Las piezas en camino cubren el objetivo")}</b><button type="button" onClick={() => { setDraft({ part: r.part, office: r.office, minimum: r.minimum, target: r.target }); if (settings.current)
        settings.current.open = true; }}>{tr("Ajustar m\u00EDnimo")}</button></article>)}</div> : <p>{tr("No hay alertas con los m\u00EDnimos configurados.")}</p>}<details ref={settings}><summary>{tr("Configurar m\u00EDnimo y objetivo por pieza / oficina")}</summary><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
        await api('/api/workshop/inventory-controls', { action: 'rule', ...draft });
        await load();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}><div className="workshop-form-grid"><label>{tr("Pieza / referencia exacta")}<input required list="reorder-parts" maxLength={160} value={draft.part} onChange={e => setDraft(old => ({ ...old, part: e.target.value }))}/><datalist id="reorder-parts">{[...new Set(batches.map(b => b.part))].map(p => <option key={p} value={p}/>)}</datalist></label><label>{tr("Oficina")}<input required list="reorder-offices" maxLength={160} value={draft.office} onChange={e => setDraft(old => ({ ...old, office: e.target.value }))}/><datalist id="reorder-offices">{[...new Set(batches.map(b => b.office))].map(p => <option key={p} value={p}/>)}</datalist></label><label>{tr("M\u00EDnimo")}<input type="number" min={0} max={10000} value={draft.minimum} onChange={e => setDraft(old => ({ ...old, minimum: Number(e.target.value) }))}/></label><label>{tr("Objetivo")}<input type="number" min={draft.minimum} max={10000} value={draft.target} onChange={e => setDraft(old => ({ ...old, target: Number(e.target.value) }))}/></label></div><p>{tr("El objetivo descuenta lo disponible y lo que ya viene en camino. Un m\u00EDnimo de cero desactiva la alerta. No se env\u00EDan pedidos al proveedor.")}</p><button disabled={busy}>{tr("Guardar m\u00EDnimo")}</button></form></details>{error && <p className="error" role="alert">{tr(error)}</p>}</section>;
}
