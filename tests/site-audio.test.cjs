const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('audio observation is idle when disabled and only scans inserted subtrees while active',()=>{
 const f=fixture();assert.equal(f.observation.active,false);assert.equal(f.observation.scans,0);
 f.mute(true);assert.equal(f.observation.active,true);assert.equal(f.observation.scans,1);
 f.mute(true);assert.equal(f.observation.scans,1);
 const audio=new f.HTMLMediaElement();
 for(let i=0;i<1000;i++)f.mutation([{addedNodes:[{querySelectorAll(){return [];}}]}]);
 f.mutation([{addedNodes:[{querySelectorAll(){return [audio];}}]}]);
 assert.equal(audio.muted,true);assert.equal(f.observation.scans,1);
 f.mute(false);assert.equal(f.observation.active,false);assert.equal(audio.muted,false);
});
function fixture() {
 const listeners = {}, media = [], contexts = [], observation = {active:false,scans:0};
 class AudioNode {
  constructor(context) {this.context=context;this.connections=[];}
  connect(destination,...ports) {this.connections.push({destination,ports});return destination;}
  disconnect(...args) {this.lastDisconnect=args;}
 }
 class HTMLMediaElement {constructor(muted=false){this.muted=muted;}}
 function context() {
  const ctx={state:'running',createGain(){const gate=new AudioNode(ctx);gate.gain={value:1};return gate;}};
  ctx.destination=new AudioNode(ctx);contexts.push(ctx);return ctx;
 }
 let mutation;
 const document={addEventListener(name,fn){listeners[name]=fn;},querySelectorAll(){observation.scans++;return media;}};
 const location={pathname:'/tab/oasis/wonderwall-1'};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site-audio.js'),'utf8'), {
  AudioNode,HTMLMediaElement,document,location,
  MutationObserver:class {constructor(fn){mutation=fn;}observe(){observation.active=true;}disconnect(){observation.active=false;}},
 });
 return {AudioNode,HTMLMediaElement,context,media,location,mutation,observation,
  mute(value){listeners['riff-reel-site-audio']({detail:value});},
  native(context,enabled){listeners['riff-reel-native-audio']({detail:{context,enabled}});},
  emit(name,target){listeners[name]({target});}};
}
test('Web Audio routes through a reversible gate without pausing the graph',()=>{
 const f=fixture(),ctx=f.context(),source=new f.AudioNode(ctx);
 assert.equal(source.connect(ctx.destination,0,0),ctx.destination);
 const gate=source.connections[0].destination;
 assert.equal(gate.connections[0].destination,ctx.destination);
 assert.equal(gate.gain.value,1);
 f.mute(true);assert.equal(gate.gain.value,0);assert.equal(ctx.state,'running');
 const second=new f.AudioNode(ctx);second.connect(ctx.destination);
 assert.equal(second.connections[0].destination,gate);
 source.disconnect(ctx.destination,0,0);
 assert.equal(source.lastDisconnect[0],gate);
 assert.deepEqual(source.lastDisconnect.slice(1),[0,0]);
 f.mute(false);assert.equal(gate.gain.value,1);
 const intermediate=new f.AudioNode(ctx);source.connect(intermediate);
 assert.equal(source.connections.at(-1).destination,intermediate);
});
test('new contexts start silent while replacement is active',()=>{
 const f=fixture();f.mute(true);
 const ctx=f.context(),node=new f.AudioNode(ctx);node.connect(ctx.destination);
 assert.equal(node.connections[0].destination.gain.value,0);
 f.mute(false);assert.equal(node.connections[0].destination.gain.value,1);
});
test('media elements are silenced including dynamic media, and initial mute state is restored',()=>{
 const f=fixture(),audible=new f.HTMLMediaElement(),muted=new f.HTMLMediaElement(true);
 f.media.push(audible,muted);f.mute(true);
 assert.equal(audible.muted,true);assert.equal(muted.muted,true);
 audible.muted=false;f.emit('volumechange',audible);assert.equal(audible.muted,true);
 const added=new f.HTMLMediaElement();f.media.push(added);f.mutation([{addedNodes:[added]}]);assert.equal(added.muted,true);
 const playing=new f.HTMLMediaElement();f.emit('play',playing);assert.equal(playing.muted,true);
 f.mute(false);
 assert.equal(audible.muted,false);assert.equal(muted.muted,true);assert.equal(added.muted,false);assert.equal(playing.muted,false);
});
test('invalid bridge data and non-tab pages cannot activate replacement',()=>{
 const f=fixture(),ctx=f.context(),node=new f.AudioNode(ctx);node.connect(ctx.destination);
 const gate=node.connections[0].destination;
 f.mute('true');assert.equal(gate.gain.value,1);
 f.location.pathname='/explore';f.mute(true);assert.equal(gate.gain.value,1);
});
test('manifest installs the audio bridge before page scripts, in the page world',()=>{
 const m=require('../manifest.json');
 const script=m.content_scripts.find(s=>s.js.includes('site-audio.js'));
 assert.equal(script.world,'MAIN');assert.equal(script.run_at,'document_start');
 assert.deepEqual(script.matches,['https://tabs.ultimate-guitar.com/*']);
 assert.equal(script.all_frames,undefined); // Never patch the YouTube iframe.
});
test('native metronome exemption opens only the XTZ context and keeps media and other audio muted',()=>{
 const f=fixture(),xtz=f.context(),other=f.context();
 const nativeSource=new f.AudioNode(xtz),otherSource=new f.AudioNode(other);
 nativeSource.connect(xtz.destination);otherSource.connect(other.destination);
 const media=new f.HTMLMediaElement();f.media.push(media);
 f.mute(true);f.native(xtz,true);
 assert.equal(nativeSource.connections[0].destination.gain.value,1);
 assert.equal(otherSource.connections[0].destination.gain.value,0);assert.equal(media.muted,true);
 f.native(xtz,false);assert.equal(nativeSource.connections[0].destination.gain.value,0);
 f.mute(false);assert.equal(nativeSource.connections[0].destination.gain.value,1);assert.equal(media.muted,false);
});
test('a native exemption also applies if the context connects after isolation is enabled',()=>{
 const f=fixture(),ctx=f.context();f.mute(true);f.native(ctx,true);
 const source=new f.AudioNode(ctx);source.connect(ctx.destination);assert.equal(source.connections[0].destination.gain.value,1);
 f.location.pathname='/explore';f.native(ctx,true);assert.equal(source.connections[0].destination.gain.value,0);
});
