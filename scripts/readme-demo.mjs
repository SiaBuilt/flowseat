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
const now=Date.now(),today=new Date(now+8*3600000).toISOString().slice(0,10);
const rows=[
 ['晨光书桌 · 演示','咖啡馆','静安','purchase','¥32–45','1 人 · 一杯饮品；可停留 3 小时',121.451,31.228,'09:00—21:00','6—10 个','舒适',['quiet','discussion']],
 ['林间阅览室 · 演示','公共空间','徐汇','free','¥0','空间使用免费，无需消费',121.439,31.206,'09:00—20:00','6—10 个','舒适',['quiet']],
 ['共坐工作社 · 演示','联合办公','黄浦','paid','¥88 / 天','开放工位日票，含饮水与独立通话间',121.476,31.218,'08:30—21:30','10 个以上','超舒适',['quiet','discussion','booth']],
 ['北窗自习所 · 演示','自习室','长宁','paid','¥28 / 2 小时','按时段使用；全天票 ¥68',121.421,31.221,'08:00—23:00','10 个以上','舒适',['quiet']],
 ['河畔慢咖啡 · 演示','咖啡馆','虹口','purchase','¥28–38','1 人 · 一杯饮品；工作日不限时',121.489,31.253,'08:00—20:00','1—5 个','硬座',['quiet','discussion']],
 ['一页公共书房 · 演示','图书馆','杨浦','free','¥0','免费阅读与办公；入场无需预约',121.514,31.270,'09:00—20:30','6—10 个','舒适',['quiet']],
 ['岛屿共享客厅 · 演示','联合办公','浦东','paid','¥68 / 天','日票含工位与茶水，会议室另计',121.531,31.229,'09:00—21:00','10 个以上','超舒适',['quiet','discussion','booth']],
 ['午后灯塔 · 演示','咖啡馆','静安','purchase','¥30–42','1 人 · 一杯饮品；高峰时段限 2 小时',121.458,31.247,'10:00—22:00','6—10 个','舒适',['quiet','discussion']]
];
raw.prepare('INSERT INTO profiles VALUES(?,?,?)').run('showcase-author','FlowSeat 虚构演示',now);
rows.forEach((r,i)=>{const [name,type,district,cost,budget,basis,lng,lat,hours,plugs,chair,zones]=r;const p={name,type,district,cost,budget,basis,price:budget,address:`虚构演示地址 ${i+1} 号 · 请勿前往`,sourceUrl:'https://example.com/flowseat-demo',sourceDate:today,plugs,charging:'靠窗与长桌座位可充电',chair,chairNote:chair==='硬座'?'木质座椅，带靠背':'带靠背与软垫，适合较长时间工作',wifi:true,hours,entry:type==='联合办公'||type==='自习室'?'提前预约，前台核验入场':'开放时段直接进入',stay:cost==='paid'?'按所购时长使用，可临时离座':cost==='free'?'开放时段内使用，离开请带走个人物品':'工作日可办公；高峰时段遵守店内停留规则',zones,extras:['饮水','卫生间','空调'],laptopFriendly:true,deskFits:true,drawing:(i%4)+1,demo:false,location:{lng,lat,system:'GCJ-02'},evidence:Object.fromEntries(['cost','hours','laptopFriendly','deskFits'].map(f=>[f,{kind:'public',date:today,url:'https://example.com/flowseat-demo',note:'仅用于产品功能演示，非真实地点核实'}]))};raw.prepare('INSERT INTO places VALUES(?,?,?,?,?,?,?,?)').run('showcase-'+(i+1),'showcase-author','showcase-'+i,JSON.stringify(p),'published','虚构演示数据，请勿出行',now,now);});
const vars=existsSync(resolve(root,'site-preview/.dev.vars'))?readFileSync(resolve(root,'site-preview/.dev.vars'),'utf8'):'';
const key=(vars.match(/^TENCENT_MAP_KEY\s*=\s*(.+)$/m)?.[1]||'').trim().replace(/^['"]|['"]$/g,'');
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:8863');if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');const response=await handle(new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),{db,seedDiscovery:false,mapCredentials:{key}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}const base=resolve(root,'site-preview/public');let file=resolve(base,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(base+'/')&&file!==base){res.writeHead(403);res.end();return;}if(!existsSync(file)||statSync(file).isDirectory())file=resolve(base,'client-shell.html');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});let content=readFileSync(file);if(extname(file)==='.js'){content=Buffer.from(content.toString().replaceAll('真实地点 · 持续核实','虚构地点 · 产品演示').replaceAll('地点来自腾讯位置服务。标为「待核实」的地点，尚未确认电脑办公条件。','以下地点、费用与设施均为虚构演示数据，请勿据此前往。').replaceAll('真实地点坐标来自腾讯；办公条件与入口请另行核对。','地图点位仅用于交互演示，不代表真实店铺，不用于出行导航。').replaceAll('社区收录','演示收录').replaceAll('空间示意插画，非地点实景','虚构空间示意插画，非真实地点'));}res.end(content);}catch(e){console.error(e.message);res.writeHead(500);res.end('Local demo error');}}).listen(8863,'127.0.0.1',()=>console.log('README demo: http://127.0.0.1:8863/ — 8 fictional places, isolated memory database, anonymous session'));
