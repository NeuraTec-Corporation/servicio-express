import Papa from 'papaparse';
import {Candidate,emptyTerms} from './domain';
export function parseText(text:string,supplier:string):Candidate[]{
 const rows:Candidate[]=[];let brandContext='',currencyContext='';
 const brands='Apple|Samsung|Motorola|Xiaomi|Google|Honor|Huawei|OnePlus|Nokia|Realme|Oppo|Vivo|Tecno|Infinix';
 const currencies='USD|EUR|DOP|MXN|COP|PEN|ARS|CLP|BRL|GTQ|HNL|NIO|CRC|PAB|CAD';
 for(const raw of text.split(/\r?\n/)){
  const line=raw.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e]/g,'').trim();if(!line)continue;
  const parts=line.split('|').map(x=>x.trim());
  if(parts.length>=5){if(/^(marca|brand)$/i.test(parts[0]))continue;rows.push({brand:parts[0],model:parts[1],variant:parts[2],cost:parseAmount(parts[3]),currency:parts[4].toUpperCase(),supplier,terms:emptyTerms(),reviewed:false});continue;}
  const heading=line.replace(/[^\p{L}\s]/gu,'').trim();
  const brandHeading=heading.match(new RegExp('^('+brands+')$','i'));if(brandHeading){brandContext=brandHeading[1];continue;}
  const currencyHeading=line.match(new RegExp('^(?:(?:precios?|moneda|lista|prices?|currency)\\s*(?:en|in|:)?\\s*)?('+currencies+')\\s*[:.]?$','i'));
  if(currencyHeading){currencyContext=currencyHeading[1].toUpperCase();continue;}
  // Remove only WhatsApp timestamp/sender prefixes, not model numbers.
  const clean=line.replace(/^\[?\d{1,2}[/:]\d{1,2}[^\]]*\]\s*[^:]{0,80}:\s*/,'').replace(/^[\s*•·▶✅📱\-]+/u,'').replace(/\*+/g,'');
  const price=clean.match(new RegExp('(?:\\s+|\\s*[-:=]\\s*|(?=\\$))(?:(?:('+currencies+')\\s*)?\\$?\\s*)(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)\\s*('+currencies+')?\\s*(?:[✅✔!]+)?$','i'));
  if(!price)continue;
  let description=clean.slice(0,price.index).trim().replace(/\s*[-:=]$/,'').trim();if(!description||!/[\p{L}]/u.test(description))continue;
  // Phone capacity alone is not a price.
  if(/^(?:hora|tel[eé]fono|contacto|total|subtotal|env[ií]o|garant[ií]a|fecha)(?:\s|:|$)/i.test(description))continue;
  const explicit=description.match(new RegExp('^('+brands+')\\s+','i'));let brand=explicit?.[1]??'';
  if(explicit)description=description.slice(explicit[0].length);
  description=description.replace(/^[¡Il1]Phone\b/i,'iPhone');
  if(!brand){if(/^iPhone\b|^iPad\b|^AirPods\b|^MacBook\b/i.test(description))brand='Apple';else if(/^Galaxy\b/i.test(description))brand='Samsung';else if(/^Redmi\b|^Poco\b/i.test(description))brand='Xiaomi';else if(/^Pixel\b/i.test(description))brand='Google';else if(/^Moto\b/i.test(description))brand='Motorola';else brand=brandContext;}
  // Split capacity/color/condition without discarding the supplier's wording.
  const variantAt=description.search(/\s+(?=\d+(?:\s*\/\s*\d+)?\s*(?:GB|TB)\b|(?:negro|blanco|azul|rojo|verde|gris|black|white|blue|gold|silver|nuevo|usado|reacondicionado|libre|sellado)\b)/i);
  const model=variantAt<0?description:description.slice(0,variantAt).trim(),variant=variantAt<0?'':description.slice(variantAt).trim();
  rows.push({brand,model,variant,cost:parseAmount(price[2]),currency:(price[1]??price[3]??currencyContext).toUpperCase(),supplier,terms:emptyTerms(),reviewed:false,warning:'Detectado automáticamente: verifica modelo, capacidad, precio y moneda contra el original. El símbolo $ no define la moneda.'});
 }
 if(rows.length>500)throw new Error('Se detectaron más de 500 productos. Divide la lista; no se importaron filas parcialmente.');
 return rows;
}
export function parseAmount(value:unknown){const s=String(value??'').trim();if(/^\d+(?:[.,]\d{1,2})?$/.test(s))return Number(s.replace(',','.'));if(/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s))return Number(s.replaceAll(',',''));if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))return Number(s.replaceAll('.','').replace(',','.'));return 0;}
export function canonicalRows(rows:Record<string,unknown>[],supplier:string):Candidate[]{if(rows.length>500)throw new Error('Máximo 500 productos por carga; divide el archivo.');return rows.map(raw=>{const r=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k.trim().toLowerCase(),v]));const str=(...keys:string[])=>String(keys.map(k=>r[k]).find(v=>v!==undefined&&v!==null)??'').trim();return {brand:str('marca','brand'),model:str('modelo','model'),variant:str('variante','variant'),supplier:str('proveedor','supplier')||supplier,cost:parseAmount(str('costo','cost','precio')),currency:str('moneda','currency').toUpperCase(),terms:{...emptyTerms(),delivery:str('entrega','delivery'),warranty:str('garantia','garantía','warranty'),returns:str('devoluciones','returns'),notes:str('observaciones','notes')},reviewed:false}})}
export function parseCsv(text:string,supplier:string){const p=Papa.parse<Record<string,unknown>>(text,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});if(p.errors.length)throw new Error('CSV no válido: '+p.errors[0].message);return canonicalRows(p.data,supplier)}
