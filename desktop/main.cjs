'use strict';
const {app,BrowserWindow,WebContentsView,ipcMain,session,shell,dialog,screen,safeStorage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const {Vault}=require('./vault.cjs');
const {createRelay}=require('./relay.cjs');
const policy=require('./policy.cjs');
app.setName('对白工坊');
app.setAppUserModelId('com.dialogueatelier.desktop');
if(!app.requestSingleInstanceLock())app.quit();
let win,workbench,wa,relay,vault,mode='workbench',shuttingDown=false,sendInFlight=null;
const requests=new Map(),shellUrl=pathToFileURL(path.join(__dirname,'shell.html')).href;
const preferences={nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,backgroundThrottling:false};
function layout(){if(!win||!workbench||!wa)return;const [width,height]=win.getContentSize(),top=110,bottom=48,h=Math.max(100,height-top-bottom);const split=mode==='split',right=Math.min(560,Math.max(360,Math.floor(width*.32)));workbench.setVisible(mode!=='whatsapp');wa.setVisible(mode!=='workbench');workbench.setBounds({x:0,y:top,width:split?width-right:width,height:h});wa.setBounds({x:split?width-right:0,y:top,width:split?right:width,height:h})}
function focusMode(next){mode=next;layout();if(next==='whatsapp')wa.webContents.focus();else workbench.webContents.focus()}
function allowedNavigation(kind,url){return kind==='workbench'?policy.trustedSite(url)||policy.auth(url):policy.whatsapp(url)}
function guard(contents,kind,partition){
 contents.on('will-navigate',(event,url)=>{if(!allowedNavigation(kind,url))event.preventDefault()});
 contents.on('will-redirect',(event,url)=>{if(!allowedNavigation(kind,url))event.preventDefault()});
 contents.setWindowOpenHandler(({url})=>{
  if(kind==='workbench'&&(policy.auth(url)||policy.trustedSite(url)))return{action:'allow',overrideBrowserWindowOptions:{width:550,height:760,parent:win,autoHideMenuBar:true,title:'工坊账号登录',webPreferences:{...preferences,partition}}};
  if(policy.external(url))dialog.showMessageBox(win,{type:'question',message:'在系统浏览器打开此链接？',detail:new URL(url).hostname,buttons:['取消','打开'],defaultId:0,cancelId:0}).then(({response})=>{if(response===1)shell.openExternal(url)});
  return{action:'deny'};
 });
 contents.on('did-create-window',child=>guard(child.webContents,kind,partition));
 contents.on('will-attach-webview',event=>event.preventDefault());
 contents.on('certificate-error',event=>{event.preventDefault()});
}
function configureSession(partition){const current=session.fromPartition(partition);const clipboard=(permission,url)=>permission==='clipboard-sanitized-write'&&(policy.trustedSite(url)||policy.whatsapp(url));current.setPermissionRequestHandler((contents,permission,callback)=>callback(clipboard(permission,contents.getURL())));current.setPermissionCheckHandler((_contents,permission,origin)=>clipboard(permission,origin));current.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:'保存文件',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))}));return current}
function rejectRequests(){for(const [id,request]of requests){clearTimeout(request.timer);if(!request.timedOut)request.reject(Error('WhatsApp 页面正在重新加载，发送结果需核对。'));requests.delete(id)}sendInFlight=null}
async function lateReceipt(message,result){
 const p=message.payload;if(message.type!=='SEND'||!p||!['submitted','failed'].includes(result?.state)||result.state==='submitted'&&!result.messageId)return;
 const key='delivery:'+p.id;let stored;for(let attempt=0;attempt<10;attempt++){stored=(await vault.get(key))[key];if(!stored?.inProgress)break;await new Promise(resolve=>setTimeout(resolve,100))}if(!stored||stored.inProgress||stored.groupHash!==p.groupHash||stored.text!==p.text||stored.state!=='unknown')return;
 await vault.set({[key]:{...stored,...result,inProgress:false,updatedAt:Date.now()}});
}
function whatsappCall(message){
 if(!wa||wa.webContents.isDestroyed()||!policy.whatsapp(wa.webContents.getURL()))return Promise.reject(Error('请先在 App 内打开 WhatsApp 并登录。'));
 if(message.type==='SEND'&&sendInFlight)return Promise.resolve({state:'failed',error:'上一条消息仍在核对中，本条尚未发送；请先检查实际群聊。'});
 const id=randomUUID();if(message.type==='SEND')sendInFlight=id;
 return new Promise((resolve,reject)=>{const request={message,resolve,reject,timedOut:false,timer:null};request.timer=setTimeout(()=>{request.timedOut=true;reject(Error('WhatsApp 页面响应超时，结果未知；不会自动重发。'));if(message.type!=='SEND')requests.delete(id)},message.type==='SEND'?30000:6000);requests.set(id,request);wa.webContents.send('desktop:wa-request',{id,message})});
}
function isShell(event){return event.sender===win?.webContents&&policy.mainFrame(event)&&event.senderFrame.url===shellUrl}
function isWorkbench(event){return event.sender===workbench?.webContents&&policy.mainFrame(event)&&policy.trustedSite(event.senderFrame.url)}
ipcMain.handle('desktop:notice',async(event,body)=>{if(!isShell(event)||typeof body?.title!=='string'||typeof body.text!=='string'||body.text.length>6000)throw Error('不允许的提示来源');await dialog.showMessageBox(win,{type:'info',message:body.title.slice(0,100),detail:body.text,buttons:['知道了']});return{ok:true}});
ipcMain.handle('desktop:relay',async(event,request)=>{
 if(!isWorkbench(event)||!request||!['STATUS','OPEN','SEND','RECEIPT','VERIFY','CONFIRM'].includes(request.command))return{ok:false,error:'此页面无权调用桌面连接'};
 if(request.payload&&JSON.stringify(request.payload).length>24000)return{ok:false,error:'请求过大'};
 return relay.call(request);
});
ipcMain.on('desktop:wa-response',(event,response)=>{
 if(event.sender!==wa?.webContents||!policy.mainFrame(event)||!policy.whatsapp(event.senderFrame.url)||!response)return;
 const pending=requests.get(response.id);if(!pending)return;clearTimeout(pending.timer);requests.delete(response.id);if(sendInFlight===response.id)sendInFlight=null;
 if(pending.timedOut)lateReceipt(pending.message,response.result).catch(()=>{});else pending.resolve(response.result);
});
ipcMain.handle('desktop:control',async(event,action)=>{
 if(!isShell(event))throw Error('不允许的操作来源');
 if(action==='status')return{...await relay.call({command:'STATUS'}),mode,version:app.getVersion()};
 if(action==='bind'){focusMode('whatsapp');const result=await relay.call({command:'BIND'},true);return result.ok?{...result,message:'已绑定 '+result.binding.name+'。请回工坊的 WS 设置检查连接，并开启联动。'}:result}
 if(action==='unbind')return relay.call({command:'UNBIND'},true);
 if(action==='diagnose')return relay.call({command:'DIAGNOSE'},true);
 if(['split','workbench','whatsapp'].includes(action)){focusMode(action);return{ok:true,mode}}
 if(action==='reload'){workbench.webContents.reload();return{ok:true}}
 if(action==='reload-wa'){if(sendInFlight)return{ok:false,error:'仍有发送任务，请核对完成后再刷新 WhatsApp。'};wa.webContents.reload();return{ok:true}}
 if(action==='browser'){await shell.openExternal(policy.SITE);return{ok:true,message:'已打开浏览器。App 和浏览器的登录与本地待同步记录彼此独立。'}}
 return{ok:false,error:'不支持的操作'};
});
async function createWindow(){
 const {width,height}=screen.getPrimaryDisplay().workAreaSize;
 win=new BrowserWindow({width:Math.min(1800,width-30),height:Math.min(1100,height-30),minWidth:1050,minHeight:650,show:false,autoHideMenuBar:true,title:'对白工坊',backgroundColor:'#f3f6f4',icon:path.join(__dirname,'assets/icon.ico'),webPreferences:{...preferences,preload:path.join(__dirname,'preload-shell.cjs')}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
 configureSession('persist:atelier-workbench');configureSession('persist:atelier-whatsapp');
 workbench=new WebContentsView({webPreferences:{...preferences,partition:'persist:atelier-workbench',preload:path.join(__dirname,'preload-workbench.cjs')}});
 wa=new WebContentsView({webPreferences:{...preferences,partition:'persist:atelier-whatsapp',preload:path.join(__dirname,'generated/whatsapp-preload.cjs')}});
 // Present a normal Chromium user agent to WhatsApp; keep Electron's security defaults.
 wa.webContents.setUserAgent(wa.webContents.getUserAgent().replace(/ Electron\/\S+/g,'').replace(/ dialogue-atelier-desktop\/\S+/gi,''));
 win.contentView.addChildView(workbench);win.contentView.addChildView(wa);
 guard(workbench.webContents,'workbench','persist:atelier-workbench');guard(wa.webContents,'whatsapp','persist:atelier-whatsapp');
 wa.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)rejectRequests()});
 wa.webContents.on('render-process-gone',rejectRequests);
 relay=createRelay({background:fs.readFileSync(path.join(__dirname,'generated/background.js'),'utf8'),storage:vault,transport:{url:()=>wa.webContents.getURL(),call:whatsappCall},siteUrl:()=>workbench.webContents.getURL(),showWhatsApp:()=>focusMode('whatsapp')});
 mode=width>=1550?'split':'workbench';win.on('resize',layout);
 win.on('close',event=>{if(sendInFlight&&!shuttingDown){event.preventDefault();dialog.showMessageBox(win,{type:'warning',message:'仍有消息正在核对发送结果',detail:'关闭后不会自动重发。请先在 WhatsApp 群中核对。',buttons:['留在 App','仍然关闭'],defaultId:0,cancelId:0}).then(({response})=>{if(response===1){shuttingDown=true;win.close()}})}});
 win.on('closed',()=>{rejectRequests();if(!workbench.webContents.isDestroyed())workbench.webContents.close();if(!wa.webContents.isDestroyed())wa.webContents.close();win=null});
 await win.loadFile('shell.html');layout();win.show();
 workbench.webContents.loadURL(policy.SITE).catch(()=>{});wa.webContents.loadURL('https://web.whatsapp.com/').catch(()=>{});
}
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.whenReady().then(async()=>{vault=await new Vault(path.join(app.getPath('userData'),'ws-ledger.enc'),safeStorage).open();await createWindow()}).catch(error=>{dialog.showErrorBox('对白工坊启动失败',error.message);app.quit()});
app.on('window-all-closed',()=>app.quit());
