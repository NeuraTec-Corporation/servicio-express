'use client';
import {useRef,useState} from 'react';
import {api,type Offer} from '@/lib/ui-data';
import {draftUpdate,initialDraft,previewOffer,type PolicyDraft,type PolicyUpdate} from '@/lib/pricing';

export function usePricing(onSaved:(updates:PolicyUpdate[])=>void){
 const [drafts,setDrafts]=useState<Record<string,PolicyDraft>>({});const draftRef=useRef(drafts);
 const [states,setStates]=useState<Record<string,{status:'saving'|'saved'|'error';message:string}>>({});const locks=useRef(new Set<string>());
 const write=(next:Record<string,PolicyDraft>)=>{draftRef.current=next;setDrafts(next);};
 function change(offer:Offer,patch:Partial<PolicyDraft>){write({...draftRef.current,[offer.id]:{...(draftRef.current[offer.id]??initialDraft(offer)),...patch}});setStates(s=>{const next={...s};delete next[offer.id];return next;});}
 function clear(ids:string[]){const next={...draftRef.current};for(const id of ids)delete next[id];write(next);setStates(s=>{const next={...s};for(const id of ids)next[id]={status:'saved',message:'Guardado'};return next;});}
 async function save(offer:Offer,reset=false){
  if(locks.current.has(offer.id))return false;
  const draft=draftRef.current[offer.id];if(!reset&&!draft)return true;
  const update=reset?{scope:'offer' as const,id:offer.id,type:null,value:null}:draftUpdate(offer,draft);
  if(!update){setStates(s=>({...s,[offer.id]:{status:'error',message:'Indica un recargo entre 0 y 1.000.000, con hasta dos decimales.'}}));return false;}
  locks.current.add(offer.id);setStates(s=>({...s,[offer.id]:{status:'saving',message:'Guardando…'}}));
  try{await api('/api/policy',update);onSaved([update]);clear([offer.id]);setStates(s=>({...s,[offer.id]:{status:'saved',message:'Guardado'}}));return true;}
  catch(e){setStates(s=>({...s,[offer.id]:{status:'error',message:e instanceof Error?e.message:'No se pudo guardar. Reintenta.'}}));return false;}
  finally{locks.current.delete(offer.id);}
 }
 return {drafts,states,change,save,clear,get:(offer:Offer)=>drafts[offer.id]??initialDraft(offer),preview:(offer:Offer)=>previewOffer(offer,drafts[offer.id]),invalid:(offer:Offer)=>!!drafts[offer.id]&&!draftUpdate(offer,drafts[offer.id]),busy:Object.values(states).some(s=>s.status==='saving')};
}
export type PricingController=ReturnType<typeof usePricing>;
