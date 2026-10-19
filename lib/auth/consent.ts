// Host sign-up consent to the terms and privacy policy. Bump CONSENT_VERSION when either document changes
// materially; hosts whose recorded version differs are asked to agree again on their next Google sign-in.
export const CONSENT_VERSION='2026-10-12';
export type Consent={version:string;agreedAt:string};
export function hasConsent(meta:unknown){
 const c=meta&&typeof meta==='object'?(meta as Record<string,unknown>).moa_consent:null;
 return !!c&&typeof c==='object'&&(c as Record<string,unknown>).version===CONSENT_VERSION;
}
// The consent value carried through the Google round trip; anything other than the current version is no consent.
export function consentParam(value:string|null|undefined){return value===CONSENT_VERSION?CONSENT_VERSION:null}
