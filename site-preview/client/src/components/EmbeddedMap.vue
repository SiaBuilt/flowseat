<script setup lang="ts">
import {ref,computed,getCurrentInstance,onMounted,onBeforeUnmount,watch,nextTick} from 'vue';
import type {Place} from '../domain/place';
import {mapPlaces} from '../domain/map';
import {costLabels,practical} from '../domain/place';
import {loadTencentMap,type MapConfig} from '../services/tencent-map';
import {request} from '../services/api';
const props=defineProps<{places:Place[];selected:string;visible:boolean}>();
const emit=defineEmits<{status:[value:string];select:[id:string]}>();
const containerId='flowseat-map-'+Math.random().toString(36).slice(2),ready=ref(false),instance=getCurrentInstance();
const points=computed(()=>mapPlaces(props.places)),latitude=ref(31.2304),longitude=ref(121.4737),nativeScale=ref(11);
const nativeMarkers=computed(()=>points.value.map((p,index)=>({id:index+1,latitude:p.location!.lat,longitude:p.location!.lng,iconPath:'/static/map-pin-'+p.cost+'.png',width:28,height:36,callout:{content:(p.cost==='free'?'免费':practical[p.id]?.budget||costLabels[p.cost])+' · '+p.type,color:props.selected===p.id?'#ffffff':'#202020',bgColor:props.selected===p.id?'#202020':'#ffffff',fontSize:11,borderRadius:12,padding:8,display:'ALWAYS'}})));
let map:any,TMap:any,markers:any[]=[],nativeContext:any;let stopped=false,generation=0;let readyTimer:ReturnType<typeof setTimeout>|undefined;
function nativeReady(){if(stopped)return;clearTimeout(readyTimer);ready.value=true;emit('status','ready');}
function nativeSelect(e:{detail:{markerId:number}}){const p=points.value[e.detail.markerId-1];if(p)emit('select',p.id);}
function paint(){
 // #ifdef H5
 if(!map||!TMap)return;for(const marker of markers)marker.destroy();markers=[];
 class PricePin extends TMap.DOMOverlay{
  constructor(options:any){super(options);}
  declare point:any;declare place:Place;declare node:HTMLButtonElement;declare listener:()=>void;
  onInit(options:any){this.point=options.point;this.place=options.place;}
  createDOM(){
   const p=this.place,button=document.createElement('button');button.type='button';button.className='live-map-pin pin-'+p.cost+(props.selected===p.id?' selected':'');button.setAttribute('aria-label',p.name+'，'+costLabels[p.cost]);button.setAttribute('aria-pressed',String(props.selected===p.id));button.style.position='absolute';button.style.left='0';button.style.top='0';button.style.zIndex=props.selected===p.id?'200':'100';
   const price=document.createElement('span');price.textContent=p.cost==='free'?'免费':(practical[p.id]?.budget||costLabels[p.cost]);const type=document.createElement('small');type.textContent=p.type;button.append(price,type);this.listener=()=>emit('select',p.id);button.addEventListener('click',this.listener);this.node=button;return button;
  }
  updateDOM(){if(!this.node)return;const p=this.getMap().projectToContainer(this.point);this.node.style.transform='translate('+(p.x-this.node.offsetWidth/2)+'px,'+(p.y-this.node.offsetHeight/2)+'px)';}
  onDestroy(){this.node?.removeEventListener('click',this.listener);}
 }
 for(const p of points.value)markers.push(new PricePin({map,point:new TMap.LatLng(p.location!.lat,p.location!.lng),place:p,isStopPropagation:true}));
 // #endif
}
function centerSelected(){
 const p=points.value.find(p=>p.id===props.selected);if(!p)return;
 // #ifdef H5
 if(map)map.easeTo({center:new TMap.LatLng(p.location!.lat,p.location!.lng),zoom:14},{duration:250});
 // #endif
 // #ifndef H5
 latitude.value=p.location!.lat;longitude.value=p.location!.lng;nativeScale.value=14;
 // #endif
}
function resetView(){
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
function retry(){clearTimeout(readyTimer);for(const marker of markers)marker.destroy();markers=[];if(map)map.destroy();map=null;ready.value=false;return start();}
watch(()=>props.places,()=>{paint();if(!props.selected)resetView();},{deep:true});watch(()=>props.selected,()=>{paint();centerSelected();});
watch(()=>props.visible,async visible=>{if(visible){await nextTick();if(map)map.setCenter(map.getCenter());}});
onMounted(start);onBeforeUnmount(()=>{stopped=true;generation++;clearTimeout(readyTimer);for(const marker of markers)marker.destroy();markers=[];if(map)map.destroy();map=null;});
defineExpose({retry,resetView,zoomBy});
</script>
<template>
 <!-- #ifdef H5 -->
 <view :id="containerId" class="embedded-map" :class="{'is-ready':ready}" aria-label="上海工位地图"/>
 <!-- #endif -->
 <!-- #ifndef H5 -->
 <map :id="containerId" class="embedded-map is-ready" :longitude="longitude" :latitude="latitude" :scale="nativeScale" :markers="nativeMarkers" :show-location="false" :enable-scroll="true" :enable-zoom="true" @updated="nativeReady" @markertap="nativeSelect" @callouttap="nativeSelect"/>
 <!-- #endif -->
</template>
