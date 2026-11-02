import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Explicit opt-in only. No credentials are loaded from another project or local file.
if(!process.argv.includes('--live')){console.log('SKIPPED: add --live and provide this project’s BAI_API_KEY / BAI_TEST_MODEL to run a paid, non-customer smoke test.');process.exit(0)}
if(!process.env.BAI_API_KEY||!process.env.BAI_TEST_MODEL){console.error('NOT RUN: this project’s dedicated BAI_API_KEY and BAI_TEST_MODEL are required. Never paste a key into Git.');process.exit(2)}
const endpoint=process.env.BAI_TEST_ENDPOINT||'chat/completions';
if(!['chat/completions','responses'].includes(endpoint)){console.error('Invalid BAI_TEST_ENDPOINT');process.exit(2)}
const model=process.env.BAI_TEST_MODEL;
let source=(await fs.readFile('worker/index.js','utf8')).replace("import {page} from './page.js';","const page='isolated-live-smoke';");
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const objects=new Map(),BUCKET={async get(key){const o=objects.get(key);return o?{etag:o.etag,json:async()=>JSON.parse(o.value)}:null},async put(key,value,options={}){const old=objects.get(key),c=options.onlyIf;if(c?.etagMatches&&old?.etag!==c.etagMatches||c?.etagDoesNotMatch==='*'&&old)return null;const etag=crypto.randomUUID();objects.set(key,{etag,value});return{etag}}};
const env={CONFIG_OWNER_ID:'local-smoke-owner',CONFIG_ENCRYPTION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),BUCKET,BAI_API_KEY:process.env.BAI_API_KEY};
const localContext={characters:[{id:'smoke-persona',name:'Fictional QA Persona'}],messages:[],learning:[]};let revision=0;
async function call(action,body){const response=await worker.fetch(new Request('https://isolated-smoke.test/api/'+action,{method:'POST',headers:{origin:'https://isolated-smoke.test','oai-authenticated-user-id':'local-smoke-owner','content-type':'application/json'},body:JSON.stringify({revision,...body,localContext})}),env);const result=await response.json();if(!response.ok){const failure=new Error('Smoke test failed: '+(result.code||response.status));failure.code=result.code;throw failure}if(result.revision!=null)revision=result.revision;return result}
try{
 const c=await call('config/ai-routing/connection/save',{connection:{name:'Isolated live smoke',provider:'bai',baseUrl:'https://api.b.ai/v1',keySource:'env'}});
 const list=await call('config/ai-routing/connection/models',{id:c.id});assert.ok(list.models.includes(model),'BAI_TEST_MODEL must be an actual ID returned by the current key');
 await call('config/ai-routing/connection/test',{id:c.id,model,endpoint});await call('config/ai-routing/connection/enable',{id:c.id,enabled:true});
 await call('config/ai-routing/scope/save',{scope:'persona',id:'smoke-persona',config:{name:'Fictional QA Persona',background:'An imaginary librarian used only for software acceptance testing.',tone:'Concise and polite',language:'pt-BR',maxChars:800,maxTokens:4096,outputFormat:'plain',prohibitions:'No customer contact and no financial claims.',connectionId:c.id,replyModel:model,translationModel:model,endpoint,translationEndpoint:endpoint,knowledgeIds:[],parameters:{},translationParameters:{}}});
 const tested=await call('config/ai-routing/scope/test',{scope:'persona',id:'smoke-persona'});await call('config/ai-routing/scope/publish',{scope:'persona',id:'smoke-persona'});
 const generated=await call('ai',{characterId:'smoke-persona',sessionId:'isolated-non-customer-smoke-session',mode:'write',instruction:'Write one short greeting for an imaginary library visitor.'});
 assert.equal(generated.audits[0].model,model);assert.equal(generated.audits[0].personaVersion,1);
 console.log(JSON.stringify({live:true,nonCustomer:true,productionConfigChanged:false,provider:'bai',model,endpoint,personaVersion:1,scopeTest:tested.evidence.map(e=>({mode:e.mode,model:e.model,returnedModel:e.returnedModel,traceId:e.traceId,draftDigest:e.draftDigest})),generation:{traceId:generated.audits[0].traceId,returnedModel:generated.audits[0].returnedModel,status:generated.audits[0].status}},null,2));
}catch(e){console.error(e.code?'LIVE TEST FAILED: '+e.code:'LIVE TEST FAILED: verification or network unavailable; no production configuration was changed.');process.exitCode=1}
