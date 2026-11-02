const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const ts=require('../apps/client/node_modules/typescript');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const exportsCluster={};vm.runInNewContext(compile(readFileSync('apps/client/src/domain/map-clusters.ts','utf8')),{exports:exportsCluster});
const source=readFileSync('apps/client/src/components/EmbeddedMap.vue','utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
 .replace(/import .*?;\n/g,'').replace(/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g,'');
class Node {
 constructor(tag){this.tag=tag;this.style={};this.children=[];this.listeners={};this.attributes={};this.offsetWidth=100;this.offsetHeight=44;this.isConnected=true;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 click(){this.listeners.click?.();}
 focus(){this.focused=true;}
}
const place=(id,lng=121.47,lat=31.23)=>({id,name:'地点'+id,cost:'unknown',type:'图书馆',location:{lng,lat,system:'GCJ-02'},demo:false});
function component(places,viewport){
 const props={places,selected:'',visible:true},events=[],watchers=[],nodes=[];
 const map={zoom:11,factor:10000,projectToContainer(p){return{x:(p.lng-121.47)*this.factor+200,y:(p.lat-31.23)*this.factor+200};},getZoom(){return this.zoom;},easeTo(value){this.zoom=value.zoom;this.center=value.center;},setOffset(value){this.offset=value;},setCenter(value){this.center=value;},setZoom(value){this.zoom=value;},fitBounds(bounds,options){this.fitOptions=options;},destroy(){this.destroyed=true;}};
 class DOMOverlay{
  constructor(options){this.map=options.map;this.onInit(options);this.root=this.createDOM();this.updateDOM();}
  getMap(){return this.map;}
  destroy(){this.onDestroy();this.root.remove();this.destroyed=true;}
 }
 const context={exports:{},defineProps:()=>props,defineEmits:()=>((...args)=>events.push(args)),defineExpose:()=>{},ref:value=>({value}),computed:get=>({get value(){return get();}}),getCurrentInstance:()=>null,onMounted:()=>{},onBeforeUnmount:()=>{},watch:(get,cb)=>watchers.push({get,cb}),nextTick:fn=>Promise.resolve().then(fn),mapPlaces:rows=>rows,clusterProjectedPoints:exportsCluster.clusterProjectedPoints,costLabels:{unknown:'费用待确认'},practical:{},request:()=>{},loadTencentMap:()=>{},setTimeout,clearTimeout,document:{createElement:tag=>{const n=new Node(tag);nodes.push(n);return n;},getElementById:id=>viewport&&!id.endsWith('-cluster')?{getBoundingClientRect:()=>({width:viewport.width,height:viewport.height,top:0,bottom:viewport.height}),closest:()=>({querySelector:()=>({getBoundingClientRect:()=>({top:viewport.cardTop,height:viewport.height-viewport.cardTop})})})}:null},console};
 vm.runInNewContext(compile(source+'\n;globalThis.controller={paint,expandCluster,chooseExpanded,closeExpanded,expandedIds,resetView,centerSelected,setRuntime(m,t){map=m;TMap=t;},get layers(){return markers;}};'),context);
 const controller=context.controller;controller.setRuntime(map,{DOMOverlay,LatLngBounds:class{extend(){}},LatLng:class{constructor(lat,lng){this.lat=lat;this.lng=lng;}}});controller.paint();
 return{props,events,watchers,map,controller,nodes};
}
test('地图覆盖物按SDK生命周期创建，缩放重算拆分并移除旧聚类按钮',()=>{
 const c=component([place('a'),place('b',121.473)]),layer=c.controller.layers[0];
 assert.equal(layer.root.children.length,1);assert.equal(layer.root.children[0].textContent,'2 处地点');
 layer.root.children[0].click();assert.equal(c.map.zoom,13);
 c.map.factor=100000;layer.updateDOM();assert.equal(layer.root.children.length,2);
 assert.ok(layer.root.children.every(b=>!b.className.includes('map-cluster-pin')));
 layer.root.children[1].click();assert.equal(c.events.at(-1)[0],'select');assert.equal(c.events.at(-1)[1],'b');
});
test('重合地点直接打开可选列表，选中后其余重合成员仍可访问',()=>{
 const c=component([place('a'),place('b'),place('c')]);c.controller.layers[0].root.children[0].click();
 assert.equal(c.map.zoom,11);assert.deepEqual(Array.from(c.controller.expandedIds.value),['a','b','c']);
 c.controller.chooseExpanded('b');assert.equal(c.controller.expandedIds.value.length,0);assert.equal(c.events.at(-1)[1],'b');
 c.props.selected='b';c.controller.paint();const nodes=c.controller.layers[0].root.children;
 assert.equal(nodes.length,2);assert.notEqual(nodes[0].style.transform,nodes[1].style.transform);
 nodes.find(n=>n.className.includes('map-cluster-pin')).click();assert.deepEqual(Array.from(c.controller.expandedIds.value),['a','c']);
});
test('高缩放聚类打开列表且筛选后清理旧覆盖物与展开状态',()=>{
 const c=component([place('a'),place('b',121.473)]);c.map.zoom=17;
 const old=c.controller.layers[0];old.root.children[0].click();assert.equal(c.controller.expandedIds.value.length,2);
 c.props.places=[c.props.places[0]];c.props.selected='a';c.watchers[0].cb();
 assert.equal(old.destroyed,true);assert.equal(old.buttons.size,0);assert.equal(c.controller.expandedIds.value.length,0);
 assert.equal(c.controller.layers[0].root.children.length,1);assert.match(c.controller.layers[0].root.children[0].className,/selected/);
});

test('选中真实位置按预览卡动态偏移，重置多点时清除偏移避免与padding叠加',async()=>{
 const c=component([place('a'),place('b',121.48)],{width:320,height:600,cardTop:350});
 c.props.selected='a';c.controller.centerSelected();
 assert.equal(c.map.center.lat,31.23);assert.equal(c.map.center.lng,121.47);assert.equal(c.map.offset.y,(75-274)/2);
 c.props.selected='';await c.controller.resetView();assert.equal(c.map.offset.y,0);assert.equal(c.map.fitOptions.padding.bottom,274);
});
test('同坐标重置也将地理中心定位在卡片上方可视区域',async()=>{
 const c=component([place('a'),place('b')],{width:390,height:600,cardTop:330});
 await c.controller.resetView();assert.equal(c.map.zoom,15);assert.equal(c.map.center.lat,31.23);assert.equal(c.map.offset.y,(75-294)/2);
});
