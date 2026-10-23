import {ZodError} from 'zod';
// Only messages the app wrote for users (Korean, short) reach the client; library and schema errors become the fallback.
export function publicMessage(e:unknown,fallback:string){
 const msg=e instanceof ZodError?e.issues[0]?.message:e instanceof Error?e.message:'';
 return msg&&msg.length<=200&&/[가-힣]/.test(msg)?msg:fallback;
}
