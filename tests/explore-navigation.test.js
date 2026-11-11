const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync('apps/client/src/pages/index/index.vue','utf8');
// Exercise the actual route handlers with a prior account page or a direct detail URL.
function handlers(state,stack){
 const calls=[];
 const context={place:{value:state.place||null},missingPlace:{value:!!state.missing},routeLoading:{value:!!state.loading},savedOnly:{value:true},clear:()=>calls.push('clear'),getCurrentPages:()=>stack,uni:{navigateBack:()=>calls.push('history'),reLaunch:options=>calls.push(options.url)}};
 const code=['back','explore'].map(name=>source.match(new RegExp('function '+name+'\\([^\\n]+'))[0]).join('\n');
 vm.createContext(context);vm.runInContext(code,context);return{context,calls};
}
test('详情返回探索不受前一页为审核或直达链接影响',()=>{
 for(const stack of [[{route:'pages/me/index'},{route:'pages/index/index'}],[{route:'pages/index/index'}]]){
  const {context,calls}=handlers({missing:true},stack);context.back();assert.deepEqual(calls,['/pages/index/index']);
 }
});
test('首页标识和探索导航从失效/加载中/正常详情回探索，探索页自身保留筛选语义',()=>{
 for(const state of [{missing:true},{loading:true},{place:{id:'p'}}])for(const reset of [false,true]){
  const {context,calls}=handlers(state,[]);context.explore(reset);assert.deepEqual(calls,['/pages/index/index']);
 }
 const {context,calls}=handlers({},[]);context.explore();assert.equal(context.savedOnly.value,false);assert.deepEqual(calls,[]);context.explore(true);assert.deepEqual(calls,['clear']);
 assert.match(source,/aria-label="流动工位首页" @click="explore\(true\)"/);
 assert.match(source,/@click="explore\(\)">探索工位/);
});
