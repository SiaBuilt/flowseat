<script setup lang="ts">
defineProps<{name:string}>();
</script>
<template>
 <!-- #ifdef H5 -->
 <image class="app-icon" :src="'/static/icons/'+name+'.svg'" mode="aspectFit" aria-hidden="true"/>
 <!-- #endif -->
 <!-- #ifndef H5 -->
 <image class="app-icon" :src="'/static/icons/'+name+'.png'" mode="aspectFit" aria-hidden="true"/>
 <!-- #endif -->
</template>
