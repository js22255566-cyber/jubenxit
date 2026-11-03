'use strict';
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=__dirname,generated=path.join(root,'generated');fs.mkdirSync(generated,{recursive:true});
const receiver=fs.readFileSync(path.join(root,'../ws-extension/whatsapp.js'),'utf8');
const bootstrap=`'use strict';\nconst {ipcRenderer}=require('electron');\nconst chrome={runtime:{id:'dialogue-desktop-v1',onMessage:{addListener(fn){ipcRenderer.on('desktop:wa-request',(_event,request)=>{const respond=result=>ipcRenderer.send('desktop:wa-response',{id:request.id,result});try{fn(request.message,{id:'dialogue-desktop-v1'},respond)}catch{respond({state:'unknown',error:'WhatsApp 页面处理失败，请核对实际群聊。'})}})}}}};\n`;
fs.writeFileSync(path.join(generated,'whatsapp-preload.cjs'),bootstrap+receiver);
fs.copyFileSync(path.join(root,'../ws-extension/background.js'),path.join(generated,'background.js'));
// Generate an original application icon without an external font or image dependency.
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=crc>>>1^((crc&1)?0xedb88320:0)}return(crc^0xffffffff)>>>0};
const chunk=(type,data)=>{const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),out.length-4);return out};
const size=256,pixels=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const offset=y*(size*4+1)+1+x*4;let color=[25,81,65,255];const bubble=x>=48&&x<=207&&y>=55&&y<=179,tail=y>=179&&y<=205&&x>=67&&x<=67+(205-y);if(bubble||tail)color=[241,250,246,255];for(const cx of [89,128,167])if((x-cx)**2+(y-118)**2<=10**2)color=[25,81,65,255];pixels.set(color,offset)}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.writeFileSync(path.join(root,'assets/icon.ico'),Buffer.concat([ico,png]));
console.log('Prepared desktop preloads and shared WS adapter.');
