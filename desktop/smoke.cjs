'use strict';
// Hidden local-only Electron check. It never loads the hosted workbench or WhatsApp.
const {app,BrowserWindow,WebContentsView,ipcMain,safeStorage,session}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=path.join(__dirname,'.smoke-output');fs.mkdirSync(path.join(output,'profile'),{recursive:true});app.setPath('userData',path.join(output,'profile'));app.commandLine.appendSwitch('disable-background-networking');
let win;const deadline=setTimeout(()=>{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:false,error:'Offline Electron smoke timeout'}));app.exit(1)},20000);
app.whenReady().then(async()=>{
 session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
 win=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 const wa=new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,preload:path.join(__dirname,'generated/whatsapp-preload.cjs')}});win.contentView.addChildView(wa);wa.setBounds({x:0,y:0,width:600,height:600});
 await wa.webContents.loadURL('data:text/html,<html><body><p>Isolated fictional fixture</p></body></html>');
 const result=await new Promise((resolve,reject)=>{ipcMain.once('desktop:wa-response',(event,response)=>{try{assert.equal(event.sender,wa.webContents);assert.equal(response.id,'offline-check');resolve(response.result)}catch(e){reject(e)}});wa.webContents.send('desktop:wa-request',{id:'offline-check',message:{type:'DIAGNOSE'}})});
 assert.equal(result.ok,true);assert.equal(result.diagnostics.chatPanelFound,false);
 const security=await wa.webContents.executeJavaScript('({node:typeof require,bridge:typeof window.atelier,href:location.protocol})');assert.equal(security.node,'undefined');assert.equal(security.bridge,'undefined');assert.equal(security.href,'data:');
 const summary={ok:true,electron:process.versions.electron,chromium:process.versions.chrome,sandbox:true,contextIsolation:true,nodeIntegration:false,localPreloadRoundTrip:true,safeStorageAvailable:safeStorage.isEncryptionAvailable(),realNetwork:false};
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(summary,null,2));clearTimeout(deadline);wa.webContents.close();win.destroy();app.exit(0);
}).catch(error=>{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:false,error:error.message}));clearTimeout(deadline);if(win&&!win.isDestroyed())win.destroy();app.exit(1)});
