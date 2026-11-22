import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineTotal,quoteTotal,stageDurations,stockAvailable,operationInput} from '../src/lib/workshop-operations';
test('quote uses cent rounding per unit, fixed markup per unit and independent labor',()=>{
 const part={description:'Pantalla',kind:'part' as const,quantity:2,unit_cost:10.05,markup_type:'percent' as const,markup_value:10};
 assert.equal(lineTotal(part),22.12);
 assert.equal(quoteTotal([part,{...part,kind:'labor',quantity:1,unit_cost:20,markup_type:'fixed',markup_value:5}]),47.12);
 assert.equal(lineTotal({...part,unit_cost:0,markup_value:0}),0);
});
test('stock availability excludes reservations and input requires positive integer quantities',()=>{
 assert.equal(stockAvailable({on_hand:7,reserved:5}),2);
 const input={action:'receive',request_id:'00000000-0000-4000-8000-000000000001',batch_id:'00000000-0000-4000-8000-000000000002',batch_version:1,quantity:0};
 assert.equal(operationInput.safeParse(input).success,false);
 assert.equal(operationInput.safeParse({...input,quantity:1.5}).success,false);
 assert.equal(operationInput.safeParse({...input,quantity:1}).success,true);
});
test('stage duration excludes recorded pauses, stops after delivery and never generates negative time',()=>{
 const make=(stage:string,paused:boolean,minute:number)=>({id:String(minute),action:'update',detail:{},stage,paused,created_at:new Date(Date.UTC(2026,10,21,10,minute)).toISOString()});
 const result=stageDurations([make('repair',false,0),make('repair',true,10),make('repair',false,30),make('testing',false,40),make('delivered',false,50)],Date.UTC(2026,10,21,12));
 assert.deepEqual(result,{repair:20,testing:10});
 assert.equal(stageDurations([make('repair',false,30)],Date.UTC(2026,10,21,10))["repair"],0);
});
