'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
import { categories, categoryLabels, Entry, entrySchema, entryTypes, typeLabels } from '@/lib/analytics';
import { api } from '@/lib/ui-data';
import Icon from './ui-icon';
export default function ManagementEntry({ initial, onClose, onSaved }: {
    initial: Entry | null;
    onClose: () => void;
    onSaved: (message?: string) => void;
}) { const { t: tr } = useLocale(); const ref = useRef<HTMLDialogElement>(null); const [type, setType] = useState(initial?.entry_type ?? 'sale'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [removing, setRemoving] = useState(false); const [removePhrase, setRemovePhrase] = useState(''); const [removePassword, setRemovePassword] = useState(''); useEffect(() => { ref.current?.showModal(); }, []); const date = new Date(); const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; return <dialog ref={ref} className="manager-dialog" onCancel={e => { if (busy)
    e.preventDefault();
else
    onClose(); }}><div className="dialog-header"><div><span className="eyebrow">{tr("REGISTRO MANUAL \u00B7 SIN POS")}</span><h2>{initial ? tr("Editar registro") : tr("Registrar operaci\u00F3n real")}</h2></div><button className="icon-button" aria-label={tr("Cerrar registro")} disabled={busy} onClick={onClose}><Icon name="close"/></button></div><p>{tr("Registra operaciones efectivamente realizadas. Las listas de proveedores no se convierten en compras ni ventas.")}</p><form onSubmit={async (e) => { e.preventDefault(); if (removing && initial) {
    setBusy(true);
    setError('');
    try {
        const response = await fetch('/api/management', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: initial.id, confirmation: removePhrase, password: removePassword }) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error);
        onSaved('Registro eliminado; auditoría conservada.');
    }
    catch (err) {
        setError(err instanceof Error ? err.message : String(err));
    }
    finally {
        setBusy(false);
    }
    return;
} const f = new FormData(e.currentTarget); const value = (key: string) => String(f.get(key) ?? '').trim(); const payload = { ...Object.fromEntries(['brand', 'model', 'variant', 'part', 'piece', 'technician', 'office', 'supplier', 'notes'].map(k => [k, value(k)])), id: initial?.id, entry_type: type, category: value('category'), occurred_on: value('occurred_on'), quantity: Number(value('quantity')), unit_cost: value('unit_cost') === '' ? null : Number(value('unit_cost')), unit_price: value('unit_price') === '' ? null : Number(value('unit_price')), currency: value('currency').toUpperCase() }; const parsed = entrySchema.safeParse(payload); if (!parsed.success) {
    setError(parsed.error.issues.map(i => i.message).join('. '));
    return;
} setBusy(true); setError(''); try {
    await api('/api/management', parsed.data);
    onSaved();
}
catch (err) {
    setError(err instanceof Error ? err.message : String(err));
}
finally {
    setBusy(false);
} }}><div className="entry-grid"><label>{tr("Operaci\u00F3n")}<select name="entry_type" value={type} onChange={e => setType(e.target.value as Entry['entry_type'])}>{entryTypes.map(k => <option key={k} value={k}>{tr(typeLabels[k])}</option>)}</select></label><label>{tr("Fecha")}<input name="occurred_on" type="date" defaultValue={initial?.occurred_on ?? today} required/></label><label>{tr("Tipo de producto / servicio")}<select name="category" defaultValue={initial?.category ?? 'phone'}>{categories.map(k => <option key={k} value={k}>{tr(categoryLabels[k])}</option>)}</select></label><label>{tr("Moneda")}<input name="currency" placeholder={tr("USD, DOP, EUR\u2026")} maxLength={3} defaultValue={initial?.currency ?? ''} pattern="[a-zA-Z]{3}" required/></label><label>{tr("Cantidad")}<input name="quantity" type="number" min="0.001" max="1000000" step="0.001" defaultValue={initial?.quantity ?? 1} required/></label><label>{tr("Costo unitario real ")}{(type === 'purchase' || type === 'expense') ? '*' : tr("(opcional)")}<input name="unit_cost" type="number" min="0" step="0.01" max="100000000" defaultValue={initial?.unit_cost ?? ''} required={type === 'purchase' || type === 'expense'}/></label>{(type === 'sale' || type === 'repair') && <label>{tr("Precio unitario cobrado *")}<input name="unit_price" type="number" min="0" step="0.01" max="100000000" defaultValue={initial?.unit_price ?? ''} required/></label>}<label>{tr("Modelo")}<input name="model" maxLength={200} defaultValue={initial?.model ?? ''} placeholder={tr("Ej. iPhone 14")}/></label><label>{tr("Oficina / sucursal")}<input name="office" maxLength={200} defaultValue={initial?.office ?? ''}/></label><label>{tr("T\u00E9cnico")}<input name="technician" maxLength={200} defaultValue={initial?.technician ?? ''}/></label></div><details className="entry-details" open={!!initial}><summary>{tr("Parte, pieza, proveedor y m\u00E1s contexto")}</summary><div className="entry-grid">{([['brand', 'Marca'], ['variant', 'Variante'], ['part', 'Parte / conjunto'], ['piece', 'Pieza específica'], ['supplier', 'Proveedor']] as const).map(([key, label]) => <label key={key}>{tr(label)}<input name={key} maxLength={200} defaultValue={initial?.[key] ?? ''}/></label>)}</div><label>{tr("Observaciones")}<textarea name="notes" rows={2} maxLength={2000} defaultValue={initial?.notes ?? ''}/></label></details><small>{tr("Costo vac\u00EDo significa \u00ABdesconocido\u00BB. El dashboard no calcula utilidad de ventas o servicios sin costo registrado. Los importes usan la moneda indicada, sin conversi\u00F3n.")}</small>{removing && <section className="reset-warning"><p>{tr("Esta eliminaci\u00F3n no se puede deshacer desde la aplicaci\u00F3n. La auditor\u00EDa se conserva.")}</p><label>{tr("Escribe BORRAR")}<input value={removePhrase} onChange={e => setRemovePhrase(e.target.value)} required autoComplete="off"/></label><label>{tr("Confirma tu clave")}<input type="password" value={removePassword} onChange={e => setRemovePassword(e.target.value)} required autoComplete="current-password"/></label></section>}{error && <p className="error" role="alert">{tr(error)}</p>}<div className="dialog-actions">{initial && <button type="button" className="clear-data-button" disabled={busy} onClick={() => setRemoving(!removing)}>{removing ? tr("Volver a editar") : tr("Eliminar registro")}</button>}<button type="button" disabled={busy} onClick={onClose}>{tr("Cancelar")}</button><button className={removing ? 'danger-button' : 'primary'} disabled={busy || (removing && (removePhrase !== 'BORRAR' || !removePassword))}>{busy ? tr("Procesando\u2026") : removing ? tr("Eliminar definitivamente") : tr("Guardar operaci\u00F3n")}</button></div></form></dialog>; }
