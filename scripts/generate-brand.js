const fs=require('node:fs');const path=require('node:path');const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'brand'),assets=path.join(root,'apps/client/src/static/brand');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(assets,{recursive:true});
const font={loadSystemFonts:false,fontFiles:['/System/Library/Fonts/Hiragino Sans GB.ttc','/System/Library/Fonts/Supplemental/Arial.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Supplemental/Arial Italic.ttf'],defaultFontFamily:'Hiragino Sans GB W3'};
// 流线形成椅背与坐面，落地的两条支撑保留座位识别。
const chair='<path d="M96 27C75 12 51 15 40 29C30 43 34 60 39 73C42 82 49 86 60 86H98M47 86L34 113M84 86L98 113"/>';
const signal='<path d="M30 30Q64 3 98 30M43 44Q64 27 85 44M46 82V60H82V82ZM28 94H100M36 94L30 113M92 94L98 113"/>';
const pin='<path d="M64 114C48 95 23 70 23 48A41 41 0 0 1 105 48C105 70 80 95 64 114Z"/><path d="M48 63V40H80V63ZM41 73H87"/>';
const group=(body,color='#111')=>'<g fill="none" stroke="'+color+'" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round">'+body+'</g>';
const svg=(w,h,content)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+content+'</svg>';
function write(name,source,width){const resvg=new Resvg(source,{font,fitTo:{mode:'width',value:width}});fs.writeFileSync(path.join(out,name+'.svg'),resvg.toString());fs.writeFileSync(path.join(out,name+'.png'),resvg.render().asPng());}
for(const [name,body] of [['logo-icon',chair],['option-signal',signal],['option-pin',pin]])write(name,svg(128,128,group(body)),1024);
write('logo-icon-white',svg(128,128,group(chair,'#fff')),1024);
const word='<text x="150" y="65" font-family="Arial" font-style="italic" font-size="48" fill="#111">flow</text><text x="243" y="65" font-family="Arial" font-weight="700" font-size="48" fill="#111">seat</text><text x="153" y="98" font-family="Hiragino Sans GB W6" font-size="20" fill="#111">流动工位</text>';
const lockup=svg(390,128,group(chair)+word);fs.writeFileSync(path.join(out,'logo-horizontal-editable.svg'),lockup);write('logo-horizontal',lockup,1560);
const appInner='<rect width="128" height="128" rx="28" fill="#111"/><g transform="translate(13 9) scale(.78)">'+group(chair,'#fff')+'</g>';
write('app-icon',svg(128,128,appInner),1024);
for(const size of [24,32,64,128,512])fs.writeFileSync(path.join(out,'logo-icon-'+size+'.png'),new Resvg(svg(128,128,group(chair)),{fitTo:{mode:'width',value:size}}).render().asPng());
let board='<rect width="1600" height="1080" fill="#fff"/><text x="80" y="62" font-family="Arial" font-size="13" letter-spacing="3" fill="#888">FLOWSEAT / BRAND DIRECTION</text><path d="M80 90H1520" stroke="#ddd"/>';
board+='<g transform="translate(110 156) scale(1.9)">'+group(chair)+'</g><text x="460" y="250" font-family="Arial" font-style="italic" font-size="100" fill="#111">flow</text><text x="653" y="250" font-family="Arial" font-weight="700" font-size="100" fill="#111">seat</text><text x="465" y="310" font-family="Hiragino Sans GB W6" font-size="35" fill="#111">流动工位</text><text x="466" y="364" font-family="Arial" font-size="23" fill="#444">Find your seat. Find your flow.</text><text x="466" y="403" font-family="Arial" font-size="15" fill="#888">Laptop-friendly places for freelancers, remote workers &amp; solo founders.</text>';
board+='<g transform="translate(1240 175) scale(1.2)">'+appInner+'</g><text x="1230" y="365" font-family="Arial" font-size="11" letter-spacing="1" fill="#999">APP ICON / MONOCHROME</text><path d="M80 468H1520" stroke="#ddd"/>';
const options=[['A','流线座椅',chair,'坐下来，让工作进入心流'],['B','信号工位',signal,'连接、电脑、可工作的座位'],['C','地图工位',pin,'位置、发现、工作空间']];
options.forEach(([letter,title,body,note],i)=>{const x=80+i*495;board+='<rect x="'+x+'" y="530" width="450" height="325" fill="#f6f6f6"/><text x="'+(x+24)+'" y="570" font-family="Arial" font-size="14" fill="#999">'+letter+(i===0?' / SELECTED':'')+'</text><g transform="translate('+(x+155)+' 590) scale(1.05)">'+group(body)+'</g><text x="'+(x+24)+'" y="792" font-family="Hiragino Sans GB W6" font-size="23" fill="#111">'+title+'</text><text x="'+(x+24)+'" y="828" font-family="Hiragino Sans GB W3" font-size="15" fill="#888">'+note+'</text>';});
board+='<text x="80" y="930" font-family="Arial" font-size="12" letter-spacing="2" fill="#888">SMALL-SIZE CHECK</text>';
for(const [size,x] of [[24,80],[32,145],[48,220],[64,320]])board+='<g transform="translate('+x+' 955) scale('+(size/128)+')">'+group(chair)+'</g>';
board+='<text x="1520" y="1022" text-anchor="end" font-family="Hiragino Sans GB W3" font-size="14" fill="#999">黑白矢量 / 网页 · 小程序 · App</text>';
write('logo-board',svg(1600,1080,board),1600);
for(const name of ['logo-icon.svg','logo-icon.png','logo-icon-32.png','logo-icon-white.svg','logo-horizontal.svg','app-icon.png'])fs.copyFileSync(path.join(out,name),path.join(assets,name));
console.log('已生成 FlowSeat 流线座椅品牌素材；成品 SVG 已转路径。');
