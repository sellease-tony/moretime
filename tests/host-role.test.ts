import test from 'node:test';
import assert from 'node:assert/strict';
import {isGoogle,isHost} from '../lib/auth/role';

test('only Google sessions marked as host by the server pass the host check', ()=>{
  assert.equal(isHost({provider:'google',moa_role:'host'}),true);
  assert.equal(isHost({provider:'google'}),false);
  assert.equal(isHost({provider:'google',moa_role:'guest'}),false);
  assert.equal(isHost({provider:'email',moa_role:'host'}),false);
  assert.equal(isHost(undefined),false);
  assert.equal(isGoogle({provider:'google'}),true);
  assert.equal(isGoogle(null),false);
});
