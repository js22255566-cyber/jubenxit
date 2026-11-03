'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
class Vault{
 constructor(file,safeStorage){this.file=file;this.crypto=safeStorage;this.data=Object.create(null);this.writes=Promise.resolve()}
 async open(){
  if(!this.crypto.isEncryptionAvailable())throw Error('Windows 安全存储不可用，已停止加载发送记录；不会改用明文保存。');
  try{const bytes=await fs.readFile(this.file);this.data=JSON.parse(this.crypto.decryptString(bytes));if(!this.data||Array.isArray(this.data)||typeof this.data!=='object')throw Error('Invalid ledger')}
  catch(e){if(e.code!=='ENOENT')throw Error('本机发送记录无法读取，原文件已保留。请先备份后联系维护者，不要重新发送未知结果的消息。')}
  return this;
 }
 async get(key){await this.writes;return structuredClone({[key]:this.data[key]})}
 set(values){return this.edit(next=>Object.assign(next,structuredClone(values)))}
 remove(key){return this.edit(next=>{delete next[key]})}
 edit(change){
  const task=this.writes.then(async()=>{const next=structuredClone(this.data);change(next);const encrypted=this.crypto.encryptString(JSON.stringify(next));await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp',file=await fs.open(temp,'w');try{await file.writeFile(encrypted);await file.sync()}finally{await file.close()}await fs.rename(temp,this.file);this.data=next});
  this.writes=task.catch(()=>{});return task;
 }
}
module.exports={Vault};
