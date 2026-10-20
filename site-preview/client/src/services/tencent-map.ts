export type MapConfig={enabled:boolean;provider?:string;serviceHost?:string};
let sdk:Promise<any>|undefined;
export function loadTencentMap(config:MapConfig):Promise<any>{
 // #ifdef H5
 if(sdk)return sdk;
 if(!config.enabled||config.provider!=='tencent'||config.serviceHost!=='/api/_TMapService')return Promise.reject(new Error('地图服务暂未开放'));
 sdk=new Promise((resolve,reject)=>{
  const browser=window as any;
  if(browser.TMap){resolve(browser.TMap);return;}
  browser._TMapSecurityConfig={serviceHost:window.location.origin+config.serviceHost};
  const script=document.createElement('script');script.async=true;script.src='https://map.qq.com/api/gljs?v=1.exp';
  const timer=setTimeout(()=>failed(),12000);
  function failed(){clearTimeout(timer);script.remove();sdk=undefined;reject(new Error('地图加载失败，请检查网络后重试'));}
  script.onerror=failed;script.onload=()=>{clearTimeout(timer);if(browser.TMap)resolve(browser.TMap);else failed();};document.head.appendChild(script);
 });return sdk;
 // #endif
 // #ifndef H5
 return Promise.reject(new Error('当前终端地图尚未配置'));
 // #endif
}
