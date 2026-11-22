import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canManage,routeAllowed,phoneKey,orderVisible,type Account} from '../src/lib/access';
test('roles enforce destructive administration and backup destination privacy',()=>{
 for(const role of ['it','owner','manager','technician','staff'] as const){assert.equal(routeAllowed(role,'/api/admin/reset','POST'),canManage(role));assert.equal(routeAllowed(role,'/api/accounts','GET'),role==='it');assert.equal(routeAllowed(role,'/api/admin/recovery','POST'),role==='it');assert.equal(routeAllowed(role,'/api/backups','GET'),canManage(role))}
 assert.equal(routeAllowed('staff','/api/workshop/operations','POST','settle'),false);
 assert.equal(routeAllowed('technician','/api/policy','POST'),false);
 const u={role:'technician',office:'Principal',code:'SETEC001',display_name:'Técnico'} as Account;
 assert.equal(orderVisible(u,{office:'Principal',technician:'SETEC001'}),true);assert.equal(orderVisible(u,{office:'Otra',technician:'SETEC001'}),false);assert.equal(orderVisible(u,{office:'Principal',technician:'SETEC002'}),false);
 assert.equal(phoneKey('+1 (555) 123-4567'),'15551234567');
});
