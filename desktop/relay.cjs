'use strict';
const vm=require('node:vm');
// Execute the shipped extension background with a narrow desktop adapter.
// This is packaged project code, never JavaScript obtained from a website.
function createRelay({background,storage,transport,siteUrl,showWhatsApp}){
 const TAB=7,ID='dialogue-desktop-v1',POPUP='desktop://bridge/popup.html';let listener;
 const chrome={storage:{local:storage},runtime:{id:ID,getURL:p=>'desktop://bridge/'+p,onMessage:{addListener:fn=>{listener=fn}}},scripting:{async executeScript(){/* Preloads are installed at navigation, not reinjected. */}},tabs:{
  async get(id){if(id!==TAB)throw Error('目标窗口不存在');return{id:TAB,url:transport.url()}},
  async query(query){return query.active?[{id:TAB,url:transport.url()}]:[]},
  async create(){showWhatsApp()},
  async sendMessage(id,message){if(id!==TAB)throw Error('目标窗口不存在');return transport.call(message)}
 }};
 vm.runInNewContext(background,{chrome,URL,setTimeout,clearTimeout,console:{log(){},error(){}}},{filename:'packaged-ws-background.js',timeout:1000});
 function call(request,popup=false){return new Promise(resolve=>{const sender=popup?{url:POPUP}:{tab:{url:siteUrl()}};try{if(!listener(request,sender,resolve))resolve({ok:false,error:'桌面连接拒绝了此来源'})}catch{resolve({ok:false,error:'桌面连接处理失败'})}})}
 return{ID,call};
}
module.exports={createRelay};
