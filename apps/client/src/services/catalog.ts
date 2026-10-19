import {ref} from 'vue';
import {demoPlaces,practical,type Place} from '../domain/place';
import {request,errorMessage} from './api';
export const catalogMode=ref<'loading'|'demo'|'community'|'error'>('loading');
export const catalogError=ref('');
function hydrate(p:Place):Place{
 practical[p.id]={budget:p.budget||'费用待确认',basis:p.basis||'请以场地方最新规则为准',menuUrl:p.menuUrl,menu:[]};
 // 未接入底图坐标时只做有明确标注的布局示意，不伪造经纬度。
 const hash=[...p.id].reduce((n,c)=>n+c.charCodeAt(0),0);return {...p,x:20+hash%50,y:26+hash%38};
}
export async function listPlaces():Promise<Place[]>{try{const r=await request<{places:Place[]}>('places');catalogError.value='';catalogMode.value=r.places.length?'community':'demo';return r.places.length?r.places.map(hydrate):demoPlaces;}catch(e){catalogMode.value='error';catalogError.value=errorMessage(e);return [];}}
export async function getPlace(id:string):Promise<Place|undefined>{if(id.startsWith('demo-'))return demoPlaces.find(p=>p.id===id);try{const r=await request<{place:Place}>('places/'+encodeURIComponent(id));return hydrate(r.place);}catch(e){catalogError.value=errorMessage(e);return undefined;}}
