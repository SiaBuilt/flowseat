const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {execFileSync}=require('node:child_process');
const out=mkdtempSync(join(tmpdir(),'flowseat-domain-'));
let freshSeat,wifiLabel,matchesSearch,amapLocationLink,mapPlaces;
try{execFileSync(process.execPath,['apps/client/node_modules/typescript/bin/tsc','apps/client/src/domain/place.ts','apps/client/src/domain/map.ts','--target','ES2020','--module','commonjs','--outDir',out,'--skipLibCheck']);({freshSeat,wifiLabel,matchesSearch,amapLocationLink}=require(join(out,'place.js')));({mapPlaces}=require(join(out,'map.js')));}finally{rmSync(out,{recursive:true,force:true});}
test('空位反馈一小时内有效，到期与未知都返回待确认',()=>{const at=10000000;const s={status:'full',at};assert.equal(freshSeat(s,at+3599999),s);assert.equal(freshSeat(s,at+3600000),undefined);assert.equal(freshSeat(undefined,at),undefined);});
test('未来时间反馈不能被视为有效实时空位',()=>{assert.equal(freshSeat({status:'available',at:2000},1000),undefined);});
test('搜索支持地址、多个词和全角拉丁字符',()=>{const p={name:'The Common Room',type:'咖啡馆',district:'静安',address:'南京西路 123 号'};assert.equal(matchesSearch(p,'南京西路 common'),true);assert.equal(matchesSearch(p,'ＣＯＭＭＯＮ 静安'),true);assert.equal(matchesSearch(p,'common 徐汇'),false);});
test('Wi-Fi 明确区分无网络和未知',()=>{assert.equal(wifiLabel(false),'无 Wi-Fi');assert.equal(wifiLabel(null),'Wi-Fi 待确认');assert.equal(wifiLabel(true),'有 Wi-Fi');});
test('地图按已提供坐标落点，未知坐标使用地址搜索且编码名称',()=>{const p={name:'A & B 咖啡',address:'测试路 123 号'};const search=new URL(amapLocationLink(p));assert.equal(search.pathname,'/search');assert.equal(search.searchParams.get('keyword'),p.name+' '+p.address);const point=new URL(amapLocationLink({...p,location:{lng:121.47,lat:31.23,system:'GCJ-02'}}));assert.equal(point.pathname,'/marker');assert.equal(point.searchParams.get('name'),p.name);assert.equal(point.searchParams.get('position'),'121.47,31.23');assert.equal(point.searchParams.get('coordinate'),'gaode');});

test('真实地图只接收非演示、上海 GCJ-02 坐标，不将示意 x/y 当经纬度',()=>{const valid={id:'real',demo:false,location:{lng:121.47,lat:31.23,system:'GCJ-02'}};const rows=[valid,{...valid,id:'demo',demo:true},{...valid,id:'unknown',location:null},{...valid,id:'gps',location:{...valid.location,system:'WGS84'}},{...valid,id:'outside',location:{...valid.location,lng:116}},{id:'schematic',demo:false,x:50,y:25}];assert.deepEqual(mapPlaces(rows).map(p=>p.id),['real']);});
