import {cpSync,rmSync,renameSync} from 'node:fs';
cpSync('dist/build/h5','web-output',{recursive:true});
rmSync('dist',{recursive:true,force:true});
renameSync('web-output','dist');
