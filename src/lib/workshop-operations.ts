import {z} from 'zod';
const text=z.string().trim().min(1).max(160);
const qty=z.number().int().min(1).max(10000);
const amount=z.number().finite().min(0).max(10000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,'Máximo dos decimales');
export const quoteLine=z.object({description:text,kind:z.enum(['part','labor']),quantity:qty,unit_cost:amount,markup_type:z.enum(['fixed','percent']),markup_value:amount,batch_id:z.uuid().optional()});
export type QuoteLine=z.infer<typeof quoteLine>;
export type StockBatch={id:string;part:string;brand:string;model:string;office:string;supplier:string;invoice:string;unit_cost:number;currency:string;ordered_quantity:number;received_quantity:number;on_hand:number;reserved:number;version:number;created_at:string};
export type PartAllocation={id:string;batch_id:string;part:string;quantity:number;state:'reserved'|'consumed'|'returned';unit_cost:number;currency:string;office:string};
export type WorkQuote={id:string;revision:number;currency:string;lines:QuoteLine[];total:number;previous_total:number|null;status:'pending'|'approved'|'declined';response_evidence:string;created_at:string;responded_at:string|null};
export type WorkEvent={id:string;action:string;detail:Record<string,unknown>;stage:string;paused:boolean;created_at:string};
export type WorkMedia={id:string;filename:string;media_type:string;caption:string;created_at:string};
export type OrderDetail={quotes:WorkQuote[];parts:PartAllocation[];events:WorkEvent[];media:WorkMedia[];settled:boolean};
const orderRef={order_id:z.uuid(),version:z.number().int().positive()};
const request={request_id:z.uuid()};
export const operationInput=z.discriminatedUnion('action',[
 z.object({...request,action:z.literal('batch'),part:text,brand:z.string().trim().max(160),model:z.string().trim().max(160),office:text,supplier:text,invoice:z.string().trim().max(160),unit_cost:amount,currency:z.string().regex(/^[A-Z]{3}$/),ordered_quantity:qty}),
 z.object({...request,action:z.literal('receive'),batch_id:z.uuid(),batch_version:z.number().int().positive(),quantity:qty,invoice:z.string().trim().max(160).optional()}),
 z.object({...request,action:z.literal('transfer'),batch_id:z.uuid(),batch_version:z.number().int().positive(),quantity:qty,office:text}),
 z.object({...request,action:z.literal('supplier_return'),batch_id:z.uuid(),batch_version:z.number().int().positive(),quantity:qty}),
 z.object({...request,...orderRef,action:z.literal('reserve'),batch_id:z.uuid(),quantity:qty}),
 z.object({...request,...orderRef,action:z.literal('consume'),allocation_id:z.uuid()}),
 z.object({...request,...orderRef,action:z.literal('return'),allocation_id:z.uuid(),confirmed_usable:z.literal(true)}),
 z.object({...request,...orderRef,action:z.literal('quote'),currency:z.string().regex(/^[A-Z]{3}$/),lines:z.array(quoteLine).min(1).max(50)}),
 z.object({...request,...orderRef,action:z.literal('decide'),quote_id:z.uuid(),status:z.enum(['approved','declined']),evidence:z.string().trim().min(8).max(2000)}),
 z.object({...request,...orderRef,action:z.literal('settle'),amount,currency:z.string().regex(/^[A-Z]{3}$/),labor_cost:amount.nullable(),pos_receipt:text,confirmed_collected:z.literal(true)}),
]);
export function lineTotal(line:QuoteLine){
 const cost=Math.round(line.unit_cost*100);
 const price=line.markup_type==='fixed'?cost+Math.round(line.markup_value*100):Math.round(cost*(1+line.markup_value/100));
 return price*line.quantity/100;
}
export function quoteTotal(lines:QuoteLine[]){return lines.reduce((sum,l)=>sum+Math.round(lineTotal(l)*100),0)/100}
export function stockAvailable(batch:Pick<StockBatch,'on_hand'|'reserved'>){return batch.on_hand-batch.reserved}
export function stageDurations(events:WorkEvent[],now=Date.now()){
 const totals:Record<string,number>={};
 for(let i=0;i<events.length;i++){
  const e=events[i];if(e.paused||e.stage==='delivered')continue;
  const end=i+1<events.length?Date.parse(events[i+1].created_at):now;
  const minutes=Math.max(0,(end-Date.parse(e.created_at))/60000);
  if(Number.isFinite(minutes))totals[e.stage]=(totals[e.stage]??0)+minutes;
 }
 return totals;
}
