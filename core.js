/* Shared by the isolated content script, service worker and Node tests. */
(function (root) {
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  function songKey(artist, title) { return `song:${JSON.stringify([normalize(artist), normalize(title)])}`; }
  function offsetKey(key, id) { return `offset:${JSON.stringify([key, id])}`; }
  function pointsKey(key, id) { return `points:${JSON.stringify([key, id])}`; }
  function videoId(input) {
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
    const result = [], seen = new Set();
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      const v = node.videoRenderer;
      if (v && videoId(v.videoId || '') && !seen.has(v.videoId)) {
        seen.add(v.videoId);
        result.push({id: v.videoId, title: v.title?.runs?.map(r => r.text).join('') || 'YouTube video'});
      }
      for (const value of Object.values(node)) if (typeof value === 'object') visit(value);
    }
    visit(data);
    return result.slice(0, 8);
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
