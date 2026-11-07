(function (root) {
  function normalizePoints(points) {
    if (!Array.isArray(points) || points.length > 100) throw new Error('A maximum of 100 sync points is allowed.');
    const sorted = points.map(point => {
      if (!point || !Number.isFinite(point.score) || !Number.isFinite(point.video) || point.score < 0 || point.video < 0 || point.score > 86400 || point.video > 86400) throw new Error('Times must be between 0 and 86400 seconds.');
      return {score:Math.round(point.score * 1000) / 1000,video:Math.round(point.video * 1000) / 1000};
    }).sort((a,b) => a.score - b.score);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].score <= sorted[i-1].score || sorted[i].video <= sorted[i-1].video) throw new Error('Sync points must move forward in both players, without duplicates.');
    }
    return sorted;
  }
  function mapPosition(points, seconds) {
    if (!points.length) return {seconds,slope:1};
    const first = points[0], last = points[points.length-1];
    if (seconds < first.score) return {seconds:seconds + first.video - first.score,slope:1};
    if (seconds >= last.score) return {seconds:seconds + last.video - last.score,slope:1};
    for (let i = 1; i < points.length; i++) {
      if (seconds < points[i].score) {
        const left = points[i-1], right = points[i];
        const slope = (right.video - left.video) / (right.score - left.score);
        return {seconds:left.video + (seconds - left.score) * slope,slope};
      }
    }
    return {seconds:seconds + last.video - last.score,slope:1};
  }
  function formatTime(seconds) {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2,'0')}:${String(Math.floor(ms / 60000) % 60).padStart(2,'0')}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')}.${String(ms % 1000).padStart(3,'0')}`;
  }
  function parseTime(value) {
    const match = typeof value === 'string' && /^(\d{2}):([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
    if (!match) throw new Error('Timecodes must use HH:MM:SS.mmm.');
    const seconds = Number(match[1])*3600 + Number(match[2])*60 + Number(match[3]) + Number(match[4])/1000;
    if (seconds > 86400) throw new Error('Timecodes cannot exceed 24:00:00.000.');
    return seconds;
  }
  function parseFile(text) {
    if (typeof text !== 'string' || text.length > 65536) throw new Error('Sync files must be smaller than 64 KB.');
    let data; try { data = JSON.parse(text.replace(/^\uFEFF/,'')); } catch { throw new Error('This is not a valid JSON sync file.'); }
    if (!data || data.version !== 1) throw new Error('Unsupported sync file version. Expected version 1.');
    for (const name of ['artist','song']) {
      if (typeof data[name] !== 'string' || !data[name].trim() || data[name].length > 500) throw new Error('The sync file must name its artist and song.');
    }
    if (typeof data.youtubeId !== 'string' || !/^[\w-]{11}$/.test(data.youtubeId)) throw new Error('The sync file must contain a valid YouTube video ID.');
    if (!Array.isArray(data.points) || data.points.length > 100) throw new Error('A maximum of 100 sync points is allowed.');
    const points = normalizePoints(data.points.map(point => ({score:parseTime(point?.tab),video:parseTime(point?.video)})));
    return {version:1,artist:data.artist,song:data.song,youtubeId:data.youtubeId,points};
  }
  function exportFile({artist,song,youtubeId,points}) {
    const data = {version:1,artist,song,youtubeId,points:normalizePoints(points).map(point => ({tab:formatTime(point.score),video:formatTime(point.video)}))};
    const text = JSON.stringify(data,null,2) + '\n';
    parseFile(text);
    return text;
  }
  // Legacy offsets are folded into explicit anchors once, keeping the same mapping.
  function migrateOffset(value, offset) {
    const points = normalizePoints(value);
    if (!points.length) return normalizePoints([{score:Math.max(0,-offset),video:Math.max(0,offset)}]);
    const shifted = points.map(point => ({score:point.score,video:point.video + offset}));
    if (shifted[0].video < 0) {
      const inverse = points.map(point => ({score:point.video,video:point.score}));
      const boundary = mapPosition(inverse,-offset).seconds;
      return normalizePoints([{score:boundary,video:0},...shifted.filter(point => point.video > 0)]);
    }
    return normalizePoints(shifted);
  }
  function createAudioMaster({command, scoreCommand, status, now = Date.now}) {
    const state = {available:false,following:false,playing:false,counting:false,waiting:false,position:null,rate:1,offset:0};
    let enabled = true, suspended = false, points = [], video = null, videoPlaying = false, videoRate = 1;
    let lastCorrection = -Infinity, appliedRate = null, pendingVideoSeek = null;
    function align(force = false) {
      if (!enabled || suspended || !state.available || !state.following || state.counting || video === null) return;
      const inverse = points.map(point => ({score:point.video,video:point.score}));
      const mapped = mapPosition(inverse, video - state.offset);
      const target = Math.max(0, mapped.seconds);
      state.waiting = mapped.seconds < 0;
      const rate = Math.max(0.1, Math.min(2, videoRate * mapped.slope));
      if (appliedRate === null || Math.abs(appliedRate - rate) > 0.001) {
        appliedRate = rate; scoreCommand('speed', rate);
      }
      const time = now();
      if (force || (time - lastCorrection >= 500 && (state.position === null || Math.abs(state.position - target) > 0.15))) {
        lastCorrection = time;
        // Record the target before dispatch: native callbacks may be synchronous.
        state.position = target; scoreCommand('seek', target);
      }
      const shouldPlay = videoPlaying && !state.waiting;
      if (state.playing !== shouldPlay) {
        state.playing = shouldPlay; scoreCommand(shouldPlay ? 'play' : 'pause');
      }
    }
    function resume() {
      if (suspended || !enabled || !state.following) return;
      if (state.counting) { command('pauseVideo'); return; }
      const shouldPlay = state.playing || videoPlaying;
      if (videoPlaying) align(true);
      command(shouldPlay ? 'playVideo' : 'pauseVideo');
    }
    function reset(keepOffset = false) {
      const offset = keepOffset ? state.offset : 0;
      if (!keepOffset) points = [];
      Object.assign(state,{available:false,following:false,playing:false,counting:false,waiting:false,position:null,rate:1,offset});
      video = null; videoPlaying = false; videoRate = 1; suspended = false; appliedRate = null; lastCorrection = -Infinity; pendingVideoSeek = null;
    }
    function event(data) {
      if (data.type === 'ready') { state.available = true; return; }
      if (data.type === 'unavailable') { state.available = false; return; }
      if (data.type === 'reset') { reset(true); return; }
      if (!enabled) return;
      if (data.type === 'position' && Number.isFinite(data.seconds) && data.seconds >= 0) {
        state.position = data.seconds;
        if (data.seek) state.following = true;
        if (!suspended && data.seek && data.userInitiated === true && !data.driven && !state.counting) {
          const target = Math.max(0,mapPosition(points,data.seconds).seconds + state.offset);
          video = target;
          pendingVideoSeek = {seconds:target,until:now()+2000};
          command('seekTo',[target,true]);
          if (!state.playing && !videoPlaying) command('pauseVideo');
        }
      } else if (data.type === 'start' && !data.driven) {
        state.following = true; state.playing = true; state.counting = data.countIn === true;
        if (!suspended) {
          if (state.counting) { command('pauseVideo'); status('Count-in: waiting for the countdown…'); }
          else command('playVideo');
        }
      } else if (data.type === 'countdown' && state.following && state.playing && Number.isFinite(data.ticks)) {
        if (data.ticks > 0) {
          // Native ticks are authoritative even when play() did not report countIn.
          if (!state.counting && !suspended) command('pauseVideo');
          state.counting = true;
          status(`Count-in: ${data.ticks}`);
        } else if (state.counting && data.ticks === 0) {
          state.counting = false;
          if (!suspended) command('playVideo');
        }
      } else if (data.type === 'pause' && !data.driven) {
        state.playing = false; state.counting = false; videoPlaying = false;
        if (!suspended && state.following) command('pauseVideo');
      } else if (data.type === 'speed' && Number.isFinite(data.rate)) {
        state.rate = data.rate; if (!data.driven) appliedRate = null;
      }
    }
    return {state,event,resume,reset,
      setSuspended(value) { suspended = value === true; if (suspended) { videoPlaying = false; state.playing = false; pendingVideoSeek = null; } },
      realign() { align(true); },
      getPoints() { return points.map(point => ({...point})); },
      setPoints(value, realign = true) { points = normalizePoints(value); appliedRate = null; if (realign) align(true); },
      setOffset(value, realign = true) {
        if (!Number.isFinite(value) || Math.abs(value) > 3600) return false;
        state.offset = Math.round(value * 1000) / 1000; if (realign) align(true); return true;
      },
      setEnabled(value) { enabled = value; if (!value) { state.following = false; state.counting = false; } },
      detach() { state.following = false; state.counting = false; },
      availableRates() {},
      videoRate(value) { if (Number.isFinite(value) && value > 0) { videoRate = value; align(); } },
      videoTime(value) {
        if (!Number.isFinite(value) || value < 0) return;
        if (pendingVideoSeek && now() < pendingVideoSeek.until && Math.abs(value - pendingVideoSeek.seconds) > 0.5) return;
        pendingVideoSeek = null; video = value; align();
      },
      videoState(value) {
        if (suspended || !enabled || !state.available) return;
        if (![0,1,2,3].includes(value)) return;
        if (state.counting) {
          // YouTube's asynchronous pause/playing messages must neither cancel
          // the native countdown nor pause UG before its final tick.
          videoPlaying = false;
          if (value === 1) command('pauseVideo');
          return;
        }
        videoPlaying = value === 1;
        if (videoPlaying) state.following = true;
        if (!videoPlaying && state.following && state.playing) { state.playing = false; scoreCommand('pause'); }
      },
    };
  }
  function create(options) {
    if (options.scoreCommand) return createAudioMaster(options);
    const {command, status, now = Date.now} = options;
    const state = {available:false,following:false,playing:false,counting:false,waiting:false,position:null,rate:1,offset:0};
    let enabled = true, suspended = false, anchor = null, lastSeekAt = -Infinity, points = [], actualRate = 1, requestedRate = null, supportedRates = null;
    function align(force = false) {
      if (suspended || state.position === null || state.counting) return;
      const mapped = mapPosition(points, state.position);
      const target = mapped.seconds + state.offset;
      if (state.playing) updateRate(mapped.slope);
      if (target < 0) {
        if (!state.waiting || force) { command('seekTo', [0, true]); command('pauseVideo'); }
        state.waiting = true; anchor = null;
        return;
      }
      const resumeWaiting = state.waiting && state.playing;
      force = force || state.waiting;
      state.waiting = false;
      const time = now();
      const predicted = anchor ? anchor.seconds + (state.playing ? (time - anchor.at) / 1000 * actualRate : 0) : null;
      if (force || (time - lastSeekAt >= 500 && (predicted === null || Math.abs(predicted - target) > (points.length > 1 ? 0.35 : 1)))) {
        command('seekTo', [target, true]);
        anchor = {seconds:target,at:time}; lastSeekAt = time;
        if (!state.playing) command('pauseVideo');
      }
      if (resumeWaiting) command('playVideo');
    }
    function updateRate(slope = state.position === null ? 1 : mapPosition(points, state.position).slope) {
      if (suspended) return;
      const desired = Math.max(0.1, Math.min(2, state.rate * slope));
      const rate = supportedRates?.length ? supportedRates.reduce((best, value) => Math.abs(value - desired) < Math.abs(best - desired) ? value : best) : desired;
      if (requestedRate === null || Math.abs(requestedRate - rate) > 0.001) {
        command('setPlaybackRate', [rate]); requestedRate = rate;
        if (supportedRates) actualRate = rate;
      }
    }
    function resume() {
      if (suspended || !state.following) return;
      if (state.counting || !state.playing) { command('pauseVideo'); return; }
      align(true); updateRate();
      if (!state.waiting) command('playVideo');
    }
    function event(data) {
      if (data.type === 'ready') { state.available = true; return; }
      if (data.type === 'unavailable') { state.available = false; return; }
      if (!enabled) return;
      if (data.type === 'start') {
        state.following = true; state.playing = true; state.counting = data.countIn === true;
        if (state.counting) { if (!suspended) command('pauseVideo'); status('Count-in: waiting for the countdown…'); }
        else resume();
      } else if (data.type === 'countdown' && Number.isFinite(data.ticks)) {
        if (!state.following || !state.playing) return;
        if (data.ticks > 0) {
          if (!suspended && !state.counting) command('pauseVideo');
          state.counting = true; status(`Count-in: ${data.ticks}`);
        } else if (state.counting) {
          state.counting = false; resume(); status(state.waiting ? 'Count-in finished: waiting for the video offset…' : 'Count-in finished: video started.');
        }
      } else if (data.type === 'position' && Number.isFinite(data.seconds) && data.seconds >= 0) {
        state.position = data.seconds;
        if (data.seek === true) state.following = true;
        if (state.following) align(data.seek === true);
      } else if (data.type === 'pause') {
        state.playing = false; state.counting = false;
        if (!suspended && state.following) command('pauseVideo');
        anchor = null;
      } else if (data.type === 'speed' && Number.isFinite(data.rate) && data.rate > 0 && data.rate <= 2) {
        state.rate = data.rate;
        if (state.following) updateRate();
        anchor = null;
      } else if (data.type === 'reset') reset(true);
    }
    function reset(keepOffset = false) {
      suspended = false;
      const offset = keepOffset ? state.offset : 0;
      if (!keepOffset) points = [];
      requestedRate = null; actualRate = 1; supportedRates = null;
      Object.assign(state, {available:false,following:false,playing:false,counting:false,waiting:false,position:null,rate:1,offset});
      anchor = null; lastSeekAt = -Infinity;
    }
    return {state,event,resume,reset,
      setSuspended(value) { suspended = value === true; if (!suspended) requestedRate = null; },
      realign() { if (state.following) align(true); },
      getPoints() { return points.map(point => ({...point})); },
      setPoints(value, realign = true) {
        points = normalizePoints(value);
        requestedRate = null;
        if (realign && state.following) align(true);
      },
      videoRate(rate) { if (Number.isFinite(rate) && rate > 0) actualRate = rate; },
      availableRates(rates) {
        if (Array.isArray(rates)) {
          const next = [...new Set(rates.filter(rate => Number.isFinite(rate) && rate > 0 && rate <= 2))].sort((a,b) => a-b);
          if (next.join(',') !== supportedRates?.join(',')) { supportedRates = next; requestedRate = null; }
        }
      },
      setOffset(seconds, realign = true) {
        if (!Number.isFinite(seconds) || Math.abs(seconds) > 3600) return false;
        state.offset = Math.round(seconds * 1000) / 1000;
        if (realign && state.following) align(true);
        return true;
      },
      setEnabled(value) { enabled = value; if (!value) { state.following = false; state.counting = false; state.waiting = false; } },
      detach() { state.following = false; state.counting = false; state.waiting = false; },
      videoTime(seconds) { if (Number.isFinite(seconds) && seconds >= 0) anchor = {seconds,at:now()}; },
    };
  }
  root.RiffSync = {create,normalizePoints,mapPosition,migrateOffset,parseFile,exportFile};
  if (typeof module !== 'undefined') module.exports = root.RiffSync;
})(globalThis);
