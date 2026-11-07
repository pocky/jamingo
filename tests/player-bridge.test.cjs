const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const {document,window}=parseHTML('<html><body><div id="pro-player-scroll-container"></div></body></html>');
 const events=[],calls=[];
 const wasm={};
 for(const name of ['onCountdownTick','onPlaybackPositionChanged','onPlaybackSecondResponse','onPlayHeadPositionSet','onPlaybackStatusChanged','onScoreLoadingStarted']){
  wasm[name]=function(...args){calls.push({name,args,self:this});return 42;};
 }
 const api={_xtzMainWasmModule:wasm,_xtzAudioModule:{audioContext:{}},setPartVolume(id,volume){calls.push({name:'setPartVolume',args:[id,volume]});},play(countIn){calls.push({name:'play',args:[countIn],self:this});return 'played';},pause(){calls.push({name:'pause',args:[]});return 'paused';},setPlayPositionByTime(seconds){calls.push({name:'setPlayPositionByTime',args:[seconds]});wasm.onPlayHeadPositionSet(1,seconds);},stop(){},setPlaybackSpeed(){},requestPlaybackSecond(){wasm.onPlaybackSecondResponse(12);}};
 const service={api,listeners:{onScoreLoaded(){}},setListeners(_owner,listeners){this.listeners=listeners;},clearListeners(){}};
 // A factory signature taken from the saved page's public loader; no site code
 // is executed in this fixture. IDs and exported property names are arbitrary.
 function factory(){/* XTZ API service is already initialized; clearListeners */}
 function webpackRequire(id){assert.equal(id,'random-module-id');return {randomExport:service};}
 webpackRequire.m={'random-module-id':factory};
 const chunks=[];chunks.push=function(chunk){chunk[2](webpackRequire);};
 document.addEventListener('riff-reel-player',event=>events.push(JSON.parse(event.detail)));
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../player-bridge.js'),'utf8'),{document,RiffMetronome:require('../native-metronome.js'),CustomEvent:window.CustomEvent,location:{pathname:'/tab/black-sabbath/snowblind-official-2074495'},webpackChunkug_react_i18n_es6:chunks});
 const request=()=>document.dispatchEvent(new window.CustomEvent('riff-reel-player-request'));
 return {document,window,events,calls,api,wasm,service,request};
}
test('locate the existing XTZ service without hardcoded module ID or export name',()=>{
 const f=setup();f.request();assert.equal(f.events.at(-1).type,'ready');
 assert.equal(f.api.play(true),'played');
 assert.deepEqual(f.events.at(-1).countIn,true);
 assert.equal(f.calls.at(-1).self,f.api);
 assert.equal(f.wasm.onCountdownTick(3),42);assert.equal(f.events.at(-1).ticks,3);
 assert.equal(f.wasm.onPlaybackPositionChanged(57,0,0,12,0,0),42);
 assert.equal(f.events.at(-1).seconds,57);assert.equal(f.calls.at(-1).self,f.wasm);
 f.wasm.onPlayHeadPositionSet(1,24);assert.equal(f.events.at(-1).seek,true);assert.equal(f.events.at(-1).seconds,24);
});
test('repeated discovery does not stack wrappers; engine queries preserve original callbacks',()=>{
 const f=setup();f.request();f.request();f.api.play(false);
 assert.equal(f.events.filter(e=>e.type==='start').length,1);
 f.document.dispatchEvent(new f.window.CustomEvent('riff-reel-player-position-request'));
 assert.equal(f.events.at(-1).seconds,12);
 assert.equal(f.calls.at(-1).name,'onPlaybackSecondResponse');
});
test('attach once initialization finishes and survive listener replacement by UG',()=>{
 const f=setup(),api=f.api;f.service.api=null;f.request();assert.equal(f.events.length,0);
 f.service.api=api;f.request();f.service.listeners={onCountdownTick(){}};
 f.wasm.onCountdownTick(0);assert.equal(f.events.at(-1).ticks,0);
 f.api.pause();assert.equal(f.events.at(-1).type,'pause');
});
test('outside the player, discovering the bridge does not initialize UG modules',()=>{
 const f=setup();f.document.getElementById('pro-player-scroll-container').remove();f.request();assert.equal(f.events.length,0);
});
test('capture native score metadata before the player DOM is mounted and then preserve the metronome',()=>{
 const f=setup(),player=f.document.getElementById('pro-player-scroll-container');player.remove();f.request();
 f.service.listeners.onScoreLoaded(1,{parts:[{volume:0.8},{volume:0.5}]});
 f.document.body.append(player);f.request();
 const reports=[];f.document.addEventListener('riff-reel-metronome-status',e=>reports.push(JSON.parse(e.detail)));
 f.document.dispatchEvent(new f.window.CustomEvent('riff-reel-metronome-request',{detail:JSON.stringify({active:true,keep:true})}));
 assert.equal(reports.at(-1).active,true);
 assert.deepEqual(f.calls.filter(call=>call.name==='setPartVolume').map(call=>call.args),[[0,0],[1,0]]);
 f.document.dispatchEvent(new f.window.CustomEvent('riff-reel-metronome-request',{detail:JSON.stringify({active:false,keep:true})}));
 assert.deepEqual(f.calls.filter(call=>call.name==='setPartVolume').slice(-2).map(call=>call.args),[[0,0.8],[1,0.5]]);
});
test('calibration commands pause and seek UG only for the current tab and valid seconds',()=>{
 const f=setup(),results=[];f.request();
 f.document.addEventListener('riff-reel-player-calibration-result',e=>results.push(JSON.parse(e.detail)));
 const send=data=>f.document.dispatchEvent(new f.window.CustomEvent('riff-reel-player-calibration',{detail:JSON.stringify({path:'/tab/black-sabbath/snowblind-official-2074495',...data})}));
 send({type:'pause'});assert.equal(results.at(-1).ok,true);assert.ok(f.calls.some(call=>call.name==='pause'));
 send({type:'seek',seconds:42});assert.equal(results.at(-1).ok,true);assert.ok(f.calls.some(call=>call.name==='setPlayPositionByTime'&&call.args[0]===42));
 send({type:'seek',seconds:-1});assert.equal(results.at(-1).ok,false);
 const count=f.calls.length;send({type:'seek',seconds:100,path:'/tab/other'});assert.equal(f.calls.length,count);
});
test('audio-follow commands control only UG and tag feedback to avoid loops',()=>{
 const f=setup();f.request();
 const send=data=>f.document.dispatchEvent(new f.window.CustomEvent('riff-reel-player-follow',{detail:JSON.stringify({path:'/tab/black-sabbath/snowblind-official-2074495',...data})}));
 send({type:'seek',value:42});assert.equal(f.events.at(-1).driven,true);
 assert.equal(f.events.at(-1).seconds,42);
 send({type:'play'});assert.equal(f.events.at(-1).type,'start');assert.equal(f.events.at(-1).driven,true);assert.equal(f.events.at(-1).countIn,false);
 send({type:'pause'});assert.equal(f.events.at(-1).driven,true);
 const count=f.calls.length;send({type:'seek',value:-1});send({type:'speed',value:5});send({type:'play',path:'/tab/other'});assert.equal(f.calls.length,count);
});
test('late or beat-snapped automatic seek feedback never becomes a user navigation',()=>{
 const f=setup();f.request();
 f.document.dispatchEvent(new f.window.CustomEvent('riff-reel-player-follow',{detail:JSON.stringify({path:'/tab/black-sabbath/snowblind-official-2074495',type:'seek',value:10})}));
 f.wasm.onPlayHeadPositionSet(1,11.5);
 assert.equal(f.events.at(-1).userInitiated,false);assert.equal(f.events.at(-1).driven,true);
 f.wasm.onPlayHeadPositionSet(1,20);assert.equal(f.events.at(-1).userInitiated,false);
});
test('only an explicit score gesture marks the next position callback as user navigation',()=>{
 const f=setup();f.request();
 const canvas=f.document.createElement('canvas');canvas.id='xtz_canvas';f.document.getElementById('pro-player-scroll-container').append(canvas);
 const gesture=new f.window.Event('pointerdown',{bubbles:true});Object.defineProperty(gesture,'isTrusted',{value:true});canvas.dispatchEvent(gesture);
 f.wasm.onPlayHeadPositionSet(1,42);assert.equal(f.events.at(-1).userInitiated,true);assert.equal(f.events.at(-1).driven,false);
 f.wasm.onPlayHeadPositionSet(1,43);assert.equal(f.events.at(-1).userInitiated,false);
});
