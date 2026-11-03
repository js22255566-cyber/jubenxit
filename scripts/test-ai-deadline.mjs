import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=await fs.readFile('worker/index.js','utf8'),fn=source.match(/^async function aiJsonRequest\(.*$/m)[0];
let deadline,cleared=0,signal,mode='network-hang';
const context=vm.createContext({AbortController,Promise,Error,setTimeout:(fn,ms)=>{assert.equal(ms,35000);deadline=fn;return 1},clearTimeout:()=>cleared++,fetch:async(url,options)=>{signal=options.signal;if(mode==='network-hang')return new Promise(()=>{});return{ok:true,status:200,json:()=>new Promise(()=>{})}}});
vm.runInContext(fn+';globalThis.request=aiJsonRequest',context);
for(const next of ['network-hang','body-hang']){mode=next;const pending=context.request('https://fixture.test/v1/chat/completions',{method:'POST'});deadline();await assert.rejects(pending,e=>e.status===504);assert.equal(signal.aborted,true)}
assert.equal(cleared,2);console.log('PASS hard backend AI deadline covers connection and response-body hangs even if fetch ignores abort; no real API calls');
