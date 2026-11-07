const {test} = require('node:test');
const assert = require('node:assert/strict');
const {songKey,videoId,searchData,videosFromData} = require('../core.js');
test('preferences identify artist and song, independent of tab version', () => {
  assert.equal(songKey(' OASIS ', 'Wonderwall'), songKey('oasis','wonderwall'));
  assert.notEqual(songKey('A','B'),songKey('B','A'));
  assert.notEqual(songKey('a:b','c'),songKey('a','b:c'));
});
test('YouTube links and IDs are validated without trusting arbitrary hosts', () => {
  for (const url of ['dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ?t=10','https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=test','https://youtube.com/shorts/dQw4w9WgXcQ']) assert.equal(videoId(url),'dQw4w9WgXcQ');
  for (const url of ['https://evil.com/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ','short']) assert.equal(videoId(url),null);
});
test('search extracts JSON with escaped strings and deduplicates videos', () => {
  const item = {videoRenderer:{videoId:'dQw4w9WgXcQ',title:{runs:[{text:'Clip "live" }'}]}}};
  const data = {contents:[item,item,{videoRenderer:{videoId:'bad'}}]};
  const parsed = searchData(`<script>var ytInitialData = ${JSON.stringify(data)}; other();</script>`);
  assert.deepEqual(videosFromData(parsed),[{id:'dQw4w9WgXcQ',title:'Clip "live" }'}]);
  assert.throws(()=>searchData('<html>Consent</html>'));
  assert.throws(()=>searchData('var ytInitialData = {'));
});
test('video validation and result titles tolerate malformed remote data',()=>{
 for(const input of [null,undefined,42,{},[]])assert.equal(videoId(input),null);
 assert.deepEqual(videosFromData({videoRenderer:{videoId:'dQw4w9WgXcQ',title:{runs:{text:'invalid'}}}}),[{id:'dQw4w9WgXcQ',title:'YouTube video'}]);
});
test('search traversal handles deep responses, cycles and stops after eight results',()=>{
 const root={};let leaf=root;
 for(let i=0;i<20000;i++){leaf.child={};leaf=leaf.child;}
 leaf.videoRenderer={videoId:'dQw4w9WgXcQ'};
 leaf.parent=root;
 assert.equal(videosFromData(root).length,1);
 const items=Array.from({length:8},(_,i)=>({videoRenderer:{videoId:String(i).padStart(11,'0')}}));
 const response={items};
 Object.defineProperty(response,'unvisited',{enumerable:true,get(){return {get videoRenderer(){throw Error('should stop after eight results');}};}});
 assert.deepEqual(videosFromData(response).map(video=>video.id),items.map(item=>item.videoRenderer.videoId));
});
test('manifest limits injection to Ultimate Guitar and requests only storage', () => {
 const manifest = require('../manifest.json');
 assert.equal(manifest.manifest_version,3);
 assert.deepEqual(manifest.permissions,['storage']);
 assert.deepEqual(manifest.content_scripts[0].matches,['https://tabs.ultimate-guitar.com/*']);
});
