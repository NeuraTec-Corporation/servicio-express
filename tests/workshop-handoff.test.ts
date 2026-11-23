import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankOrder,orderInput,publicOrder,workshopCounts,type WorkOrder} from '../src/lib/workshop';
test('front desk custody is outside workshop workload and TV excludes private intake credentials',()=>{
 const o={...blankOrder(),id:'00000000-0000-4000-8000-000000000001',public_code:'SE-DEMO',version:1,created_at:'2026-11-22T10:00:00Z',updated_at:'2026-11-22T10:00:00Z',brand:'Apple',model:'iPhone 14',customer_name:'Private',customer_phone:'12025550109',reported_fault:'Screen',office:'Principal',stage:'front_desk',device_access_code:'DEMO-PIN-1234',handoff:{front_desk_at:'2026-11-22T10:00:00Z',front_desk_by:'SETEC001',client_at:null,client_by:'',notes:'Physical handover',collection_reference:'Private receipt',reference_amount:100}} as WorkOrder;
 assert.deepEqual(workshopCounts([publicOrder(o)]),{active:0,waitingParts:0,waitingApproval:0,ready:0});assert.ok(!JSON.stringify(publicOrder(o)).includes('DEMO-PIN'));assert.ok(!JSON.stringify(publicOrder(o)).includes('Private receipt'));
});
test('manual intake accepts multiple independent reported issues while preserving their preliminary state',()=>{
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 const parsed=orderInput.parse({action:'create',data:{...blankOrder(),brand:'Samsung',model:'Galaxy S24',customer_name:'DEMO',customer_phone:'12025550109',reported_fault:'Screen, charge, audio',office:'Principal',workflow:{issues:ids.map((id,n)=>({id,reported:['Screen','Charge','Audio'][n]}))}}});
 assert.equal(parsed.data.workflow?.issues.length,3);assert.ok(parsed.data.workflow?.issues.every(i=>!i.confirmed&&!i.resolved));
});
