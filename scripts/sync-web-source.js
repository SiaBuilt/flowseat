const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const client=path.join(root,'apps/client');
const site=path.join(root,'site-preview');
const built=path.join(client,'dist/build/h5');
if(!fs.existsSync(path.join(built,'index.html')))throw new Error('请先执行 npm run build:web');
for(const folder of ['assets','static']){const dst=path.join(site,'public',folder);fs.rmSync(dst,{recursive:true,force:true});fs.cpSync(path.join(built,folder),dst,{recursive:true});}
fs.copyFileSync(path.join(built,'index.html'),path.join(site,'public/client-shell.html'));
for(const name of ['src','package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html']){const dst=path.join(site,'client',name);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.rmSync(dst,{recursive:true,force:true});fs.cpSync(path.join(client,name),dst,{recursive:true});}
console.log('已同步 uni-app 源码与 Web 产物，未复制依赖、数据库和本地环境变量。');
