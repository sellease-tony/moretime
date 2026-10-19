import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONSENT_VERSION,consentParam,hasConsent} from '../lib/auth/consent';

test('only the current consent version counts as agreement',()=>{
 assert.equal(consentParam(CONSENT_VERSION),CONSENT_VERSION);
 for(const bad of ['1','2020-01-01','',null,undefined])assert.equal(consentParam(bad),null);
});

test('a host is treated as consented only with a record of the current version',()=>{
 assert.equal(hasConsent({moa_role:'host',moa_consent:{version:CONSENT_VERSION,agreedAt:'2026-10-19T00:00:00Z'}}),true);
 assert.equal(hasConsent({moa_role:'host',moa_consent:{version:'2025-01-01'}}),false);
 for(const meta of [{moa_role:'host'},{moa_consent:'yes'},null,undefined])assert.equal(hasConsent(meta),false);
});
