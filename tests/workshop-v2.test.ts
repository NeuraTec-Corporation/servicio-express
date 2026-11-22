import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {approvalCurrent,businessMinutes,compatibleStock,emptyWorkflow,issueSchema,partRequestSchema,partState,requiredQuantities,resolvedLines,validateWorkflow,verifiedStock} from '../src/lib/workshop-v2';
import {stageDurations} from '../src/lib/workshop-operations';
test('unknown or defective parts cannot be considered verified usable inventory',()=>{
 assert.equal(verifiedStock({condition:'unknown',inspected:false}),false);assert.equal(verifiedStock({condition:'defective',inspected:true}),false);assert.equal(verifiedStock({condition:'new',inspected:true,cancelled:true}),false);assert.equal(verifiedStock({condition:'refurbished',inspected:true}),true);
 assert.equal(compatibleStock({brand:'Apple',model:'iPhone 13'},{brand:'Apple',model:'iPhone 14'}),false);assert.equal(compatibleStock({brand:'Samsung',model:'Galaxy S24'},{brand:'Apple',model:'Galaxy S24'}),false);assert.equal(compatibleStock({brand:'Samsung',model:'S24',compatible_models:['Galaxy S24']},{brand:'samsung',model:' Galaxy S24 '}),true);
});
test('a previous approval does not authorize a materially changed plan',()=>{const w=emptyWorkflow();assert.equal(approvalCurrent(w),false);assert.equal(approvalCurrent(w,{status:'approved',plan_revision:1}),true);w.revision++;assert.equal(approvalCurrent(w,{status:'approved',plan_revision:1}),false);assert.equal(approvalCurrent(w,{status:'declined',plan_revision:2}),false)});
test('two damages using one batch require their combined quantity',()=>{
 const w=emptyWorkflow(),issueA=issueSchema.parse({id:randomUUID(),reported:'Screen'}),issueB=issueSchema.parse({id:randomUUID(),reported:'Frame'}),batch=randomUUID();w.issues=[issueA,issueB];
 w.requests=w.issues.map(i=>partRequestSchema.parse({id:randomUUID(),issue_id:i.id,description:'Adhesive',quantity:1,unit_cost:5,currency:'USD',source:'stock',batch_id:batch}));validateWorkflow(w);
 assert.equal(partState(w,[{batch_id:batch,state:'reserved',quantity:1}]),'available');assert.equal(partState(w,[{batch_id:batch,state:'reserved',quantity:2}]),'received');
 const lines=resolvedLines(w.requests.map(r=>({kind:'part',request_id:r.id,quantity:1})),w.requests);assert.equal(requiredQuantities(lines)?.get(batch),2);assert.equal(requiredQuantities([{kind:'part',quantity:1}]),null);
 w.requests[0].issue_id=randomUUID();assert.throws(()=>validateWorkflow(w));
});
test('working time excludes mornings and nights and handles daylight saving',()=>{
 const s=emptyWorkflow().schedule;assert.equal(businessMinutes(Date.parse('2026-11-22T10:00:00-05:00'),Date.parse('2026-11-22T22:00:00-05:00'),s),300);
 assert.equal(businessMinutes(Date.parse('2026-11-22T20:00:00-05:00'),Date.parse('2026-11-23T15:00:00-05:00'),s),0);
 assert.equal(businessMinutes(Date.parse('2026-03-08T10:00:00-04:00'),Date.parse('2026-03-08T22:00:00-04:00'),s),300);
 assert.equal(businessMinutes(Date.parse('2026-11-22T15:00:00-05:00'),Date.parse('2026-11-22T20:00:00-05:00'),{...s,days:[1]}),0);
});
test('recorded interval uses its shift snapshot rather than a later edit',()=>{
 const s=emptyWorkflow().schedule,events=[{id:'1',action:'repair',detail:{_schedule:s},stage:'repair',paused:false,created_at:'2026-11-22T14:00:00-05:00'},{id:'2',action:'pause',detail:{},stage:'repair',paused:true,created_at:'2026-11-22T16:00:00-05:00'}];assert.equal(stageDurations(events,Date.parse('2026-11-22T19:00:00-05:00'),{...s,start:600}).repair,60);
});
