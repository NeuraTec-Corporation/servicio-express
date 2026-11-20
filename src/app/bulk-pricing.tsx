'use client';
import {useEffect,useState} from 'react';
import {api,money,type Offer} from '@/lib/ui-data';
import {assertBulkCurrencies,bulkPolicySchema,priceOf,applyPricingUpdates,type PolicyUpdate} from '@/lib/pricing';

export default function BulkPricing({selected,visible,checked,onToggleVisible,onClear,onSaved,busy,onBusyChange}:{selected:Offer[];visible:Offer[];checked:Set<string>;onToggleVisible:()=>void;onClear:()=>void;onSaved:(updates:PolicyUpdate[])=>void;busy:boolean;onBusyChange:(busy:boolean)=>void}){
 const [type,setType]=useState<'percent'|'fixed'>('percent'),[value,setValue]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const parsed=bulkPolicySchema.safeParse({ids:selected.map(o=>o.id),type,value:value.trim()?Number(value):NaN});
 let currencyError='';try{assertBulkCurrencies(selected.map(o=>o.currency),type);}catch(e){currencyError=(e as Error).message;}
 const allVisible=visible.length>0&&visible.every(o=>checked.has(o.id));
 const selectionKey=selected.map(o=>o.id).join('|');useEffect(()=>{setMessage('');setError('');},[selectionKey]);
 async function apply(){if(!parsed.success||currencyError||saving||busy)return;setSaving(true);onBusyChange(true);setError('');setMessage('');try{const result=await api('/api/policy/bulk',parsed.data);onSaved(result.updates);setMessage(`Recargo guardado en ${result.count} ofertas.`);}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar.');}finally{setSaving(false);onBusyChange(false);}}
 return <section className="bulk-pricing" aria-label="Recargo de ofertas seleccionadas">
  <div className="bulk-selection"><strong>{selected.length?`${new Set(selected.map(o=>o.variant_id)).size} modelos · ${selected.length} ofertas marcadas`:'Marca teléfonos para aplicar un recargo en grupo'}</strong><div><button type="button" disabled={!visible.length||saving||busy} onClick={onToggleVisible}>{allVisible?'Desmarcar visibles':'Seleccionar todos los visibles'}</button><button type="button" disabled={!selected.length||saving||busy} onClick={onClear}>Quitar selección</button></div></div>
  {selected.length>0&&<><div className="bulk-controls"><label>Recargo para la selección<input aria-label="Recargo masivo" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" placeholder="Ej. 20" value={value} disabled={saving} onChange={e=>{setValue(e.target.value);setMessage('');setError('');}}/></label><label>Modalidad<select aria-label="Modalidad de recargo masivo" value={type} disabled={saving} onChange={e=>{setType(e.target.value as typeof type);setMessage('');setError('');}}><option value="percent">Porcentaje (%)</option><option value="fixed">Importe fijo</option></select></label><button type="button" className="primary" disabled={!parsed.success||!!currencyError||saving||busy} onClick={()=>void apply()}>{saving?'Aplicando…':`Aplicar a seleccionados (${selected.length})`}</button></div>
  <p>Las casillas solo marcan ofertas; no abren la ficha. El recargo se aplica a cada oferta marcada y reemplaza su recargo anterior. Un importe fijo requiere la misma moneda.</p>
  {currencyError&&<p className="error" role="alert">{currencyError}</p>}
  {parsed.success&&!currencyError&&<details className="bulk-preview"><summary>Vista previa de {selected.length} ofertas · todavía sin guardar</summary><ul>{selected.map(offer=>{const next=applyPricingUpdates([offer],[{id:offer.id,scope:'offer',type,value:Number(value)}])[0];return <li key={offer.id}><span>{offer.brand} {offer.model}<small>{offer.variant} · {offer.supplier}</small></span><strong>{money(priceOf(next)!,offer.currency)}</strong></li>;})}</ul></details>}
  {message&&<p className="bulk-success" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}</>}
 </section>;
}
