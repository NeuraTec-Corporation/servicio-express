'use client';
import { useLocale } from "./locale";
import type { Offer } from '@/lib/ui-data';
import { initialDraft } from '@/lib/pricing';
import type { PricingController } from './use-pricing';
export default function PolicyEditor({ offer, pricing, location = 'tabla', disabled = false }: {
    offer: Offer;
    pricing: PricingController;
    location?: 'tabla' | 'ficha';
    disabled?: boolean;
}) {
    const { t: tr } = useLocale();
    const draft = pricing.get(offer), state = pricing.states[offer.id], busy = state?.status === 'saving' || disabled;
    const label = `${offer.supplier} ${offer.model} ${location}`;
    return <div className="policy policy-editor" onClick={e => e.stopPropagation()}>
  <div className="policy-input"><input aria-label={tr("Recargo {0}", undefined, [label])} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={draft.value} placeholder={tr("Definir")} disabled={disabled} readOnly={state?.status === 'saving'} onChange={e => pricing.change(offer, { value: e.target.value })} onBlur={() => { if (pricing.drafts[offer.id])
        void pricing.save(offer); }} onKeyDown={e => { if (e.key === 'Enter') {
        e.preventDefault();
        void pricing.save(offer);
    } }}/><select aria-label={tr("Modalidad de recargo {0}", undefined, [label])} value={draft.type} disabled={disabled} aria-disabled={busy} onChange={e => { if (busy)
        return; pricing.change(offer, { type: e.target.value as 'percent' | 'fixed' }); if (pricing.get(offer).value.trim())
        void pricing.save(offer); }}><option value="percent">%</option><option value="fixed">{offer.currency}</option></select></div>
  <button type="button" className="save-policy-button" aria-label={tr("Guardar recargo {0}", undefined, [label])} disabled={busy || !pricing.drafts[offer.id] || pricing.invalid(offer)} onClick={() => void pricing.save(offer)}>{busy ? tr("Guardando\u2026") : tr("Guardar")}</button>
  <span className={`policy-status ${state?.status ?? 'pending'}`} role={state?.status === 'error' ? 'alert' : 'status'}>{state?.message ?? (pricing.drafts[offer.id] ? 'Vista previa · sin guardar' : 'Enter o Tab para guardar')}</span>
  <select aria-label={tr("Aplicar recargo a {0}", undefined, [label])} className="policy-scope" value={draft.scope} disabled={disabled} aria-disabled={busy} onChange={e => { if (!busy)
        pricing.change(offer, initialDraft(offer, e.target.value as 'offer' | 'variant')); }}><option value="offer">{tr("Solo esta oferta")}</option><option value="variant">{tr("Predeterminado del modelo")}</option></select>
  {draft.scope === 'variant' && offer.markup_type !== null && <small>{tr("Esta oferta tiene recargo propio. \u00ABHeredar modelo\u00BB activa el predeterminado.")}</small>}
  {offer.markup_type !== null && <button className="text-button" disabled={busy} onClick={() => void pricing.save(offer, true)}>{tr("Heredar modelo")}</button>}
 </div>;
}
