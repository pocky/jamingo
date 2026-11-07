const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../sync.js');
function setup(){let time=0;const commands=[],statuses=[];const sync=create({command:(name,args=[])=>commands.push({name,args}),status:text=>statuses.push(text),now:()=>time});return {sync,commands,statuses,advance(ms){time+=ms;}};}
test('count-in waits for the final tick then seeks to the actual score position',()=>{
 const f=setup();f.sync.event({type:'ready'});f.sync.event({type:'position',seconds:12});
 f.sync.event({type:'start',countIn:true});
 for(const ticks of [4,3,2,1])f.sync.event({type:'countdown',ticks});
 assert.equal(f.commands.some(c=>c.name==='playVideo'),false);
 f.sync.resume();assert.equal(f.commands.at(-1).name,'pauseVideo');
 f.sync.event({type:'countdown',ticks:0});
 assert.deepEqual(f.commands.find(c=>c.name==='seekTo').args,[12,true]);
 assert.equal(f.commands.at(-1).name,'playVideo');
});
test('measure jumps seek in seconds, including backwards, without playing a paused video',()=>{
 const f=setup();f.sync.event({type:'position',seconds:65,seek:true,userInitiated:true});
 assert.deepEqual(f.commands,[{name:'seekTo',args:[65,true]},{name:'pauseVideo',args:[]}]);
 f.sync.event({type:'start',countIn:false});f.advance(1000);
 f.sync.event({type:'position',seconds:4,seek:true,userInitiated:true});
 assert.deepEqual(f.commands.at(-1),{name:'seekTo',args:[4,true]});
});
test('normal progress does not repeatedly seek but significant drift is corrected',()=>{
 const f=setup();f.sync.event({type:'position',seconds:0});f.sync.event({type:'start',countIn:false});
 for(let i=1;i<=30;i++){f.advance(100);f.sync.event({type:'position',seconds:i/10});}
 assert.equal(f.commands.filter(c=>c.name==='seekTo').length,1);
 f.advance(500);f.sync.event({type:'position',seconds:45});
 assert.deepEqual(f.commands.at(-1),{name:'seekTo',args:[45,true]});
});
test('pause cancels a count-in and a late zero tick cannot restart playback',()=>{
 const f=setup();f.sync.event({type:'start',countIn:true});f.sync.event({type:'pause'});
 f.sync.event({type:'countdown',ticks:0});f.sync.resume();
 assert.equal(f.commands.some(c=>c.name==='playVideo'),false);
});
test('reset and disabling synchronization prevent old state from controlling a new song',()=>{
 const f=setup();f.sync.event({type:'ready'});f.sync.event({type:'start',countIn:true});
 f.sync.reset();f.sync.event({type:'countdown',ticks:0});
 assert.equal(f.sync.state.available,false);assert.equal(f.sync.state.position,null);
 f.sync.setEnabled(false);const count=f.commands.length;
 f.sync.event({type:'start',countIn:false});f.sync.event({type:'position',seconds:50,seek:true,userInitiated:true});
 assert.equal(f.commands.length,count);
});
test('invalid positions are rejected and requested speed is passed to YouTube',()=>{
 const f=setup();
 for(const seconds of [NaN,Infinity,-1,'12'])f.sync.event({type:'position',seconds,seek:true,userInitiated:true});
 assert.equal(f.commands.length,0);
 f.sync.event({type:'speed',rate:0.75});f.sync.event({type:'start',countIn:false});
 assert.ok(f.commands.some(c=>c.name==='setPlaybackRate'&&c.args[0]===0.75));
});
test('positive offsets skip intros and survive count-in and jumps',()=>{
 const f=setup();f.sync.setOffset(10.2);
 f.sync.event({type:'position',seconds:0});f.sync.event({type:'start',countIn:true});
 assert.equal(f.commands.some(c=>c.name==='seekTo'),false);
 f.sync.event({type:'countdown',ticks:0});
 assert.deepEqual(f.commands.find(c=>c.name==='seekTo').args,[10.2,true]);
 f.sync.event({type:'position',seconds:30,seek:true,userInitiated:true});
 assert.deepEqual(f.commands.at(-1).args,[40.2,true]);
 f.advance(1000);f.sync.event({type:'position',seconds:31});
 assert.equal(f.commands.filter(c=>c.name==='seekTo').length,2);
});
test('negative offsets wait at zero until a valid video position exists',()=>{
 const f=setup();f.sync.setOffset(-2);
 f.sync.event({type:'position',seconds:0});f.sync.event({type:'start',countIn:false});
 assert.equal(f.sync.state.waiting,true);assert.equal(f.commands.some(c=>c.name==='playVideo'),false);
 for(const seconds of [0.5,1,1.9])f.sync.event({type:'position',seconds});
 assert.equal(f.commands.some(c=>c.name==='playVideo'),false);
 f.sync.event({type:'position',seconds:2});
 assert.equal(f.sync.state.waiting,false);assert.equal(f.commands.at(-1).name,'playVideo');
 assert.ok(f.commands.filter(c=>c.name==='seekTo').every(c=>c.args[0]>=0));
 f.sync.event({type:'position',seconds:0.5,seek:true,userInitiated:true});
 assert.equal(f.sync.state.waiting,true);assert.equal(f.commands.at(-1).name,'pauseVideo');
});
test('adjustments while paused seek without resuming, and while counting wait until count-in ends',()=>{
 const f=setup();f.sync.event({type:'position',seconds:10,seek:true,userInitiated:true});
 f.sync.setOffset(0.3);assert.deepEqual(f.commands.at(-2).args,[10.3,true]);assert.equal(f.commands.at(-1).name,'pauseVideo');
 f.sync.event({type:'start',countIn:true});const count=f.commands.length;
 f.sync.setOffset(1.1);assert.equal(f.commands.length,count);
 f.sync.event({type:'countdown',ticks:0});
 assert.deepEqual(f.commands.findLast(c=>c.name==='seekTo').args,[11.1,true]);
});
test('offset rounding, validation, reset and timing state remain explicit',()=>{
 const f=setup();assert.equal(f.sync.setOffset(0.1+0.2),true);assert.equal(f.sync.state.offset,0.3);
 for(const offset of [NaN,Infinity,-Infinity,'2',3600.1,-3600.1])assert.equal(f.sync.setOffset(offset),false);
 assert.equal(f.sync.state.offset,0.3);
 f.sync.event({type:'reset'});assert.equal(f.sync.state.offset,0.3);
 f.sync.reset();assert.equal(f.sync.state.offset,0);
});
test('millisecond precision survives repeated fine nudges without accumulating floating point error',()=>{
 const f=setup();f.sync.setOffset(0.027);assert.equal(f.sync.state.offset,0.027);
 for(let i=0;i<100;i++)f.sync.setOffset(f.sync.state.offset+0.01);
 assert.equal(f.sync.state.offset,1.027);
 for(let i=0;i<100;i++)f.sync.setOffset(f.sync.state.offset-0.01);
 assert.equal(f.sync.state.offset,0.027);
 f.sync.event({type:'position',seconds:10,seek:true,userInitiated:true});
 assert.deepEqual(f.commands.at(-2).args,[10.027,true]);
});
const {normalizePoints,mapPosition}=require('../sync.js');
test('point mapping interpolates drift and uses a constant offset outside known anchors',()=>{
 const points=normalizePoints([{score:60,video:63},{score:30,video:31.2}]);
 assert.equal(mapPosition(points,45).seconds,47.1);
 assert.ok(Math.abs(mapPosition(points,0).seconds-1.2)<1e-12);
 assert.equal(mapPosition(points,90).seconds,93);
 assert.equal(mapPosition([{score:20,video:21.5}],5).seconds,6.5);
 assert.equal(mapPosition([],12).seconds,12);
 assert.ok(Math.abs(mapPosition(points,45).slope-1.06)<1e-12);
});
test('invalid anchors cannot reverse time, overlap after rounding, or overflow storage limits',()=>{
 for(const points of [null,[{score:0,video:NaN}],[{score:-1,video:0}],[{score:0,video:90000}],[{score:1,video:2},{score:2,video:1}],[{score:1,video:2},{score:1.0001,video:3}],Array(101).fill({score:1,video:1})])assert.throws(()=>normalizePoints(points));
});
test('mapped seeks and count-in use anchors plus global trim and remain paused on stopped seeks',()=>{
 const f=setup();f.sync.setPoints([{score:30,video:31.2},{score:60,video:63}]);f.sync.setOffset(0.5);
 f.sync.event({type:'position',seconds:45,seek:true,userInitiated:true});
 assert.deepEqual(f.commands.at(-2).args,[47.6,true]);assert.equal(f.commands.at(-1).name,'pauseVideo');
 f.sync.event({type:'start',countIn:true});const count=f.commands.length;
 f.sync.event({type:'position',seconds:60,seek:true,userInitiated:true});assert.equal(f.commands.length,count);
 f.sync.event({type:'countdown',ticks:0});
 assert.deepEqual(f.commands.findLast(c=>c.name==='seekTo').args,[63.5,true]);
});
test('segment rates use YouTube supported speeds and stable telemetry does not spam rate commands',()=>{
 const f=setup();f.sync.setPoints([{score:0,video:0},{score:10,video:15}]);
 f.sync.availableRates([0.5,1,1.5,2]);f.sync.event({type:'position',seconds:0});f.sync.event({type:'start',countIn:false});
 assert.ok(f.commands.some(c=>c.name==='setPlaybackRate'&&c.args[0]===1.5));
 for(let i=1;i<=9;i++){f.advance(1000);f.sync.availableRates([0.5,1,1.5,2]);f.sync.event({type:'position',seconds:i});}
 assert.equal(f.commands.filter(c=>c.name==='seekTo').length,1);
 assert.equal(f.commands.filter(c=>c.name==='setPlaybackRate').length,1);
 f.sync.event({type:'position',seconds:10});
 assert.equal(f.commands.findLast(c=>c.name==='setPlaybackRate').args[0],1);
});
test('invalid point update is atomic and engine resets preserve saved calibration',()=>{
 const f=setup();const points=[{score:0,video:2},{score:10,video:12}];f.sync.setPoints(points);
 assert.throws(()=>f.sync.setPoints([{score:1,video:NaN}]));assert.deepEqual(f.sync.getPoints(),points);
 f.sync.event({type:'reset'});assert.deepEqual(f.sync.getPoints(),points);
 f.sync.reset();assert.deepEqual(f.sync.getPoints(),[]);
});
test('suspension tracks engine state but sends no YouTube commands until explicitly restored',()=>{
 const f=setup();f.sync.event({type:'position',seconds:10,seek:true,userInitiated:true});f.commands.length=0;
 f.sync.setSuspended(true);
 f.sync.event({type:'start',countIn:true});f.sync.event({type:'countdown',ticks:0});
 f.sync.event({type:'position',seconds:60,seek:true,userInitiated:true});f.sync.event({type:'pause'});
 f.sync.setOffset(1);f.sync.setPoints([{score:60,video:62}]);f.sync.resume();
 assert.equal(f.commands.length,0);assert.equal(f.sync.state.position,60);assert.equal(f.sync.state.playing,false);
 f.sync.setSuspended(false);f.sync.realign();
 assert.deepEqual(f.commands,[{name:'seekTo',args:[63,true]},{name:'pauseVideo',args:[]}]);
});
function audioMaster(){let time=0;const video=[],score=[];const sync=create({command:(name,args)=>video.push({name,args}),scoreCommand:(type,value)=>score.push({type,value}),status:()=>{},now:()=>time});sync.event({type:'ready'});return {sync,video,score,advance(ms){time+=ms;}};}
test('audio clock inverts sync points and adjusts only the score position and speed',()=>{
 const f=audioMaster();f.sync.setPoints([{score:30,video:32},{score:60,video:65}]);
 f.sync.videoState(1);f.sync.videoTime(48.5);
 assert.equal(f.score.find(r=>r.type==='seek').value,45);
 assert.ok(Math.abs(f.score.find(r=>r.type==='speed').value-30/33)<1e-9);
 assert.equal(f.score.at(-1).type,'play');assert.deepEqual(f.video,[]);
 f.advance(600);f.sync.event({type:'position',seconds:46});f.sync.videoTime(49.6);
 assert.equal(f.score.filter(r=>r.type==='seek').length,1);
 f.advance(600);f.sync.videoTime(60);
 assert.ok(f.score.filter(r=>r.type==='seek').length>1);assert.deepEqual(f.video,[]);
});
test('video intro waits at score zero without stopping the real audio; pause and buffering stop the score',()=>{
 const f=audioMaster();f.sync.setOffset(10);f.sync.videoState(1);f.sync.videoTime(3);
 assert.equal(f.sync.state.waiting,true);assert.deepEqual(f.video,[]);
 f.advance(600);f.sync.videoTime(11);assert.equal(f.score.at(-1).type,'play');
 f.sync.videoState(3);assert.equal(f.score.at(-1).type,'pause');
 f.sync.videoState(1);f.advance(600);f.sync.videoTime(12);assert.equal(f.score.at(-1).type,'play');
 f.sync.videoState(2);assert.equal(f.score.at(-1).type,'pause');assert.deepEqual(f.video,[]);
});
test('count-in, suspension, offsets and driven callbacks cannot pull the audio clock around',()=>{
 const f=audioMaster();f.sync.event({type:'start',countIn:true});f.sync.videoTime(10);
 assert.deepEqual(f.video.map(r=>r.name),['pauseVideo']);assert.deepEqual(f.score,[]);
 f.sync.event({type:'countdown',ticks:0});assert.equal(f.video.at(-1).name,'playVideo');
 f.sync.videoState(1);f.sync.videoTime(10);const count=f.video.length;
 f.sync.event({type:'position',seconds:50,seek:true,driven:true});f.sync.setOffset(2);f.sync.setPoints([{score:10,video:12}]);
 assert.equal(f.video.length,count);
 f.sync.event({type:'pause',driven:true});assert.equal(f.video.length,count);
 f.sync.setSuspended(true);const commands=f.score.length;f.sync.videoTime(20);f.sync.videoState(1);assert.equal(f.score.length,commands);
 f.sync.setSuspended(false);f.sync.realign();assert.equal(f.score.at(-1).type,'seek');
});
test('audio master readiness preserves a requested start and disabled following leaves UG alone',()=>{
 const f=audioMaster();f.sync.videoTime(5);f.sync.event({type:'start',countIn:false});
 f.sync.resume();assert.equal(f.video.at(-1).name,'playVideo');assert.deepEqual(f.score,[]);
 f.sync.setEnabled(false);f.sync.videoState(1);f.sync.videoTime(20);f.sync.realign();assert.deepEqual(f.score,[]);
});
test('legacy offsets migrate into points preserving interpolation and zero-boundary waits',()=>{
 const {migrateOffset,mapPosition}=require('../sync.js');
 assert.deepEqual(migrateOffset([],5),[{score:0,video:5}]);
 assert.deepEqual(migrateOffset([],-3),[{score:3,video:0}]);
 const original=[{score:10,video:12},{score:20,video:24}];
 const shifted=migrateOffset(original,2);
 assert.equal(mapPosition(shifted,15).seconds,mapPosition(original,15).seconds+2);
 const clipped=migrateOffset(original,-18);
 assert.deepEqual(clipped,[{score:15,video:0},{score:20,video:6}]);
 assert.ok(Math.abs(mapPosition(clipped,17).seconds-(mapPosition(original,17).seconds-18))<1e-9);
 assert.throws(()=>migrateOffset([{score:1,video:86400}],10));
});
test('YouTube pause acknowledgements and late playing telemetry cannot interrupt the native count-in',()=>{
 const f=audioMaster();f.sync.setPoints([{score:0,video:5},{score:30,video:36}]);
 f.sync.event({type:'position',seconds:0});f.sync.event({type:'start',countIn:true});
 for(const ticks of [4,3,2,1]) {
  f.sync.event({type:'countdown',ticks});
  f.sync.videoState(2);f.sync.videoState(1);f.sync.videoTime(8);f.sync.videoRate(1);
  f.sync.realign();assert.equal(f.sync.state.counting,true);assert.equal(f.sync.state.playing,true);
 }
 assert.deepEqual(f.score,[]);assert.equal(f.video.some(r=>r.name==='playVideo'),false);
 f.sync.event({type:'countdown',ticks:0});assert.equal(f.video.at(-1).name,'playVideo');
 f.sync.videoState(1);f.sync.videoTime(8);assert.ok(f.score.some(r=>r.type==='seek'));
});
test('native positive ticks establish count-in and cancellation prevents a late final tick restarting video',()=>{
 const f=audioMaster();f.sync.event({type:'start',countIn:false});
 f.sync.event({type:'countdown',ticks:4});assert.equal(f.sync.state.counting,true);assert.equal(f.video.at(-1).name,'pauseVideo');
 f.sync.videoState(2);assert.deepEqual(f.score,[]);
 f.sync.event({type:'pause'});const count=f.video.length;
 f.sync.event({type:'countdown',ticks:0});assert.equal(f.video.length,count);assert.equal(f.sync.state.counting,false);
});
test('explicit score clicks seek YouTube while automatic score callbacks never seek it back',()=>{
 const f=audioMaster();f.sync.setPoints([{score:10,video:12},{score:20,video:24}]);
 f.sync.event({type:'position',seconds:15,seek:true,userInitiated:true});
 assert.deepEqual(f.video,[{name:'seekTo',args:[18,true]},{name:'pauseVideo',args:undefined}]);
 f.sync.videoTime(1);assert.deepEqual(f.score,[]); // old telemetry in flight
 f.sync.videoTime(18);assert.ok(Math.abs(f.sync.state.position-15)<1e-9);
 const count=f.video.length;
 f.sync.event({type:'position',seconds:16,seek:true,driven:true});f.sync.videoTime(19.2);
 assert.equal(f.video.length,count);
 f.sync.videoState(1);f.sync.event({type:'position',seconds:18,seek:true,userInitiated:true});
 assert.equal(f.video.at(-1).name,'seekTo');assert.ok(Math.abs(f.video.at(-1).args[0]-21.6)<1e-9);
});
test('play and pause work from either player without native feedback restarting the other',()=>{
 const f=audioMaster();f.sync.videoState(1);f.sync.videoTime(5);
 assert.equal(f.score.at(-1).type,'play');
 f.sync.event({type:'start',driven:true,countIn:false});assert.equal(f.video.length,0);
 f.sync.videoState(2);assert.equal(f.score.at(-1).type,'pause');
 f.sync.event({type:'pause',driven:true});assert.equal(f.video.length,0);
 f.sync.event({type:'start',countIn:false});assert.equal(f.video.at(-1).name,'playVideo');
 f.sync.videoState(1);f.sync.videoTime(6);
 f.sync.event({type:'pause'});assert.equal(f.video.at(-1).name,'pauseVideo');
 f.sync.event({type:'position',seconds:3,seek:true,userInitiated:true});assert.equal(f.video.at(-1).name,'pauseVideo');
});
test('unattributed engine seeks never move YouTube even with calibrated sync points',()=>{
 const f=audioMaster();f.sync.setPoints([{score:0,video:2},{score:30,video:34}]);
 f.sync.videoState(1);f.sync.videoTime(12);const count=f.video.length;
 for(const seconds of [11,20,25])f.sync.event({type:'position',seconds,seek:true,driven:false});
 assert.equal(f.video.length,count);
 f.sync.event({type:'position',seconds:15,seek:true,userInitiated:true});assert.equal(f.video.at(-1).name,'seekTo');
});
test('portable sync files round-trip millisecond anchors and readable metadata',()=>{
 const {exportFile,parseFile}=require('../sync.js');
 const data={artist:'Black Sabbath',song:'Snowblind',youtubeId:'dQw4w9WgXcQ',points:[{score:0,video:12.35},{score:30,video:43.1},{score:86400,video:86400}]};
 const text=exportFile(data);assert.match(text,/00:00:12.350/);assert.match(text,/24:00:00.000/);
 assert.deepEqual(parseFile('\uFEFF'+text),{version:1,...data});
 for(const bad of ['no JSON',JSON.stringify({...JSON.parse(text),version:2}),JSON.stringify({...JSON.parse(text),youtubeId:'bad'}),JSON.stringify({...JSON.parse(text),points:[{tab:'00:60:00.000',video:'00:00:01.000'}]}),JSON.stringify({...JSON.parse(text),points:[{tab:'00:00:01.000',video:'00:00:02.000'},{tab:'00:00:02.000',video:'00:00:01.000'}]}),' '.repeat(65537)]) assert.throws(()=>parseFile(bad));
});
