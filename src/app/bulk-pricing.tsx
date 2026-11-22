'use client';
import { useLocale } from "./locale";
import { useEffect, useState } from 'react';
import { api, money, type Offer } from '@/lib/ui-data';
import { assertBulkCurrencies, bulkPolicySchema, priceOf, applyPricingUpdates, type PolicyUpdate } from '@/lib/pricing';
export default function BulkPricing({ selected, visible, checked, onToggleVisible, onClear, onSaved, busy, onBusyChange }: {
    selected: Offer[];
    visible: Offer[];
    checked: Set<string>;
    onToggleVisible: () => void;
    onClear: () => void;
    onSaved: (updates: PolicyUpdate[]) => void;
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const { t: tr } = useLocale();
    const [type, setType] = useState<'percent' | 'fixed'>('percent'), [value, setValue] = useState(''), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
    const parsed = bulkPolicySchema.safeParse({ ids: selected.map(o => o.id), type, value: value.trim() ? Number(value) : NaN });
    let currencyError = '';
    try {
        assertBulkCurrencies(selected.map(o => o.currency), type);
    }
    catch (e) {
        currencyError = (e as Error).message;
    }
    const allVisible = visible.length > 0 && visible.every(o => checked.has(o.id));
    const selectionKey = selected.map(o => o.id).join('|');
    useEffect(() => { setMessage(''); setError(''); }, [selectionKey]);
    async function apply() { if (!parsed.success || currencyError || saving || busy)
        return; setSaving(true); onBusyChange(true); setError(''); setMessage(''); try {
        const result = await api('/api/policy/bulk', parsed.data);
        onSaved(result.updates);
        setMessage(`Recargo guardado en ${result.count} ofertas.`);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo aplicar.');
    }
    finally {
        setSaving(false);
        onBusyChange(false);
    } }
    return <section className="bulk-pricing" aria-label={tr("Recargo de ofertas seleccionadas")}>
  <div className="bulk-selection"><strong>{selected.length ? tr("{0} modelos \u00B7 {1} ofertas marcadas", undefined, [new Set(selected.map(o => o.variant_id)).size, selected.length]) : tr("Marca tel\u00E9fonos para aplicar un recargo en grupo")}</strong><div><button type="button" disabled={!visible.length || saving || busy} onClick={onToggleVisible}>{allVisible ? tr("Desmarcar visibles") : tr("Seleccionar todos los visibles")}</button><button type="button" disabled={!selected.length || saving || busy} onClick={onClear}>{tr("Quitar selecci\u00F3n")}</button></div></div>
  {selected.length > 0 && <><div className="bulk-controls"><label>{tr("Recargo para la selecci\u00F3n")}<input aria-label={tr("Recargo masivo")} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" placeholder={tr("Ej. 20")} value={value} disabled={saving} onChange={e => { setValue(e.target.value); setMessage(''); setError(''); }}/></label><label>{tr("Modalidad")}<select aria-label={tr("Modalidad de recargo masivo")} value={type} disabled={saving} onChange={e => { setType(e.target.value as typeof type); setMessage(''); setError(''); }}><option value="percent">{tr("Porcentaje (%)")}</option><option value="fixed">{tr("Importe fijo")}</option></select></label><button type="button" className="primary" disabled={!parsed.success || !!currencyError || saving || busy} onClick={() => void apply()}>{saving ? tr("Aplicando\u2026") : tr("Aplicar a seleccionados ({0})", undefined, [selected.length])}</button></div>
  <p>{tr("Las casillas solo marcan ofertas; no abren la ficha. El recargo se aplica a cada oferta marcada y reemplaza su recargo anterior. Un importe fijo requiere la misma moneda.")}</p>
  {currencyError && <p className="error" role="alert">{currencyError}</p>}
  {parsed.success && !currencyError && <details className="bulk-preview"><summary>{tr("Vista previa de ")}{selected.length}{tr(" ofertas \u00B7 todav\u00EDa sin guardar")}</summary><ul>{selected.map(offer => { const next = applyPricingUpdates([offer], [{ id: offer.id, scope: 'offer', type, value: Number(value) }])[0]; return <li key={offer.id}><span>{offer.brand} {offer.model}<small>{offer.variant} · {offer.supplier}</small></span><strong>{money(priceOf(next)!, offer.currency)}</strong></li>; })}</ul></details>}
  {message && <p className="bulk-success" role="status">{tr(message)}</p>}{error && <p className="error" role="alert">{tr(error)}</p>}</>}
 </section>;
}
