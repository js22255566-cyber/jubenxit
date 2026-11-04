import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=await fs.readFile('worker/index.js','utf8');
const code=source.slice(source.indexOf('async function writeSheetValues('),source.indexOf('const fresh='));
let calls=[],rows=992,cols=26,fail=true,permission=false,checkpointed=0,wal={groups:[{id:'isolated-sheet',data:[{range:"'history'!A993",values:[['audit']]}]}],baseline:{characters:[]}};
const sandbox={names:['history','characters'],checkpoint:async()=>checkpointed++,applyDocumentPlan:async()=>assert.fail('unexpected Docs write'),sheets:async(env,path,body,id)=>{
 assert.equal(id,'isolated-sheet');calls.push({path,body});
 if(permission)throw Error('permission denied');
 if(path.startsWith('?fields='))return{sheets:[{properties:{title:'history',sheetId:7,gridProperties:{rowCount:rows,columnCount:cols}}}]};
 if(path===':batchUpdate'){for(const r of body.requests){assert.equal(r.appendDimension.sheetId,7);if(r.appendDimension.dimension==='ROWS')rows+=r.appendDimension.length;else cols+=r.appendDimension.length}return{}}
 if(fail){fail=false;throw Error('表格请求失败：Invalid data[1]: Range (history!A993) exceeds grid limits. Max rows: 992, max columns: 26')}
 return{updated:true};
}};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const env={BUCKET:{get:async()=>({json:async()=>wal}),put:async(k,value)=>{wal=JSON.parse(value)}}};
await sandbox.recoverPendingWrite(env);
assert.equal(rows,1248);assert.equal(checkpointed,1);assert.equal(wal.groups.length,0);assert.deepEqual(calls.map(c=>c.path),['/values:batchUpdate','?fields=sheets.properties',':batchUpdate','/values:batchUpdate']);
assert.deepEqual(calls[0].body,calls[3].body);
calls=[];await sandbox.writeSheetValues(env,{id:'isolated-sheet',data:[{range:"'history'!A994",values:[['next']]}]});assert.equal(calls.length,1);
fail=true;calls=[];await sandbox.writeSheetValues(env,{id:'isolated-sheet',data:[{range:"'history'!AA994",values:[['new column']]}]});assert.equal(cols,27);assert.equal(rows,1248);
permission=true;calls=[];wal={groups:[{id:'isolated-sheet',data:[{range:"'history'!A995",values:[['keep']]}]}]};
await assert.rejects(sandbox.recoverPendingWrite(env),/permission denied/);assert.equal(wal.groups.length,1);assert.equal(calls.length,1);assert.equal(checkpointed,1);
console.log('PASS grid expansion restores exact pending history write; grows only needed rows/columns; normal saves add no metadata reads; permissions preserve WAL. Isolated data only.');
