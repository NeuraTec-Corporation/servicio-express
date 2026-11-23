import {reportFailure} from './client-signals';
import type {Terms} from './domain';
export type Offer={id:string;variant_id:string;brand:string;model:string;variant:string;supplier:string;cost:string;currency:string;terms:Terms;published_at:string;source_id:string;filename:string;markup_type:string|null;markup_value:string|null;default_markup_type:string|null;default_markup_value:string|null;previous_cost:string|null;last_purchase:{cost:number;date:string}|null;last_sale:{price:number;date:string}|null};
export type OfferHistory={offers:Record<string,string>[];audit:Record<string,unknown>[]};
export const uiLocale=()=>typeof window==='undefined'?'es':document.documentElement.lang==='en'?'en-US':'es';
export const money=(value:number,currency:string)=>`${currency} ${value.toLocaleString(uiLocale(),{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const date=(value:string)=>new Date(value).toLocaleString(uiLocale(),{dateStyle:'short',timeStyle:'short',timeZone:'America/New_York'});
export async function api(url:string,body?:unknown){let response:Response;try{response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined)}catch(e){reportFailure(url,0);throw e}if(response.status>=500)reportFailure(url,response.status);if(response.status===401){location.reload();throw new Error('Sesión vencida')}const result=await response.json();if(!response.ok)throw new Error(result.error??'No se pudo completar la operación');return result}
