// Rules for personal booking addresses (moretime.sellease.io/{handle}/{slug}). Shared by the API, pages and editor.
export const HANDLE_RE=/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const SLUG_RE=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
// Top-level paths the app uses or may use, plus names that could be mistaken for the service itself.
const RESERVED=new Set(['app','admin','api','auth','book','booking','bookings','poll','polls','login','logout','signin','signup','register','privacy','terms','pricing','price','plans','help','support','about','blog','docs','faq','contact','legal','security','status','billing','pay','payment','payments','settings','account','accounts','dashboard','profile','profiles','user','users','team','teams','org','new','edit','static','public','assets','images','img','icon','icons','favicon','robots','sitemap','manifest','www','mail','email','root','null','undefined','moretime','moatime','sellease','official','system','test','demo','opengraph-image']);
export function handleError(raw:string){
 const h=raw.trim().toLowerCase();
 if(!HANDLE_RE.test(h)||h.includes('--'))return '영문 소문자·숫자·하이픈으로 3~30자 입력해 주세요. 하이픈으로 시작하거나 끝날 수 없습니다.';
 if(RESERVED.has(h)||h.startsWith('zz'))return '사용할 수 없는 주소입니다. 다른 주소를 입력해 주세요.';
 return null;
}
export const slugError=(s:string)=>SLUG_RE.test(s)&&!s.includes('--')?null:'페이지 주소는 영문 소문자·숫자·하이픈으로 40자 이내로 입력해 주세요.';
// A starting suggestion from an English title ("Coffee Chat" -> "coffee-chat"); Korean titles get no suggestion.
export function suggestSlug(title:string){return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'')}
export const prettyPath=(handle:string,slug:string)=>`/${handle}/${slug}`;
