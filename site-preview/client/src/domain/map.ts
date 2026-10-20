import type {Place} from './place';
export function mapPlaces(places:Place[]){
 return places.filter(p=>!p.demo&&p.location?.system==='GCJ-02'&&Number.isFinite(p.location.lng)&&Number.isFinite(p.location.lat)&&p.location.lng>=120.8&&p.location.lng<=122.3&&p.location.lat>=30.6&&p.location.lat<=31.9);
}
