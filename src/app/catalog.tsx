'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
import { variation } from '@/lib/domain';
import { api, date, money, Offer, OfferHistory } from '@/lib/ui-data';
import Icon from './ui-icon';
import PolicyEditor from './policy-editor';
import BulkPricing from './bulk-pricing';
import { usePricing } from './use-pricing';
import { priceOf, type PolicyUpdate } from '@/lib/pricing';
export const offerPrice = priceOf;
const availability = { unknown: 'Por confirmar', reported: 'Reportada', confirmed: 'Confirmada', unavailable: 'No disponible' };
type Props = {
    offers: Offer[];
    loading: boolean;
    onReload: () => void;
    onImport: () => void;
    onError: (s: string) => void;
    onNotice: (s: string) => void;
    onPoliciesSaved: (updates: PolicyUpdate[]) => void;
};
export default function Catalog({ offers, loading, onReload, onImport, onError, onNotice, onPoliciesSaved }: Props) {
    const { t: tr } = useLocale();
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [history, setHistory] = useState<OfferHistory | null>(null);
    const [historyError, setHistoryError] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState('');
    const detailDialog = useRef<HTMLDialogElement>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const pricing = usePricing(onPoliciesSaved);
    const selectedOffers = offers.filter(o => checked.has(o.id));
    function toggleIds(ids: string[], check: boolean) {
        setChecked(old => {
            const next = new Set(old);
            for (const id of ids) {
                if (check)
                    next.add(id);
                else
                    next.delete(id);
            }
            return next;
        });
    }
    useEffect(() => { setChecked(old => new Set([...old].filter(id => offers.some(o => o.id === id)))); }, [offers]);
    function selectOffer(id: string) { setSelectedId(id); setCopyFeedback(''); setDetailOpen(true); }
    useEffect(() => {
        const dialog = detailDialog.current;
        if (!dialog)
            return;
        if (detailOpen) {
            if (!dialog.open)
                dialog.showModal();
            const overflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = overflow;
                if (dialog.open)
                    dialog.close();
            };
        }
        if (dialog.open)
            dialog.close();
    }, [detailOpen]);
    const normalized = search.trim().toLocaleLowerCase('es');
    const filtered = offers.filter(o => `${o.brand} ${o.model} ${o.variant} ${o.supplier}`.toLocaleLowerCase('es').includes(normalized) && filters.every(f => f === 'confirmed' ? o.terms.availability === 'confirmed' : f === 'warranty' ? !!o.terms.warranty : f === 'returns' ? !!o.terms.returns : f === 'current' ? !o.terms.validUntil || Date.parse(o.terms.validUntil) >= Date.now() : o.terms.method === f));
    const selectedOriginal = filtered.find(o => o.id === selectedId) ?? null;
    const selected = selectedOriginal ? pricing.preview(selectedOriginal) : null;
    const selectedVariant = selected?.variant_id;
    const selectedDirty = !!(selectedOriginal && pricing.drafts[selectedOriginal.id]);
    const selectedInvalid = !!(selectedOriginal && pricing.invalid(selectedOriginal));
    useEffect(() => {
        if (!selectedOriginal)
            setDetailOpen(false);
    }, [selectedOriginal]);
    useEffect(() => {
        let active = true;
        setHistory(null);
        setHistoryError('');
        if (selectedVariant)
            void api('/api/history?variant=' + selectedVariant).then(result => {
                if (active)
                    setHistory(result);
            }).catch(e => {
                if (active)
                    setHistoryError(e instanceof Error ? e.message : String(e));
            });
        return () => { active = false; };
    }, [selectedVariant, offers]);
    const groups = new Map<string, Offer[]>();
    for (const offer of filtered) {
        const group = groups.get(offer.variant_id) ?? [];
        group.push(offer);
        groups.set(offer.variant_id, group);
    }
    async function copy() {
        if (!selected || selectedDirty)
            return;
        const price = offerPrice(selected);
        if (price === null)
            return;
        try {
            await navigator.clipboard.writeText(`${selected.brand} ${selected.model} ${selected.variant}: ${money(price, selected.currency)}. Precio sugerido sin impuestos${selected.terms.logistics === null ? ', logística por confirmar' : ''}. Disponibilidad y entrega sujetas a confirmación.`);
            setCopyFeedback('Cotización copiada.');
            onNotice('Cotización copiada.');
        }
        catch {
            setCopyFeedback('El navegador no permitió copiar. Selecciona el precio para copiarlo manualmente.');
            onError('El navegador no permitió copiar. Selecciona el precio para copiarlo manualmente.');
        }
    }
    return <div className="meridian-body catalog-popup-layout"><main className="catalog-main"><div className="page-heading"><div><span className="eyebrow">{tr("CAT\u00C1LOGO / OFERTAS")}</span><h1>{tr("Comparar ofertas")}</h1><p>{tr("Marca casillas para cambiar recargos en grupo. Pulsa el nombre para abrir la ficha.")}</p></div><button className="quiet-button" onClick={onReload} disabled={loading}><Icon name="refresh"/><span>{tr("Actualizar")}</span></button></div><section className="toolbar"><label className="search"><Icon name="search"/><input aria-label={tr("Buscar marca, modelo, variante o proveedor")} value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("Buscar marca, modelo o variante\u2026")}/>{search && <button aria-label={tr("Limpiar b\u00FAsqueda")} className="icon-button" onClick={() => setSearch('')}><Icon name="close"/></button>}</label></section><div className="filterbar">{[['confirmed', 'Confirmado'], ['delivery', 'Delivery'], ['pickup', 'Retiro'], ['warranty', 'Garantía'], ['returns', 'Devolución'], ['current', 'Sin vencer']].map(([key, label]) => <label key={key}><input type="checkbox" checked={filters.includes(key)} onChange={e => setFilters(e.target.checked ? [...filters, key] : filters.filter(f => f !== key))}/>{tr(label)}</label>)}<span className="count" role="status">{filtered.length}{tr(" ofertas \u00B7 ")}{groups.size}{tr(" variantes")}</span></div>
    <BulkPricing selected={selectedOffers} visible={filtered} checked={checked} onToggleVisible={() => toggleIds(filtered.map(o => o.id), !filtered.every(o => checked.has(o.id)))} onClear={() => setChecked(new Set())} onSaved={updates => { onPoliciesSaved(updates); pricing.clear(updates.map(u => u.id)); }} busy={pricing.busy} onBusyChange={setBulkBusy}/>
    {[...groups.values()].map(group => {
            const model = group[0];
            return <section className={'model-group' + (group.some(o => checked.has(o.id)) ? ' selected-model' : '')} key={model.variant_id} aria-label={`${model.brand} ${model.model} ${model.variant}`}><div className="model-strip"><label className="model-checkbox"><input type="checkbox" aria-label={tr("Marcar modelo {0} {1} {2}", undefined, [model.brand, model.model, model.variant])} checked={group.every(o => checked.has(o.id))} disabled={bulkBusy} ref={input => {
                    if (input)
                        input.indeterminate = group.some(o => checked.has(o.id)) && !group.every(o => checked.has(o.id));
                }} onChange={e => toggleIds(group.map(o => o.id), e.target.checked)}/><span className="sr-only">{tr("Marcar para recargo masivo")}</span></label><button className="model-selector" aria-label={tr("Ver detalle de {0} {1} {2}", undefined, [model.brand, model.model, model.variant])} aria-haspopup="dialog" aria-pressed={selected?.variant_id === model.variant_id} onClick={() => selectOffer(selected?.variant_id === model.variant_id ? selected.id : model.id)}><span className="phone-tile"><Icon name="phone"/></span><span className="model-label"><strong>{model.brand} {model.model}</strong><small>{model.variant || tr("Variante sin informar")}</small></span></button><small className="group-count">{new Set(group.map(o => o.supplier)).size}{tr(" proveedores")}{group.some(o => checked.has(o.id)) && <span className="selection-caption">{tr("Marcado para recargo")}</span>}</small></div><div className="catalog-table"><table><thead><tr><th>{tr("Proveedor")}</th><th>{tr("Costo / cambio")}</th><th>{tr("Disp. / entrega")}</th><th>{tr("Recargo")}</th><th>{tr("Sugerido")}</th></tr></thead><tbody>{group.map(o => {
                    const preview = pricing.preview(o);
                    const dirty = !!pricing.drafts[o.id];
                    const invalid = pricing.invalid(o);
                    const price = invalid ? null : offerPrice(preview);
                    const delta = variation(Number(o.cost), o.previous_cost === null ? null : Number(o.previous_cost));
                    const expired = !!o.terms.validUntil && Date.parse(o.terms.validUntil) < Date.now();
                    return <tr key={o.id} className={checked.has(o.id) ? 'selected-offer' : selected?.id === o.id ? 'viewed-offer' : ''} onClick={e => {
                            if (!(e.target as HTMLElement).closest('button,input,select,a'))
                                selectOffer(o.id);
                        }}><td data-label={tr("Proveedor")}><div className="supplier-selection"><input type="checkbox" aria-label={tr("Marcar oferta {0} {1} {2}", undefined, [o.supplier, o.model, o.variant])} checked={checked.has(o.id)} disabled={bulkBusy} onChange={e => toggleIds([o.id], e.target.checked)}/><button className="supplier" aria-pressed={selected?.id === o.id} aria-haspopup="dialog" onClick={() => selectOffer(o.id)}>{o.supplier}<Icon name="arrow"/></button></div><small>{date(o.published_at)}{expired && <span className="error">{tr(" \u00B7 Vencida")}</span>}</small></td><td data-label={tr("Costo / cambio")}><strong className="numeric">{money(Number(o.cost), o.currency)}</strong>{delta ? <small className={delta.amount > 0 ? 'up' : 'down'}>{delta.amount > 0 ? '+' : ''}{money(delta.amount, o.currency)} · {delta.percent > 0 ? '+' : ''}{delta.percent.toFixed(1)}%</small> : <small>{tr("Sin historial")}</small>}<small>{tr("Anterior: ")}{o.previous_cost === null ? tr("sin dato") : money(Number(o.previous_cost), o.currency)}</small></td><td data-label={tr("Disp. / entrega")}><span className={'badge ' + o.terms.availability}>{availability[o.terms.availability]}</span><small>{o.terms.delivery || tr("Entrega sin dato")}</small><small>{o.terms.method === 'unknown' ? tr("Modalidad sin dato") : o.terms.method === 'pickup' ? tr("Retiro propio") : tr("Delivery")}</small></td><td data-label={tr("Recargo")}><PolicyEditor offer={o} pricing={pricing} disabled={bulkBusy}/></td><td data-label={tr("Sugerido")} className="quote"><strong>{invalid ? tr("Recargo inv\u00E1lido") : price === null ? tr("Definir recargo") : money(price, o.currency)}</strong>{dirty && <span className="quote-preview">{tr("Vista previa \u00B7 sin guardar")}</span>}<small>{o.terms.logistics === null ? tr("Log\u00EDstica pendiente") : tr("Incluye log\u00EDstica informada")}{tr(" \u00B7 sin impuestos")}</small></td></tr>;
                })}</tbody></table></div></section>;
        })}
    {loading && !offers.length ? <div className="empty" role="status">{tr("Cargando ofertas\u2026")}</div> : !filtered.length ? <div className="empty"><span className="empty-icon"><Icon name="search"/></span><h2>{offers.length ? tr("No hay coincidencias") : tr("Tu cat\u00E1logo comienza aqu\u00ED")}</h2><p>{offers.length ? tr("Prueba otro modelo o cambia los filtros.") : tr("Carga una lista y revisa los precios antes de publicarlos.")}</p><button className="primary" onClick={() => offers.length ? (setSearch(''), setFilters([])) : onImport()}>{offers.length ? tr("Limpiar filtros") : tr("Cargar primera lista")}<Icon name={offers.length ? 'refresh' : 'upload'}/></button></div> : null}
    <footer className="table-footer"><span>{tr("Ofertas mayoristas \u2260 stock propio")}</span><span>{tr("Monedas conservadas \u00B7 sin conversi\u00F3n autom\u00E1tica")}</span></footer><p className="hint">{tr("Recargo sobre costo + log\u00EDstica conocida. Impuestos y cargos no informados quedan pendientes. Confirma disponibilidad antes de vender.")}</p></main>
    <dialog ref={detailDialog} className="offer-dialog" aria-labelledby="offer-dialog-title" onCancel={() => setDetailOpen(false)} onClick={e => {
            if (e.target === e.currentTarget)
                setDetailOpen(false);
        }}><header className="offer-dialog-header"><div><span className="eyebrow">{tr("FICHA DEL MODELO SELECCIONADO")}</span><h2 id="offer-dialog-title">{selected ? `${selected.brand} ${selected.model}` : tr("Detalle de oferta")}</h2><p>{selected?.variant || tr("Variante sin informar")}</p></div><button type="button" className="icon-button" aria-label={tr("Cerrar detalle de oferta")} onClick={() => setDetailOpen(false)} autoFocus><Icon name="close"/></button></header><div className="offer-panel"><div className="offer-panel-content" key={selected?.id}>{selected ? <><span className="eyebrow">{tr("PROVEEDOR SELECCIONADO")}</span><h3 className="selected-supplier-name">{selected.supplier}</h3><div className="dialog-pricing"><h3>{tr("Editar recargo de esta oferta")}</h3>{selectedOriginal && <PolicyEditor offer={selectedOriginal} pricing={pricing} location="ficha" disabled={bulkBusy}/>}</div><h3>{tr("Precio sugerido")}</h3><div className="detail-price">{selectedInvalid ? tr("Recargo inv\u00E1lido") : offerPrice(selected) === null ? tr("Definir recargo") : money(offerPrice(selected)!, selected.currency)}</div>{selectedDirty && <span className="quote-preview">{tr("Vista previa \u00B7 sin guardar")}</span>}<small>{selected.markup_type || selected.default_markup_type ? tr("Recargo {0}{1}", undefined, [(selected.markup_value ?? selected.default_markup_value), (selected.markup_type ?? selected.default_markup_type) === 'percent' ? '%' : ' ' + selected.currency]) : tr("Configura el recargo en la tabla")}{tr(" \u00B7 sin impuestos")}</small><dl className="summary-terms"><div><dt>{tr("Disponibilidad / entrega")}</dt><dd><span className={'badge ' + selected.terms.availability}>{availability[selected.terms.availability]}</span><small>{selected.terms.delivery || tr("Sin dato \u00B7 por confirmar")}</small></dd></div><div><dt>{tr("Garant\u00EDa del proveedor")}</dt><dd>{selected.terms.warranty || tr("Sin dato")}</dd></div><div><dt>{tr("Log\u00EDstica / devoluci\u00F3n")}</dt><dd>{selected.terms.logistics === null ? tr("Log\u00EDstica sin dato") : money(selected.terms.logistics, selected.currency)}<small>{selected.terms.returns || tr("Devoluci\u00F3n sin dato")}</small></dd></div><div><dt>{tr("\u00DAltima compra / venta real")}</dt><dd>{selected.last_purchase ? money(Number(selected.last_purchase.cost), selected.currency) : tr("Sin compra registrada")}<small>{selected.last_sale ? 'Última venta: ' + money(Number(selected.last_sale.price), selected.currency) : tr("Sin venta registrada")}</small></dd></div></dl><button className="primary copy-quote" disabled={offerPrice(selected) === null || selectedDirty || selectedInvalid} onClick={() => void copy()}><Icon name="copy"/>{tr("Copiar cotizaci\u00F3n")}</button>{copyFeedback && <p className="copy-feedback" role="status">{copyFeedback}</p>}<a className="source-button" href={'/api/source/' + selected.source_id}><Icon name="file"/>{tr("Ver fuente original")}</a><small className="source-caption">{selected.filename}</small><details className="commercial-details"><summary>{tr("M\u00E1s condiciones ")}<Icon name="chevron"/></summary><dl>{[['Confirmación', selected.terms.confirmedAt ? date(selected.terms.confirmedAt) : 'Sin dato'], ['Vigencia', selected.terms.validUntil ? date(selected.terms.validUntil) : 'Sin dato'], ['Horario / días', selected.terms.schedule], ['Hora límite', selected.terms.cutoff], ['Observaciones', selected.terms.notes], ['Fecha de última compra', selected.last_purchase ? date(selected.last_purchase.date) : 'Sin historial'], ['Fecha de última venta', selected.last_sale ? date(selected.last_sale.date) : 'Sin historial']].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || tr("Sin dato")}</dd></div>)}</dl></details><details className="commercial-details"><summary>{tr("Historial de esta variante ")}<Icon name="history"/></summary>{history ? <><ul className="history">{history.offers.map(h => <li key={h.id}><span>{h.supplier}<small>{date(h.published_at)}</small></span><b>{money(Number(h.cost), h.currency)}</b><a href={'/api/source/' + h.source_id}>{tr("Fuente")}</a></li>)}</ul><small>{history.audit.length}{tr(" cambios de pol\u00EDtica registrados.")}</small></> : <p role={historyError ? 'alert' : undefined}>{historyError || tr("Cargando historial\u2026")}</p>}</details></> : <div className="panel-placeholder"><span className="empty-icon"><Icon name="phone"/></span><h2>{tr("Tu cotizaci\u00F3n, aqu\u00ED")}</h2><p>{tr("Elige un proveedor para consultar precio, entrega y condiciones.")}</p><small>{tr("La fuente y el historial permanecen vinculados a cada oferta.")}</small></div>}</div></div></dialog></div>;
}
