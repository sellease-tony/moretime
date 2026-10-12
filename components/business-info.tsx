import {legal,businessRows,TODO} from '@/lib/legal';
// Seller identity block shown in the landing footer and at the end of the legal pages.
export default function BusinessInfo({className}:{className?:string}){
 return <dl className={'business-info '+(className||'')} aria-label="사업자 정보">
  {businessRows.map(([label,key])=><div key={key}><dt>{label}</dt><dd>{legal[key]===TODO?<span className="business-todo">[{TODO}]</span>:legal[key]}</dd></div>)}
 </dl>;
}
