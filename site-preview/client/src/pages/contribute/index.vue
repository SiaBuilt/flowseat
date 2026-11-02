<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';
import {coreFields,evidenceKinds,type FieldEvidence} from '../../domain/place';
import {reactive,ref,watch} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import ActionButton from '../../components/ActionButton.vue';
import {request,loadSession,session,signIn,errorMessage} from '../../services/api';
import {notify} from '../../adapters/platform';
const editing=ref(''),error=ref(''),busy=ref(false),done=ref(false),hidden=ref(false),extra=ref(false),loaded=ref(false),loadError=ref('');
const regions=['静安','徐汇','黄浦','长宁','浦东','普陀','虹口','杨浦','闵行','宝山','嘉定','松江','青浦','奉贤','金山','崇明'];
const types=['咖啡馆','公共空间','联合办公','自习室','图书馆','其他'];
const costs=[{key:'unknown',label:'待确认'},{key:'free',label:'免费'},{key:'purchase',label:'需消费'},{key:'paid',label:'付费工位'}];
const initial=()=>({name:'',address:'',district:'静安',type:'咖啡馆',cost:'unknown',budget:'费用待确认',basis:'',sourceUrl:'',sourceDate:new Date().toLocaleDateString('sv-SE'),menuUrl:'',laptopFriendly:false,deskFits:false,plugs:'待确认',chair:'待确认',wifi:null as boolean|null,hours:'',entry:'',stay:'',zones:[] as string[],evidence:{} as Record<string,FieldEvidence>});
const form=reactive(initial());
const longitude=ref(''),latitude=ref('');

onLoad(options=>{editing.value=String(options?.id||'');void loadForm();});
async function loadForm(){
 loaded.value=false;loadError.value='';
 try{
  await loadSession();
  if(editing.value){
   const own=(await request('contributions')).places.map((r:any)=>({...r.payload,id:r.id,reviewStatus:r.status}));
   let p=own.find((p:any)=>p.id===editing.value);
   if(!p&&session.value?.canReview)p=(await request('review-queue')).places.find((p:any)=>p.id===editing.value);
   if(!p)throw new Error('找不到可编辑的投稿');
   Object.assign(form,p);hidden.value=p.reviewStatus==='hidden';
   if(p.location){longitude.value=String(p.location.lng);latitude.value=String(p.location.lat);extra.value=true;}
  }else{
   const draft=uni.getStorageSync('flowseat-place-draft');
   if(draft&&typeof draft==='object'){Object.assign(form,draft);longitude.value=draft.longitude||'';latitude.value=draft.latitude||'';}
  }
 }catch(e){loadError.value=errorMessage(e);}finally{loaded.value=true;}
}
watch([form,longitude,latitude],()=>{if(loaded.value&&!editing.value&&!done.value)uni.setStorageSync('flowseat-place-draft',{...form,longitude:longitude.value,latitude:latitude.value});},{deep:true});
function addEvidence(field:string){form.evidence[field]={kind:'public',url:form.sourceUrl,date:form.sourceDate,note:''};}
function back(){uni.reLaunch({url:'/pages/index/index'});}
function pick(field:'district'|'type'|'plugs'|'chair',list:string[],e:{detail:{value:string|number}}){form[field]=list[Number(e.detail.value)];}
function zone(z:string){form.zones=form.zones.includes(z)?form.zones.filter(x=>x!==z):form.zones.concat(z);}
async function submit(){if(!loaded.value||loadError.value||busy.value)return;error.value='';if(!session.value){signIn();return;}if(!session.value.displayName){error.value='请先到“我的”设置贡献署名。';return;}if(!form.name.trim()||!form.address.trim()||!form.sourceUrl.trim()){error.value='请填写地点名称、详细地址和公开来源链接。';return;}busy.value=true;try{await request(editing.value?'submissions/'+editing.value:'submissions',editing.value?'PUT':'POST',{...form,location:longitude.value.trim()||latitude.value.trim()?{lng:longitude.value.trim()?Number(longitude.value):null,lat:latitude.value.trim()?Number(latitude.value):null,system:'GCJ-02'}:null});done.value=true;uni.removeStorageSync('flowseat-place-draft');}catch(e){error.value=errorMessage(e);}finally{busy.value=false;}}
function profile(){uni.navigateTo({url:'/pages/me/index'});}
function contributions(){uni.navigateTo({url:'/pages/me/index?tab='+(hidden.value?'review':'contributions')});}
</script>
<template><view class="shell form-shell"><view class="topbar"><ActionButton class="brand" @click="back"><image class="brand-mark" src="/static/brand/logo-icon.png"/><view class="brand-words"><text>流动工位</text><text class="brand-sub">FlowSeat</text></view></ActionButton><ActionButton class="text-button" @click="back">返回探索</ActionButton></view>
<view v-if="done" class="success-state"><view class="success-mark">✓</view><view class="section-title">{{hidden?'资料已保存，地点仍保持隐藏。':'谢谢，新的好工位有线索了。'}}</view><view class="description">{{hidden?'请回到快速审核核对新依据，再决定是否恢复展示。':'投稿已保存到云端，审核通过后会展示你的贡献署名。'}}<text class="line-break"> </text>{{hidden?'恢复前仍不会出现在探索列表。':'可以在“我的贡献”查看进度和修改建议。'}}</view><view class="chips"><ActionButton class="black-button" @click="contributions">{{hidden?'返回快速审核':'查看我的贡献'}}</ActionButton><ActionButton class="outline-button" @click="back">返回探索</ActionButton></view></view>
<view v-else-if="!loaded" class="notice" role="status">正在读取投稿资料…</view>
<view v-else-if="loadError" class="error-box" role="alert">{{loadError}}<view class="chips"><ActionButton class="underlink" @click="loadForm">重新加载</ActionButton><ActionButton class="underlink" @click="back">返回探索</ActionButton></view></view>
<view v-else class="contribute-layout"><view class="form-intro"><view class="small-tag">Built by people who work anywhere.</view><view class="headline">好工位，<text class="line-break"> </text>值得被看见。</view><view class="description">推荐一个允许电脑办公的地方。<text class="line-break"> </text>不确定的条件留为待确认，<text class="line-break"> </text>公开来源和到访体验都能成为线索。</view><view class="notice">不复制其他平台的评论正文，不公开 Wi-Fi 密码或个人联系方式。提交的地点信息会经过审核。</view><view class="meta">{{editing?'正在编辑投稿':'内容会在本机自动保存为草稿'}}。</view></view><view class="form-content"><view class="section-title">{{editing?'补充地点信息':'推荐一个工位'}}</view><view v-if="!session" class="notice">请先登录并设置贡献署名。<ActionButton class="underlink" @click="signIn">使用 ChatGPT 登录</ActionButton></view>
<view v-if="session&&!session.displayName" class="notice">投稿前请先设置贡献署名。<ActionButton class="underlink" @click="profile">去设置贡献署名</ActionButton></view>
<label class="field-label">地点名称 *</label><input v-model="form.name" class="form-input" maxlength="70" placeholder="例如：某某咖啡（静安店）"/>
<label class="field-label">上海详细地址 *</label><input v-model="form.address" class="form-input" maxlength="160" placeholder="路名、门牌号、楼层；不要只填商场名"/>
<view class="form-two"><view><view class="field-label">片区</view><picker :range="regions" @change="pick('district',regions,$event)"><view class="form-input select-input">{{form.district}} ⌄</view></picker></view><view><view class="field-label">地点类型</view><picker :range="types" @change="pick('type',types,$event)"><view class="form-input select-input">{{form.type}} ⌄</view></picker></view></view>
<view class="field-label">使用费用</view><view class="option-grid"><ActionButton v-for="c in costs" :key="c.key" class="option" :class="[{active:form.cost===c.key},'tone-'+c.key]" @click="form.cost=c.key;form.budget=c.key==='free'?'¥0':'费用待确认'">{{c.label}}</ActionButton></view>
<view class="field-label">预算与单位</view><input v-model="form.budget" class="form-input" maxlength="70" placeholder="例如 ¥35 / 约 2 小时；不知道请填费用待确认"/>
<view class="field-label">消费与停留依据</view><textarea v-model="form.basis" class="form-textarea short" maxlength="200" placeholder="例如：1 杯饮品；是否可久坐、最低消费仍需确认"/>
<view class="field-label">公开来源链接 *</view><input v-model="form.sourceUrl" class="form-input" maxlength="1800" placeholder="商家官网或公开帖子，https://…"/>
<view class="field-label">来源核对 / 到访日期 *</view><input v-model="form.sourceDate" class="form-input" placeholder="YYYY-MM-DD"/>
<view class="field-label">收录门槛（确认后勾选）</view><ActionButton class="check-row" :aria-pressed="form.laptopFriendly" @click="form.laptopFriendly=!form.laptopFriendly"><text>{{form.laptopFriendly?'☑':'□'}}</text>允许使用笔记本电脑办公</ActionButton><ActionButton class="check-row" :aria-pressed="form.deskFits" @click="form.deskFits=!form.deskFits"><text>{{form.deskFits?'☑':'□'}}</text>桌面能放下电脑与鼠标</ActionButton><view class="meta">未确认的投稿会保留为候选线索，不会直接发布为合格工位。</view>
<view class="evidence-form"><view class="field-label">逐项核对依据</view><view class="meta">有依据再填写。来源核对日期不是文章发布时间；旧文章需重新确认现行规则。关键依据超过 30 天需复核。</view><view v-for="field in coreFields" :key="field.key" class="evidence-editor"><view class="row"><text>{{field.label}}</text><ActionButton class="underlink" @click="form.evidence[field.key]?delete form.evidence[field.key]:addEvidence(field.key)">{{form.evidence[field.key]?'移除依据':'补充依据 ＋'}}</ActionButton></view><template v-if="form.evidence[field.key]"><view class="option-grid"><ActionButton v-for="(label,kind) in evidenceKinds" :key="kind" class="option" :class="{active:form.evidence[field.key].kind===kind}" @click="form.evidence[field.key].kind=kind">{{label}}</ActionButton></view><input v-model="form.evidence[field.key].url" class="form-input" :aria-label="field.label+'来源链接'" placeholder="https://… 公开核对来源"/><input v-model="form.evidence[field.key].date" class="form-input" :aria-label="field.label+'核对日期'" placeholder="核对日期 YYYY-MM-DD"/><textarea v-model="form.evidence[field.key].note" class="form-textarea short" maxlength="240" :aria-label="field.label+'具体依据'" placeholder="简述来源支持的具体条件，不复制评论全文"/></template></view></view>
<ActionButton class="expand-button" :aria-expanded="extra" @click="extra=!extra">补充设施、菜单和到访规则 <text>{{extra?'−':'+'}}</text></ActionButton>
<view v-if="extra" class="extra-fields"><view class="field-label">地图坐标（选填，GCJ-02）</view><view class="form-two"><input v-model="longitude" aria-label="地图经度" class="form-input" placeholder="地图经度，例如 121.47"/><input v-model="latitude" aria-label="地图纬度" class="form-input" placeholder="地图纬度，例如 31.23"/></view><view class="meta">腾讯、高德同用 GCJ-02；仅填已核对的坐标，不混用百度或 GPS 坐标。留空也可以投稿；审核通过后用于地点导航。</view><view class="form-two"><view><view class="field-label">插座数量</view><picker :range="['待确认','0 个','1—5 个','6—10 个','10 个以上']" @change="pick('plugs',['待确认','0 个','1—5 个','6—10 个','10 个以上'],$event)"><view class="form-input select-input">{{form.plugs}} ⌄</view></picker></view><view><view class="field-label">椅子舒适度</view><picker :range="['待确认','硬座','舒适','超舒适']" @change="pick('chair',['待确认','硬座','舒适','超舒适'],$event)"><view class="form-input select-input">{{form.chair}} ⌄</view></picker></view></view><view class="field-label">Wi-Fi</view><view class="option-grid"><ActionButton v-for="v in [{key:null,label:'待确认'},{key:true,label:'有 Wi-Fi'},{key:false,label:'无 Wi-Fi'}]" :key="String(v.key)" class="option" :class="{active:form.wifi===v.key}" @click="form.wifi=v.key">{{v.label}}</ActionButton></view><view class="field-label">工作区域</view><view class="option-grid"><ActionButton v-for="z in [{key:'quiet',label:'安静工作'},{key:'discussion',label:'多人讨论'},{key:'booth',label:'独立通话'}]" :key="z.key" class="option" :class="{active:form.zones.includes(z.key)}" @click="zone(z.key)">{{z.label}}</ActionButton></view><view class="field-label">商家公开菜单链接</view><input v-model="form.menuUrl" class="form-input" placeholder="https://…（选填）"/><view class="field-label">开放时间</view><input v-model="form.hours" class="form-input" placeholder="待确认或填写具体时间"/><view class="field-label">进入方式</view><input v-model="form.entry" class="form-input" placeholder="是否需要预约、证件或购买权益"/><view class="field-label">停留规则</view><input v-model="form.stay" class="form-input" placeholder="限时、周末规则或未知"/></view>
<view v-if="error" class="error-box" role="alert">{{error}}</view><ActionButton class="black-button submit-button" :disabled="busy" @click="submit">{{busy?'正在保存…':hidden?'保存资料并保持隐藏':editing?'保存并重新审核':'提交到云端审核'}}</ActionButton><view class="meta">公开时使用你的贡献署名；未通过的内容只对你与审核员可见。</view>
</view></view></view></template>
