importScripts('core.js');
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'riff-search') return;
  if (!sender.tab || !sender.url?.startsWith('https://tabs.ultimate-guitar.com/')) return;
  const query = String(message.query || '').slice(0, 200);
  (async () => {
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' official music video')}`, {credentials: 'omit', signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('YouTube search unavailable.');
    const videos = RiffCore.videosFromData(RiffCore.searchData(await response.text()));
    if (!videos.length) throw new Error('No videos found. Paste a YouTube URL.');
    return {videos};
  })().then(reply, error => reply({error: error.message}));
  return true;
});
