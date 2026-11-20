import type {AnalyticsOffer} from './analytics';
import {suggested} from './domain';

export function initialDashboardMode(offers:AnalyticsOffer[]):'offers'|'real'{return offers.length?'offers':'real';}
export function catalogBreakdown(offers:AnalyticsOffer[],field:'model'|'brand',measure:'cost'|'suggested'|'markup'|'count'){
 if(measure!=='count'&&new Set(offers.map(o=>o.currency)).size>1)throw new Error('Selecciona una moneda');
 const groups=new Map<string,{sum:number;count:number}>();
 for(const o of offers){
  const price=suggested(o.cost,o.logistics,o.markup_type,o.markup_value);
  if((measure==='suggested'||measure==='markup')&&price===null)continue;
  const value=measure==='cost'?o.cost:measure==='suggested'?price!:measure==='markup'?price!-o.cost-(o.logistics??0):1;
  const label=field==='brand'?o.brand:[o.brand,o.model,o.variant].filter(Boolean).join(' · ');
  const group=groups.get(label)??{sum:0,count:0};group.sum+=value;group.count++;groups.set(label,group);
 }
 return [...groups].map(([label,r])=>({label,value:measure==='count'?r.sum:Math.round(r.sum/r.count*100)/100})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label,'es'));
}
