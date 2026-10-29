(()=>{if(globalThis.__DW_WS_BRIDGE==='0.1.4')return;
window.addEventListener('message',async event=>{if(event.source!==window||event.origin!==location.origin||event.data?.source!=='DW_WS_REQUEST')return;if(event.data.extensionId&&event.data.extensionId!==chrome.runtime.id)return;const {requestId,command,payload}=event.data;if(typeof requestId!=='string'||!['STATUS','OPEN','SEND','RECEIPT'].includes(command))return;let result;try{result=await chrome.runtime.sendMessage({command,payload})}catch(e){result={ok:false,error:e.message}}window.postMessage({source:'DW_WS_RESPONSE',extensionId:chrome.runtime.id,requestId,result},location.origin)});

globalThis.__DW_WS_BRIDGE='0.1.4';})();
