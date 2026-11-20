import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyPricingUpdates,assertBulkCurrencies,bulkPolicySchema,draftUpdate,initialDraft,policySchema,previewOffer,priceOf} from '../src/lib/pricing';
import {emptyTerms} from '../src/lib/domain';
import type {Offer} from '../src/lib/ui-data';
const offer={id:'00000000-0000-4000-8000-000000000010',variant_id:'00000000-0000-4000-8000-000000000011',cost:'480',currency:'USD',terms:emptyTerms(),markup_type:'fixed',markup_value:'80',default_markup_type:null,default_markup_value:null} as Offer;
test('vista previa cambia inmediatamente sin alterar la oferta guardada',()=>{
 const next=previewOffer(offer,{scope:'offer',type:'fixed',value:'200'});assert.equal(priceOf(next),680);assert.equal(priceOf(offer),560);assert.equal(priceOf(previewOffer(offer,{scope:'offer',type:'percent',value:'20'})),576);
});
test('el recargo cero se guarda como cero y vacío no equivale a cero',()=>{
 assert.equal(draftUpdate(offer,{scope:'offer',type:'fixed',value:'0'})?.value,0);assert.equal(draftUpdate(offer,{scope:'offer',type:'fixed',value:''}),null);assert.equal(draftUpdate(offer,{scope:'offer',type:'fixed',value:'-5'}),null);assert.equal(draftUpdate(offer,{scope:'offer',type:'fixed',value:'1.005'}),null);
});
test('predeterminado respeta recargo individual y heredar lo recupera',()=>{
 const [defaults]=applyPricingUpdates([offer],[{scope:'variant',id:offer.variant_id,type:'percent',value:10}]);assert.equal(priceOf(defaults),560);const [inherited]=applyPricingUpdates([defaults],[{scope:'offer',id:offer.id,type:null,value:null}]);assert.equal(priceOf(inherited),528);assert.deepEqual(initialDraft(inherited),{scope:'offer',type:'percent',value:'10'});
});
test('aplicar masivo reemplaza solo las ofertas indicadas, sin tocar las otras',()=>{
 const other={...offer,id:'00000000-0000-4000-8000-000000000012'};const updated=applyPricingUpdates([offer,other],[{scope:'offer',id:offer.id,type:'fixed',value:200}]);assert.equal(priceOf(updated[0]),680);assert.equal(priceOf(updated[1]),560);
});
test('importe fijo masivo requiere una moneda y porcentaje admite monedas distintas',()=>{
 assert.throws(()=>assertBulkCurrencies(['USD','DOP'],'fixed'),/sola moneda/);assert.doesNotThrow(()=>assertBulkCurrencies(['USD','DOP'],'percent'));
});
test('lote exige selección explícita, elimina repetidos y rechaza políticas incompletas',()=>{
 assert.equal(bulkPolicySchema.safeParse({ids:[],type:'fixed',value:10}).success,false);assert.equal(bulkPolicySchema.parse({ids:[offer.id,offer.id],type:'fixed',value:200}).ids.length,1);assert.equal(policySchema.safeParse({id:offer.id,scope:'offer',type:'fixed',value:null}).success,false);
});
