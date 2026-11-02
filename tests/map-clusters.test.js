const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const out=mkdtempSync(join(tmpdir(),'flowseat-cluster-test-'));
let clusterProjectedPoints;
try{execFileSync(process.execPath,['apps/client/node_modules/typescript/bin/tsc','apps/client/src/domain/map-clusters.ts','--target','ES2020','--module','commonjs','--outDir',out,'--skipLibCheck']);({clusterProjectedPoints}=require(join(out,'map-clusters.js')));}finally{rmSync(out,{recursive:true,force:true});}
const point=(id,x,y)=>({place:{id},x,y});
const members=groups=>groups.map(g=>g.items.map(p=>p.place.id).sort()).sort((a,b)=>a.join().localeCompare(b.join()));

test('聚类处理空列表、单地点，并保留原地点对象',()=>{
 assert.deepEqual(clusterProjectedPoints([]),[]);
 const p=point('single',120,80),groups=clusterProjectedPoints([p]);
 assert.equal(groups.length,1);assert.equal(groups[0].items[0].place,p.place);
 assert.equal(groups[0].x,120);assert.equal(groups[0].y,80);
});
test('密集点聚为一组，缩放拉开后可逐个访问',()=>{
 const dense=[point('a',0,0),point('b',30,10),point('c',300,0)];
 assert.deepEqual(members(clusterProjectedPoints(dense)),[['a','b'],['c']]);
 const zoomed=dense.map(p=>({...p,x:p.x*8,y:p.y*8}));
 assert.deepEqual(members(clusterProjectedPoints(zoomed)),[['a'],['b'],['c']]);
});
test('同一坐标的多个地点不丢失，选中地点独立可定位',()=>{
 const same=[point('a',10,10),point('b',10,10),point('c',10,10)];
 assert.deepEqual(members(clusterProjectedPoints(same)),[['a','b','c']]);
 assert.deepEqual(members(clusterProjectedPoints(same,'b')),[['a','c'],['b']]);
});
test('筛选后聚类只包含结果，每个地点恰好出现一次且不修改输入',()=>{
 const points=Array.from({length:42},(_,i)=>point(String(i),i%7*70,Math.floor(i/7)*40));
 const before=JSON.stringify(points);const visible=points.filter((_,i)=>i%3!==0);
 const groups=clusterProjectedPoints(visible),ids=groups.flatMap(g=>g.items.map(p=>p.place.id));
 assert.equal(new Set(ids).size,visible.length);assert.equal(ids.length,visible.length);
 assert.deepEqual(ids.sort(),visible.map(p=>p.place.id).sort());
 assert.equal(JSON.stringify(points),before);assert.ok(groups.every(g=>Number.isFinite(g.x)&&Number.isFinite(g.y)));
});
test('跨越屏幕分区边界的相邻点仍聚合，输入顺序不改变分组',()=>{
 const points=[point('a',159,20),point('b',161,20),point('c',500,500)];
 assert.deepEqual(members(clusterProjectedPoints(points)),[['a','b'],['c']]);
 assert.deepEqual(members(clusterProjectedPoints([...points].reverse())),members(clusterProjectedPoints(points)));
});
