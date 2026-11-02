<script setup lang="ts">
import {ref,computed,getCurrentInstance,onMounted,onBeforeUnmount,watch,nextTick} from 'vue';
import type {Place} from '../domain/place';
import {mapPlaces} from '../domain/map';
import {clusterProjectedPoints,type PointCluster} from '../domain/map-clusters';
import ActionButton from './ActionButton.vue';
import {costLabels,practical} from '../domain/place';
import {loadTencentMap,type MapConfig} from '../services/tencent-map';
import {request} from '../services/api';
const props=defineProps<{places:Place[];selected:string;visible:boolean}>();
const emit=defineEmits<{status:[value:string];select:[id:string]}>();
const containerId='flowseat-map-'+Math.random().toString(36).slice(2),ready=ref(false),instance=getCurrentInstance();
const points=computed(()=>mapPlaces(props.places)),latitude=ref(31.2304),longitude=ref(121.4737),nativeScale=ref(11);
const expandedIds=ref<string[]>([]);
let clusterTrigger:HTMLElement|undefined;
function closeExpanded(){expandedIds.value=[];
 // #ifdef H5
 nextTick(()=>{const target=clusterTrigger?.isConnected?clusterTrigger:document.getElementById(containerId)?.querySelector<HTMLElement>('.live-map-pin');target?.focus();});
 // #endif
}
const expandedPlaces=computed(()=>points.value.filter(p=>expandedIds.value.includes(p.id)));
function chooseExpanded(id:string){expandedIds.value=[];emit('select',id);}
const nativeMarkers=computed(()=>points.value.map((p,index)=>({id:index+1,latitude:p.location!.lat,longitude:p.location!.lng,iconPath:'/static/map-pin-'+p.cost+'.png',width:28,height:36,callout:{content:(p.cost==='unknown'?p.name:p.cost==='free'?'免费':practical[p.id]?.budget||costLabels[p.cost])+' · '+p.type,color:props.selected===p.id?'#ffffff':'#202020',bgColor:props.selected===p.id?'#202020':'#ffffff',fontSize:11,borderRadius:12,padding:8,display:'ALWAYS'}})));
let map:any,TMap:any,markers:any[]=[],nativeContext:any;let stopped=false,generation=0;let readyTimer:ReturnType<typeof setTimeout>|undefined;
function nativeReady(){if(stopped)return;clearTimeout(readyTimer);ready.value=true;emit('status','ready');}
function nativeSelect(e:{detail:{markerId:number}}){const p=points.value[e.detail.markerId-1];if(p)emit('select',p.id);}
function paint(){
 // #ifdef H5
 if(!map||!TMap)return;for(const marker of markers)marker.destroy();markers=[];
 class ClusterLayer extends TMap.DOMOverlay{
  constructor(options:any){super(options);}
  declare node:HTMLDivElement;declare buttons:Map<string,HTMLButtonElement>;
  onInit(){this.buttons=new Map();}
  createDOM(){const node=document.createElement('div');node.style.cssText='position:absolute;left:0;top:0;width:0;height:0;pointer-events:none';this.node=node;return node;}
  updateDOM(){
   if(!this.node)return;
   const projected=points.value.map(place=>{const point=this.getMap().projectToContainer(new TMap.LatLng(place.location!.lat,place.location!.lng));return {place,x:point.x as number,y:point.y as number};});
   const groups=clusterProjectedPoints<Place>(projected,props.selected),activeKeys=new Set<string>();
   const selected=projected.find(p=>p.place.id===props.selected);
   for(const group of groups){
    const places=group.items.map(p=>p.place),p=places[0],cluster=places.length>1,key=places.map(p=>p.id).sort().join('|');activeKeys.add(key);
    let button=this.buttons.get(key);
    if(!button){
     button=document.createElement('button');button.type='button';button.style.cssText='position:absolute;left:0;top:0;pointer-events:auto;min-height:44px';
     if(cluster){button.className='live-map-pin map-cluster-pin';button.textContent=places.length+' 处地点';button.setAttribute('aria-label','展开附近 '+places.length+' 处地点');button.title='点击放大，查看这里的地点';button.addEventListener('click',()=>expandCluster(group,button));}
     else{
      button.className='live-map-pin pin-'+p.cost+(props.selected===p.id?' selected':'');button.setAttribute('aria-label',p.name+'，'+costLabels[p.cost]);button.title=p.name+' · '+costLabels[p.cost];button.setAttribute('aria-pressed',String(props.selected===p.id));
      const price=document.createElement('span');price.textContent=p.cost==='unknown'?p.name:p.cost==='free'?'免费':(practical[p.id]?.budget||costLabels[p.cost]);const type=document.createElement('small');type.textContent=p.type;button.append(price,type);button.addEventListener('click',()=>emit('select',p.id));
     }
     this.node.append(button);this.buttons.set(key,button);
    }
    // Keep overlapping members reachable when the selected pin is isolated.
    const offset=selected&&p.id!==props.selected&&Math.abs(group.x-selected.x)<160&&Math.abs(group.y-selected.y)<52?-58:0;
    button.style.zIndex=props.selected===p.id?'200':'100';button.style.transform='translate('+(group.x-button.offsetWidth/2)+'px,'+(group.y+offset-button.offsetHeight/2)+'px)';
   }
   for(const [key,button] of this.buttons)if(!activeKeys.has(key)){button.remove();this.buttons.delete(key);}
  }
  onDestroy(){this.buttons.clear();}
 }
 markers.push(new ClusterLayer({map,isStopPropagation:true}));
 // #endif
}
function expandCluster(group:PointCluster<Place>,trigger?:HTMLElement){
 // #ifdef H5
 if(!map)return;
 const places=group.items.map(p=>p.place),first=places[0].location!;
 const coincident=places.every(p=>Math.abs(p.location!.lat-first.lat)<0.00001&&Math.abs(p.location!.lng-first.lng)<0.00001);
 if(map.getZoom()>=17||coincident){clusterTrigger=trigger;expandedIds.value=places.map(p=>p.id);nextTick(()=>document.getElementById(containerId+'-cluster')?.querySelector<HTMLElement>('.cluster-place-choice')?.focus());return;}
 const lat=places.reduce((n,p)=>n+p.location!.lat,0)/places.length,lng=places.reduce((n,p)=>n+p.location!.lng,0)/places.length;
 map.easeTo({center:new TMap.LatLng(lat,lng),zoom:Math.min(18,map.getZoom()+2)},{duration:250});
 // #endif
}
function centerSelected(){
 const p=points.value.find(p=>p.id===props.selected);if(!p)return;
 // #ifdef H5
 if(map)map.easeTo({center:new TMap.LatLng(p.location!.lat,p.location!.lng),zoom:Math.max(14,map.getZoom())},{duration:250});
 // #endif
 // #ifndef H5
 latitude.value=p.location!.lat;longitude.value=p.location!.lng;nativeScale.value=14;
 // #endif
}
function resetView(){
 expandedIds.value=[];
 // #ifdef H5
 if(!map)return;if(points.value.length){const bounds=new TMap.LatLngBounds();for(const p of points.value)bounds.extend(new TMap.LatLng(p.location!.lat,p.location!.lng));map.fitBounds(bounds,{padding:{top:75,left:50,right:50,bottom:240},maxZoom:15});}else{map.setCenter(new TMap.LatLng(31.2304,121.4737));map.setZoom(11);}
 // #endif
 // #ifndef H5
 if(points.value.length&&nativeContext)nativeContext.includePoints({points:points.value.map(p=>({latitude:p.location!.lat,longitude:p.location!.lng})),padding:[75,50,240,50]});else{latitude.value=31.2304;longitude.value=121.4737;nativeScale.value=11;}
 // #endif
}
function zoomBy(by:number){
 // #ifdef H5
 if(map)map.setZoom(Math.max(3,Math.min(18,map.getZoom()+by)));
 // #endif
 // #ifndef H5
 nativeScale.value=Math.max(3,Math.min(18,nativeScale.value+by));
 // #endif
}
async function start(){
 const run=++generation;emit('status','loading');
 // #ifdef H5
 try{
  const config=await request<MapConfig>('map-config');if(stopped||run!==generation)return;if(!config.enabled){emit('status','disabled');return;}
  TMap=await loadTencentMap(config);if(stopped||run!==generation)return;await nextTick();
  const container=document.getElementById(containerId);if(!container)throw new Error('地图容器尚未就绪');
  map=new TMap.Map(container,{viewMode:'2D',pitch:0,rotation:0,zoom:11,center:new TMap.LatLng(31.2304,121.4737)});
  readyTimer=setTimeout(()=>{if(!stopped&&run===generation&&!ready.value)emit('status','error');},15000);
  map.on('tilesloaded',()=>{if(stopped||run!==generation)return;nativeReady();});paint();resetView();centerSelected();
 }catch{if(!stopped&&run===generation)emit('status','error');}
 // #endif
 // #ifndef H5
 nativeContext=uni.createMapContext(containerId,instance?.proxy as any);if(ready.value)emit('status','ready');readyTimer=setTimeout(()=>{if(!stopped&&!ready.value)emit('status','error');},15000);await nextTick();resetView();centerSelected();
 // #endif
}
function retry(){expandedIds.value=[];clearTimeout(readyTimer);for(const marker of markers)marker.destroy();markers=[];if(map)map.destroy();map=null;ready.value=false;return start();}
watch(()=>props.places,()=>{expandedIds.value=[];paint();if(!props.selected)resetView();},{deep:true});watch(()=>props.selected,()=>{expandedIds.value=[];paint();centerSelected();});
watch(()=>props.visible,async visible=>{if(visible){await nextTick();if(map)map.setCenter(map.getCenter());}});
onMounted(start);onBeforeUnmount(()=>{stopped=true;generation++;clearTimeout(readyTimer);for(const marker of markers)marker.destroy();markers=[];if(map)map.destroy();map=null;});
defineExpose({retry,resetView,zoomBy});
</script>
<template>
 <!-- #ifdef H5 -->
 <view :id="containerId" class="embedded-map" :class="{'is-ready':ready}" aria-label="上海工位地图"/>
 <view v-if="expandedPlaces.length" :id="containerId+'-cluster'" class="map-cluster-panel" role="region" aria-label="此处地点列表" @keydown.esc.stop="closeExpanded">
  <view class="cluster-panel-heading"><text>此处 {{expandedPlaces.length}} 处地点</text><ActionButton class="cluster-close" aria-label="关闭地点列表" @click="closeExpanded">关闭</ActionButton></view>
  <view class="cluster-place-list"><ActionButton v-for="p in expandedPlaces" :key="p.id" class="cluster-place-choice" @click="chooseExpanded(p.id)"><text>{{p.name}}</text><text class="meta">{{p.type}} · {{costLabels[p.cost]}}</text></ActionButton></view>
 </view>
 <!-- #endif -->
 <!-- #ifndef H5 -->
 <map :id="containerId" class="embedded-map is-ready" :longitude="longitude" :latitude="latitude" :scale="nativeScale" :markers="nativeMarkers" :show-location="false" :enable-scroll="true" :enable-zoom="true" @updated="nativeReady" @markertap="nativeSelect" @callouttap="nativeSelect"/>
 <!-- #endif -->
</template>

<style>
.map-cluster-pin{min-width:84px;justify-content:center;background:#202020;color:#fff;border:2px solid #fff;box-shadow:0 2px 10px #0003}
.map-cluster-pin:before{display:none}.live-map-pin:focus-visible{outline:3px solid #66829a;outline-offset:3px}
.map-cluster-panel{position:absolute;z-index:300;top:70px;left:12px;right:12px;max-height:calc(100% - 90px);display:flex;flex-direction:column;background:#fff;border:1px solid #ddd;border-radius:16px;box-shadow:0 8px 30px #0002;overflow:hidden}
.cluster-panel-heading{display:flex;justify-content:space-between;align-items:center;padding:4px 12px;border-bottom:1px solid #eee;font-size:14px;font-weight:600}.cluster-panel-heading .cluster-close{min-width:44px;min-height:44px;font-size:12px}
.cluster-place-list{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 12px}.cluster-place-choice{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-height:54px;width:100%;padding:12px 0;text-align:left;border-bottom:1px solid #eee;font-size:13px;white-space:normal}.cluster-place-choice:last-child{border-bottom:0}.cluster-place-choice:hover,.cluster-place-choice:focus-visible{background:#f3f3f3}
</style>
