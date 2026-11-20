import {z} from 'zod';
import {suggested} from './domain';
import type {Offer} from './ui-data';

export const markupValue=z.number().min(0).max(1e6).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6,'Usa hasta dos decimales');
export const policySchema=z.object({id:z.uuid(),scope:z.enum(['variant','offer']),type:z.enum(['percent','fixed']).nullable(),value:markupValue.nullable()}).refine(p=>(p.type===null)===(p.value===null),'Política incompleta');
export const bulkPolicySchema=z.object({ids:z.array(z.uuid()).min(1).max(500).transform(ids=>[...new Set(ids)].sort()),type:z.enum(['percent','fixed']),value:markupValue});
export type PolicyUpdate=z.infer<typeof policySchema>;
export type PolicyDraft={scope:'offer'|'variant';type:'percent'|'fixed';value:string};
export function applyPricingUpdates(offers:Offer[],updates:PolicyUpdate[]):Offer[]{return offers.map(offer=>updates.reduce((o,p)=>{
 if(p.scope==='offer'&&p.id===o.id)return {...o,markup_type:p.type,markup_value:p.value===null?null:String(p.value)};
 if(p.scope==='variant'&&p.id===o.variant_id)return {...o,default_markup_type:p.type,default_markup_value:p.value===null?null:String(p.value)};
 return o;
},offer));}
export function initialDraft(offer:Offer,scope:'offer'|'variant'='offer'):PolicyDraft{
 return {scope,type:((scope==='offer'?offer.markup_type:null)??offer.default_markup_type??'percent') as 'percent'|'fixed',value:String((scope==='offer'?offer.markup_value:null)??offer.default_markup_value??'')};
}
export function draftUpdate(offer:Offer,draft:PolicyDraft):PolicyUpdate|null{
 if(!draft.value.trim())return null;
 const result=policySchema.safeParse({scope:draft.scope,id:draft.scope==='offer'?offer.id:offer.variant_id,type:draft.type,value:Number(draft.value)});
 return result.success?result.data:null;
}
export function previewOffer(offer:Offer,draft?:PolicyDraft):Offer{
 if(!draft)return offer;const update=draftUpdate(offer,draft);return update?applyPricingUpdates([offer],[update])[0]:offer;
}
export function priceOf(offer:Offer){return suggested(Number(offer.cost),offer.terms.logistics,offer.markup_type??offer.default_markup_type,offer.markup_value!==null?Number(offer.markup_value):offer.default_markup_value!==null?Number(offer.default_markup_value):null);}
export function assertBulkCurrencies(currencies:string[],type:'fixed'|'percent'){
 if(type==='fixed'&&new Set(currencies).size>1)throw new Error('El importe fijo requiere una sola moneda. Selecciona ofertas de la misma moneda o usa porcentaje.');
}
