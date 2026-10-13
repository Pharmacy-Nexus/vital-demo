export default function IdentityMark({id,className="",barClass="bg-current"}:{id:string;className?:string;barClass?:string}){
  return <div className={`flex items-end gap-1 ${className}`} aria-label={`Medical ID ${id}`}>{[10,18,13,22,15].map((h,i)=><span key={i} className={`w-1 rounded-full ${barClass}`} style={{height:h}} />)}</div>
}
