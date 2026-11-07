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
test('manifest limits injection to Ultimate Guitar and requests only storage', () => {
 const manifest = require('../manifest.json');
 assert.equal(manifest.manifest_version,3);
 assert.deepEqual(manifest.permissions,['storage']);
 assert.deepEqual(manifest.content_scripts[0].matches,['https://tabs.ultimate-guitar.com/*']);
});
