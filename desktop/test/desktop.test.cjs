'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {Vault}=require('../vault.cjs');
const {createRelay}=require('../relay.cjs');
const policy=require('../policy.cjs');
test('exact origin and main-frame authorization',()=>{
 assert.ok(policy.trustedSite(policy.SITE+'/api/state'));assert.ok(!policy.trustedSite(policy.SITE+'.evil.test/'));assert.ok(!policy.whatsapp('https://web.whatsapp.com.evil.test/'));assert.ok(!policy.auth('http://auth.openai.com/'));assert.ok(!policy.external('file:///C:/Windows/system.ini'));assert.ok(!policy.external('javascript:alert(1)'));assert.ok(!policy.mainFrame({senderFrame:{processId:1,routingId:2},sender:{mainFrame:{processId:1,routingId:3}}}));
});
test('encrypted durable ledger, concurrent saves, restart and corrupt-file preservation',async()=>{
 const base=path.join(__dirname,'../.smoke-output');await fs.mkdir(base,{recursive:true});const dir=await fs.mkdtemp(path.join(base,'ledger-')),file=path.join(dir,'ledger.enc');
 const key=crypto.randomBytes(32),safe={isEncryptionAvailable:()=>true,encryptString:text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data])},decryptString:bytes=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')}};
 const vault=await new Vault(file,safe).open();await Promise.all([vault.set({first:{text:'private fictional test'}}),vault.set({second:2})]);assert.equal((await vault.get('second')).second,2);assert.ok(!(await fs.readFile(file)).includes(Buffer.from('private fictional test')));
 const restarted=await new Vault(file,safe).open();assert.equal((await restarted.get('first')).first.text,'private fictional test');await restarted.remove('first');assert.equal((await restarted.get('first')).first,undefined);
 await fs.writeFile(file,'corrupt fixture');await assert.rejects(new Vault(file,safe).open());assert.equal(await fs.readFile(file,'utf8'),'corrupt fixture');await assert.rejects(new Vault(file,{isEncryptionAvailable:()=>false}).open());
 // Delete only explicitly constructed test files, never a computed directory tree.
 await fs.unlink(file);await fs.rmdir(dir);
});
test('native adapter reuses group binding, independent stable IDs and unknown suppression',async()=>{
 const background=await fs.readFile(path.join(__dirname,'../../ws-extension/background.js'),'utf8');const data={};let sends=0,group='group-A',mode='submitted',activeUrl=policy.SITE;
 const storage={async get(k){return structuredClone({[k]:data[k]})},async set(v){Object.assign(data,structuredClone(v))},async remove(k){delete data[k]}};
 const transport={url:()=> 'https://web.whatsapp.com/',async call(m){if(m.type==='DESCRIBE')return{ok:true,name:'Fictional test',groupHash:group,identityMode:'group'};if(m.type==='SEND'){sends++;return{state:mode,messageId:mode==='submitted'?'wa-'+m.payload.id:'',error:''}}}};
 const make=()=>createRelay({background,storage,transport,siteUrl:()=>activeUrl,showWhatsApp(){}});let relay=make();assert.equal((await relay.call({command:'BIND'},true)).ok,true);
 const send=id=>relay.call({command:'SEND',payload:{id,text:'No.30\n\nFictional',images:[],groupHash:'group-A'}});
 for(let i=0;i<8;i++)assert.equal((await send('same-persona-'+i)).state,'submitted');assert.equal(sends,8);await send('same-persona-0');assert.equal(sends,8);
 group='group-B';assert.equal((await send('wrong-target')).ok,false);assert.equal(sends,8);group='group-A';mode='unknown';await send('unknown');assert.equal(sends,9);relay=make();await send('unknown');assert.equal(sends,9);
 activeUrl='https://evil.test';assert.equal((await send('unauthorized')).ok,false);assert.equal(sends,9);
});
test('packaged preloads parse and register exactly one content receiver',async()=>{
 let listener,registrations=0;const context=vm.createContext({require:name=>{assert.equal(name,'electron');return{ipcRenderer:{on(channel,fn){assert.equal(channel,'desktop:wa-request');listener=fn;registrations++},send(){}}}}});
 const preload=await fs.readFile(path.join(__dirname,'../generated/whatsapp-preload.cjs'),'utf8');new vm.Script(preload);vm.runInContext(preload,context);assert.equal(registrations,1);assert.equal(typeof listener,'function');
 for(const file of ['main.cjs','preload-shell.cjs','preload-workbench.cjs','shell.js'])new vm.Script(await fs.readFile(path.join(__dirname,'..',file),'utf8'));
});
test('main process IPC rejects untrusted windows, subframes and oversized commands',async()=>{
 const handles=new Map(),events=new Map();const app={setName(){},setAppUserModelId(){},requestSingleInstanceLock:()=>true,on(){},whenReady:()=>new Promise(()=>{})};
 const context=vm.createContext({__dirname:path.join(__dirname,'..'),process:{},console,URL,setTimeout,clearTimeout,require:name=>name==='electron'?{app,ipcMain:{handle:(k,fn)=>handles.set(k,fn),on:(k,fn)=>events.set(k,fn)},dialog:{showMessageBox:async()=>({response:0})}}:require(name.startsWith('./')?path.join(__dirname,'..',name):name)});
 const main=await fs.readFile(path.join(__dirname,'../main.cjs'),'utf8');vm.runInContext(main+'\nglobalThis.setFixture=(fixture,adapter)=>{workbench=fixture;relay=adapter}',context);
 let calls=0;const frame={processId:1,routingId:2,url:policy.SITE+'/'},contents={mainFrame:frame},fixture={webContents:contents};context.setFixture(fixture,{async call(){calls++;return{ok:true}}});const invoke=handles.get('desktop:relay');
 assert.equal((await invoke({sender:contents,senderFrame:frame},{command:'STATUS'})).ok,true);assert.equal(calls,1);
 assert.equal((await invoke({sender:{mainFrame:frame},senderFrame:frame},{command:'SEND'})).ok,false);
 assert.equal((await invoke({sender:contents,senderFrame:{...frame,routingId:99}},{command:'SEND'})).ok,false);
 frame.url=policy.SITE+'.evil.test/';assert.equal((await invoke({sender:contents,senderFrame:frame},{command:'STATUS'})).ok,false);frame.url=policy.SITE+'/';
 assert.equal((await invoke({sender:contents,senderFrame:frame},{command:'BIND'})).ok,false);
 assert.equal((await invoke({sender:contents,senderFrame:frame},{command:'SEND',payload:{text:'x'.repeat(25000)}})).ok,false);assert.equal(calls,1);
});
