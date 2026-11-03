import http from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL,fileURLToPath} from 'node:url';
// Local-only screenshot fixture; never imports or changes production records.
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const {handle}=await import(pathToFileURL(resolve(root,'site-preview/server/api.mjs')));
const raw=new DatabaseSync(':memory:');
for(const f of ['0000_mixed_talkback.sql','0002_merchant_links.sql'])raw.exec(readFileSync(resolve(root,'site-preview/drizzle',f),'utf8'));
const db={prepare(sql){return {bind(...args){const p=raw.prepare(sql);return {first:async()=>p.get(...args)||null,all:async()=>({results:p.all(...args)}),run:async()=>p.run(...args),execute:()=>p.run(...args)}}}},async batch(items){raw.exec('BEGIN');try{const result=items.map(p=>p.execute());raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};
const {withResearch}=await import(pathToFileURL(resolve(root,'site-preview/server/research.mjs')));
const now=Date.now();
const files=['shanghai-real-discovery.json','shanghai-expansion-20261025.json','shanghai-expansion-20261027.json','shanghai-expansion-20261101.json'];
const source=files.flatMap(file=>JSON.parse(readFileSync(resolve(root,'data',file),'utf8')));
const ids=['source-f97015e6b64bf8feb7d28635','source-60edd59f1c355e5d3c716366','tencent-7356209017016184253','tencent-16790604963118065515','tencent-1495878479948436991','tencent-1323168865883257290','tencent-2138397045690600724','tencent-1156071251300695158'];
raw.prepare('INSERT INTO profiles VALUES(?,?,?)').run('showcase-author','FlowSeat 产品目标预览',now);
ids.forEach((id,i)=>{
 const original=source.find(p=>p.id===id);if(!original?.location)throw new Error('Missing source location: '+id);
 const known=withResearch(original),p={...known};
 const paid=known.type==='联合办公'||known.type==='自习室',cafe=known.type==='咖啡馆';
 const assumptions={cost:paid?'paid':cafe?'purchase':'free',budget:paid?(known.type==='自习室'?'¥28 / 2 小时':'¥88 / 天'):cafe?'¥32–45':'¥0',price:paid?'按时段购买工位':cafe?'饮品消费后可用':'空间使用免费',basis:paid?'开放工位使用费用，其他服务另计':cafe?'1 人 · 一杯饮品':'空间使用免费，无需消费',plugs:paid?'10 个以上':'6—10 个',charging:'靠窗与长桌座位可充电',chair:paid?'超舒适':'舒适',chairNote:'带靠背与软垫',wifi:true,hours:paid?'08:30—21:30':'09:00—20:00',entry:paid?'提前预约，前台核验入场':'开放时段直接进入',stay:paid?'按所购时长使用，可临时离座':'开放时段内使用，离开请带走个人物品',zones:paid?['quiet','discussion','booth']:['quiet'],extras:['饮水','卫生间','空调'],laptopFriendly:true,deskFits:true};
 const assumedFields=[];
 for(const [field,value] of Object.entries(assumptions)){
  const current=p[field];
  // Existing false permission flags without evidence mean unverified, not a negative finding.
  const permissionUnknown=['laptopFriendly','deskFits'].includes(field)&&!p.evidence?.[field];
  if(current==null||current===''||current==='unknown'||/待确认|待到访|尚无|尚未核实/.test(String(current))||(Array.isArray(current)&&!current.length)||permissionUnknown){p[field]=value;assumedFields.push(field);}
 }
 p.demo=false;p.targetPreview={assumedFields,note:'目标状态设想，未经核实',sourceId:id};
 // Never attach genuine source URLs or fabricated visit evidence to assumed conditions.
 p.evidence={...known.evidence};for(const field of assumedFields)delete p.evidence[field];
 p.leadSources=[...(known.leadSources||[]),{url:known.sourceUrl,note:'仓库已有基础资料来源，仅支持原记录；不支持目标状态设想字段',checkedAt:known.sourceDate,kind:'基础资料'}];
 raw.prepare('INSERT INTO places VALUES(?,?,?,?,?,?,?,?)').run(id,'showcase-author','showcase-'+i,JSON.stringify(p),'published','目标状态设想，未经核实',now,now);
});
const vars=existsSync(resolve(root,'site-preview/.dev.vars'))?readFileSync(resolve(root,'site-preview/.dev.vars'),'utf8'):'';
const key=(vars.match(/^TENCENT_MAP_KEY\s*=\s*(.+)$/m)?.[1]||'').trim().replace(/^['"]|['"]$/g,'');
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:8863');if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');const response=await handle(new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),{db,seedDiscovery:false,mapCredentials:{key}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}const base=resolve(root,'site-preview/public');let file=resolve(base,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(base+'/')&&file!==base){res.writeHead(403);res.end();return;}if(!existsSync(file)||statSync(file).isDirectory())file=resolve(base,'client-shell.html');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});let content=readFileSync(file);if(extname(file)==='.js'){content=Buffer.from(content.toString().replaceAll('真实地点 · 持续核实','上海 · 灵活办公').replaceAll('地点来自腾讯位置服务。标为「待核实」的地点，尚未确认电脑办公条件。','从费用、位置和办公条件，找到适合今天的座位。').replaceAll('真实地点坐标来自腾讯；办公条件与入口请另行核对。','地点基础资料来自仓库记录；出行前请向场地方确认。').replaceAll('示例地点不代表真实商家；社区地点请结合来源与到访反馈判断。','出行前请向场地方确认办公条件与使用规则。').replaceAll('社区收录','地点资料').replaceAll('预算按来源估算，请以现场规则为准','具体费用与使用规则以场地方信息为准').replaceAll('已审核办公条件','目标办公条件').replaceAll('空间示意插画，非地点实景','空间示意插画，非地点实景'));}if(extname(file)==='.html')content=Buffer.from(content.toString().replace('<body>', '<body><div style="position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;isolation:isolate;padding:6px 14px;border:1px solid #e4d5a6;border-radius:6px;background:#fff9e8;color:#66501a;font:12px/1.4 sans-serif;pointer-events:none;white-space:nowrap">目标效果，部分条件为设想</div>'));res.end(content);}catch(e){console.error(e.message);res.writeHead(500);res.end('Local demo error');}}).listen(8863,'127.0.0.1',()=>console.log('README demo: http://127.0.0.1:8863/ — 8 repository places with target-state assumptions, isolated memory database, anonymous session'));
