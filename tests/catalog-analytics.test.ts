import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogBreakdown,initialDashboardMode} from '../src/lib/catalog-analytics';
import type {AnalyticsOffer} from '../src/lib/analytics';
const offer={id:'a',brand:'Apple',model:'iPhone 14',variant:'128 GB',cost:480,currency:'USD',markup_type:'fixed',markup_value:100,logistics:null} as AnalyticsOffer;
test('dashboard abre catálogo cuando existen listas, aunque no haya operaciones',()=>{assert.equal(initialDashboardMode([offer]),'offers');assert.equal(initialDashboardMode([]),'real');});
test('estadísticas del catálogo usan recargos guardados y excluyen precios sin configurar',()=>{
 const unknown={...offer,id:'b',model:'iPhone 15',cost:520,markup_type:null,markup_value:null};
 assert.deepEqual(catalogBreakdown([offer,unknown],'model','suggested'),[{label:'Apple · iPhone 14 · 128 GB',value:580}]);assert.equal(catalogBreakdown([offer],'model','markup')[0].value,100);assert.equal(catalogBreakdown([offer,unknown],'brand','cost')[0].value,500);
});
test('conteos aceptan monedas distintas pero importes nunca las mezclan',()=>{
 const dop={...offer,id:'b',currency:'DOP'};assert.equal(catalogBreakdown([offer,dop],'brand','count')[0].value,2);assert.throws(()=>catalogBreakdown([offer,dop],'brand','cost'),/moneda/);
});
test('recargo previsto no duplica logística ni confunde cero con ausencia de política',()=>{
 assert.equal(catalogBreakdown([{...offer,logistics:20,markup_type:'percent',markup_value:10}],'model','markup')[0].value,50);assert.equal(catalogBreakdown([{...offer,markup_value:0}],'model','suggested')[0].value,480);
});
