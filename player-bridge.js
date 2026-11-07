// Adapter for UG's XTZ player, identified in the October 2026 page bundle.
// No score download and no module number dependency: locate the existing API
// service by its factory signature, then observe its callbacks in place.
(() => {
  let webpack, service, attachedApi, attachedWasm;
  const nativeMetronome = typeof RiffMetronome !== 'undefined' ? RiffMetronome.create({document,CustomEvent}) : null;
  let enabled = true;
  let discovering = false, driving = false, drivenPauseUntil = 0;
  let scoreGesture = null;
  const observedPushes = new WeakSet();
  const scanned = new Set();
  const wrappers = new WeakSet();
  function emit(type, values = {}) {
    if (!enabled || !location.pathname.startsWith('/tab/')) return;
    document.dispatchEvent(new CustomEvent('riff-reel-player', {detail:JSON.stringify({type,path:location.pathname,driven:driving,...values})}));
  }
  function wrap(object, key, before) {
    const original = object?.[key];
    if (typeof original !== 'function' || wrappers.has(original)) return;
    const wrapped = function (...args) {
      // An observer failure must never prevent the site's original operation.
      try { before(...args); } catch { /* Keep UG running. */ }
      return original.apply(this, args);
    };
    wrappers.add(wrapped);
    object[key] = wrapped;
  }
  function requestPosition() {
    if (!enabled) return;
    try { attachedApi?.requestPlaybackSecond?.(); } catch { /* Player may be loading. */ }
  }
  function attach() {
    if (!enabled || !location.pathname.startsWith('/tab/')) return;
    if (!webpack) {
      const chunks = globalThis.webpackChunkug_react_i18n_es6;
      if (!Array.isArray(chunks) || chunks.push === Array.prototype.push) return;
      // The runtime callback receives the page's existing require function.
      chunks.push([[`riff-reel-observer-${Date.now()}`], {}, require => { webpack = require; }]);
    }
    if (!webpack?.m) return;
    if (!service) {
      for (const [id, factory] of Object.entries(webpack.m)) {
        if (scanned.has(id) || typeof factory !== 'function') continue;
        scanned.add(id);
        const source = Function.prototype.toString.call(factory);
        if (!source.includes('XTZ API service is already initialized') || !source.includes('clearListeners')) continue;
        const exports = webpack(id);
        service = Object.values(exports).find(value => value && typeof value.setListeners === 'function' && typeof value.clearListeners === 'function' && value.listeners);
        if (service) break;
      }
    }
    if (service) nativeMetronome?.bindService(service);
    if (!document.getElementById('pro-player-scroll-container')) return;
    const api = service?.api, wasm = api?._xtzMainWasmModule;
    if (!api || !wasm || typeof wasm.onPlaybackPositionChanged !== 'function' || typeof wasm.onCountdownTick !== 'function') return;
    if (api !== attachedApi || wasm !== attachedWasm) {
      attachedApi = api; attachedWasm = wasm;
      wrap(api, 'play', countIn => emit('start', {countIn:Boolean(countIn)}));
      wrap(api, 'pause', () => emit('pause'));
      wrap(api, 'stop', () => emit('pause'));
      wrap(api, 'setPlaybackSpeed', rate => emit('speed', {rate}));
      wrap(wasm, 'onCountdownTick', ticks => emit('countdown', {ticks}));
      wrap(wasm, 'onPlaybackPositionChanged', seconds => emit('position', {seconds}));
      wrap(wasm, 'onPlaybackSecondResponse', seconds => emit('position', {seconds}));
      wrap(wasm, 'onPlayHeadPositionSet', (success, seconds) => {
        if (!success) return;
        const userInitiated = !driving && scoreGesture?.path === location.pathname && Date.now() - scoreGesture.at < 1500;
        scoreGesture = null;
        // Engine corrections may snap to a beat or arrive late: their returned
        // position is not sufficient evidence of a user's navigation intent.
        emit('position', {seconds,seek:true,userInitiated:Boolean(userInitiated),driven:!userInitiated});
      });
      wrap(wasm, 'onPlaybackStatusChanged', status => { if (status !== 0) emit('pause', {driven:driving || Date.now() < drivenPauseUntil}); });
      wrap(wasm, 'onScoreLoadingStarted', () => { nativeMetronome?.reset(); emit('reset'); });
    }
    emit('ready');
  }
  function discover() {
    if (!enabled || discovering) return;
    discovering = true;
    try { attach(); } catch { emit('unavailable'); }
    finally { discovering = false; }
    const chunks = globalThis.webpackChunkug_react_i18n_es6;
    // Inspect a newly registered lazy player module before its promise resumes
    // and loads a score, so native volume snapshots are available on first play.
    if (Array.isArray(chunks) && chunks.push !== Array.prototype.push && !observedPushes.has(chunks.push)) {
      const original = chunks.push;
      const wrapped = function (...args) { const result = original.apply(this,args); discover(); return result; };
      observedPushes.add(wrapped); chunks.push = wrapped;
    }
  }
  function captureScoreGesture(event) {
    if (!enabled || event.isTrusted !== true) return;
    if (event.type === 'keydown' && !['Enter',' ','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const target = event.target;
    if (target?.closest?.('#pro-player-scroll-container') && target.closest('#xtz_canvas,.Xl1Mv')) {
      scoreGesture = {path:location.pathname,at:Date.now()};
    }
  }
  document.addEventListener('pointerdown', captureScoreGesture, true);
  document.addEventListener('keydown', captureScoreGesture, true);
  document.addEventListener('riff-reel-player-request', discover);
  document.addEventListener('riff-reel-metronome-request', event => {
    if (typeof event.detail !== 'string' || event.detail.length > 200) return;
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    if (!data || typeof data.active !== 'boolean' || typeof data.keep !== 'boolean') return;
    nativeMetronome?.request(enabled && data.active && location.pathname.startsWith('/tab/'), data.keep);
  });
  // Begin before the async score load; all later requests use the same adapter.
  let discoveryTimer = typeof setInterval === 'function' ? setInterval(discover, 250) : null;
  function scheduleDiscovery() {
    if (!enabled && discoveryTimer !== null) {
      clearInterval(discoveryTimer);
      discoveryTimer = null;
    } else if (enabled && discoveryTimer === null && typeof setInterval === 'function') {
      discoveryTimer = setInterval(discover, 250);
    }
  }

  document.addEventListener('riff-reel-player-follow', event => {
    if (typeof event.detail !== 'string' || event.detail.length > 300) return;
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    if (!enabled || !data || data.path !== location.pathname || !location.pathname.startsWith('/tab/')) return;
    driving = true;
    try {
      if (data.type === 'seek' && Number.isFinite(data.value) && data.value >= 0 && data.value <= 86400) {
        attachedApi?.setPlayPositionByTime?.(data.value);
      } else if (data.type === 'speed' && Number.isFinite(data.value) && data.value >= 0.1 && data.value <= 2) attachedApi?.setPlaybackSpeed?.(data.value);
      else if (data.type === 'play') attachedApi?.play?.(false);
      else if (data.type === 'pause') { drivenPauseUntil = Date.now()+500; attachedApi?.pause?.(); }
    } catch { emit('unavailable'); }
    finally { driving = false; }
  });
  document.addEventListener('riff-reel-player-calibration', event => {
    if (typeof event.detail !== 'string' || event.detail.length > 300) return;
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    if (!enabled || !data || data.path !== location.pathname || !location.pathname.startsWith('/tab/')) return;
    if (data.type !== 'pause' && data.type !== 'seek') return;
    let ok = false;
    try {
      if (data.type === 'pause' && typeof attachedApi?.pause === 'function') { attachedApi.pause(); ok = true; }
      if (data.type === 'seek' && Number.isFinite(data.seconds) && data.seconds >= 0 && data.seconds <= 86400 && typeof attachedApi?.setPlayPositionByTime === 'function') {
        attachedApi.setPlayPositionByTime(data.seconds); ok = true;
      }
    } catch { /* Report the failure without interrupting the site's listeners. */ }
    document.dispatchEvent(new CustomEvent('riff-reel-player-calibration-result', {detail:JSON.stringify({type:data.type,ok,path:data.path})}));
  });
  document.addEventListener('riff-reel-enabled', event => {
    if (typeof event.detail !== 'boolean') return;
    enabled = event.detail;
    scheduleDiscovery();
    scoreGesture = null;
    if (enabled) discover();
    else nativeMetronome?.request(false, false);
  });
  document.addEventListener('riff-reel-player-position-request', requestPosition);
})();
