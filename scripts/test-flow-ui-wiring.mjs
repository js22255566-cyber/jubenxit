import fs from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=await fs.readFile('ui/index.html','utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];new vm.Script(script);
const right={innerHTML:''},context=vm.createContext({draftPage:1,PAGE_SIZE:80,state:{drafts:[{id:'d',characterId:'c',pt:'Pronto',zh:'中文',warnings:[]}]},$:()=>right,esc:String,byId:()=>({name:'Fixture'}),pendingDraftStatus:()=>'<span>LOCAL_PENDING_MARKER</span>',listPager:()=>''});
vm.runInContext(script.match(/^function renderDrafts\(.*$/m)[0]+';renderDrafts()',context);assert.ok(right.innerHTML.includes('LOCAL_PENDING_MARKER'));assert.ok(right.innerHTML.includes('本机先保存'));assert.ok(right.innerHTML.includes('retrydraftsync'));
assert.ok(script.includes('modelPicker(c.aiModel,c.aiBase'));assert.ok(script.includes('wsverifyqueue'));assert.ok(script.includes('translationNeedsUpdate.add(selected)'));assert.ok(!script.includes('saveWrite({check:!!service.ai})'));
console.log('PASS draft UI explains purpose and pending sync, retry control is present, key model selector and manual WS verification are wired, autosave does not compete with translation');
