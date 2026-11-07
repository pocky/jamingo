// Runs before UG scripts in the page world. YouTube lives in a separate frame,
// so its audio graph and media elements are never modified here.
(() => {
  let silenced = false;
  const gates = new Map();
  const nativeContexts = new Set();
  const mediaStates = new Map();
  const connect = AudioNode.prototype.connect;
  const disconnect = AudioNode.prototype.disconnect;
  function gateFor(context) {
    let gate = gates.get(context);
    if (!gate) {
      gate = context.createGain();
      gate.gain.value = silenced && !nativeContexts.has(context) ? 0 : 1;
      connect.call(gate, context.destination);
      gates.set(context, gate);
    }
    return gate;
  }
  // Preserve the site's graph and timing; only gate connections to speakers.
  AudioNode.prototype.connect = function (destination, ...ports) {
    if (destination === this.context.destination) {
      connect.call(this, gateFor(this.context), ...ports);
      return destination;
    }
    return connect.call(this, destination, ...ports);
  };
  AudioNode.prototype.disconnect = function (...args) {
    if (args[0] === this.context.destination && gates.has(this.context)) args[0] = gates.get(this.context);
    return disconnect.apply(this, args);
  };
  function muteMedia(element) {
    if (!mediaStates.has(element)) mediaStates.set(element, element.muted);
    if (!element.muted) element.muted = true;
  }
  function scan() {
    if (silenced) document.querySelectorAll('audio,video').forEach(muteMedia);
  }
  // This event is sent only by the page-world native metronome adapter. An
  // exemption never unmutes media elements or unrelated AudioContexts.
  document.addEventListener('riff-reel-native-audio', event => {
    const detail = event.detail;
    if (!detail || typeof detail.enabled !== 'boolean' || !detail.context) return;
    if (detail.enabled && location.pathname.startsWith('/tab/')) nativeContexts.add(detail.context);
    else nativeContexts.delete(detail.context);
    const gate = gates.get(detail.context);
    if (gate) gate.gain.value = silenced && !nativeContexts.has(detail.context) ? 0 : 1;
  });
  document.addEventListener('riff-reel-site-audio', event => {
    if (typeof event.detail !== 'boolean') return;
    silenced = event.detail && location.pathname.startsWith('/tab/');
    for (const [context, gate] of gates) {
      if (context.state === 'closed') gates.delete(context);
      else gate.gain.value = silenced && !nativeContexts.has(context) ? 0 : 1;
    }
    if (silenced) scan();
    else {
      for (const [element, muted] of mediaStates) element.muted = muted;
      mediaStates.clear();
    }
  });
  document.addEventListener('play', event => {
    if (silenced && event.target instanceof HTMLMediaElement) muteMedia(event.target);
  }, true);
  document.addEventListener('volumechange', event => {
    if (silenced && event.target instanceof HTMLMediaElement) muteMedia(event.target);
  }, true);
  new MutationObserver(scan).observe(document, {childList:true, subtree:true});
})();
