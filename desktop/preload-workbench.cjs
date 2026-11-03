'use strict';
const {ipcRenderer}=require('electron');
const origins=new Set(['https://dialogue-atelier-7024.biopics-paws-0c.chatgpt.site','https://dialogue-atelier-7024.candidkoala259.chatgpt.site']);
if(origins.has(location.origin)&&process.isMainFrame){
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.source!=='DW_WS_REQUEST')return;
  const {requestId,command,payload,extensionId}=event.data;
  if(extensionId&&extensionId!=='dialogue-desktop-v1')return;
  if(typeof requestId!=='string'||requestId.length>150||!['STATUS','OPEN','SEND','RECEIPT'].includes(command))return;
  let result;try{result=await ipcRenderer.invoke('desktop:relay',{command,payload})}catch{result={ok:false,error:'桌面连接暂时不可用，请查看顶部连接状态。'}}
  window.postMessage({source:'DW_WS_RESPONSE',extensionId:'dialogue-desktop-v1',requestId,result},location.origin);
 });
}
