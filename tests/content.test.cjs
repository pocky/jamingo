const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const RiffCore = require('../core.js');
const fixture = fs.readFileSync(path.join(__dirname,'fixtures/official-player.html'),'utf8');
test('disabling releases UG audio and ignores native controls and late video events; enabling restores saved choices',async()=>{
 const f=await setup();
 f.saved[songStorageKey]='abcdefghijk';
 const pointsKey=RiffCore.pointsKey(songStorageKey,'abcdefghijk');
 f.saved[pointsKey]=[{score:10,video:12}];
 const button=f.document.querySelectorAll('#pro-player-scroll-container button')[1];
 f.click(button);assert.equal(f.muting.at(-1),true);
 const oldFrame=f.panel.querySelector('iframe');
 f.click(f.panel.querySelector('#toggle-enabled'));await flush();
 assert.equal(f.saved['riff-reel:enabled'],false);
 assert.equal(f.panel.querySelector('#panel').dataset.enabled,'false');
 assert.equal(f.panel.querySelector('iframe'),null);
 assert.equal(f.muting.at(-1),false);
 const count=f.commands.length,following=f.followRequests.length;
 f.click(button);
 f.document.dispatchEvent(new f.document.defaultView.CustomEvent('riff-reel-player',{detail:JSON.stringify({path:f.location.pathname,type:'start'})}));
 const event=new f.document.defaultView.Event('message');
 Object.assign(event,{origin:'https://www.youtube.com',source:oldFrame.contentWindow,data:JSON.stringify({event:'onStateChange',info:1})});
 f.document.defaultView.dispatchEvent(event);f.tick();
 assert.equal(f.commands.length,count);assert.equal(f.followRequests.length,following);assert.equal(f.muting.at(-1),false);
 f.click(f.panel.querySelector('#toggle-enabled'));await flush();
 assert.equal(f.saved['riff-reel:enabled'],true);
 assert.match(f.panel.querySelector('iframe').src,/abcdefghijk/);
 assert.deepEqual(f.saved[pointsKey],[{score:10,video:12}]);
 assert.match(f.panel.querySelector('#point-list').textContent,/10.000 s → 12.000 s/);
 f.panel.querySelector('iframe').dispatchEvent(new f.document.defaultView.Event('load'));
 f.message({event:'infoDelivery',info:{}});
 f.click(button);assert.equal(f.commands.at(-1).data.func,'playVideo');
});
test('disabled preference survives a new page, navigation, and Close mode without loading YouTube',async()=>{
 const f=await setup(undefined,undefined,{saved:{'riff-reel:enabled':false,'riff-reel:panel-mode':'closed'}});
 assert.equal(f.panel.querySelector('#toggle-enabled').getAttribute('aria-checked'),'false');
 assert.equal(f.panel.querySelector('iframe'),null);assert.equal(f.searches.length,0);
 f.location.pathname='/tab/other/song-1';f.tick();await flush();
 assert.equal(f.searches.length,0);assert.equal(f.commands.length,0);
 f.location.pathname='/explore';f.tick();assert.equal(f.document.querySelector('#riff-reel'),null);
 f.location.pathname='/tab/other/song-1';f.tick();assert.ok(f.document.querySelector('#riff-reel'));
 f.click(f.panel.querySelector('#toggle-enabled'));await flush();assert.ok(f.panel.querySelector('iframe'));
});
test('disable cancels an unsaved calibration without issuing further UG commands',async()=>{
 const f=await setup();startSync(f);pickTab(f,10);
 const count=f.calibrationRequests.length;
 f.click(f.panel.querySelector('#toggle-enabled'));await flush();
 assert.equal(f.calibrationRequests.length,count);assert.equal(f.muting.at(-1),false);
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);
 assert.equal(f.saved[RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ')],undefined);
});
test('disable invalidates a pending search and storage changes apply across tabs',async()=>{
 let finishSearch;const f=await setup(undefined,undefined,{search:()=>new Promise(resolve=>{finishSearch=resolve;})});
 f.storageChanged({'riff-reel:enabled':{newValue:false}},'local');
 finishSearch({videos:[{id:'dQw4w9WgXcQ',title:'Late result'}]});await flush();
 assert.equal(f.panel.querySelector('iframe'),null);assert.equal(f.panel.querySelector('#panel').dataset.enabled,'false');
 f.storageChanged({'riff-reel:enabled':{newValue:true}},'sync');assert.equal(f.panel.querySelector('#panel').dataset.enabled,'false');
});
test('failed preference writes keep UG released and explain that the setting was not saved',async()=>{
 const f=await setup(undefined,undefined,{set:async()=>{throw Error('disk');}});
 f.click(f.panel.querySelector('#toggle-enabled'));await flush();
 assert.equal(f.muting.at(-1),false);assert.match(f.panel.querySelector('#enabled-status').textContent,/Could not save/);
});
test('new installations and unreadable preferences start disabled without loading YouTube',async()=>{
 for(const options of [{defaultDisabled:true},{defaultDisabled:true,get:async()=>{throw Error('storage unavailable');}}]){
  const f=await setup(undefined,undefined,options);
  assert.equal(f.panel.querySelector('#toggle-enabled').getAttribute('aria-checked'),'false');
  assert.equal(f.panel.querySelector('iframe'),null);assert.equal(f.searches.length,0);
 }
});
test('removing the enabled preference returns to the disabled default',async()=>{
 const f=await setup();
 f.storageChanged({'riff-reel:enabled':{newValue:undefined}},'local');
 assert.equal(f.panel.querySelector('#toggle-enabled').getAttribute('aria-checked'),'false');
 assert.equal(f.panel.querySelector('iframe'),null);assert.equal(f.muting.at(-1),false);
});
test('disabled polling does not detach and reinsert the launcher',async()=>{
 const f=await setup(undefined,undefined,{defaultDisabled:true});
 let appends=0;const original=f.document.documentElement.append;
 f.document.documentElement.append=function(...args){appends++;return original.apply(this,args);};
 for(let i=0;i<100;i++)f.tick();
 assert.equal(appends,0);assert.equal(f.searches.length,0);
});
test('calibration telemetry preserves existing point buttons and keyboard focus targets',async()=>{
 const f=await setup();
 await addPoint(f,10,12);startSync(f);
 const edit=f.panel.querySelector('#point-list button');
 assert.ok(edit);
 for(let i=0;i<100;i++)f.message({event:'infoDelivery',info:{currentTime:12+i/1000,playerState:2}});
 assert.equal(f.panel.querySelector('#point-list button'),edit);
});
test('no messages target a loading iframe; pending Play resumes only after YouTube is ready',async()=>{
 const f=await setup(undefined,undefined,{frameLoaded:false});
 f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]);
 f.tick();assert.equal(f.commands.length,0);
 f.frame.dispatchEvent(new f.document.defaultView.Event('load'));
 assert.equal(f.commands.at(-1).data.event,'listening');
 f.message({event:'onReady'});
 assert.equal(f.commands.at(-1).data.func,'playVideo');
 assert.ok(f.commands.every(command=>command.origin===(command.data.event==='listening'?'*':'https://www.youtube.com')));
});
test('a temporarily unavailable iframe does not break native transport handling',async()=>{
 let failed=true;
 const f=await setup(undefined,undefined,{postMessage(){if(failed)throw Error('frame navigated');}});
 assert.doesNotThrow(()=>f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]));
 failed=false;f.message({event:'onReady'});
 assert.equal(f.commands.at(-1).data.func,'playVideo');
});
test('loaded same-origin iframe never receives YouTube messages',async()=>{
 const f=await setup();
 Object.defineProperty(f.frame,'contentDocument',{value:f.document});
 const count=f.commands.length;
 f.frame.dispatchEvent(new f.document.defaultView.Event('load'));
 f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]);f.tick();
 assert.equal(f.commands.length,count);
});
test('single transport button follows clicks, YouTube pause and video completion',async()=>{
 const f=await setup(),button=f.panel.querySelector('#play');
 assert.equal(f.panel.querySelector('#pause'),null);
 assert.equal(button.getAttribute('aria-label'),'Play');
 f.click(button);assert.equal(button.getAttribute('aria-label'),'Pause');assert.equal(f.commands.at(-1).data.func,'playVideo');
 f.click(button);assert.equal(button.getAttribute('aria-label'),'Play');assert.equal(f.commands.at(-1).data.func,'pauseVideo');
 f.message({event:'onStateChange',info:1});assert.equal(button.getAttribute('aria-label'),'Pause');
 assert.equal(f.panel.querySelector('#status').textContent,'');
 f.message({event:'onStateChange',info:2});assert.equal(button.getAttribute('aria-label'),'Play');
 f.message({event:'infoDelivery',info:{playerState:1}});assert.equal(button.getAttribute('aria-label'),'Pause');
 f.message({event:'onStateChange',info:0});assert.equal(button.getAttribute('aria-label'),'Play');
});
test('commands wait for a verified response; only the public handshake uses a wildcard',async()=>{
 const f=await setup(undefined,undefined,{verifyOrigin:false});
 f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]);
 assert.equal(f.commands.length,0);
 f.tick();assert.ok(f.commands.every(command=>command.data.event==='listening'&&command.origin==='*'));
 f.message({event:'onReady'});
 assert.equal(f.commands.at(-1).data.func,'playVideo');assert.equal(f.commands.at(-1).origin,'https://www.youtube.com');
});
async function setup(html = fixture, videos = [{id:'dQw4w9WgXcQ',title:'Clip'}], options = {}) {
 const {window,document} = parseHTML(`<html><head><title>Snowblind OFFICIAL by Black Sabbath @ Ultimate-Guitar.Com</title></head><body>${html}</body></html>`);
 const commands = [], muting = [], exported = [], downloads = [], searches = [], saved = options.saved || {};
 if (!options.defaultDisabled && saved['riff-reel:enabled'] === undefined) saved['riff-reel:enabled']=true;
 let storageChanged;
 const createElement=document.createElement.bind(document);
 document.createElement=(name,...args)=>{
  const element=createElement(name,...args);
  if(name==='a')element.click=()=>downloads.push({name:element.download,url:element.href});
  if(name==='iframe')Object.defineProperty(element,'contentWindow',{value:{postMessage(payload,origin){if(options.postMessage)options.postMessage(payload,origin);commands.push({data:JSON.parse(payload),origin});}}});
  return element;
 };
 const location = {pathname:'/tab/black-sabbath/snowblind-official-2074495',origin:'https://tabs.ultimate-guitar.com'};
 let tick, timerId=0;
 const intervals=new Map(), timeouts=new Map(), calibrationRequests=[],followRequests=[];
 document.addEventListener('riff-reel-player-follow',event=>followRequests.push(JSON.parse(event.detail)));
 document.addEventListener('riff-reel-player-calibration',event=>{
  const data=JSON.parse(event.detail);calibrationRequests.push(data);
  const ok=options.pauseOk!==false;
  if(ok){
   const change=data.type==='pause'?{type:'pause'}:{type:'position',seconds:data.seconds,seek:true};
   document.dispatchEvent(new window.CustomEvent('riff-reel-player',{detail:JSON.stringify({path:location.pathname,...change})}));
  }
  document.dispatchEvent(new window.CustomEvent('riff-reel-player-calibration-result',{detail:JSON.stringify({type:data.type,path:data.path,ok})}));
 });
 document.addEventListener('riff-reel-site-audio',e=>muting.push(e.detail));
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../content.js'),'utf8'),{
  Blob,URL:{createObjectURL(blob){exported.push(blob);return 'blob:sync-file';},revokeObjectURL(){}},
  window,document,location,RiffCore,RiffSync:require('../sync.js'),CustomEvent:window.CustomEvent,
  setInterval(fn){if(!tick)tick=fn;const id=++timerId;intervals.set(id,fn);return id;},
  clearInterval(id){intervals.delete(id);},
  setTimeout(fn){const id=++timerId;timeouts.set(id,fn);return id;},
  clearTimeout(id){timeouts.delete(id);},
  chrome:{storage:{onChanged:{addListener(fn){storageChanged=fn;}},local:{get:async key=>options.get?options.get(key):({[key]:saved[key]}),set:async data=>options.set?options.set(data):Object.assign(saved,data),remove:async key=>delete saved[key]}},runtime:{getManifest:()=>({version:'1.2.0'}),sendMessage:async()=>{searches.push(true);return options.search?options.search():({videos,error:videos.length?undefined:'No results'});}}},
 });
 await new Promise(resolve=>setImmediate(resolve));
 const panel=document.querySelector('#riff-reel').shadowRoot;
 // LinkeDOM does not implement the browser's checked IDL property.
 panel.querySelector('#sync-player').checked = true;
 panel.querySelector('#replace-audio').checked = panel.querySelector('#replace-audio').hasAttribute('checked');
 const frame=panel.querySelector('iframe');
 if(frame && options.frameLoaded!==false){frame.dispatchEvent(new window.Event('load'));if(options.verifyOrigin!==false)message({event:'infoDelivery',info:{}});commands.length=0;}

 function click(element) {element.dispatchEvent(new window.Event('click',{bubbles:true,composed:true}));}
 function message(data) {
  const event = new window.Event('message');
  Object.assign(event,{origin:'https://www.youtube.com',source:panel.querySelector('iframe').contentWindow,data:JSON.stringify(data)});
  window.dispatchEvent(event);
 }
 return {document,panel,frame,commands,muting,click,message,tick,location,intervals,timeouts,saved,calibrationRequests,followRequests,exported,downloads,searches,storageChanged};
}
test('user-supplied Official SVG Play sends a command immediately and retries when ready',async()=>{
 const f=await setup();
 const buttons=f.document.querySelectorAll('#pro-player-scroll-container button');
 assert.equal(buttons[1].textContent,'');assert.equal(buttons[1].hasAttribute('aria-label'),false);
 // SVG path clicks must resolve to the containing button too.
 f.click(buttons[1].querySelector('path'));
 assert.equal(f.commands.at(-1).data.func,'playVideo');
 assert.equal(f.commands.at(-1).origin,'https://www.youtube.com');
 assert.equal(f.muting.at(-1),true);
 assert.match(f.panel.querySelector('#status').textContent,/Play received/);
 f.message({event:'onReady'});
 assert.equal(f.commands.filter(c=>c.data.func==='playVideo').length,2);
 f.message({event:'onStateChange',info:1});
 assert.equal(f.panel.querySelector('#status').textContent,'');
 // React keeps the button but replaces its children when showing Pause.
 buttons[1].innerHTML='<svg><path d="M5 2h4v16H5zm6 0h4v16h-4z"/></svg>';
 f.click(buttons[1].querySelector('svg'));
 assert.equal(f.commands.at(-1).data.func,'pauseVideo');
 assert.equal(f.muting.at(-1),true); // Keep UG silent while the video is paused.
 buttons[1].innerHTML='<svg><path d="M19 10 5 18V2z"/></svg>';
 f.click(buttons[1]);assert.equal(f.commands.at(-1).data.func,'playVideo');
});
test('other Official controls and identical icons outside the player do not trigger YouTube',async()=>{
 const f=await setup();
 const buttons=f.document.querySelectorAll('#pro-player-scroll-container button');
 for(const index of [0,2,3,4,5])f.click(buttons[index]);
 const unrelated=f.document.createElement('button');unrelated.innerHTML='<svg><path d="M19 10 5 18V2z"/></svg>';
 f.document.body.append(unrelated);f.click(unrelated);
 assert.equal(f.commands.length,0);assert.equal(f.muting.at(-1),false);
});
test('delegation survives replacing the Official Play button and ignores generated IDs/classes',async()=>{
 const f=await setup();
 const original=f.document.querySelectorAll('#pro-player-scroll-container button')[1];
 const replacement=original.cloneNode(true);replacement.id='new-react-id';replacement.className='new-class';
 replacement.querySelector('path').setAttribute('d','M19,10 5,18 V2z');
 original.replaceWith(replacement);
 f.click(replacement);assert.equal(f.commands.at(-1).data.func,'playVideo');
 replacement.disabled=true;const count=f.commands.length;f.click(replacement);assert.equal(f.commands.length,count);
});
test('Play without a video does not silence the site',async()=>{
 const f=await setup(fixture,[]);
 f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]);
 assert.equal(f.muting.at(-1),false);
 assert.match(f.panel.querySelector('#status').textContent,/Choose a video/);
});
test('labelled Play and Pause still work',async()=>{
 const f=await setup('<button aria-label="Play">Play</button><button aria-label="Pause">Pause</button>');
 f.click(f.document.querySelector('[aria-label="Play"]'));assert.equal(f.commands.at(-1).data.func,'playVideo');
 f.click(f.document.querySelector('[aria-label="Pause"]'));assert.equal(f.commands.at(-1).data.func,'pauseVideo');
});
test('React Aria glyph changes before click preserve pointer and keyboard intent',async()=>{
 const f=await setup();
 const button=f.document.querySelectorAll('#pro-player-scroll-container button')[1];
 function gesture(type,key) {
  const event=new f.document.defaultView.Event(type,{bubbles:true});
  if(key)event.key=key;
  button.dispatchEvent(event);
 }
 gesture('pointerdown');
 assert.equal(f.commands.length,0); // A cancelled gesture must not start anything.
 button.innerHTML='<svg><path d="M5 2h4v16H5zm6 0h4v16h-4z"/></svg>';
 f.click(button);assert.equal(f.commands.at(-1).data.func,'playVideo');
 gesture('keydown',' ');
 button.innerHTML='<svg><path d="M19 10 5 18V2z"/></svg>';
 f.click(button);assert.equal(f.commands.at(-1).data.func,'pauseVideo');
});
test('engine count-in and seeks control the iframe through the content bridge',async()=>{
 const f=await setup();
 const emit=data=>f.document.dispatchEvent(new f.document.defaultView.CustomEvent('riff-reel-player',{detail:JSON.stringify({path:f.location.pathname,userInitiated:data.seek===true && !data.driven,...data})}));
 emit({type:'ready'});emit({type:'position',seconds:32});emit({type:'start',countIn:true});
 f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]);
 f.message({event:'onReady'});
 assert.equal(f.muting.at(-1),false); // Keep the site's count-in audible.
 assert.equal(f.commands.some(c=>c.data.func==='playVideo'),false);
 assert.match(f.panel.querySelector('#sync-status').textContent,/YouTube is the clock/);
 emit({type:'countdown',ticks:0});
 assert.equal(f.muting.at(-1),true);
 assert.equal(f.commands.some(c=>c.data.func==='seekTo'),false);
 f.message({event:'infoDelivery',info:{currentTime:32,playerState:1}});
 assert.equal(f.commands.at(-1).data.func,'playVideo');
 emit({type:'position',seconds:92,seek:true});
 assert.equal(f.commands.findLast(c=>c.data.func==='seekTo').data.args[0],92);
 emit({type:'pause'});emit({type:'position',seconds:10,seek:true});
 assert.equal(f.commands.at(-1).data.func,'pauseVideo');
 const count=f.commands.length;emit({type:'position',seconds:100,path:'/tab/another-song',seek:true});
 assert.equal(f.commands.length,count);
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const songStorageKey=RiffCore.songKey('Black Sabbath','Snowblind');
function engine(f,data){f.document.dispatchEvent(new f.document.defaultView.CustomEvent('riff-reel-player',{detail:JSON.stringify({path:f.location.pathname,userInitiated:data.seek===true && !data.driven,...data})}));}
test('legacy offsets become explicit points and the global offset controls are removed',async()=>{
 const offset=RiffCore.offsetKey(songStorageKey,'dQw4w9WgXcQ'),key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ');
 const saved={[offset]:2.5},f=await setup(undefined,undefined,{saved});
 assert.equal(f.panel.querySelector('#offset'),null);
 assert.deepEqual(JSON.parse(JSON.stringify(saved[key])),[{score:0,video:2.5}]);assert.equal(saved[offset],0);
 const reopened=await setup(undefined,undefined,{saved});assert.equal(reopened.panel.querySelector('#point-list').children.length,1);
 f.click(f.panel.querySelector('#point-list button:last-child'));await flush();
 assert.deepEqual(JSON.parse(JSON.stringify(saved[key])),[]);
 const again=await setup(undefined,undefined,{saved});assert.equal(again.panel.querySelector('#point-list').children.length,0);
});
test('failed migration preserves legacy storage and can be retried',async()=>{
 const offset=RiffCore.offsetKey(songStorageKey,'dQw4w9WgXcQ'),key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ');
 const saved={[offset]:-3};const f=await setup(undefined,undefined,{saved,set:async()=>{throw Error('full');}});
 assert.equal(saved[offset],-3);assert.equal(saved[key],undefined);assert.match(f.panel.querySelector('#points-status').textContent,/reload to retry/);
 assert.equal(f.panel.querySelector('#point-list').children.length,1);
 await setup(undefined,undefined,{saved});assert.deepEqual(JSON.parse(JSON.stringify(saved[key])),[{score:3,video:0}]);assert.equal(saved[offset],0);
});
const plain=value=>JSON.parse(JSON.stringify(value));
function startSync(f){f.message({event:'onReady'});engine(f,{type:'ready'});f.click(f.panel.querySelector('#point-sync'));}
function pickTab(f,seconds){engine(f,{type:'position',seconds,seek:true});}
function adjustVideo(f,seconds){f.message({event:'onStateChange',info:1});f.message({event:'infoDelivery',info:{currentTime:seconds,playerState:2}});}
async function addPoint(f,score,video){startSync(f);pickTab(f,score);adjustVideo(f,video);f.click(f.panel.querySelector('#point-save'));await flush();}
test('Sync mode freezes the chosen tab time and lets YouTube move independently until Save',async()=>{
 const saved={},f=await setup(undefined,undefined,{saved});const key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ');
 startSync(f);assert.equal(f.panel.querySelector('#point-editor').hidden,false);assert.equal(f.calibrationRequests[0].type,'pause');
 pickTab(f,30);assert.equal(f.panel.querySelector('#point-score').value,'30.000');
 assert.equal(f.commands.findLast(c=>c.data.func==='seekTo').data.args[0],30);
 adjustVideo(f,31.2);const count=f.commands.length;
 engine(f,{type:'position',seconds:35});engine(f,{type:'pause'});engine(f,{type:'countdown',ticks:0});
 assert.equal(f.commands.length,count);assert.equal(f.panel.querySelector('#point-score').value,'30.000');
 assert.equal(f.panel.querySelector('#point-save').disabled,false);
 f.click(f.panel.querySelector('#point-save'));await flush();
 assert.deepEqual(plain(saved[key]),[{score:30,video:31.2}]);
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);assert.equal(f.panel.querySelector('#sync-player').disabled,false);
 assert.equal(f.commands.findLast(c=>c.data.func==='seekTo').data.args[0],30);
 engine(f,{type:'position',seconds:45,seek:true});assert.equal(f.commands.findLast(c=>c.data.func==='seekTo').data.args[0],46.2);
 assert.ok(Math.abs(f.followRequests.findLast(r=>r.type==='seek').value-30)<1e-9);
});
test('new tab selections replace the draft, discard old video telemetry and apply current calibration',async()=>{
 const saved={[RiffCore.offsetKey(songStorageKey,'dQw4w9WgXcQ')]:2},f=await setup(undefined,undefined,{saved});
 startSync(f);pickTab(f,10);adjustVideo(f,13);assert.equal(f.panel.querySelector('#point-save').disabled,false);
 pickTab(f,60);assert.equal(f.commands.findLast(c=>c.data.func==='seekTo').data.args[0],62);
 assert.equal(f.panel.querySelector('#point-video').value,'62.000');assert.equal(f.panel.querySelector('#point-save').disabled,true);
 f.message({event:'infoDelivery',info:{currentTime:13,playerState:2}});assert.equal(f.panel.querySelector('#point-save').disabled,true);
 adjustVideo(f,64);f.click(f.panel.querySelector('#point-save'));await flush();
 assert.deepEqual(plain(saved[RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ')]),[{score:0,video:2},{score:60,video:64}]);
});
test('Cancel restores following preferences, keeps calibration unchanged and does not restart playback',async()=>{
 const key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ'),saved={[key]:[{score:10,video:11}]},f=await setup(undefined,undefined,{saved});
 f.panel.querySelector('#sync-player').checked=false;startSync(f);pickTab(f,40);adjustVideo(f,44);
 const count=f.commands.filter(c=>c.data.func==='playVideo').length;
 f.click(f.panel.querySelector('#point-cancel'));
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);assert.equal(f.panel.querySelector('#sync-player').checked,false);
 assert.equal(f.commands.filter(c=>c.data.func==='playVideo').length,count);assert.deepEqual(saved[key],[{score:10,video:11}]);
});
test('saving failure keeps Sync mode and the previous calibration intact so Save can be retried',async()=>{
 const writes=[],options={set:async data=>{writes.push(data);throw Error('Full');}},f=await setup(undefined,undefined,options);
 startSync(f);pickTab(f,30);adjustVideo(f,31.2);f.click(f.panel.querySelector('#point-save'));await flush();
 assert.match(f.panel.querySelector('#points-status').textContent,/Could not save/);assert.equal(f.panel.querySelector('#point-editor').hidden,false);
 assert.equal(f.panel.querySelector('#point-list').children.length,0);
 options.set=async data=>Object.assign(f.saved,data);f.click(f.panel.querySelector('#point-save'));await flush();
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);assert.equal(f.panel.querySelector('#point-list').children.length,1);
});
test('saved points use the same Sync mode for editing, and invalid reverse mappings stay in the editor',async()=>{
 const key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ'),saved={[key]:[{score:30,video:31.2},{score:60,video:63}]},f=await setup(undefined,undefined,{saved});
 engine(f,{type:'ready'});f.click(f.panel.querySelector('#point-list button'));
 assert.equal(f.panel.querySelector('#point-score').value,'30.000');assert.ok(f.calibrationRequests.some(request=>request.type==='seek'&&request.seconds===30));
 adjustVideo(f,70);f.click(f.panel.querySelector('#point-save'));await flush();assert.match(f.panel.querySelector('#points-status').textContent,/move forward/);
 assert.equal(f.panel.querySelector('#point-editor').hidden,false);
 adjustVideo(f,31.5);f.click(f.panel.querySelector('#point-save'));await flush();
 assert.deepEqual(plain(saved[key]),[{score:30,video:31.5},{score:60,video:63}]);
 const rows=f.panel.querySelectorAll('#point-list .row');f.click(rows[1].querySelectorAll('button')[1]);await flush();assert.equal(saved[key].length,1);
});
test('changing videos cancels the unsaved Sync draft',async()=>{
 const saved={},f=await setup(undefined,undefined,{saved});startSync(f);pickTab(f,10);adjustVideo(f,11);
 f.panel.querySelector('#url').value='https://youtu.be/abcdefghijk';f.click(f.panel.querySelector('#save'));await flush();
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);assert.equal(f.panel.querySelector('#point-list').children.length,0);
 assert.equal(saved[RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ')],undefined);
});
test('Save stays unavailable until the native tab is paused successfully',async()=>{
 const f=await setup(undefined,undefined,{pauseOk:false});startSync(f);pickTab(f,30);adjustVideo(f,31.2);
 assert.equal(f.panel.querySelector('#point-save').disabled,true);assert.match(f.panel.querySelector('#points-status').textContent,/Could not pause/);
});
test('Keep UG metronome forwards the audio mode and releases it when leaving the page',async()=>{
 const f=await setup(),requests=[];
 f.document.addEventListener('riff-reel-metronome-request',event=>requests.push(JSON.parse(event.detail)));
 const checkbox=f.panel.querySelector('#keep-metronome');checkbox.checked=true;checkbox.onchange();
 assert.deepEqual(requests.at(-1),{active:false,keep:true});
 f.click(f.document.querySelectorAll('#pro-player-scroll-container button')[1]);
 assert.deepEqual(requests.at(-1),{active:true,keep:true});
 checkbox.checked=false;checkbox.onchange();assert.deepEqual(requests.at(-1),{active:true,keep:false});
 f.document.defaultView.dispatchEvent(new f.document.defaultView.Event('pagehide'));
 assert.deepEqual(requests.at(-1),{active:false,keep:false});
});
test('an in-flight save remains scoped to its video when the user switches videos',async()=>{
 const saved={},options={saved},f=await setup(undefined,undefined,options);let release;
 options.set=data=>Object.keys(data).some(key=>key.startsWith('points:'))?new Promise(resolve=>release=()=>{Object.assign(saved,data);resolve();}):Promise.resolve(Object.assign(saved,data));
 startSync(f);pickTab(f,10);adjustVideo(f,11);f.click(f.panel.querySelector('#point-save'));await flush();
 f.panel.querySelector('#url').value='https://youtu.be/abcdefghijk';f.click(f.panel.querySelector('#save'));await flush();
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);release();await flush();
 assert.equal(saved[RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ')].length,1);
 assert.equal(f.panel.querySelector('#point-list').children.length,0);
 startSync(f);assert.equal(f.panel.querySelector('#point-editor').hidden,false);
});
test('UG Play cannot take over the video during Sync mode, and is paused after its start call finishes',async()=>{
 const f=await setup();startSync(f);pickTab(f,10);adjustVideo(f,11);
 const count=f.commands.length,requests=f.calibrationRequests.length;
 engine(f,{type:'start',countIn:false});assert.equal(f.commands.length,count);assert.equal(f.calibrationRequests.length,requests);
 assert.equal(f.panel.querySelector('#point-save').disabled,true);
 [...f.timeouts.values()][0]();
 assert.equal(f.commands.length,count);assert.equal(f.calibrationRequests.at(-1).type,'pause');assert.equal(f.panel.querySelector('#point-save').disabled,false);
});
test('navigation cancels Sync mode and restores the disabled controls without saving the draft',async()=>{
 const f=await setup();startSync(f);pickTab(f,10);adjustVideo(f,11);
 f.location.pathname='/tab/radiohead/creep-chords-3';f.document.title='Creep CHORDS by Radiohead @ Ultimate-Guitar.Com';
 f.tick();await flush();
 assert.equal(f.panel.querySelector('#point-editor').hidden,true);assert.equal(f.panel.querySelector('#sync-player').disabled,false);
 assert.equal(f.panel.querySelector('#points-controls').disabled,false);
 assert.equal(f.saved[RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ')],undefined);
});
test('time fields preserve a keyboard draft during telemetry and commit decimal edits',async()=>{
 const f=await setup();startSync(f);pickTab(f,30);adjustVideo(f,31);
 const input=f.panel.querySelector('#point-video');
 assert.equal(input.getAttribute('type'),'number');assert.equal(input.hasAttribute('readonly'),false);
 input.onfocus();input.value='31.250';adjustVideo(f,32);
 assert.equal(input.value,'31.250');
 input.onchange();assert.equal(f.commands.at(-1).data.func,'seekTo');assert.equal(f.commands.at(-1).data.args[0],31.25);
 assert.equal(f.panel.querySelector('#point-save').disabled,true);
 input.onblur();adjustVideo(f,31.25);
 const score=f.panel.querySelector('#point-score');score.value='40.125';score.onchange();
 assert.equal(f.calibrationRequests.some(r=>r.type==='seek'&&r.seconds===40.125),true);
 input.value='-1';const count=f.commands.length;input.onchange();assert.equal(f.commands.length,count);
 assert.match(f.panel.querySelector('#points-status').textContent,/Enter a time/);
});
test('millisecond buttons adjust both number inputs precisely, accumulate pending seeks and clamp boundaries',async()=>{
 const f=await setup();startSync(f);pickTab(f,30);adjustVideo(f,31);
 for(const id of ['point-score','point-video']) {
  const input=f.panel.querySelector('#'+id);assert.equal(input.type,'number');assert.equal(input.getAttribute('step'),'0.001');
  const initial=Number(input.value);
  f.click(f.panel.querySelector('#'+id+'-plus-one'));assert.equal(Number(input.value),initial+0.001);
  f.click(f.panel.querySelector('#'+id+'-plus-ten'));assert.equal(Number(input.value),initial+0.011);
  f.click(f.panel.querySelector('#'+id+'-minus-one'));assert.equal(Number(input.value),initial+0.010);
  f.click(f.panel.querySelector('#'+id+'-minus-ten'));assert.equal(Number(input.value),initial);
 }
 const video=f.panel.querySelector('#point-video');video.value='0.000';f.click(f.panel.querySelector('#point-video-minus-ten'));assert.equal(video.value,'0.000');
 video.value='86400.000';f.click(f.panel.querySelector('#point-video-plus-one'));assert.equal(video.value,'86400.000');
 assert.equal(f.commands.at(-1).data.args[0],86400);
});
function importFile(f,text,size=text.length){const input=f.panel.querySelector('#points-file');Object.defineProperty(input,'files',{configurable:true,value:[{size,text:async()=>text}]});return input.onchange();}
function syncFile(points=[{score:10,video:12}],extra={}){return require('../sync.js').exportFile({artist:'Black Sabbath',song:'Snowblind',youtubeId:'dQw4w9WgXcQ',points,...extra});}
test('import previews validated points and replaces only after confirmation; Cancel preserves saved points',async()=>{
 const f=await setup(),key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ');
 await importFile(f,syncFile());assert.equal(f.panel.querySelector('#points-preview').hidden,false);assert.equal(f.saved[key],undefined);
 f.click(f.panel.querySelector('#points-import-cancel'));assert.equal(f.saved[key],undefined);
 await importFile(f,syncFile());f.click(f.panel.querySelector('#points-replace'));await flush();
 assert.deepEqual(plain(f.saved[key]),[{score:10,video:12}]);assert.equal(f.panel.querySelector('#points-preview').hidden,true);
 await importFile(f,syncFile([]));assert.match(f.panel.querySelector('#points-preview-text').textContent,/with 0 imported/);
 f.click(f.panel.querySelector('#points-replace'));await flush();assert.deepEqual(plain(f.saved[key]),[]);
});
test('import rejects wrong song, wrong video, malformed files and oversized files without saving',async()=>{
 const f=await setup(),key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ');
 for(const text of [syncFile([],{song:'Other'}),syncFile([],{youtubeId:'abcdefghijk'}),'{}','garbage']){
  await importFile(f,text);assert.equal(f.panel.querySelector('#points-preview').hidden,true);assert.equal(f.saved[key],undefined);
 }
 await importFile(f,syncFile(),65537);assert.match(f.panel.querySelector('#points-status').textContent,/64 KB/);
});
test('an import read from a previous video is discarded and failed writes allow retry',async()=>{
 const options={},f=await setup(undefined,undefined,options);let release;
 const input=f.panel.querySelector('#points-file');Object.defineProperty(input,'files',{configurable:true,value:[{size:100,text:()=>new Promise(resolve=>release=resolve)}]});
 const pending=input.onchange();f.panel.querySelector('#url').value='https://youtu.be/abcdefghijk';f.click(f.panel.querySelector('#save'));await flush();release(syncFile());await pending;
 assert.equal(f.panel.querySelector('#points-preview').hidden,true);
 await importFile(f,syncFile([{score:1,video:2}],{youtubeId:'abcdefghijk'}));
 options.set=async()=>{throw Error('full');};f.click(f.panel.querySelector('#points-replace'));await flush();
 assert.equal(f.panel.querySelector('#points-preview').hidden,false);assert.match(f.panel.querySelector('#points-status').textContent,/Could not save/);
 options.set=async data=>Object.assign(f.saved,data);f.click(f.panel.querySelector('#points-replace'));await flush();assert.equal(f.panel.querySelector('#points-preview').hidden,true);
});
test('Export downloads a versioned file for the active song and video with current saved points',async()=>{
 const key=RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ');const f=await setup(undefined,undefined,{saved:{[key]:[{score:10,video:12.345}]}});
 f.click(f.panel.querySelector('#points-export'));assert.equal(f.downloads.length,1);assert.match(f.downloads[0].name,/dQw4w9WgXcQ\.riff-sync\.json$/);
 const data=require('../sync.js').parseFile(await f.exported[0].text());assert.equal(data.song,'Snowblind');assert.deepEqual(data.points,[{score:10,video:12.345}]);
 startSync(f);const count=f.exported.length;f.click(f.panel.querySelector('#points-export'));assert.equal(f.exported.length,count);
});
test('Open, Video and Close modes preserve the same video and calibration without playback commands',async()=>{
 const f=await setup(),panel=f.panel.querySelector('#panel'),frame=f.panel.querySelector('iframe');
 const count=f.commands.length;
 for(const mode of ['video','closed','open']){
  f.click(f.panel.querySelector('#mode-'+mode));assert.equal(panel.dataset.mode,mode);
  assert.equal(f.panel.querySelector('#mode-'+mode).getAttribute('aria-pressed'),'true');
  assert.equal(f.panel.querySelector('iframe'),frame);assert.equal(f.commands.length,count);
 }
 await flush();assert.equal(f.saved['riff-reel:panel-mode'],'open');
 f.click(f.panel.querySelector('#mode-closed'));f.click(f.panel.querySelector('#reopen'));assert.equal(panel.dataset.mode,'open');
});
test('panel mode is restored locally and Sync mode expands all calibration controls',async()=>{
 const f=await setup(undefined,undefined,{saved:{'riff-reel:panel-mode':'video'}});
 assert.equal(f.panel.querySelector('#panel').dataset.mode,'video');
 startSync(f);assert.equal(f.panel.querySelector('#panel').dataset.mode,'open');assert.equal(f.panel.querySelector('#sync-section').open,true);
});
test('a stalled calibration seek can use an explicitly confirmed reported position without saving a guessed time',async()=>{
 const f=await setup();startSync(f);pickTab(f,60);
 f.message({event:'infoDelivery',info:{currentTime:13,playerState:2}});
 assert.equal(f.panel.querySelector('#point-save').disabled,true);
 const recover=f.panel.querySelector('#point-use-current');assert.equal(recover.hidden,false);assert.equal(recover.disabled,false);
 f.click(recover);assert.equal(f.panel.querySelector('#point-save').disabled,false);assert.equal(f.panel.querySelector('#point-video').value,'13.000');
 f.click(f.panel.querySelector('#point-save'));await flush();
 assert.deepEqual(plain(f.saved[RiffCore.pointsKey(songStorageKey,'dQw4w9WgXcQ')]),[{score:60,video:13}]);
});
test('waiting calibration seeks poll YouTube, accept a reported end boundary and clear recovery samples on a new selection',async()=>{
 const f=await setup();startSync(f);pickTab(f,600);
 const count=f.commands.length;f.tick();assert.ok(f.commands.slice(count).some(c=>c.data.event==='listening'));
 f.message({event:'infoDelivery',info:{currentTime:120,duration:120,playerState:2}});
 assert.equal(f.panel.querySelector('#point-save').disabled,false);assert.equal(f.panel.querySelector('#point-video').value,'120.000');
 pickTab(f,30);assert.equal(f.panel.querySelector('#point-use-current').disabled,true);
 f.message({event:'infoDelivery',info:{currentTime:120,playerState:3}});
 assert.equal(f.panel.querySelector('#point-use-current').disabled,true);assert.equal(f.panel.querySelector('#point-save').disabled,true);
});
