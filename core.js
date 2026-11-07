/* Shared by the isolated content script, service worker and Node tests. */
(function (root) {
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  function songKey(artist, title) { return `song:${JSON.stringify([normalize(artist), normalize(title)])}`; }
  function offsetKey(key, id) { return `offset:${JSON.stringify([key, id])}`; }
  function pointsKey(key, id) { return `points:${JSON.stringify([key, id])}`; }
  function videoId(input) {
    if (typeof input !== 'string') return null;
    const raw = input.trim();
    if (/^[\w-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      const host = url.hostname.replace(/^www\./, '');
      let id;
      if (host === 'youtu.be') id = url.pathname.slice(1);
      else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
        id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
      }
      return /^[\w-]{11}$/.test(id || '') ? id : null;
    } catch { return null; }
  }
  function videosFromData(data) {
    const result = [], seen = new Set(), visited = new WeakSet(), pending = [data];
    // Iterative traversal handles deeply nested responses without growing the
    // call stack. Stop as soon as the eight displayed results are available.
    while (pending.length && result.length < 8) {
      const node = pending.pop();
      if (!node || typeof node !== 'object' || visited.has(node)) continue;
      visited.add(node);
      const video = node.videoRenderer;
      if (video && videoId(video.videoId) && !seen.has(video.videoId)) {
        seen.add(video.videoId);
        const runs = Array.isArray(video.title?.runs) ? video.title.runs : [];
        const title = runs.map(run => typeof run?.text === 'string' ? run.text : '').join('');
        result.push({id:video.videoId,title:title || 'YouTube video'});
      }
      const values = Object.values(node);
      for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] && typeof values[i] === 'object') pending.push(values[i]);
      }
    }
    return result;
  }
  function searchData(html) {
    const match = /(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/g.exec(html);
    if (!match) throw new Error('YouTube did not provide usable search results.');
    const start = match.index + match[0].length;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (quoted) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quoted = false; }
      else if (ch === '"') quoted = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
    throw new Error('Incomplete YouTube search results.');
  }
  root.RiffCore = {songKey, offsetKey, pointsKey, videoId, videosFromData, searchData};
  if (typeof module !== 'undefined') module.exports = root.RiffCore;
})(globalThis);
