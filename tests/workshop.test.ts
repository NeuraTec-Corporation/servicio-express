import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankOrder,orderInput,publicOrder,validateOrder,workshopCounts,type WorkOrder} from '../src/lib/workshop';
const fields=()=>({...blankOrder(),pos_reference:'POS-123',brand:'Apple',model:'iPhone 14',reported_fault:'No enciende',technician:'Técnico 1',office:'Central'});
const order=(overrides:Partial<WorkOrder>={}):WorkOrder=>({...fields(),id:'00000000-0000-4000-8000-000000000001',public_code:'SE-123',version:1,created_at:'2026-11-21T10:00:00Z',updated_at:'2026-11-21T10:00:00Z',...overrides});
test('TV allowlist never discloses client, POS, diagnosis, evidence or unexpected stored keys',()=>{
  const privateOrder={...order(),customer_name:'Private person',customer_phone:'555',pos_reference:'SECRET-POS',diagnosis:'Private finding',approval_evidence:'Private authorization',device_password:'SECRET'};
  const safe=publicOrder(privateOrder);
  assert.deepEqual(Object.keys(safe).sort(),['id','public_code','device_type','brand','model','stage','office','technician','estimated_minutes','parts_state','approval_state','updated_at'].sort());
  for(const secret of ['Private person','555','SECRET-POS','Private finding','Private authorization','SECRET'])assert.ok(!JSON.stringify(safe).includes(secret));
});
test('waiting counts overlap without adding duplicate active devices, delivered excluded',()=>{
  assert.deepEqual(workshopCounts([publicOrder(order({parts_state:'ordered',approval_state:'pending'})),publicOrder(order({stage:'delivered'}))]),{active:1,waitingParts:1,waitingApproval:1,ready:0});
});
test('new orders start received, validation rejects blank POS and invalid estimate',()=>{
  assert.equal(validateOrder(fields()),null);
  assert.ok(validateOrder({...fields(),stage:'ready',tests_passed:true,diagnosis:'done'}));
  assert.equal(orderInput.safeParse({action:'create',data:{...fields(),pos_reference:' '}}).success,false);
  assert.equal(orderInput.safeParse({action:'create',data:{...fields(),estimated_minutes:-1}}).success,false);
});
test('repair progression requires diagnosis, parts and authorization',()=>{
  const before=fields();
  assert.ok(validateOrder({...before,stage:'repair'},before));
  assert.ok(validateOrder({...before,stage:'repair',diagnosis:'Screen',parts_state:'ordered'},before));
  assert.ok(validateOrder({...before,stage:'repair',diagnosis:'Screen',approval_state:'pending'},before));
  assert.equal(validateOrder({...before,stage:'repair',diagnosis:'Screen',parts_state:'received'},before),null);
});
test('additional approval requires response evidence; final tests gate readiness and delivery',()=>{
  const before=fields();
  assert.ok(validateOrder({...before,approval_state:'approved'},before));
  assert.ok(validateOrder({...before,stage:'ready',diagnosis:'done'},before));
  const ready={...before,stage:'ready' as const,diagnosis:'done',tests_passed:true};
  assert.equal(validateOrder(ready,before),null);
  assert.ok(validateOrder({...ready,approval_state:'pending'},ready));
  assert.ok(validateOrder({...ready,stage:'delivered'},before));
  assert.equal(validateOrder({...ready,stage:'delivered'},ready),null);
});
