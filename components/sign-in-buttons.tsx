import {ArrowRight} from 'lucide-react';
import {GoogleLogo,MicrosoftLogo} from '@/components/brand-logos';

// Sign-in for hosts. Members go straight in; a first-time visitor agrees to the terms on /signup right after.
export default function SignInButtons({buttonClass,label='Google로 시작하기'}:{buttonClass:string;label?:string}){
 return <div className="sign-in-buttons">
  <a className={buttonClass} href="/auth/google"><GoogleLogo/>{label}<ArrowRight size={17}/></a>
  <a className={buttonClass} style={{marginTop:10}} href="/auth/microsoft"><MicrosoftLogo/>{label.replace('Google','Microsoft')}<ArrowRight size={17}/></a>
  <small style={{display:'block',textAlign:'center',fontSize:12,lineHeight:1.6,marginTop:10,color:'var(--text-secondary)'}}>Google 캘린더 또는 Outlook(Microsoft 365) 캘린더 중 쓰시는 쪽으로 시작하세요.</small>
 </div>;
}
