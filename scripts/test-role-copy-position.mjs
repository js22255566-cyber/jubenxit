import fs from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=await fs.readFile('ui/index.html','utf8');
const fn=source.match(/function copyBlock\(m\)\{[^\n]+/)[0];
const roles={p:{name:'助理',roleType:'primary'},n:{number:'24',gender:'女',age:'52',occupation:'餐饮店经营者'}};
const c=vm.createContext({byId:id=>roles[id],primaryRole:r=>r.roleType==='primary'});vm.runInContext(fn+';globalThis.copyBlock=copyBlock',c);
assert.equal(c.copyBlock({characterId:'p',pt:'Olá'}),'助理\nOlá');assert.equal(c.copyBlock({characterId:'n',pt:'Olá'}),'编号 24 女 52岁 餐饮店经营者\nOlá');
assert.ok(source.includes("sessionStorage.setItem('dialogue-chat-position'"));assert.ok(source.includes('restoreChatPosition();checkWsIndicator()'));console.log('PASS primary role labels, numbered copy formatting and session scroll restoration wiring');
