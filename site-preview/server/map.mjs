import {fail} from './validation.mjs';

export function publicMapConfig({key=''}={}){
 return key.trim()?{enabled:true,provider:'tencent',serviceHost:'/api/_TMapService'}:{enabled:false,provider:'tencent'};
}
export async function proxyMap(request,{key=''}={},fetcher=fetch){
 if(!key.trim())fail(503,'地图服务暂未开放');
 if(request.method!=='GET')fail(405,'地图服务仅支持读取');
 const incoming=new URL(request.url),origin=request.headers.get('origin');
 if((origin&&origin!==incoming.origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'请从本站打开地图');
 if(incoming.search.length>5000)fail(400,'地图请求过长');
 const prefix='/api/_TMapService';
 if(incoming.pathname!==prefix&&!incoming.pathname.startsWith(prefix+'/'))fail(404,'地图路径无效');
 let path;try{path=decodeURIComponent(incoming.pathname.slice(prefix.length));}catch{fail(400,'地图路径无效');}
 if(!/^[a-zA-Z0-9_./-]*$/.test(path)||path.split('/').some(s=>s==='.'||s==='..')||path.includes('//'))fail(400,'地图路径无效');
 const params=new URLSearchParams(incoming.search);params.delete('key');params.delete('apikey');
 for(const field of ['callback','jsonp','cb'])for(const value of params.getAll(field))if(!/^[a-zA-Z_$][a-zA-Z0-9_$.]{0,120}$/.test(value))fail(400,'地图回调格式无效');
 let target;
 if(path===''||path==='/'){target=new URL('https://pr.map.qq.com/pingd');params.set('appid','jsapi_v3');params.set('key',key.trim());}
 else if(path==='/checkKey'){target=new URL('https://apikey.map.qq.com/mkey/index.php/mkey/check');params.set('key',key.trim());}
 else if(path==='/oversea'||path.startsWith('/oversea/')){target=new URL('https://overseactrl.map.qq.com'+path.slice('/oversea'.length));params.set('apikey',key.trim());}
 else if(path==='/service'||path.startsWith('/service/')){target=new URL('https://apis.map.qq.com/ws'+path.slice('/service'.length));params.set('key',key.trim());}
 else fail(404,'地图路径无效');
 target.search=params.toString();
 let upstream;try{upstream=await fetcher(target.href,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Referer:incoming.origin+'/'}});}catch(error){const detail=String(error?.message||'unknown').split(key.trim()).join('[redacted]').replace(/https?:\/\/[^\s]+/g,'[upstream]').slice(0,180);console.warn('Map upstream connection failure',target.hostname,detail);fail(502,'地图服务连接失败，请稍后重试');}
 if(!upstream.ok||!upstream.body)fail(502,'地图服务暂不可用');
 const type=upstream.headers.get('content-type')||'application/json';
 if(!/^(application\/(json|javascript|octet-stream)|text\/(javascript|plain)|image\/)/i.test(type))fail(502,'地图响应格式无效');
 const reader=upstream.body.getReader(),chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();fail(502,'地图响应过大');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
