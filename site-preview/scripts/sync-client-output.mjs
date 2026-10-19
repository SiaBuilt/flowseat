import {cpSync,mkdirSync,rmSync,copyFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd(),src=resolve(root,'client/dist/build/h5'),dst=resolve(root,'public');
if(!existsSync(resolve(src,'index.html')))throw new Error('Build the uni-app client first.');
mkdirSync(dst,{recursive:true});for(const name of ['assets','static']){rmSync(resolve(dst,name),{recursive:true,force:true});cpSync(resolve(src,name),resolve(dst,name),{recursive:true});}
copyFileSync(resolve(src,'index.html'),resolve(dst,'client-shell.html'));
