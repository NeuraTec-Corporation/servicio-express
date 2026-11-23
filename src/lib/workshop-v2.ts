import {z} from 'zod';
const text=z.string().trim().max(4000),short=z.string().trim().max(160);
export const issueSchema=z.object({id:z.uuid(),reported:short.min(1),preliminary:text.default(''),diagnosis:text.default(''),solution:text.default(''),requires_part:z.boolean().default(true),evidence_required:z.boolean().optional(),confirmed:z.boolean().default(false),resolved:z.boolean().default(false),final_diagnosis:text.default('')});
export const partRequestSchema=z.object({id:z.uuid(),issue_id:z.uuid(),description:short.min(1),sku:short.default(''),quantity:z.number().int().min(1).max(10000),unit_cost:z.number().min(0).max(1e7).refine(n=>Math.abs(n*100-Math.round(n*100))<.00001),currency:z.string().regex(/^[A-Z]{3}$/),source:z.enum(['stock','supplier']),batch_id:z.uuid().nullable().default(null),supplier_id:z.uuid().nullable().default(null),received_quantity:z.number().int().min(0).max(10000).optional(),nonconforming_quantity:z.number().int().min(0).max(10000).optional(),status:z.enum(['planned','ordered','partial','received','rejected','cancelled']).default('planned'),supplier_reference:short.default(''),condition:z.enum(['new','used','refurbished']).default('new')});
export type Issue=z.infer<typeof issueSchema>;
export type PartRequest=z.infer<typeof partRequestSchema>;
export const scheduleSchema=z.object({start:z.number().int().min(0).max(1439).default(900),end:z.number().int().min(1).max(1440).default(1200),timezone:z.string().max(80).default('America/New_York'),days:z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0,1,2,3,4,5,6])}).refine(s=>s.end>s.start,'Horario inválido').refine(s=>{try{new Intl.DateTimeFormat('en',{timeZone:s.timezone});return true}catch{return false}},'Zona horaria inválida');
export const authorizationSchema=z.object({quote_id:z.uuid(),revision:z.number().int().positive(),shared_status:z.enum(['approved','declined','pending']),items:z.array(z.object({issue_id:z.uuid(),status:z.enum(['approved','declined','pending'])})).max(30)});
export type IssueAuthorization=z.infer<typeof authorizationSchema>;
export const workflowSchema=z.object({closure_outcome:z.enum(['repaired','unrepaired']).optional(),authorization:authorizationSchema.optional(),revision:z.number().int().min(1).default(1),issues:z.array(issueSchema).max(30).default([]),requests:z.array(partRequestSchema).max(60).default([]),received_at:z.iso.datetime().nullable().default(null),preliminary:text.default(''),preliminary_part:short.default(''),preliminary_price:z.number().min(0).max(1e7).nullable().default(null),preliminary_currency:z.string().regex(/^[A-Z]{3}$/).default('USD'),device_label:short.default(''),technical_closed:z.boolean().default(false),drying_required:z.boolean().default(false),drying_done:z.boolean().default(false),cleaning_done:z.boolean().default(false),satisfaction:z.enum(['pending','satisfied','not_satisfied']).default('pending'),schedule:scheduleSchema.default({start:900,end:1200,timezone:'America/New_York',days:[0,1,2,3,4,5,6]})});
export type Workflow=z.infer<typeof workflowSchema>;
export type Supplier={id:string;slot:number;name:string;url:string;is_placeholder:boolean;active:boolean};
export type CatalogOption={id:string;kind:string;label_es:string;label_en:string};
export const emptyWorkflow=()=>workflowSchema.parse({});
export function verifiedStock(b:{condition?:string;inspected?:boolean;cancelled?:boolean}){return !!b.inspected&&!b.cancelled&&['new','used','refurbished'].includes(b.condition??'')}
const normalized=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function compatibleStock(b:{brand?:string;model?:string;compatible_models?:string[]},o:{brand:string;model:string}){return normalized(b.brand??'')===normalized(o.brand)&&(normalized(b.model??'')===normalized(o.model)||(b.compatible_models??[]).some(m=>normalized(m)===normalized(o.model)))}
export function approvalCurrent(w:Workflow,q?:{id?:string;status?:string;plan_revision?:number|null}){return !!q&&q.status==='approved'&&q.plan_revision===w.revision&&(!w.authorization||(w.authorization.revision===w.revision&&w.authorization.quote_id===q.id&&w.authorization.shared_status==='approved'&&w.authorization.items.some(i=>i.status==='approved')))}
export function issueDecision(w:Workflow,id:string){return w.authorization&&w.authorization.revision===w.revision?w.authorization.items.find(i=>i.issue_id===id)?.status??'pending':'approved'}
export function acceptedIssues(w:Workflow){return w.issues.filter(i=>issueDecision(w,i.id)==='approved')}
export function activeRequests(w:Workflow){return w.requests.filter(r=>r.status!=='cancelled'&&issueDecision(w,r.issue_id)==='approved')}
export function pendingApproval(w:Workflow){return !!w.authorization&&w.authorization.revision===w.revision&&(w.authorization.shared_status==='pending'||w.authorization.items.some(i=>i.status==='pending'))}
export function approvedQuoteLines<T extends {issue_id?:string}>(w:Workflow,lines:T[]){if(!w.authorization||w.authorization.revision!==w.revision)return lines;return lines.filter(l=>l.issue_id?issueDecision(w,l.issue_id)==='approved':w.authorization!.shared_status==='approved')}
export function receivedQuantity(r:PartRequest){return r.received_quantity??(r.status==='received'?r.quantity:0)}
export function resolvedLines<T extends {batch_id?:string;request_id?:string}>(lines:T[],requests:PartRequest[]){return lines.map(l=>({...l,batch_id:l.request_id?requests.find(r=>r.id===l.request_id&&r.status!=='cancelled')?.batch_id??undefined:l.batch_id}))}
export function requiredQuantities(lines:{kind:string;batch_id?:string;quantity:number}[]){const totals=new Map<string,number>();for(const l of lines)if(l.kind==='part'){if(!l.batch_id)return null;totals.set(l.batch_id,(totals.get(l.batch_id)??0)+l.quantity)}return totals}
export function partState(w:Workflow,allocations:{batch_id:string;state:string;quantity:number}[]):'not_required'|'pending'|'ordered'|'nonconforming'|'available'|'received'{
 const requests=activeRequests(w);if(!requests.length&&pendingApproval(w))return 'pending';if(!requests.length)return acceptedIssues(w).some(i=>i.confirmed&&i.requires_part)?'pending':'not_required';
 if(requests.some(r=>r.source==='supplier'&&r.status==='rejected'))return 'nonconforming';if(requests.some(r=>r.source==='supplier'&&['ordered','partial'].includes(r.status)))return 'ordered';
 if(requests.some(r=>r.source==='supplier'&&r.status==='planned'))return 'pending';
 const totals=new Map<string,number>();for(const r of requests){if(!r.batch_id)return 'pending';totals.set(r.batch_id,(totals.get(r.batch_id)??0)+r.quantity)}
 for(const [id,qty]of totals)if(allocations.filter(a=>a.batch_id===id&&a.state!=='returned').reduce((n,a)=>n+a.quantity,0)<qty)return 'available';return 'received';
}
export function validateWorkflow(w:Workflow){
 if(new Set(w.issues.map(i=>i.id)).size!==w.issues.length||new Set(w.requests.map(r=>r.id)).size!==w.requests.length)throw new Error('Identificadores duplicados.');
 if(w.authorization&&(new Set(w.authorization.items.map(i=>i.issue_id)).size!==w.authorization.items.length||w.authorization.items.some(i=>!w.issues.some(issue=>issue.id===i.issue_id))))throw new Error('Autorización con daños duplicados o ajenos.');if(w.requests.some(r=>receivedQuantity(r)>r.quantity))throw new Error('La recepción supera lo solicitado.');
 if(w.requests.some(r=>!w.issues.some(i=>i.id===r.issue_id)))throw new Error('La pieza debe pertenecer a un daño de esta orden.');
}
function localBoundary(day:string,minutes:number,timezone:string){const [y,m,d]=day.split('-').map(Number),target=Date.UTC(y,m-1,d,0,minutes);let candidate=target;const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(let n=0;n<3;n++){const p=Object.fromEntries(fmt.formatToParts(new Date(candidate)).map(p=>[p.type,p.value]));const seen=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const correction=target-seen;candidate+=correction;if(!correction)break}return candidate}
/** Intersect recorded active intervals with configured local shifts, including DST. */
export function businessMinutes(start:number,end:number,schedule:Workflow['schedule']){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
 if(end-start>3660*86400000)throw new Error('Intervalo fuera del alcance del piloto.');
 let sum=0;const first=new Date(start-86400000);first.setUTCHours(0,0,0,0);
 for(let stamp=+first;stamp<end+86400000;stamp+=86400000){const day=new Date(stamp).toISOString().slice(0,10);if(!schedule.days.includes(new Date(day+'T12:00:00Z').getUTCDay()))continue;const a=localBoundary(day,schedule.start,schedule.timezone),b=localBoundary(day,schedule.end,schedule.timezone);sum+=Math.max(0,Math.min(end,b)-Math.max(start,a));}
 return sum/60000;
}

export const conditionLabels:Record<string,string>={new:'Nueva',used:'Usada',refurbished:'Reacondicionada',defective:'Defectuosa',unknown:'Por verificar'};
