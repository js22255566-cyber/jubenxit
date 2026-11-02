import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const group='123456@g.us',groupHash=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(group))).toString('hex');
let messages=[],input={innerText:'',focus(){}},clicks=0,clearAfter=0,polls=0;
const node=(id,text)=>({getAttribute:k=>k==='data-id'?id:null,querySelector:()=>({innerText:text})});
const header={querySelector:()=>({getAttribute:()=> 'Test group'})};
const main={querySelector:()=>header,querySelectorAll:()=>messages};
const sent=[];
const button={click(){clicks++;sent.push(input.innerText);messages=[node('true_'+group+'_'+clicks,input.innerText)];clearAfter=3}};
const document={querySelector(s){if(s==='#main')return main;if(s.includes('contenteditable'))return input;if(s.includes('button[aria-label'))return button;return null},execCommand(c,unused,text){assert.equal(c,'insertText');input.innerText+=text;return true}};
const context=vm.createContext({document,chrome:{runtime:{id:'own',onMessage:{addListener(){}}}},crypto:webcrypto,TextEncoder,setTimeout:fn=>{polls++;if(clearAfter&&!--clearAfter)input.innerText='';fn();return 0}});
const source=(await fs.readFile('ws-extension/whatsapp.js','utf8')).replace("globalThis.__DW_WA_RECEIVER='0.1.4';","globalThis.testSend=send;globalThis.__DW_WA_RECEIVER='0.1.4';");
vm.runInContext(source,context);
const text='No.30 F 53 Trade manager\n\nSame persona';
messages=[node('true_'+group+'_old',text)];
for(let i=0;i<8;i++){
 context.payload={id:'distinct-'+i,groupHash,text,images:[]};
 const before=polls,result=await vm.runInContext('testSend(payload)',context);
 assert.equal(result.state,'submitted');assert.equal(result.messageId,'true_'+group+'_'+(i+1));
 assert.ok(polls-before<8,'no full acknowledgement timeout after virtualized replacement');
 if(i===0)assert.equal(polls-before,0,'visible receipt does not wait on a potentially throttled background timer');
}
assert.equal(clicks,8);assert.deepEqual(sent,Array(8).fill(text));
// An unrelated user draft must never be cleared or sent.
input.innerText='Unrelated draft';clearAfter=0;
assert.equal((await vm.runInContext('testSend(payload)',context)).state,'failed');
assert.equal(input.innerText,'Unrelated draft');assert.equal(clicks,8);
console.log('PASS 8 distinct IDs/same persona/same text, fixed-size virtualized list, delayed composer clearing, unique receipts, no unrelated-draft overwrite (offline DOM model)');
