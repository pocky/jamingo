const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const {create}=require('../native-metronome.js');
function setup(){
 const {document,window}=parseHTML('<html></html>'),exemptions=[],reports=[],calls=[];
 document.addEventListener('riff-reel-native-audio',e=>exemptions.push(e.detail));
 document.addEventListener('riff-reel-metronome-status',e=>reports.push(JSON.parse(e.detail)));
 const levels=new Map([[0,0.75],[1,0.4]]),context={};
 const api={_xtzAudioModule:{audioContext:context},setPartVolume(id,volume){levels.set(id,volume);calls.push([id,volume]);}};
 let callbackThis;
 const service={api,listeners:{onScoreLoaded(){callbackThis=this;return 42;}},setListeners(_owner,listeners){this.listeners=listeners;}};
 const model=create({document,CustomEvent:window.CustomEvent});model.bindService(service);
 function seed(){return service.listeners.onScoreLoaded(1,{parts:[{volume:0.75},{volume:0.4}]});}
 return {model,service,api,seed,levels,context,exemptions,reports,calls,get callbackThis(){return callbackThis;}};
}
test('mute parts before opening the exact engine context and restore original levels',()=>{
 const f=setup();assert.equal(f.seed(),42);assert.equal(f.callbackThis,f.service.listeners);
 f.model.request(true,true);
 assert.deepEqual([...f.levels.values()],[0,0]);assert.equal(f.exemptions.at(-1).context,f.context);assert.equal(f.exemptions.at(-1).enabled,true);
 assert.equal(f.reports.at(-1).active,true);
 f.model.request(true,false);
 assert.equal(f.exemptions.at(-1).enabled,false);assert.deepEqual([...f.levels.values()],[0.75,0.4]);
});
test('changes to part levels remain muted while preserving the latest requested settings',()=>{
 const f=setup();f.seed();f.model.request(true,true);
 f.api.setPartVolume(0,0.2);assert.equal(f.levels.get(0),0);
 f.api.setPartVolume(1,0);assert.equal(f.levels.get(1),0);
 f.model.request(false,true);assert.deepEqual([...f.levels.values()],[0.2,0]);
});
test('do not open a context without a complete score snapshot or native context',()=>{
 const f=setup();f.api.setPartVolume(0,0.5);f.model.request(true,true);
 assert.equal(f.reports.at(-1).ready,false);assert.equal(f.exemptions.some(e=>e.enabled),false);
 f.seed();assert.equal(f.reports.at(-1).active,true);
 f.api._xtzAudioModule.audioContext=null;f.model.bindService(f.service);
 assert.equal(f.reports.at(-1).ready,false);assert.deepEqual([...f.levels.values()],[0.75,0.4]);
});
test('capture metadata before normal score handlers can restore their own volume preferences',()=>{
 const f=setup();f.service.setListeners('owner',{onScoreLoaded(){f.api.setPartVolume(0,0.1);}});
 f.seed();f.model.request(true,true);f.model.request(false,true);
 assert.equal(f.levels.get(0),0.1);
});
test('isolation failure closes the gate and restores partially changed parts',()=>{
 const f=setup();f.seed();const original=f.api.setPartVolume;
 // A failing new engine API is discovered like a replacement player instance.
 f.service.api={_xtzAudioModule:{audioContext:f.context},setPartVolume(id,volume){if(id===1&&volume===0)throw Error('Engine failure');original.call(f.api,id,volume);}};
 f.model.bindService(f.service);f.seed();f.model.request(true,true);
 assert.equal(f.exemptions.at(-1).enabled,false);assert.equal(f.reports.at(-1).active,false);
 assert.deepEqual([...f.levels.values()],[0.75,0.4]);
});
test('reset clears per-score state and disables any context exemption',()=>{
 const f=setup();f.seed();f.model.request(true,true);f.model.reset();
 assert.equal(f.exemptions.at(-1).enabled,false);assert.deepEqual([...f.levels.values()],[0.75,0.4]);
 f.model.request(true,true);assert.equal(f.reports.at(-1).ready,false);
});
