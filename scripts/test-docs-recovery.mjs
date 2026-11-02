import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
let source=await fs.readFile('worker/index.js','utf8');
source=source.replace("import {page} from './page.js';","const page='fixture';").replace(/^async function token\(env\).*$/m,"async function token(){return 'fixture'}");
source+='\nexport {applyDocumentPlan,docsRequest};';
const {applyDocumentPlan,docsRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const plan={id:'fixture-doc',revisionId:'1',operation:'operation-fixture',requests:[{insertText:{location:{index:1},text:'fictional'}}],metadata:{managed:true,records:{fixture:{id:'fixture'}}}};
let revision='1',marker=false,posts=0,reads=0,metaWrites=0,mode='ok',replies=[];
const env={BUCKET:{async get(){return null},async put(){metaWrites++}}};
const reset=next=>{revision='1';marker=false;posts=reads=metaWrites=0;mode=next;replies=[]};
globalThis.fetch=async(url,init={})=>{
 assert.equal(new URL(url).hostname,'docs.googleapis.com');
 if(!init.body){reads++;if(mode==='read429'&&reads===1)return Response.json({error:{message:'quota'}},{status:429});return Response.json({revisionId:revision,body:{content:[]},namedRanges:marker?{'DW_OP_operation-fixture':{namedRanges:[]}}:{}})}
 posts++;const body=JSON.parse(init.body);assert.equal(body.writeControl.requiredRevisionId,'1');
 if(mode==='permission')return Response.json({error:{message:'permission denied'}},{status:403});
 if(mode==='rateAlways')return Response.json({error:{message:'quota'}},{status:429});
 if(mode==='rateOnce'&&posts===1)return Response.json({error:{message:'quota'}},{status:429});
 marker=true;revision='2';
 if(mode==='lostResponse')throw Error('network response lost after commit');
 return Response.json({});
};
reset('rateOnce');await applyDocumentPlan(env,plan);assert.equal(posts,2);assert.equal(metaWrites,1);assert.ok(reads>=2);
reset('lostResponse');await applyDocumentPlan(env,plan);assert.equal(posts,1,'lost successful response must never duplicate insertion');assert.equal(metaWrites,1);
reset('ok');revision='2';await assert.rejects(applyDocumentPlan(env,plan),e=>e.documentConflict&&e.syncCode==='DOCS_REVISION_CONFLICT');assert.equal(posts,0,'stale positions never reach Google batchUpdate');assert.equal(metaWrites,0);
reset('permission');await assert.rejects(applyDocumentPlan(env,plan),e=>e.syncCode==='DOCS_PERMISSION_DENIED'&&!e.retryable&&e.upstreamStatus===403);assert.equal(posts,1);assert.equal(metaWrites,0);
reset('rateAlways');await assert.rejects(applyDocumentPlan(env,plan),e=>e.syncCode==='DOCS_RATE_LIMIT');assert.equal(posts,3,'bounded retry');assert.equal(metaWrites,0);
reset('read429');await docsRequest(env,'fixture-doc');assert.equal(reads,2);
reset('ok');marker=true;revision='2';await applyDocumentPlan(env,plan);assert.equal(posts,0);assert.equal(metaWrites,1,'replay completes metadata without rewriting document');
console.log('PASS Docs recovery: read throttling, bounded write throttling, committed-response loss, stale WAL positions, permission failure, operation-marker reconciliation and metadata-only completion; mock Google only');
