import {z} from 'zod';
// Contact information is supplied by the guest; Google sign-in only prefills it.
export const guestContactSchema=z.object({
  name:z.string().trim().min(1,'이름을 입력해 주세요.').max(80),
  email:z.string().trim().toLowerCase().email('알림받을 이메일을 확인해 주세요.').max(200),
  phone:z.string().transform(v=>v.replace(/[\s-]/g,'')).pipe(z.string().regex(/^01[016789]\d{7,8}$/,'휴대전화 번호를 확인해 주세요.')),
});
