<script setup lang="ts">
import {ref,reactive} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import ActionButton from '../../components/ActionButton.vue';
import {request,errorMessage} from '../../services/api';
import {merchantLabels,merchantValue} from '../../domain/merchant';
import {notify} from '../../adapters/platform';
type Field={key:string;label:string;current:unknown;budget?:string};
const token=ref(''),loading=ref(true),error=ref(''),busy=ref(false),done=ref(false);
const place=ref<{name:string;address:string;district:string;type:string}>(),fields=ref<Field[]>([]),expiresAt=ref(0);
// 每项三态：未处理 / 与现状一致 / 更正为新值；未处理的项不提交。
const mode=reactive<Record<string,''|'same'|'fix'>>({}),answers=reactive<Record<string,any>>({}),contact=ref(''),note=ref('');
const choices:Record<string,{value:any;label:string}[]>={
 laptopFriendly:[{value:true,label:'允许电脑办公'},{value:false,label:'不允许'}],
 deskFits:[{value:true,label:'电脑和鼠标放得下'},{value:false,label:'放不下'}],
 wifi:[{value:true,label:'提供 Wi-Fi'},{value:false,label:'不提供'}],
 plugs:['0 个','1—5 个','6—10 个','10 个以上'].map(value=>({value,label:value})),
 cost:[{value:'free',label:'免费'},{value:'purchase',label:'需消费'},{value:'paid',label:'付费工位'}]
};
const known=(f:Field)=>f.current!==null&&f.current!==''&&f.current!=='unknown'&&!/待确认|未知|不详/.test(String(f.current));
onLoad(async options=>{token.value=String(options?.token||'');if(!token.value){error.value='链接不完整，请向流动工位索取新的确认链接。';loading.value=false;return;}
 try{const r=await request('merchant/'+encodeURIComponent(token.value));place.value=r.place;fields.value=r.fields;expiresAt.value=r.expiresAt;for(const f of r.fields as Field[]){mode[f.key]='';answers[f.key]='';if(f.key==='cost')answers.budget=f.budget&&!/待确认/.test(f.budget)?f.budget:'';}}
 catch(e){error.value=errorMessage(e);}finally{loading.value=false;}});
function pickMode(f:Field,m:'same'|'fix'){mode[f.key]=mode[f.key]===m?'':m;if(m==='same')answers[f.key]=f.current;else answers[f.key]=f.key==='cost'||choices[f.key]?'':(known(f)?String(f.current):'');}
function choose(key:string,value:unknown){answers[key]=value;if(key==='cost'&&value==='free')answers.budget='¥0';}
async function submit(){if(busy.value)return;const picked=fields.value.filter(f=>mode[f.key]&&answers[f.key]!==''&&answers[f.key]!=null);if(!picked.length){notify('请至少确认或更正一项');return;}if(contact.value.trim().length<2){notify('请填写你的称呼或职务');return;}
 const body:Record<string,any>={};for(const f of picked)body[f.key]=answers[f.key];if(body.cost)body.budget=answers.budget;
 busy.value=true;error.value='';try{await request('merchant/'+encodeURIComponent(token.value),'POST',{answers:body,contact:contact.value.trim(),note:note.value.trim()});done.value=true;}catch(e){error.value=errorMessage(e);}finally{busy.value=false;}}
</script>
<template><view class="shell form-shell"><view class="topbar"><view class="brand"><image class="brand-mark" src="/static/brand/logo-icon.png"/><view class="brand-words"><text>流动工位</text><text class="brand-sub">FlowSeat</text></view></view></view>
<view v-if="loading" class="notice">正在读取确认信息…</view>
<view v-else-if="done" class="success-state"><view class="success-mark">✓</view><view class="section-title">谢谢，已收到你的确认。</view><view class="description">信息会先经过审核，通过后以「商家自述」展示在地点的信息来源中。<text class="line-break"> </text>这条链接已失效，如需再次修改请联系流动工位。</view></view>
<view v-else-if="error&&!place" class="success-state"><view class="section-title">这条链接无法使用</view><view class="description">{{error}}<text class="line-break"> </text>确认链接 14 天内有效、只能提交一次。</view></view>
<view v-else-if="place" class="contribute-layout"><view class="form-intro"><view class="small-tag">For the people who host the work.</view><view class="headline">{{place.name}}</view><view class="description">{{place.district}} · {{place.type}}<text class="line-break"> </text>{{place.address}}</view><view class="notice">流动工位帮助自由职业者和远程工作者找到适合带电脑工作的地方。请逐项确认我们目前记录的信息：一致就点「与现状一致」，不对就点「更正」。不确定的项可以跳过。</view><view class="meta">商家自述，审核后展示，不等于独立实测。不需要登录，不收集手机号；链接有效至 {{new Date(expiresAt).toLocaleDateString()}}，只能提交一次。</view></view>
<view class="form-content"><view class="section-title">确认场地信息</view>
<view v-for="f in fields" :key="f.key" class="evidence-row"><view class="row"><text class="amenity-title">{{merchantLabels[f.key]||f.label}}</text><text class="meta">目前记录：{{merchantValue(f.key,f.current)}}<text v-if="f.key==='cost'&&f.budget&&!/待确认/.test(f.budget)">（{{f.budget}}）</text></text></view>
 <view class="chips"><ActionButton v-if="known(f)" class="option" :class="{active:mode[f.key]==='same'}" @click="pickMode(f,'same')">与现状一致</ActionButton><ActionButton class="option" :class="{active:mode[f.key]==='fix'}" @click="pickMode(f,'fix')">{{known(f)?'更正':'补充'}}</ActionButton></view>
 <template v-if="mode[f.key]==='fix'">
  <view v-if="choices[f.key]" class="option-grid"><ActionButton v-for="c in choices[f.key]" :key="String(c.value)" class="option" :class="{active:answers[f.key]===c.value}" @click="choose(f.key,c.value)">{{c.label}}</ActionButton></view>
  <input v-else v-model="answers[f.key]" class="form-input" maxlength="100" :placeholder="f.key==='hours'?'例如：周一至周日 08:00—22:00':'例如：直接进入，无需预约'"/>
  <input v-if="f.key==='cost'" v-model="answers.budget" class="form-input" maxlength="70" placeholder="预算与单位，例如：饮品 ¥30 起 / 按小时 ¥15"/>
 </template>
</view>
<label class="field-label">你的称呼或职务 *</label><input v-model="contact" class="form-input" maxlength="40" placeholder="例如：店长 王 / 社区经理"/>
<label class="field-label">补充说明</label><textarea v-model="note" class="form-textarea short" maxlength="240" placeholder="可选：高峰时段、电脑办公的限制、预约方式等"/>
<view v-if="error" class="error-box" role="alert">{{error}}</view>
<ActionButton class="black-button" :disabled="busy" @click="submit">{{busy?'正在提交…':'提交确认'}}</ActionButton></view></view>
</view></template>
