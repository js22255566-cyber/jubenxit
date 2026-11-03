import fs from 'node:fs/promises';
const fixture=await fs.readFile('scripts/test-documents.mjs','utf8'),end=fixture.indexOf("let c=await call('config'");if(end<0)throw Error('Docs fixture boundary missing');
const test=`
let config=await call('config',{revision:0,googleEnabled:true,masterSheet:'main',googleCredentials:JSON.stringify({client_email:'fixture@example.test',private_key:'PRIVATE KEY fixture'})});
config=await call('config/connect-docs',{revision:config.revision,documentLink:'chatdoc'});assert.equal(config.status,200);
let current=await call('state?force=1');const did='11111111-1111-4111-8111-111111111111',mid='22222222-2222-4222-8222-222222222222';
const draft={id:did,characterId:'c1',zh:'原文一起保存',pt:'Teste de fluxo',images:[],warnings:[],position:null};
let result=await call('mutate',{collection:'drafts',action:'save',record:draft,clientDraftId:did,expected:current.version,includeDelta:true});assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.record.id,did);
current=await call('state?force=1');failSheet=true;const message={...draft,id:mid,sourceDraftId:did,time:'2026-11-03T12:00:00Z',order:3000};
result=await call('mutate',{collection:'messages',action:'save',record:message,clientMessageId:mid,sourceDraftId:did,expected:current.version,includeDelta:true});assert.equal(result.status,502,'document may commit before a sheet failure');const committedWrites=docWrites;
current=await call('state?force=1');assert.equal(current.status,200,JSON.stringify(current));assert.equal(docWrites,committedWrites,'WAL recovery does not duplicate the committed document insert');const recovered=current.state.messages.find(m=>m.id===mid);assert.ok(recovered);assert.equal(recovered.zh,draft.zh);assert.equal(recovered.pt,draft.pt);assert.equal(recovered.sourceDraftId,did);assert.ok(!current.state.drafts.some(d=>d.id===did));assert.equal(text.split(draft.pt).length,2);
result=await call('mutate',{collection:'messages',action:'save',record:message,clientMessageId:mid,sourceDraftId:did,expected:current.version,includeDelta:true});assert.equal(result.status,200,JSON.stringify(result));assert.equal(text.split(draft.pt).length,2);assert.equal(docWrites,committedWrites);
console.log('PASS full owner API/Docs/Sheets flow: stable draft, bilingual document insert, source-draft removal, sheet failure recovery and duplicate send acknowledgement without duplicate document text');
`;
await import('data:text/javascript;base64,'+Buffer.from(fixture.slice(0,end)+test).toString('base64'));
