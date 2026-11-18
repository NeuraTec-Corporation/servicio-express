import Papa from 'papaparse';
import {Candidate,emptyTerms} from './domain';
export function parseText(text:string,supplier:string):Candidate[]{
 return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,500).map(line=>{
  const parts=line.split('|').map(x=>x.trim());
  if(parts.length>=5)return {brand:parts[0],model:parts[1],variant:parts[2],cost:parseAmount(parts[3]),currency:parts[4].toUpperCase(),supplier,terms:emptyTerms(),reviewed:false};
  const match=line.match(/^(Apple|Samsung|Motorola|Xiaomi|Google|Honor|Huawei|OnePlus|Nokia|Realme|Oppo|Vivo)\s+(.+?)\s+(?:(USD|EUR|DOP|MXN|COP|PEN)\s*)?\$?\s*(\d+(?:[.,]\d{1,2})?)\s*(USD|EUR|DOP|MXN|COP|PEN)?$/i);
  return {brand:match?.[1]??'',model:match?.[2]??line,variant:'',cost:match?parseAmount(match[4]):0,currency:(match?.[3]??match?.[5]??'').toUpperCase(),supplier,terms:emptyTerms(),reviewed:false,warning:'Revisa identidad y moneda; no se infiere moneda desde el símbolo $.'};
 });
}
export function parseAmount(value:unknown){const s=String(value??'').trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(s))return 0;return Number(s.replace(',','.'))}
export function canonicalRows(rows:Record<string,unknown>[],supplier:string):Candidate[]{return rows.slice(0,500).map(raw=>{const r=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k.trim().toLowerCase(),v]));const str=(...keys:string[])=>String(keys.map(k=>r[k]).find(v=>v!==undefined&&v!==null)??'').trim();return {brand:str('marca','brand'),model:str('modelo','model'),variant:str('variante','variant'),supplier:str('proveedor','supplier')||supplier,cost:parseAmount(str('costo','cost','precio')),currency:str('moneda','currency').toUpperCase(),terms:{...emptyTerms(),delivery:str('entrega','delivery'),warranty:str('garantia','garantía','warranty'),returns:str('devoluciones','returns'),notes:str('observaciones','notes')},reviewed:false}})}
export function parseCsv(text:string,supplier:string){const p=Papa.parse<Record<string,unknown>>(text,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});if(p.errors.length)throw new Error('CSV no válido: '+p.errors[0].message);return canonicalRows(p.data,supplier)}
