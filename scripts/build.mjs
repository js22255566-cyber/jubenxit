import {extensionZip} from './build-ws-extension.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const archive=await extensionZip();await writeFile('dist/ws-extension.zip',archive);
const aiManagerSource=await readFile('ui/ai-manager.js','utf8');
const html=(await readFile('ui/index.html','utf8')).replace('/* AI_MANAGER_CODE */',()=>aiManagerSource),source=await readFile('worker/index.js','utf8');
await writeFile('dist/server/index.js',source.replace("const wsExtensionArchive='';",()=>"const wsExtensionArchive='"+archive.toString('base64')+"';").replace("import {page} from './page.js';",()=> 'const page='+JSON.stringify(html)+';'));
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built embedded UI and API worker');
