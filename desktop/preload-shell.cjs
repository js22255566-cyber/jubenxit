'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['status','bind','unbind','diagnose','split','workbench','whatsapp','reload','reload-wa','browser']);
contextBridge.exposeInMainWorld('atelier',{command:action=>allowed.has(action)?ipcRenderer.invoke('desktop:control',action):Promise.reject(Error('Unsupported command')),notice:(title,text)=>ipcRenderer.invoke('desktop:notice',{title:String(title).slice(0,100),text:String(text).slice(0,6000)})});
