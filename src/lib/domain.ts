import {z} from 'zod';
export const termsSchema=z.object({availability:z.enum(['unknown','reported','confirmed','unavailable']).default('unknown'),confirmedAt:z.string().max(50).default(''),delivery:z.string().max(200).default(''),method:z.enum(['unknown','delivery','pickup']).default('unknown'),schedule:z.string().max(300).default(''),cutoff:z.string().max(100).default(''),logistics:z.number().min(0).max(1e8).nullable().default(null),warranty:z.string().max(500).default(''),returns:z.string().max(500).default(''),validUntil:z.string().max(50).default(''),notes:z.string().max(1000).default('')});
export const rowSchema=z.object({brand:z.string().trim().min(1).max(100),model:z.string().trim().min(1).max(150),variant:z.string().trim().max(250).default(''),supplier:z.string().trim().min(1).max(150),cost:z.number().positive().max(1e8),currency:z.string().regex(/^[A-Z]{3}$/),terms:termsSchema,reviewed:z.literal(true)});
export type ImportRow=z.infer<typeof rowSchema>;
export type Terms=z.infer<typeof termsSchema>;
export type Candidate=Omit<ImportRow,'reviewed'> & {reviewed:boolean;warning?:string};
export function identity(r:{brand:string;model:string;variant:string}) {return [r.brand,r.model,r.variant].map(s=>s.trim().normalize('NFKC').toLowerCase().replace(/\s+/g,' ')).join('|')}
export function suggested(cost:number,logistics:number|null,type:string|null,value:number|null){if(!type||value===null)return null;const base=Math.round((cost+(logistics??0))*100);return Math.round(type==='percent'?base*(1+value/100):base+value*100)/100}
export function variation(current:number,previous:number|null){return previous===null?null:{amount:Math.round((current-previous)*100)/100,percent:(current-previous)/previous*100}}
export const emptyTerms=()=>termsSchema.parse({});
