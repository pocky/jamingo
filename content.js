(() => {
  // Keep legacy storage keys and bridge names so the Jamingo rename preserves user data.
  let currentKey = '', generation = 0, frame, chosen, song, results = [];
  let wantedPlaying = false, ready = false, frameLoaded = false, videoOriginVerified = false, host;
  let enabled = false, enabledReady = false, enabledRevision = 0, enabledWrites = Promise.resolve();
  let videoGeneration = 0, calibrationReady = false, calibrationRevision = 0, calibrationWrites = Promise.resolve();
  let reportedVideoSample = null, videoSample = null, videoState = null, videoRate = 1, calibration = null;
  let replacementActive = false, pointWrite = null, importDraft = null, importReading = false, importRequest = 0;
  const officialTransportButtons = new WeakSet();
  const rootHost = document.createElement('div');
  rootHost.id = 'riff-reel';
  const shadow = rootHost.attachShadow({mode: 'open'});
  shadow.innerHTML = `
    <style>
      :host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483646;font:14px/1.5 "Segoe UI",Arial,sans-serif;color:#23354b;color-scheme:light;--ink:#23354b;--muted:#586b80;--blue:#244fba;--line:#cad4df;--paper:#edf2f7}
      *{box-sizing:border-box}[hidden]{display:none!important}
      button,input,select{font:inherit;color:inherit}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}
      button,input,select{border:1px solid var(--line);border-radius:7px;background:#fff;padding:9px 11px;min-height:38px;max-width:100%}
      button:hover:not(:disabled){background:#e3ebfa;border-color:#90a9d4}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid #3972dc;outline-offset:3px}
      .shell{width:410px;max-width:calc(100vw - 32px);background:var(--paper);border:1px solid #b6c5d8;border-radius:18px;box-shadow:0 16px 54px #17304f38;overflow:hidden}
      .topbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:#fff;border-bottom:1px solid var(--line)}
      .brand{display:flex;align-items:center;gap:9px;border:0;background:transparent;padding:0;min-height:34px;font-weight:700;color:var(--blue);letter-spacing:-.4px;white-space:nowrap}
      .mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--blue);color:#fff;font-size:18px;letter-spacing:-3px;padding-right:3px}
      .modes{display:flex;gap:2px;padding:3px;background:#e9eef5;border-radius:8px}.modes button{border:0;min-height:29px;padding:4px 8px;font-size:12px;background:transparent;border-radius:5px}.modes button[aria-pressed="true"]{background:#fff;color:var(--blue);box-shadow:0 1px 4px #23354b20;font-weight:700}
      .body{max-height:calc(100dvh - 120px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
      .player{padding:18px 18px 8px;background:#fff}h2{font-size:20px;line-height:1.25;letter-spacing:-.5px;margin:0 0 14px;font-weight:700;overflow-wrap:anywhere}
      iframe{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:9px;background:#182333}#video:empty{display:none}
      .row{display:flex;align-items:center;gap:8px;margin:10px 0;flex-wrap:wrap}.transport{display:grid;grid-template-columns:1fr;margin:12px 0 0}.transport button{font-weight:650}
      #play,#point-save,#points-replace{background:var(--blue);border-color:var(--blue);color:#fff}#play:hover:not(:disabled),#point-save:hover:not(:disabled),#points-replace:hover:not(:disabled){background:#1c3e91}
      p{font-size:12px;line-height:1.6;color:var(--muted);margin:8px 0}p:empty{display:none}#status{margin:8px 0 2px;overflow-wrap:anywhere}
      .settings{padding:6px 18px 16px}.settings>details{border-top:1px solid var(--line);padding:2px 0;background:transparent}
      summary{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:14px 0;font-weight:700;list-style:none}summary::-webkit-details-marker{display:none}summary:after{content:'+';font-size:19px;color:var(--muted);font-weight:400}details[open]>summary:after{content:'−'}
      .settings details>div{padding-bottom:12px}label{display:block;font-size:12px;font-weight:600;margin:12px 0 4px}input:not([type="checkbox"]),select{width:100%;margin:4px 0 7px}
      .audio-option{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:9px 0;font-size:13px;font-weight:500}.audio-option input{order:2;accent-color:var(--blue);width:17px;height:17px;flex:none;margin:0}
      fieldset{border:0;margin:0;padding:0;min-width:0}.time-control{margin:12px 0;background:#fff;border-left:3px solid #9eb2cf;padding:10px 12px;border-radius:0 8px 8px 0}.time-control label{margin:0;color:var(--muted);font-size:12px;font-weight:600}.time-control input{font:600 24px/1.3 "Consolas",monospace;font-variant-numeric:tabular-nums;letter-spacing:-.7px;margin:8px 0}
      .time-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.time-steps button{padding:6px 2px;font-size:12px;white-space:nowrap;min-height:32px}
      #point-list .row{padding:10px 0;border-bottom:1px solid var(--line);gap:6px}#point-list span{font:12px "Consolas",monospace;flex:1 1 100%;color:var(--ink)}#point-list button{padding:4px 10px;min-height:30px;font-size:12px}
      #points-preview{padding:10px;background:#dee8fb;border-radius:8px}#point-editor{margin-top:12px}a{color:var(--blue);text-underline-offset:3px;font-size:12px}.header-actions{display:flex;align-items:center;gap:4px;flex:none}
      #help-toggle{width:32px;min-height:32px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted);font-weight:700;font-size:16px}
      #help-toggle:hover,#help-toggle[aria-expanded="true"]{background:#e3ebfa;color:var(--blue)}
      #playback-help{margin:0;padding:12px 16px;background:#fff;border-bottom:1px solid var(--line)}
      .shell[data-enabled="false"] .body,.shell[data-enabled="false"] .modes{display:none}
      #toggle-enabled{display:grid;place-items:center;flex:none;width:32px;min-height:32px;padding:6px;border:0;border-radius:50%;background:#e3ebfa;color:var(--blue)}
      #toggle-enabled svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
      #toggle-enabled[aria-checked="false"]{background:#e9eef5;color:var(--muted)}
      #toggle-enabled:hover:not(:disabled){background:#d4e0f7}
      #enabled-status{padding:0 14px}
      .shell[data-enabled="false"]{width:auto;border-radius:40px}
      .shell[data-enabled="false"] .topbar{padding:9px 10px;border:0}
      .shell[data-enabled="false"] .brand{color:var(--muted);font-weight:400}
      .shell[data-enabled="false"] .mark{background:#e9eef5;color:var(--muted)}
      .shell[data-mode="video"]{width:350px}.shell[data-mode="video"] .settings{display:none}.shell[data-mode="video"] h2{font-size:16px}.shell[data-mode="video"] .player{padding:14px}
      .shell[data-mode="closed"]{width:auto;border-radius:40px}.shell[data-mode="closed"] .body,.shell[data-mode="closed"] .modes{display:none}.shell[data-mode="closed"] .topbar{padding:9px 14px 9px 10px;border:0}.shell[data-mode="closed"] .brand{min-height:30px}
      .shell[data-mode="closed"][data-help="true"],.shell[data-enabled="false"][data-help="true"]{width:350px;border-radius:18px}
      @media(max-width:480px){:host{right:12px;bottom:12px}.shell{width:calc(100vw - 24px);max-width:calc(100vw - 24px)}.topbar{gap:6px}.player,.settings{padding-left:14px;padding-right:14px}}
      @media(max-width:380px){.topbar{gap:4px}.modes button{padding:4px 5px}.shell[data-enabled="true"]:not([data-mode="closed"]) .brand .mark{display:none}}
      @media(prefers-reduced-motion:no-preference){button{transition:background-color .12s,border-color .12s}}
    </style>
    <div class="shell" id="panel" data-mode="open">
      <header class="topbar"><button class="brand" id="reopen" title="Open Jamingo" aria-label="Open Jamingo"><span class="mark" aria-hidden="true">♫</span>Jamingo</button>
        <nav class="modes" aria-label="Panel mode"><button id="mode-open" aria-pressed="true" title="Show all controls">Open</button><button id="mode-video" aria-pressed="false" title="Show video and playback controls">Video</button><button id="mode-closed" aria-pressed="false" title="Collapse to a small launcher">Close</button></nav>
        <div class="header-actions"><button id="help-toggle" type="button" aria-label="Playback help" aria-expanded="false" aria-controls="playback-help" title="Playback help">?</button><button id="toggle-enabled" type="button" role="switch" aria-label="Jamingo" aria-checked="false" title="Enable Jamingo" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9M6.4 5.6a8 8 0 1 0 11.2 0"/></svg></button></div>
      </header>
      <p id="playback-help" hidden>Play on the tab starts the video and replaces site audio. If playback is blocked, click Play inside the video. After the count-in, the tab follows YouTube audio. Navigate from either player; use Sync mode to calibrate.</p>
      <p id="enabled-status" role="status" aria-live="polite"></p>
      <div class="body"><section class="player" aria-label="Video player">
      <h2 id="song"></h2><div id="video"></div>
      <div class="row transport"><button id="play" aria-label="Play">▶ Play</button></div>
      <p id="status" role="status" aria-live="polite"></p></section>
      <div class="settings">
      <details open><summary>Playback & audio</summary><div>
      <label class="audio-option"><input id="replace-audio" type="checkbox" checked style="width:auto"> Replace site audio</label>
      <label class="audio-option"><input id="keep-metronome" type="checkbox" style="width:auto"> Keep UG metronome</label>
      <p id="metronome-status" role="status"></p>
      <label class="audio-option"><input id="sync-player" type="checkbox" checked style="width:auto"> Align tab to YouTube audio</label>
      <p id="sync-status" role="status">Sync: looking for the player…</p>
      </div></details><details id="sync-section"><summary>Sync points</summary><div>
        <fieldset id="points-controls" disabled style="border:0;margin:0;padding:0">
          <p>Enter Sync mode, click a position on the tab, then adjust only YouTube to find the matching sound.</p>
          <button id="point-sync">Enter Sync mode</button>
          <div id="point-editor" hidden>
            <p id="point-instructions">Click a position on the tab to begin.</p>
            <button id="point-use-current" type="button" hidden>Use current YouTube position</button>
            <div class="time-control"><label for="point-score">Tab position · seconds</label><input id="point-score" type="number" min="0" max="86400" step="0.001" inputmode="decimal"><div class="time-steps" role="group" aria-label="Adjust tab position"><button type="button" id="point-score-minus-ten" data-time="point-score" data-ms="-10" aria-label="Tab position -10 milliseconds">−10 ms</button><button type="button" id="point-score-minus-one" data-time="point-score" data-ms="-1" aria-label="Tab position -1 milliseconds">−1 ms</button><button type="button" id="point-score-plus-one" data-time="point-score" data-ms="1" aria-label="Tab position +1 milliseconds">+1 ms</button><button type="button" id="point-score-plus-ten" data-time="point-score" data-ms="10" aria-label="Tab position +10 milliseconds">+10 ms</button></div></div>
            <div class="time-control"><label for="point-video">YouTube position · seconds</label><input id="point-video" type="number" min="0" max="86400" step="0.001" inputmode="decimal"><div class="time-steps" role="group" aria-label="Adjust youtube position"><button type="button" id="point-video-minus-ten" data-time="point-video" data-ms="-10" aria-label="YouTube position -10 milliseconds">−10 ms</button><button type="button" id="point-video-minus-one" data-time="point-video" data-ms="-1" aria-label="YouTube position -1 milliseconds">−1 ms</button><button type="button" id="point-video-plus-one" data-time="point-video" data-ms="1" aria-label="YouTube position +1 milliseconds">+1 ms</button><button type="button" id="point-video-plus-ten" data-time="point-video" data-ms="10" aria-label="YouTube position +10 milliseconds">+10 ms</button></div></div>
            <div class="row"><button id="point-save" disabled>Save sync point</button><button id="point-cancel">Cancel</button></div>
          </div>
          <div id="point-list"></div>
          <div class="row"><button id="points-export">Export sync file</button><button id="points-import">Import sync file</button></div>
          <input id="points-file" type="file" accept=".json,.riff-sync.json,application/json" hidden>
          <div id="points-preview" hidden>
            <p id="points-preview-text"></p>
            <div class="row"><button id="points-replace">Replace saved points</button><button id="points-import-cancel">Cancel import</button></div>
          </div>
        </fieldset>
        <p id="points-status" role="status" aria-live="polite"></p>
      </div></details>
      <details id="versions-section"><summary>Video versions</summary><div>
      <label>Choose a version<select id="versions" aria-label="YouTube versions"></select></label>
      <button id="search">Find versions</button>
      <label for="url">Another YouTube video</label><input id="url" type="url" placeholder="https://www.youtube.com/watch?v=…">
      <div class="row"><button id="save">Use and remember</button><button id="reset">Forget choice</button></div>
      <a id="youtube" target="_blank" rel="noopener noreferrer">Search YouTube ↗</a>
      </div></details>
    </div></div></div>`;
  const $ = id => shadow.getElementById(id);
  function setHelpOpen(open) {
    $('playback-help').hidden = !open;
    $('help-toggle').setAttribute('aria-expanded', String(open));
    $('panel').dataset.help = String(open);
  }
  $('help-toggle').onclick = () => setHelpOpen($('playback-help').hidden);
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('playback-help').hidden) {
      setHelpOpen(false);
      $('help-toggle').focus();
    }
  });
  let panelMode = 'open', modeRevision = 0, modeWrites = Promise.resolve();
  function setPanelMode(mode, persist = true) {
    if (!['open','video','closed'].includes(mode)) return;
    panelMode = mode; $('panel').dataset.mode = mode;
    for (const value of ['open','video','closed']) $('mode-'+value).setAttribute('aria-pressed',String(mode === value));
    $('reopen').setAttribute('aria-expanded',String(enabled && mode !== 'closed'));
    if (persist) {
      modeRevision++;
      modeWrites = modeWrites.catch(() => {}).then(() => chrome.storage.local.set({'riff-reel:panel-mode':mode})).catch(() => {});
    }
  }
  for (const mode of ['open','video','closed']) $('mode-'+mode).onclick = () => {
    setPanelMode(mode);
    if (mode === 'closed') $('reopen').focus();
  };
  $('reopen').onclick = () => {
    if (!enabled) $('toggle-enabled').onclick();
    setPanelMode('open');
    $('mode-open').focus();
  };
  chrome.storage.local.get('riff-reel:panel-mode').then(stored => {
    if (modeRevision === 0) setPanelMode(stored['riff-reel:panel-mode'] || 'open', false);
  }).catch(() => {});
  const status = text => { $('status').textContent = text; };
  function identify() {
    if (!location.pathname.startsWith('/tab/')) return null;
    // UG exposes its tab metadata in a JSON data attribute; no page script execution.
    for (const el of document.querySelectorAll('.js-store[data-content]')) {
      try {
        const data = JSON.parse(el.getAttribute('data-content'));
        const tab = data.store?.page?.data?.tab || data.page?.data?.tab;
        if (tab?.song_name && tab?.artist_name) return {title: tab.song_name, artist: tab.artist_name};
      } catch { /* Fall through to the document title. */ }
    }
    const match = document.title.match(/^(.*?)\s+(?:CHORDS|TABS?|BASS|UKULELE|GUITAR PRO|OFFICIAL)(?:\s+\([^)]*\))?\s+by\s+(.*?)\s+(?:@|\|)/i);
    return match ? {title: match[1], artist: match[2]} : null;
  }
  const videoOrigin = 'https://www.youtube.com';
  function postToVideo(message) {
    // A newly inserted iframe initially inherits UG's origin (about:blank).
    // Wait for its navigation before using the strictly scoped YouTube API.
    if (!frameLoaded || !frame?.isConnected || !frame.contentWindow) return false;
    try {
      // A load event can also belong to about:blank or a UG error page.
      // A readable document proves that this is not the cross-origin player.
      if (frame.contentDocument) { videoOriginVerified = false; return false; }
      const handshake = message.event === 'listening';
      if (!handshake && !videoOriginVerified) return false;
      // The public, data-free handshake can race iframe navigation. Commands
      // remain restricted to YouTube after a response validates origin + source.
      frame.contentWindow.postMessage(JSON.stringify(message), handshake ? '*' : videoOrigin);
      return true;
    } catch {
      // The frame can disappear during navigation. Pending Play is retried
      // after a valid onReady message from the current YouTube window.
      return false;
    }
  }
  function command(name, args = []) {
    if (!enabled) return;
    if (!calibrationReady && ['playVideo','seekTo','setPlaybackRate'].includes(name)) return;
    postToVideo({event:'command',func:name,args});
  }
  const sync = RiffSync.create({command,status,scoreCommand(type,value) {
    if (!enabled || !calibrationReady || calibration) return;
    document.dispatchEvent(new CustomEvent('riff-reel-player-follow', {detail:JSON.stringify({type,value,path:location.pathname})}));
  }});
  function requestPlayer() { if (enabled) document.dispatchEvent(new CustomEvent('riff-reel-player-request')); }
  document.addEventListener('riff-reel-player', event => {
    if (!enabled || !currentKey || typeof event.detail !== 'string' || event.detail.length > 1000) return;
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    if (!data || data.path !== location.pathname) return;
    const wasAvailable = sync.state.available;
    sync.setEnabled(calibration ? true : $('sync-player').checked);
    // A selected tab position stays frozen while YouTube is adjusted.
    if (!calibration || calibration.target === null || data.type !== 'position' || data.seek === true) sync.event(data);
    if (calibration) {
      if (data.type === 'reset' || data.type === 'unavailable') { leaveCalibration(false); $('points-status').textContent = 'Sync mode closed: the tab player changed.'; return; }
      if (data.type === 'position' && data.seek === true && Number.isFinite(data.seconds) && data.seconds >= 0 && !calibration.saving) selectCalibrationPosition(data.seconds);
      if (data.type === 'start') {
        const session = calibration; session.paused = false; updateCalibrationUI();
        setTimeout(() => { if (calibration === session) requestCalibration('pause'); }, 0);
      }
      return;
    }
    $('sync-status').textContent = sync.state.available
      ? 'YouTube is the clock: the tab follows its audio.'
      : 'Time sync unavailable: Play/Pause still work.';
    if (sync.state.following) {
      wantedPlaying = sync.state.playing;
      updatePlaybackButton();
      if (wantedPlaying && frame) replaceAudio($('replace-audio').checked && !sync.state.counting);
    }
    if (data.type === 'ready' && !wasAvailable) {
      const tempo = [...document.querySelectorAll('#pro-player-scroll-container [role="spinbutton"]')]
        .find(node => /tempo/i.test(node.querySelector('label')?.textContent || ''));
      const rate = Number(tempo?.getAttribute('aria-valuenow')) / 100;
      if (rate > 0) sync.event({type:'speed',rate});
      document.dispatchEvent(new CustomEvent('riff-reel-player-position-request'));
    }
    if (data.type === 'start') document.dispatchEvent(new CustomEvent('riff-reel-player-position-request'));
  });
  function replaceAudio(active) {
    active = enabled && active;
    replacementActive = active;
    document.dispatchEvent(new CustomEvent('riff-reel-site-audio', {detail:active}));
    document.dispatchEvent(new CustomEvent('riff-reel-metronome-request', {detail:JSON.stringify({active,keep:!calibration && $('keep-metronome').checked === true})}));
  }
  document.addEventListener('riff-reel-metronome-status', event => {
    if (typeof event.detail !== 'string' || event.detail.length > 1000) return;
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    if (data && typeof data.message === 'string') $('metronome-status').textContent = data.message;
  });
  function updatePlaybackButton() {
    const playing = Boolean(frame) && wantedPlaying;
    $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }
  function play() {
    if (!enabled) return;
    wantedPlaying = true;
    updatePlaybackButton();
    if (sync.state.following && sync.state.counting) { command('pauseVideo'); status('Count-in: waiting for the countdown…'); return; }
    if (frame) {
      replaceAudio($('replace-audio').checked);
      // Send during the user gesture too; onReady retries if the iframe is loading.
      command('playVideo');
      status(ready ? 'Play command sent to YouTube.' : 'Play received. Waiting for YouTube…');
    } else status('Choose a video to start playback.');
  }
  function pause() { wantedPlaying = false; updatePlaybackButton(); command('pauseVideo'); }
  function load(id) {
    if (calibration) leaveCalibration(false);
    importDraft = null; importReading = false; importRequest++; $('points-preview').hidden = true;
    const token = ++videoGeneration, key = currentKey;
    ready = false; frameLoaded = false; videoOriginVerified = false; chosen = id; calibrationReady = false; calibrationRevision++;
    sync.setOffset(0, false); sync.setPoints([], false); videoSample = null; reportedVideoSample = null; videoState = null;
    $('points-controls').disabled = true; renderPoints();
    $('points-status').textContent = 'Loading sync points…';
    frame = document.createElement('iframe');
    frame.title = `Video for ${song.title}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
    const loadedFrame = frame;
    frame.addEventListener('load', () => {
      if (frame !== loadedFrame) return;
      frameLoaded = true;
      postToVideo({event:'listening',id:'riff-reel'});
    });
    $('video').replaceChildren(frame);
    updatePlaybackButton();
    restoreCalibration(key, id, token);
  }
  async function restoreCalibration(key, id, token) {
    let value = 0, failed = false, restoredPoints = [], invalidPoints = false;
    try {
      await calibrationWrites.catch(() => {});
      const setting = RiffCore.offsetKey(key, id);
      try {
        const stored = await chrome.storage.local.get(setting);
        if (typeof stored[setting] === 'number' && Number.isFinite(stored[setting]) && Math.abs(stored[setting]) <= 3600) value = stored[setting];
      } catch { failed = true; }
      try {
        const pointSetting = RiffCore.pointsKey(key, id);
        const pointStored = await chrome.storage.local.get(pointSetting);
        restoredPoints = RiffSync.normalizePoints(pointStored[pointSetting] ?? []);
      } catch { invalidPoints = true; }
    } catch { failed = true; }
    if (token !== videoGeneration || key !== currentKey || chosen !== id) return;
    if (!failed && !invalidPoints && value !== 0) {
      try {
        restoredPoints = RiffSync.migrateOffset(restoredPoints, value);
        const payload = {[RiffCore.pointsKey(key,id)]:restoredPoints,[RiffCore.offsetKey(key,id)]:0};
        const write = calibrationWrites.catch(() => {}).then(() => chrome.storage.local.set(payload));
        calibrationWrites = write; await write;
      } catch { failed = true; }
    }
    if (token !== videoGeneration || key !== currentKey || chosen !== id) return;
    sync.setPoints(restoredPoints, false); sync.setOffset(0, false); renderPoints();
    calibrationReady = true; $('points-controls').disabled = false;
    $('points-status').textContent = invalidPoints ? 'Saved sync points are invalid and have not been applied.' : `${restoredPoints.length} sync point(s) loaded.`;
    if (failed) $('points-status').textContent = 'Could not load or migrate all calibration settings. Existing stored settings are preserved; reload to retry.';
    if (ready) {
      if (calibration) { if (calibration.target !== null) selectCalibrationPosition(calibration.target); }
      else if (sync.state.following) sync.resume();
      else if (wantedPlaying) play();
    }
  }
  function requestCalibration(type, seconds) {
    if (!calibration || calibration.path !== location.pathname) return;
    document.dispatchEvent(new CustomEvent('riff-reel-player-calibration', {detail:JSON.stringify({type,seconds,path:calibration.path})}));
  }
  const editingTimes = new Set();
  function updateCalibrationUI() {
    $('points-export').disabled = !calibrationReady || Boolean(calibration) || pointWrite?.token === videoGeneration;
    $('points-import').disabled = $('points-export').disabled || importReading;
    $('points-replace').disabled = !importDraft || $('points-import').disabled;
    $('points-import-cancel').disabled = pointWrite?.token === videoGeneration;
    $('point-editor').hidden = !calibration;
    $('point-sync').disabled = Boolean(calibration) || pointWrite?.token === videoGeneration;
    $('sync-player').disabled = Boolean(calibration);
    $('play').disabled = Boolean(calibration);
    $('replace-audio').disabled = Boolean(calibration); $('keep-metronome').disabled = Boolean(calibration);
    $('point-use-current').hidden = !calibration?.awaitingSeek;
    $('point-use-current').disabled = !reportedVideoSample || videoState === 3 || Boolean(calibration?.saving);
    $('point-use-current').textContent = reportedVideoSample ? `Use reported YouTube position (${reportedVideoSample.seconds.toFixed(3)} s)` : 'Waiting for YouTube position…';
    $('point-cancel').disabled = Boolean(calibration?.saving);
    $('point-save').disabled = !calibration || calibration.saving || !calibration.paused || calibration.target === null || calibration.awaitingSeek || !videoSample || videoState === 3;
    for (const button of shadow.querySelectorAll('[data-time]')) button.disabled = !calibration || calibration.saving || calibration.target === null;
    for (const id of ['point-score','point-video']) $(id).disabled = !calibration || calibration.saving;
    $('point-save').textContent = calibration?.saving ? 'Saving…' : 'Save sync point';
    if (!editingTimes.has('point-score')) $('point-score').value = calibration?.target === null || !calibration ? '' : calibration.target.toFixed(3);
    if (!editingTimes.has('point-video')) $('point-video').value = calibration?.awaitingSeek ? calibration.expectedVideo.toFixed(3) : calibration && videoSample ? videoSample.seconds.toFixed(3) : '';
    $('point-instructions').textContent = !calibration || calibration.target === null
      ? 'Click a position on the tab. The tab stays paused.'
      : calibration.awaitingSeek ? 'Waiting for YouTube to seek. You can adjust the video directly, or use its reported position below.'
      : 'Use YouTube playback and seeking to find the matching sound, then click Save sync point.';
    renderPoints();
  }
  function enterCalibration(point = null) {
    if (calibration || !calibrationReady || !frame || pointWrite?.token === videoGeneration) return;
    requestPlayer();
    if (!sync.state.available) { $('points-status').textContent = 'Connect the Official player before entering Sync mode.'; return; }
    setPanelMode('open'); $('sync-section').open = true;
    importDraft = null; $('points-preview').hidden = true;
    calibration = {path:location.pathname,follow:$('sync-player').checked,replacement:replacementActive,target:null,editing:point?.score ?? null,paused:false,awaitingSeek:false,saving:false,pendingEdit:point?.score ?? null};
    sync.setEnabled(true); sync.setSuspended(true);
    pause(); replaceAudio(true); videoSample = null;
    updateCalibrationUI();
    $('sync-status').textContent = 'Sync mode: automatic following is suspended.';
    $('points-status').textContent = 'Click a position on the tab, then adjust YouTube independently.';
    requestCalibration('pause');
    if (point) {
      requestCalibration('seek', point.score);
    }
  }
  function selectCalibrationPosition(seconds) {
    if (!calibration || calibration.saving) return;
    calibration.pendingEdit = null;
    calibration.target = Math.round(seconds * 1000) / 1000;
    sync.event({type:'position',seconds:calibration.target,seek:true});
    calibration.expectedVideo = Math.max(0, RiffSync.mapPosition(sync.getPoints(),calibration.target).seconds);
    calibration.awaitingSeek = true;
    videoSample = null; reportedVideoSample = null; wantedPlaying = false;
    requestCalibration('pause');
    command('pauseVideo'); command('seekTo',[calibration.expectedVideo,true]); command('pauseVideo');
    updateCalibrationUI();
  }
  function leaveCalibration(realign = true) {
    if (!calibration) return;
    const session = calibration;
    requestCalibration('pause');
    calibration = null; editingTimes.clear();
    pause(); sync.setSuspended(false); sync.setEnabled(session.follow);
    $('sync-player').checked = session.follow;
    replaceAudio(session.replacement);
    if (realign && session.follow) sync.realign();
    updateCalibrationUI();
    $('sync-status').textContent = sync.state.available ? 'YouTube is the clock: the tab follows its audio.' : 'Time sync unavailable: Play/Pause still work.';
  }
  document.addEventListener('riff-reel-player-calibration-result', event => {
    if (!calibration || typeof event.detail !== 'string' || event.detail.length > 300) return;
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    if (!data || data.path !== calibration.path) return;
    if (data.type === 'pause') {
      calibration.paused = data.ok === true;
      if (!data.ok) $('points-status').textContent = 'Could not pause the tab. Cancel Sync mode and reconnect the Official player.';
      updateCalibrationUI();
    }
    if (data.type === 'seek' && data.ok && calibration.pendingEdit !== null) selectCalibrationPosition(calibration.pendingEdit);
    if (data.type === 'seek' && !data.ok) { $('points-status').textContent = 'Could not select this saved tab position. Click the desired position on the tab.'; calibration.target = null; updateCalibrationUI(); }
  });
  let renderedPoints = '';
  function renderPoints() {
    const points = sync.getPoints();
    const busy = Boolean(calibration) || pointWrite?.token === videoGeneration;
    const signature = JSON.stringify([points,busy]);
    if (signature === renderedPoints) return;
    renderedPoints = signature;
    $('point-list').replaceChildren();
    for (const point of points) {
      const row = document.createElement('div'); row.className = 'row'; row.style.flexWrap = 'wrap';
      const label = document.createElement('span'); label.textContent = `${point.score.toFixed(3)} s → ${point.video.toFixed(3)} s`;
      const edit = document.createElement('button'); edit.textContent = 'Edit'; edit.disabled = Boolean(calibration) || pointWrite?.token === videoGeneration; edit.setAttribute('aria-label', `Edit sync point at ${point.score} seconds`);
      edit.onclick = () => enterCalibration(point);
      const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.disabled = Boolean(calibration) || pointWrite?.token === videoGeneration; remove.setAttribute('aria-label', `Delete sync point at ${point.score} seconds`);
      remove.onclick = () => savePoints(sync.getPoints().filter(item => item.score !== point.score));
      row.append(label,edit,remove); $('point-list').append(row);
    }
  }
  async function savePoints(value) {
    if (!calibrationReady || !chosen || pointWrite?.token === videoGeneration) return false;
    let points;
    try { points = RiffSync.normalizePoints(value); }
    catch (error) { $('points-status').textContent = error.message; return false; }
    const revision = ++calibrationRevision, token = videoGeneration;
    const operation = {token}; pointWrite = operation; updateCalibrationUI();
    const payload = {[RiffCore.pointsKey(currentKey, chosen)]:points,[RiffCore.offsetKey(currentKey, chosen)]:0};
    $('points-status').textContent = 'Saving sync points…';
    const write = calibrationWrites.catch(() => {}).then(() => chrome.storage.local.set(payload)); calibrationWrites = write;
    try {
      await write;
      if (token !== videoGeneration || revision !== calibrationRevision) return false;
      sync.setPoints(points);
      $('points-status').textContent = `${points.length} sync point(s) saved.`;
      return true;
    } catch {
      if (token === videoGeneration && revision === calibrationRevision) $('points-status').textContent = 'Could not save sync points. Your previous calibration is unchanged. Try again.';
      return false;
    } finally {
      if (pointWrite === operation) { pointWrite = null; updateCalibrationUI(); }
    }
  }
  $('points-export').onclick = () => {
    if (!calibrationReady || !chosen || calibration || pointWrite?.token === videoGeneration) return;
    let url;
    try {
      const text = RiffSync.exportFile({artist:song.artist,song:song.title,youtubeId:chosen,points:sync.getPoints()});
      url = URL.createObjectURL(new Blob([text],{type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      const name = `${song.artist} - ${song.title}`.replace(/[^a-zA-Z0-9 _-]/g,'_').slice(0,120);
      link.download = `${name}-${chosen}.riff-sync.json`;
      shadow.append(link); link.click(); link.remove();
      $('points-status').textContent = 'Sync file download requested.';
    } catch { $('points-status').textContent = 'Could not export sync points.'; }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url),10000); }
  };
  $('points-import').onclick = () => {
    if (!calibrationReady || calibration || pointWrite?.token === videoGeneration || importReading) return;
    $('points-file').value = ''; $('points-file').click();
  };
  $('points-file').onchange = async () => {
    const file = $('points-file').files?.[0];
    if (!file || !calibrationReady || calibration || pointWrite?.token === videoGeneration) return;
    const token = videoGeneration, request = ++importRequest;
    importDraft = null; importReading = true; $('points-preview').hidden = true; updateCalibrationUI();
    try {
      if (file.size > 65536) throw new Error('Sync files must be smaller than 64 KB.');
      const data = RiffSync.parseFile(await file.text());
      if (token !== videoGeneration || request !== importRequest || calibration) return;
      if (RiffCore.songKey(data.artist,data.song) !== currentKey) throw new Error('This file belongs to a different song. Open that song before importing.');
      if (data.youtubeId !== chosen) throw new Error('This file belongs to a different YouTube video. Select that video before importing.');
      importDraft = {token,points:data.points};
      $('points-preview-text').textContent = `${data.artist} — ${data.song}: replace ${sync.getPoints().length} saved point(s) with ${data.points.length} imported point(s)?`;
      $('points-preview').hidden = false;
      $('points-status').textContent = 'File validated. Review the replacement before importing.';
    } catch (error) {
      if (token === videoGeneration && request === importRequest) $('points-status').textContent = error.message;
    } finally {
      if (token === videoGeneration && request === importRequest) { importReading = false; updateCalibrationUI(); }
    }
  };
  $('points-import-cancel').onclick = () => {
    if (pointWrite?.token === videoGeneration) return;
    importRequest++; importDraft = null; importReading = false; $('points-preview').hidden = true; updateCalibrationUI();
  };
  $('points-replace').onclick = async () => {
    const draft = importDraft;
    if (!draft || draft.token !== videoGeneration || calibration || importReading) return;
    if (await savePoints(draft.points) && importDraft === draft) {
      importDraft = null; $('points-preview').hidden = true; updateCalibrationUI();
    }
  };
  for (const id of ['point-score', 'point-video']) {
    const input = $(id);
    input.onfocus = () => editingTimes.add(id);
    input.onblur = () => { editingTimes.delete(id); updateCalibrationUI(); };
    input.onchange = () => {
      if (!calibration || calibration.saving) return;
      const raw = input.value.trim().replace(',', '.');
      const seconds = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) {
        $('points-status').textContent = 'Enter a time between 0 and 86400 seconds.';
        input.value = id === 'point-score' ? (calibration.target?.toFixed(3) ?? '') : (videoSample?.seconds.toFixed(3) ?? '');
        return;
      }
      if (id === 'point-score') requestCalibration('seek', seconds);
      else if (calibration.target !== null) {
        calibration.expectedVideo = seconds; calibration.awaitingSeek = true;
        videoSample = null; reportedVideoSample = null; pause(); command('seekTo', [seconds, true]); updateCalibrationUI();
      }
    };
    input.onkeydown = event => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    };
  }
  for (const button of shadow.querySelectorAll('[data-time]')) {
    button.onclick = () => {
      if (!calibration || calibration.saving || calibration.target === null) return;
      const input = $(button.dataset.time);
      const raw = input.value.trim().replace(',', '.');
      const base = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(base)) { $('points-status').textContent = 'Enter a valid time before adjusting it.'; return; }
      const milliseconds = Math.round(base * 1000) + Number(button.dataset.ms);
      input.value = (Math.max(0,Math.min(86400000,milliseconds)) / 1000).toFixed(3);
      input.onchange();
    };
  }
  $('point-use-current').onclick = () => {
    if (!calibration || calibration.saving || !reportedVideoSample || videoState === 3) return;
    if (Date.now() - reportedVideoSample.at > 3000) {
      $('points-status').textContent = 'Refresh the YouTube position by playing or pausing the video, then try again.';
      command('pauseVideo');
      postToVideo({event:'listening',id:'riff-reel'});
      return;
    }
    videoSample = {...reportedVideoSample}; calibration.awaitingSeek = false; updateCalibrationUI();
    $('points-status').textContent = 'Using the position reported by YouTube. Adjust the video, then save your sync point.';
  };
  $('point-sync').onclick = () => enterCalibration();
  $('point-save').onclick = async () => {
    const session = calibration;
    if (!session || session.saving || !session.paused || session.target === null || session.awaitingSeek || !videoSample || videoState === 3) return;
    const age = Date.now() - videoSample.at;
    if (videoState !== 2 && age > 1500) { $('points-status').textContent = 'Waiting for a fresh YouTube timecode. Play or pause the video, then save again.'; return; }
    const video = videoSample.seconds + (videoState === 1 ? age / 1000 * videoRate : 0);
    const existing = sync.getPoints().filter(point => point.score !== (session.editing ?? session.target));
    const candidate = [...existing,{score:session.target,video}];
    try { RiffSync.normalizePoints(candidate); }
    catch (error) { $('points-status').textContent = error.message; return; }
    session.saving = true; pause(); updateCalibrationUI();
    const saved = await savePoints(candidate);
    if (calibration !== session) return;
    if (saved) leaveCalibration();
    else { session.saving = false; updateCalibrationUI(); }
  };
  $('point-cancel').onclick = () => {
    if (calibration?.saving) return;
    leaveCalibration(); $('points-status').textContent = 'Sync mode cancelled. No point was saved.';
  };
  window.addEventListener('message', event => {
    if (!enabled || event.origin !== 'https://www.youtube.com' || event.source !== frame?.contentWindow) return;
    let data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
    if (!data || typeof data !== 'object') return;
    videoOriginVerified = true;
    if ((data?.event === 'onReady' || data?.event === 'initialDelivery') && !ready) {
      ready = true; frameLoaded = true;
      for (const name of ['onError', 'onAutoplayBlocked', 'onStateChange']) {
        postToVideo({event:'command',func:'addEventListener',args:[name]});
      }
      if (calibration) { if (calibration.target !== null) selectCalibrationPosition(calibration.target); }
      else if (sync.state.following) sync.resume();
      else if (wantedPlaying) play();
    }
    if (data?.event === 'infoDelivery' || data?.event === 'initialDelivery') {
      sync.videoState?.(data.info?.playerState);
      sync.videoTime(data.info?.currentTime);
      sync.videoRate(data.info?.playbackRate);
      if (data.info?.availablePlaybackRates) sync.availableRates(data.info.availablePlaybackRates);
      if (Number.isFinite(data.info?.playbackRate) && data.info.playbackRate > 0) videoRate = data.info.playbackRate;
      if (Number.isInteger(data.info?.playerState)) {
        videoState = data.info.playerState;
        if (!sync.state.counting && [0,1,2,5].includes(videoState)) wantedPlaying = videoState === 1;
        updatePlaybackButton();
      }
      if (Number.isFinite(data.info?.currentTime) && data.info.currentTime >= 0 && videoState !== 3 && !calibration?.saving) {
        const value = data.info.currentTime;
        reportedVideoSample = {seconds:value,at:Date.now()};
        const duration = data.info.duration;
        const reachedEnd = calibration?.awaitingSeek && Number.isFinite(duration) && duration > 0 && calibration.expectedVideo > duration && Math.abs(value - duration) <= 2;
        if (!calibration?.awaitingSeek || Math.abs(value - calibration.expectedVideo) <= 2 || reachedEnd) {
          videoSample = {seconds:value,at:Date.now()};
          if (calibration) { calibration.awaitingSeek = false; updateCalibrationUI(); }
        }
        if (calibration) updateCalibrationUI();
      }
    }
    if (data?.event === 'onStateChange') {
      sync.videoState?.(data.info);
      const previousState = videoState;
      videoState = data.info;
      if ([0,2,5].includes(videoState) && !sync.state.counting) wantedPlaying = false;
      updatePlaybackButton();
      if (calibration) {
        if (videoState === 3 || (videoState === 2 && previousState !== 2)) videoSample = null;
        if (videoState === 1 && !calibration.saving) calibration.awaitingSeek = false;
        if (videoState === 2) postToVideo({event:'listening',id:'riff-reel'});
        updateCalibrationUI();
      }
    }
    if (data?.event === 'onStateChange' && data.info === 1) {
      if (calibration) { wantedPlaying = true; updatePlaybackButton(); replaceAudio(true); return; }
      if (sync.state.following && sync.state.counting) { command('pauseVideo'); return; }
      wantedPlaying = true;
      replaceAudio($('replace-audio').checked);
      updatePlaybackButton();
      status('');
    }
    if (data?.event === 'onError') status('This video cannot be embedded. Choose another version.');
    if (data?.event === 'onAutoplayBlocked') status('Click Play inside the video to allow playback.');
  });
  function showVersions() {
    $('versions').replaceChildren();
    if (chosen && !results.some(v => v.id === chosen)) results.unshift({id:chosen,title:'Saved version'});
    for (const v of results) { const option = document.createElement('option'); option.value = v.id; option.textContent = v.title; $('versions').append(option); }
    if (chosen) $('versions').value = chosen;
  }
  async function select(id) {
    const key = currentKey;
    load(id); showVersions();
    try { await chrome.storage.local.set({[key]:id}); if (key === currentKey) status('Version saved in this browser.'); }
    catch { if (key === currentKey) status('Video ready, but your choice could not be saved.'); }
  }
  async function search(token = generation) {
    $('search').disabled = true; status('Searching for videos…');
    try {
      const response = await chrome.runtime.sendMessage({type:'riff-search',query:`${song.artist} ${song.title}`});
      if (token !== generation) return;
      if (response?.error || !response?.videos?.length) throw new Error(response?.error || 'Search unavailable.');
      results = response.videos;
      if (!chosen) load(results[0].id);
      showVersions(); status('Choose a version to remember it.');
    } catch (error) { if (token === generation) status(`${error.message} You can paste a YouTube link.`); }
    finally { if (token === generation) $('search').disabled = false; }
  }
  async function refresh() {
    if (!enabledReady) return;
    const next = identify();
    if (!enabled) {
      if (next) {
        if (!rootHost.isConnected) document.documentElement.append(rootHost);
      } else rootHost.remove();
      return;
    }
    const key = next ? RiffCore.songKey(next.artist, next.title) : '';
    if (key === currentKey) return;
    if (calibration) leaveCalibration(false);
    currentKey = key; const token = ++generation;
    videoGeneration++; calibrationReady = false; $('points-controls').disabled = true; videoSample = null;
    pause(); sync.reset(); replaceAudio(false); frame = null; chosen = null; ready = false; frameLoaded = false; videoOriginVerified = false; results = []; $('video').replaceChildren();
    if (!next) { rootHost.remove(); return; }
    song = next; document.documentElement.append(rootHost); host = rootHost;
    $('song').textContent = `${song.artist} — ${song.title}`;
    $('url').value = ''; $('versions').replaceChildren(); $('search').disabled = false;
    $('youtube').href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.artist} ${song.title} official music video`)}`;
    status('Loading…');
    requestPlayer();
    try {
      const saved = await chrome.storage.local.get(key);
      if (token !== generation) return;
      if (RiffCore.videoId(saved[key] || '')) { load(saved[key]); showVersions(); status('Your saved version.'); }
      else await search(token);
    } catch { if (token === generation) status('Storage unavailable. Paste a YouTube URL.'); }
  }
  $('keep-metronome').onchange = () => replaceAudio(replacementActive);
  $('replace-audio').onchange = () => replaceAudio($('replace-audio').checked && Boolean(frame));
  window.addEventListener('pagehide', () => { if (calibration) leaveCalibration(false); replaceAudio(false); });
  $('sync-player').onchange = () => { sync.setEnabled($('sync-player').checked); requestPlayer(); };
  $('play').onclick = () => { if (wantedPlaying && frame) pause(); else play(); };
  $('search').onclick = () => search();
  $('versions').onchange = () => select($('versions').value);
  $('save').onclick = () => { const id = RiffCore.videoId($('url').value); if (id) select(id); else status('Enter a valid YouTube URL.'); };
  $('reset').onclick = async () => {
    const key = currentKey;
    try { await chrome.storage.local.remove(key); if (key === currentKey) status('Choice forgotten. The next visit will search again.'); }
    catch { status('Could not forget this choice.'); }
  };
  // React Aria can replace the Play glyph on pointerup, before click fires.
  // Capture intent first; execute only on click so cancelled gestures do nothing.
  const pendingTransport = new WeakMap();
  function clickedButton(event) {
    if (!currentKey || event.composedPath().includes(host)) return null;
    return event.composedPath().find(node => node.matches?.('button,[role="button"]'));
  }
  function playbackAction(button) {
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
    // The Official glyph comes from the reported player HTML. Keep this scoped
    // to the player and independent of generated React IDs and CSS classes.
    if (button.closest('#pro-player-scroll-container')) {
      const playIcon = [...button.querySelectorAll('svg path')].some(path =>
        path.getAttribute('d')?.replace(/[\s,]+/g, '').toLowerCase() === 'm1910518v2z');
      if (playIcon) { officialTransportButtons.add(button); return 'play'; }
      if (officialTransportButtons.has(button)) return 'pause';
    }
    const label = [button.getAttribute('aria-label'),button.getAttribute('title'),button.getAttribute('data-testid'),button.textContent].filter(Boolean).join(' ').trim();
    if (/\b(pause|stop|arrêter)\b/i.test(label)) return 'pause';
    if (/^(?:play|lecture|lire|start playing)(?:\s|$)|\bplay[ -]button\b/i.test(label)) return 'play';
    return null;
  }
  function captureTransport(event) {
    if (!enabled) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    requestPlayer();
    const button = clickedButton(event);
    const action = playbackAction(button);
    if (action) pendingTransport.set(button, {action, time:Date.now(), key:currentKey});
  }
  document.addEventListener('pointerdown', captureTransport, true);
  document.addEventListener('keydown', captureTransport, true);
  // Delegation survives client-side navigation and replaced controls.
  document.addEventListener('click', event => {
    if (!enabled || calibration) return;
    const button = clickedButton(event);
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    const pending = pendingTransport.get(button);
    pendingTransport.delete(button);
    const action = pending && pending.key === currentKey && Date.now() - pending.time < 2000
      ? pending.action : playbackAction(button);
    if (action === 'play') {
      if (!sync.state.available || !$('sync-player').checked) play();
    }
    else if (action === 'pause') pause();
  }, true);
  // One inexpensive check also covers history.pushState navigation without page-world injection.
  setInterval(() => {
    refresh();
    requestPlayer();
    if (currentKey && !calibration && !sync.state.available) $('sync-status').textContent = 'Time sync unavailable: Play/Pause still work.';
    if (frame && (!ready || calibration?.awaitingSeek)) postToVideo({event:'listening',id:'riff-reel'});
  }, 1000);
  function setEnabled(value) {
    if (enabledReady && enabled === value) return;
    // Invalidate asynchronous searches and calibration reads before releasing UG.
    if (!value) {
      command('pauseVideo');
      enabled = false;
      generation++; videoGeneration++; importRequest++;
      currentKey = ''; wantedPlaying = false; ready = false; frameLoaded = false; videoOriginVerified = false;
      calibration = null; editingTimes.clear();
      importDraft = null; importReading = false;
      sync.reset(); sync.setEnabled(false);
      replaceAudio(false);
      frame = null; chosen = null; calibrationReady = false;
      $('video').replaceChildren();
      updateCalibrationUI();
    } else {
      enabled = true;
      sync.setEnabled($('sync-player').checked);
    }
    enabledReady = true;
    $('panel').dataset.enabled = String(enabled);
    $('toggle-enabled').disabled = false;
    $('toggle-enabled').setAttribute('aria-checked', String(enabled));
    $('toggle-enabled').title = enabled ? 'Disable Jamingo' : 'Enable Jamingo';
    $('reopen').title = enabled ? 'Open Jamingo' : 'Enable Jamingo';
    $('reopen').setAttribute('aria-label', enabled ? 'Open Jamingo' : 'Enable Jamingo');
    setPanelMode(panelMode, false);
    document.dispatchEvent(new CustomEvent('riff-reel-enabled', {detail:enabled}));
    refresh();
  }
  $('toggle-enabled').onclick = () => {
    if (!enabledReady) return;
    const value = !enabled;
    enabledRevision++;
    $('enabled-status').textContent = '';
    setEnabled(value);
    enabledWrites = enabledWrites.catch(() => {}).then(() => chrome.storage.local.set({'riff-reel:enabled':value})).catch(() => {
      $('enabled-status').textContent = 'Could not save this setting. It may reset when you reload.';
    });
  };
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || !changes['riff-reel:enabled']) return;
    enabledRevision++;
    $('enabled-status').textContent = '';
    setEnabled(changes['riff-reel:enabled'].newValue === true);
  });
  const initialEnabledRevision = enabledRevision;
  chrome.storage.local.get('riff-reel:enabled').then(stored => {
    if (enabledRevision === initialEnabledRevision) setEnabled(stored['riff-reel:enabled'] === true);
  }).catch(() => {
    if (enabledRevision === initialEnabledRevision) setEnabled(false);
  });
})();
