<script setup lang="ts">
import {useAttrs,ref,onMounted,onUnmounted} from 'vue';
defineOptions({inheritAttrs:false});
const attrs=useAttrs() as Record<string,any>;
const emit=defineEmits(['click','mouseenter','mouseleave']);
const element=ref<{$el:HTMLElement}|HTMLElement>();
function activate(event:KeyboardEvent){
 // #ifdef H5
 if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&attrs.role==='tab'){
  const target=event.currentTarget as HTMLElement;
  const tabs=Array.from(target.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]')||[]) as HTMLElement[];
  const index=tabs.indexOf(target),next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
  if(next){event.preventDefault();next.focus();next.click();}return;
 }
 if(event.key!=='Enter'&&event.key!==' ')return;
 event.preventDefault();
 if(attrs.disabled===true||attrs.disabled==='')return;
 (event.currentTarget as HTMLElement).click();
 // #endif
}
// #ifdef H5
let node:HTMLElement|undefined;
const enter=()=>emit('mouseenter');
const leave=()=>emit('mouseleave');
onMounted(()=>{const value=element.value;node=value&&('$el' in value?value.$el:value);node?.addEventListener('keydown',activate);node?.addEventListener('mouseenter',enter);node?.addEventListener('mouseleave',leave);});
onUnmounted(()=>{node?.removeEventListener('keydown',activate);node?.removeEventListener('mouseenter',enter);node?.removeEventListener('mouseleave',leave);});
// #endif
</script>
<template>
 <!-- #ifdef H5 -->
 <button ref="element" v-bind="attrs" :role="String(attrs.role||'button')" :tabindex="attrs.disabled?-1:0" :aria-disabled="attrs.disabled?true:undefined" @click="emit('click',$event)"><slot/></button>
 <!-- #endif -->
 <!-- #ifndef H5 -->
 <button :class="attrs.class" :style="attrs.style" :disabled="Boolean(attrs.disabled)" :aria-label="attrs['aria-label']" @click="emit('click',$event)"><slot/></button>
 <!-- #endif -->
</template>
