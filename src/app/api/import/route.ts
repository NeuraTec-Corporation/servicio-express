import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import ExcelJS from 'exceljs';
import {authenticated,sameOrigin} from '@/lib/auth';
import {db,TENANT} from '@/lib/db';
import {parseText,parseCsv,canonicalRows} from '@/lib/import';
import type {Candidate} from '@/lib/domain';
export const runtime='nodejs';
export async function POST(request:Request){if(!await authenticated())return new Response(null,{status:401});if(!sameOrigin(request))return new Response(null,{status:403});try{const f=await request.formData();const supplier=String(f.get('supplier')??'').trim();if(!supplier||supplier.length>150)throw new Error('Indica el proveedor');const file=f.get('file');let original:Buffer,filename:string,type:string,rows:Candidate[];
 if(file instanceof File&&file.size){if(file.size>5*1024*1024)throw new Error('Archivo máximo: 5 MB');original=Buffer.from(await file.arrayBuffer());filename=file.name.slice(0,200);const ext=filename.split('.').pop()?.toLowerCase();type=file.type||'application/octet-stream';if(ext==='csv')rows=parseCsv(original.toString('utf8'),supplier);else if(ext==='txt')rows=parseText(original.toString('utf8'),supplier);else if(ext==='xlsx'){const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(original as never);const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Excel vacío');if(sheet.rowCount>501||sheet.columnCount>40)throw new Error('Máximo 500 filas y 40 columnas');const headers=(sheet.getRow(1).values as unknown[]).slice(1).map(String);const records:Record<string,unknown>[]=[];sheet.eachRow((row,n)=>{if(n>1){const r:Record<string,unknown>={};headers.forEach((h,i)=>r[h]=row.getCell(i+1).text);records.push(r)}});rows=canonicalRows(records,supplier)}else if(['pdf','png','jpg','jpeg','webp'].includes(ext??'')){rows=[]}else throw new Error('Formato admitido: texto, CSV, XLSX, PDF o imagen');
 }else{const text=String(f.get('text')??'');if(!text.trim()||text.length>100000)throw new Error('Pega texto válido (máximo 100.000 caracteres)');original=Buffer.from(text);filename='mensaje.txt';type='text/plain';rows=parseText(text,supplier)}
 const id=randomUUID();await db()`INSERT INTO sources(id,tenant_id,supplier,filename,media_type,original) VALUES(${id},${TENANT},${supplier},${filename},${type},${original})`;return NextResponse.json({id,rows,manual:!rows.length,filename});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudo importar'},{status:400})}}

