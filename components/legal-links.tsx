import {legal} from '@/lib/legal';
// Terms, privacy policy and support contact, shown at the bottom of the host app and every guest page.
export default function LegalLinks({className='legal-links'}:{className?:string}){
 return <div className={className} role="navigation" aria-label="약관 및 정책"><a href="/terms" target="_blank" rel="noopener">이용약관</a><a href="/privacy" target="_blank" rel="noopener"><strong>개인정보 처리방침</strong></a><a href={'mailto:'+legal.contactEmail}>고객센터</a></div>;
}
