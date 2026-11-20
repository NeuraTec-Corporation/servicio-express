import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseText,parseAmount,parseCsv} from '../src/lib/import';
import {validateFile,readDocument} from '../src/lib/document-reader';
test('captura WhatsApp: encabezados, marcas inferidas, capacidad y precio separado',()=>{
 const rows=parseText('Proveedor Demo\nPrecios en USD\niPhone 14 128 GB negro $480\nSamsung Galaxy S24 256 GB USD 520\nRedmi Note 13 8/256 GB $180\nGracias por su compra','QA');
 assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>[r.brand,r.model,r.variant,r.cost,r.currency]),[['Apple','iPhone 14','128 GB negro',480,'USD'],['Samsung','Galaxy S24','256 GB',520,'USD'],['Xiaomi','Redmi Note 13','8/256 GB',180,'USD']]);assert(rows.every(r=>!r.reviewed));
});
test('precios con miles y decimales regionales no pierden importes',()=>{
 for(const value of ['1,250.50','1.250,50'])assert.equal(parseAmount(value),1250.5);
 assert.equal(parseText('Apple iPhone 15 Pro 256 GB USD 1,250.50','QA')[0].cost,1250.5);
});
test('no confunde capacidad sin precio con una oferta ni inventa moneda por $',()=>{
 assert.equal(parseText('iPhone 14 128 GB\nBuenos días\nGarantía: 30','QA').length,0);
 assert.equal(parseText('iPhone 14 128GB $480','QA')[0].currency,'');
});
test('listas agrupadas por marca y formato canónico omiten cabecera',()=>{
 const grouped=parseText('SAMSUNG\nS24 Ultra 256 GB 950 USD','QA');assert.equal(grouped[0].brand,'SAMSUNG');assert.equal(grouped[0].model,'S24 Ultra');
 const rows=parseText('marca | modelo | variante | costo | moneda\nApple | iPhone 14 | 128 GB | 480 | USD','QA');assert.equal(rows.length,1);
});
test('listas grandes no se truncan silenciosamente',()=>{assert.throws(()=>parseText(Array(501).fill('iPhone 14 USD 480').join('\n'),'QA'),/500/);});
test('carga valida tamaño y formato antes de iniciar lectura',()=>{
 assert.throws(()=>validateFile({name:'lista.pdf',size:0}),/vacío/);assert.throws(()=>validateFile({name:'lista.pdf',size:5*1024*1024}),/4 MB/);assert.throws(()=>validateFile({name:'lista.exe',size:100}),/Formato/);assert.doesNotThrow(()=>validateFile({name:'Captura.PNG',size:1024}));
});
test('cancelación previa devuelve control sin iniciar lectores ni red',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(readDocument(new File(['x'],'lista.pdf'),()=>assert.fail('No debe iniciar progreso'),controller.signal),{name:'AbortError'});
});
test('normaliza la confusión OCR de iPhone y rechaza CSV truncado',()=>{
 assert.equal(parseText('Apple ¡Phone 14 128 GB USD 480','QA')[0].model,'iPhone 14');
 assert.throws(()=>parseCsv('marca,modelo,costo,moneda\n'+Array(501).fill('Apple,iPhone 14,480,USD').join('\n'),'QA'),/500/);
});
