import {z} from 'zod';
import {workflowSchema} from './workshop-v2';
import {phoneKey} from './access';

export const stages = {
  received:'Recibido', diagnosis:'Diagnóstico', repair:'En reparación', drying:'Secado',
  assembly:'Armado', repaired:'Reparado', pre_delivery:'Preentrega', cleaning:'Limpieza final', testing:'Pruebas', ready:'Listo para entregar', delivered:'Entregado',
} as const;
export const partsStates = {not_required:'Sin piezas pendientes', pending:'Por pedir', ordered:'Pedidas',nonconforming:'Repuesto en revisión',available:'En stock', received:'Recibidas'} as const;
export const approvalStates = {pos:'Autorización inicial registrada', pending:'Adicional pendiente', approved:'Adicional aprobado', declined:'Adicional rechazado'} as const;
const short = z.string().trim().max(160);
export const orderFields = z.object({
  workflow:workflowSchema.optional(),pos_reference:short.default(''), device_type:z.enum(['phone','tablet','laptop','desktop','other']),
  brand:short.min(1), model:short.min(1), customer_name:short.min(1), customer_phone:short.refine(s=>/^[0-9]{7,15}$/.test(phoneKey(s)),'Teléfono: entre 7 y 15 dígitos'),
  reported_fault:z.string().trim().min(1).max(4000), accessories:z.string().trim().max(2000).default(''),
  technician:short.default(''), office:short.min(1), diagnosis:z.string().trim().max(8000).default(''),
  stage:z.enum(Object.keys(stages) as [keyof typeof stages,...(keyof typeof stages)[]]).default('received'),
  parts_state:z.enum(['not_required','pending','ordered','nonconforming','available','received']).default('not_required'),
  approval_state:z.enum(['pos','pending','approved','declined']).default('pos'),
  approval_evidence:z.string().trim().max(2000).default(''),
  pause_reason:z.string().trim().max(1000).default(''),
  estimated_minutes:z.number().int().min(0).max(43200).nullable().default(null),
  tests_passed:z.boolean().default(false),
  tests_notes:z.string().trim().max(4000).default(''),
  delivery_notes:z.string().trim().max(4000).default(''),
  warranty_days:z.number().int().min(0).max(730).default(0),
});
export type OrderFields=z.infer<typeof orderFields>;
export type WorkOrder=OrderFields & {id:string;public_code:string;version:number;created_at:string;updated_at:string};
export type PublicOrder=Pick<WorkOrder,'id'|'public_code'|'device_type'|'brand'|'model'|'stage'|'office'|'technician'|'estimated_minutes'|'parts_state'|'approval_state'|'updated_at'>;
export const orderInput=z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),data:orderFields}),
  z.object({action:z.literal('update'),id:z.uuid(),version:z.number().int().positive(),data:orderFields}),
]);

/** Explicit allowlist: public TV responses must never serialize the private order. */
export function publicOrder(order:WorkOrder):PublicOrder {
  const {id,public_code,device_type,brand,model,stage,office,technician,estimated_minutes,parts_state,approval_state,updated_at}=order;
  return {id,public_code,device_type,brand,model,stage,office,technician,estimated_minutes,parts_state,approval_state,updated_at};
}

export function validateOrder(next:OrderFields,previous?:OrderFields):string|null {
  if(!previous&&next.stage!=='received')return 'Una orden nueva comienza como recibida.';
  if(next.approval_state==='approved'&&!next.approval_evidence.trim())return 'Registra la evidencia de aprobación del trabajo adicional.';
  if(next.stage==='delivered'&&previous?.stage!=='ready'&&previous?.stage!=='delivered')return 'Completa las pruebas y marca el equipo listo antes de entregarlo.';
  if((next.stage==='ready'||next.stage==='delivered')&&!next.tests_passed)return 'Confirma las pruebas finales antes de marcar el equipo listo.';
  if((next.stage==='ready'||next.stage==='delivered')&&(['pending','declined'].includes(next.approval_state)||['pending','ordered','nonconforming'].includes(next.parts_state)))return 'Un equipo listo no puede tener piezas o autorización pendientes.';
  const executing=['repair','drying','assembly','testing','ready','delivered'].includes(next.stage);
  if(executing&&!next.diagnosis.trim())return 'Registra el diagnóstico antes de iniciar la reparación.';
  // Work may remain at its present stage while approval/parts are pending, but cannot advance.
  if(next.stage!==previous?.stage&&executing){
    if(next.approval_state==='pending'||next.approval_state==='declined')return 'Resuelve la autorización adicional antes de avanzar.';
    if(next.parts_state==='pending'||next.parts_state==='ordered')return 'Confirma la recepción de las piezas antes de avanzar.';
  }
  return null;
}

export function blankOrder():OrderFields {
  return {pos_reference:'',device_type:'phone',brand:'',model:'',customer_name:'',customer_phone:'',reported_fault:'',accessories:'',technician:'',office:'',diagnosis:'',stage:'received',parts_state:'not_required',approval_state:'pos',approval_evidence:'',pause_reason:'',estimated_minutes:null,tests_passed:false,tests_notes:'',delivery_notes:'',warranty_days:0};
}

export function workshopCounts(orders:PublicOrder[]){
  const active=orders.filter(o=>o.stage!=='delivered');
  return {active:active.length,waitingParts:active.filter(o=>['pending','ordered','nonconforming'].includes(o.parts_state)).length,
    waitingApproval:active.filter(o=>o.approval_state==='pending').length,ready:active.filter(o=>o.stage==='ready').length};
}
