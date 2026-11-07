const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../core.js');
function worker(fetch) {
 let handler;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),{
  importScripts(){},RiffCore:core,AbortSignal,fetch,chrome:{runtime:{onMessage:{addListener(fn){handler=fn;}}}}
 });
 return handler;
}
test('search worker rejects other senders and reports network failures',async()=>{
 let called=false;
 const handle = worker(async()=>{called=true;throw new Error('Offline');});
 assert.equal(handle({type:'riff-search'}, {url:'https://example.org',tab:{}},()=>{}),undefined);
 assert.equal(called,false);
 const result = await new Promise(resolve=>{
  assert.equal(handle({type:'riff-search',query:'Oasis Wonderwall'},{url:'https://tabs.ultimate-guitar.com/tab/x',tab:{}},resolve),true);
 });
 assert.equal(result.error,'Offline');
});
test('search worker encodes query, omits credentials and returns videos',async()=>{
 let request;
 const data={videoRenderer:{videoId:'dQw4w9WgXcQ',title:{runs:[{text:'Clip'}]}}};
 const handle=worker(async(url,options)=>{request={url,options};return {ok:true,text:async()=>`var ytInitialData = ${JSON.stringify(data)};`};});
 const result=await new Promise(resolve=>handle({type:'riff-search',query:'A & B'},{url:'https://tabs.ultimate-guitar.com/tab/x',tab:{}},resolve));
 assert.equal(result.videos[0].id,'dQw4w9WgXcQ');
 assert.equal(new URL(request.url).searchParams.get('search_query'),'A & B official music video');
 assert.equal(request.options.credentials,'omit');
});
