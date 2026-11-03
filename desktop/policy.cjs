'use strict';
const SITE='https://dialogue-atelier-7024.biopics-paws-0c.chatgpt.site';
const SITES=new Set([SITE,'https://dialogue-atelier-7024.candidkoala259.chatgpt.site']);
const AUTH=new Set(['chatgpt.com','auth.openai.com','auth0.openai.com','accounts.google.com','login.microsoftonline.com','appleid.apple.com']);
function origin(url){try{return new URL(url).origin}catch{return ''}}
function trustedSite(url){return SITES.has(origin(url))}
function whatsapp(url){return origin(url)==='https://web.whatsapp.com'}
function auth(url){try{const u=new URL(url);return u.protocol==='https:'&&AUTH.has(u.hostname)}catch{return false}}
function external(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
function mainFrame(event){const frame=event.senderFrame,main=event.sender?.mainFrame;return !!frame&&!!main&&frame.processId===main.processId&&frame.routingId===main.routingId}
module.exports={SITE,SITES,origin,trustedSite,whatsapp,auth,external,mainFrame};
