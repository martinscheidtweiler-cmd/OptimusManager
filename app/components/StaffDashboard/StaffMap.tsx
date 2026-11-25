'use client'
import {useState} from 'react'
type Point={id:string;name:string;lat:number;lon:number;accuracy:number}
const tile=256
function project(lat:number,lon:number,z:number){const n=tile*2**z;const phi=Math.max(-85,Math.min(85,lat))*Math.PI/180;return {x:(lon+180)/360*n,y:(1-Math.asinh(Math.tan(phi))/Math.PI)/2*n}}
export default function StaffMap({points}:{points:Point[]}){
 const [zoomOffset,Z]=useState(0),[selected,S]=useState('')
 if(!points.length)return <div style={{height:250,display:'grid',placeItems:'center',background:'#f3f3f3',borderRadius:8}}>Geen recente GPS-posities</div>
 const width=600,height=300;let base=17
 for(;base>4;base--){const p=points.map(v=>project(v.lat,v.lon,base));if(Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x))<width-100&&Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y))<height-80)break}
 const z=Math.max(3,Math.min(19,base+zoomOffset)),p=points.map(v=>({...v,...project(v.lat,v.lon,z)}));const cx=(Math.min(...p.map(v=>v.x))+Math.max(...p.map(v=>v.x)))/2,cy=(Math.min(...p.map(v=>v.y))+Math.max(...p.map(v=>v.y)))/2,left=cx-width/2,top=cy-height/2;const tiles=[]
 for(let x=Math.floor(left/tile);x<=Math.floor((left+width)/tile);x++)for(let y=Math.floor(top/tile);y<=Math.floor((top+height)/tile);y++)if(y>=0&&y<2**z)tiles.push({x,y})
 return <div><div style={{position:'relative',background:'#eee',borderRadius:8,overflow:'hidden',aspectRatio:'2 / 1'}}><svg viewBox="0 0 600 300" style={{width:'100%',height:'100%',display:'block'}} aria-label="Kaart actieve medewerkers">{tiles.map(t=><image key={t.x+':'+t.y} href={'https://tile.openstreetmap.org/'+z+'/'+((t.x%2**z+2**z)%2**z)+'/'+t.y+'.png'} x={t.x*tile-left} y={t.y*tile-top} width={tile} height={tile}/>)}{p.map(v=><g key={v.id} transform={'translate('+(v.x-left)+' '+(v.y-top)+')'} onClick={()=>S(v.id)} style={{cursor:'pointer'}}><circle r="10" fill="#111" stroke="white" strokeWidth="2"/><text y="-15" fontSize="12" textAnchor="middle" stroke="white" strokeWidth="4" paintOrder="stroke" fontWeight="bold">{v.name}</text></g>)}</svg><div style={{position:'absolute',right:8,top:8,display:'grid',gap:3}}><button aria-label="Inzoomen" onClick={()=>Z(v=>v+1)}>+</button><button aria-label="Uitzoomen" onClick={()=>Z(v=>v-1)}>−</button><button onClick={()=>Z(0)}>Alles</button></div><a style={{position:'absolute',bottom:0,right:0,background:'white',fontSize:10}} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>{points.filter(v=>v.id===selected).map(v=><p key={v.id}>{v.name} · GPS nauwkeurigheid ±{Math.round(v.accuracy||0)} m</p>)}</div>
}
