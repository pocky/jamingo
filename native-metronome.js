// Keep XTZ's native metronome audible by muting its parts before mixing.
// Only open the exact XTZ AudioContext after all known part volumes are muted.
(function (root) {
  function create({document, CustomEvent}) {
    let service, api, context, enabled = false, requested = false, keep = false;
    let volumes = new Map(), hasScoreSnapshot = false, needsRestore = false, internal = false, lastStatus = '';
    const hooked = new WeakSet();
    const originalVolumes = new WeakMap();
    function report(ready, active, message) {
      const detail = JSON.stringify({ready,active,message});
      if (detail !== lastStatus) { lastStatus = detail; document.dispatchEvent(new CustomEvent('riff-reel-metronome-status',{detail})); }
    }
    function exempt(value) {
      if (context) document.dispatchEvent(new CustomEvent('riff-reel-native-audio',{detail:{context,enabled:value}}));
    }
    function setVolumes(mute) {
      const setter = api && originalVolumes.get(api);
      if (!setter) return;
      internal = true;
      try {
        let error;
        for (const [id, volume] of volumes) { try { setter.call(api,id,mute ? 0 : volume); } catch (failure) { error ||= failure; } }
        if (error) throw error;
      }
      finally { internal = false; }
    }
    function disable() {
      exempt(false); // Close the gate before restoring instruments.
      if (enabled || needsRestore) {
        enabled = false;
        setVolumes(false); needsRestore = false;
      }
    }
    function apply() {
      const ready = Boolean(api && context && hasScoreSnapshot && volumes.size && originalVolumes.has(api));
      if (!requested || !keep) { disable(); report(ready,false,''); return; }
      if (!ready) {
        disable();
        report(false,false,'Metronome routing is not ready. Reload this page to capture the original instrument levels.');
        return;
      }
      if (!enabled) {
        try { needsRestore = true; setVolumes(true); enabled = true; exempt(true); }
        catch {
          exempt(false);
          enabled = true; // Restore any parts already changed before the error.
          try { disable(); } catch { /* The master gate remains closed. */ }
          report(false,false,'Could not isolate the metronome. Site audio remains muted.'); return;
        }
      }
      report(true,true,'UG metronome preserved. Enable the metronome in Ultimate Guitar; its master volume still applies.');
    }
    function seed(metadata) {
      disable(); volumes.clear(); hasScoreSnapshot = false;
      if (!metadata || !Array.isArray(metadata.parts) || !metadata.parts.length) { apply(); return; }
      const next = new Map();
      for (const [id,part] of metadata.parts.entries()) {
        if (!part || !Number.isFinite(part.volume) || part.volume < 0 || part.volume > 1) { apply(); return; }
        next.set(id,part.volume);
      }
      volumes = next; hasScoreSnapshot = true; apply();
    }
    function observeListeners() {
      const listeners = service?.listeners;
      const original = listeners?.onScoreLoaded;
      if (typeof original !== 'function' || hooked.has(original)) return;
      const wrapped = function (status, metadata, ...rest) {
        try { seed(metadata); } catch { exempt(false); report(false,false,'Could not capture instrument levels. Site audio remains muted.'); }
        return original.call(this,status,metadata,...rest);
      };
      hooked.add(wrapped); listeners.onScoreLoaded = wrapped;
    }
    function bindService(nextService) {
      if (service && service !== nextService) { disable(); api = context = null; volumes.clear(); hasScoreSnapshot = false; }
      service = nextService;
      if (!hooked.has(service.setListeners)) {
        const original = service.setListeners;
        const wrapped = function (...args) { const result = original.apply(this,args); observeListeners(); return result; };
        hooked.add(wrapped); service.setListeners = wrapped;
      }
      observeListeners();
      const nextApi = service.api;
      if (!nextApi) return;
      if (api !== nextApi) { disable(); if (api) { volumes.clear(); hasScoreSnapshot = false; } api = nextApi; }
      const nextContext = api._xtzAudioModule?.audioContext;
      if (context !== nextContext) { disable(); context = nextContext; }
      if (typeof api.setPartVolume === 'function' && !originalVolumes.has(api)) {
        const original = api.setPartVolume; originalVolumes.set(api, original);
        api.setPartVolume = function (id, volume) {
          if (!internal && Number.isInteger(id) && Number.isFinite(volume) && volume >= 0 && volume <= 1) volumes.set(id,volume);
          return original.call(this,id,enabled && !internal ? 0 : volume);
        };
      }
      apply();
    }
    function request(active, preserve) { requested = active === true; keep = preserve === true; try { apply(); } catch { exempt(false); report(false,false,'Could not restore instrument levels. Metronome output remains muted.'); } }
    function reset() { requested = false; disable(); volumes.clear(); hasScoreSnapshot = false; }
    return {bindService,request,reset};
  }
  root.RiffMetronome = {create};
  if (typeof module !== 'undefined') module.exports = root.RiffMetronome;
})(globalThis);
