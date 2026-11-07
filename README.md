# Jamingo

A Manifest V3 extension for **Chrome and Brave** (Chromium 111 or newer). Play a YouTube video alongside an Ultimate Guitar tab, remember your preferred versions and calibrate timing for each song and video. The interface is in English.

Jamingo is an independent project, not affiliated with or endorsed by Ultimate Guitar. It does not provide an Ultimate Guitar subscription or unlock restricted content. Permission for its integration with Ultimate Guitar's internal player has not been obtained.

## Install or update

1. Download **[jamingo.zip from the latest GitHub release](https://github.com/pocky/jamingo/releases/latest/download/jamingo.zip)**. Select the release asset, not GitHub's automatic source-code archive.
2. Extract the ZIP into a permanent folder, for example `jamingo`. Keep this folder: the browser loads the extension from it.
3. Open `chrome://extensions` or `brave://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Open or reload a tab at `https://tabs.ultimate-guitar.com/tab/…`, then enable Jamingo using its power switch.

For updates, replace the files in the **same folder**, reload the extension on the extensions page, then fully reload the Ultimate Guitar page. Keep the extension installed to retain its local settings. The audio bridge must start before the site's scripts. No npm installation or compilation is required to use the extension. Manual installations do not update automatically; download each new release yourself.

## Build and download

From the project root, run `make` or `make zip`. Make and Python 3 are required. This recreates and verifies `dist/jamingo.zip` containing the manifest at its root, runtime scripts, icons, documentation and MIT license. Dependencies, tests and local tooling data are excluded. The build also writes `dist/SHA256SUMS`.

Verify a downloaded release using its accompanying checksum file:

```sh
sha256sum -c SHA256SUMS
```

On macOS, use `shasum -a 256 -c SHA256SUMS`. Versioned downloads are available on the [Releases page](https://github.com/pocky/jamingo/releases). Every successful CI run also provides a ZIP artifact in [GitHub Actions](https://github.com/pocky/jamingo/actions); downloading CI artifacts requires signing into GitHub.

## Panel modes

Jamingo starts disabled until you enable it; your choice is then remembered. Its name is bold blue when enabled and regular gray when disabled. Use the **power switch** in the header to use Ultimate Guitar on its own. This stops and removes the YouTube player, restores site audio (including instrument levels when preserving the metronome), cancels any unsaved Sync mode draft, and stops Jamingo from responding to Ultimate Guitar playback controls. The choice is saved in this browser and applies to other open tabs. Saved video choices and sync points are kept. When disabled, the panel becomes a small **Jamingo** launcher. Click its name or power switch to resume; playback does not start automatically.

Use the header to switch between three layouts:

- **Open** shows the video and all controls, grouped into **Playback & audio**, **Sync points** and **Video versions**.
- **Video** keeps the video, song title, Play/Pause and playback messages visible while hiding settings.
- **Close** keeps a compact 200 × 200 px YouTube player visible while hiding the song details and extension controls. Playback continues in the same iframe. Click the Jamingo name to reopen the full panel. When Jamingo is disabled, only the small launcher remains and the video is removed.

All panel modes keep the embedded player at least 200 × 200 px, the minimum viewport specified in [YouTube's player documentation](https://developers.google.com/youtube/player_parameters). This addresses player visibility and size; it does not establish compliance with all YouTube requirements.

The chosen mode is remembered locally. Switching modes keeps the same iframe and does not issue play, pause or seek commands. Entering Sync mode expands the full panel and its calibration section. The panel fits narrow viewports, scrolls within the available height, and exposes keyboard focus indicators.

## Choose a video

The panel recognizes the artist and song title and searches YouTube. The first result loads without autoplay. Pick another result in **Choose a version**, or paste a YouTube URL and click **Use and remember**. Your choice is saved by artist and song, including across different tabs for the same song. **Forget choice** clears the selected video preference; it does not delete timing calibration.

Search uses public YouTube search pages without an API key. Their format can change, and consent pages or network limits can prevent results. **Search YouTube** and manual URLs remain available as alternatives.

## Playback and Official player sync

Recognized Play/Pause/Stop controls on Ultimate Guitar control the video. **Replace site audio** mutes the main page's HTML media and Web Audio outputs, leaving the YouTube iframe audible. Muting stays active after a pause to avoid unexpectedly resuming the site's sound. Uncheck the option or leave the song to restore site audio.

**Align tab to YouTube audio** is enabled by default. YouTube is the playback clock: the tab follows its position using your saved sync points. Automatic corrections never seek the video or change its playback speed.

- Starting from UG waits for its native count-in before starting YouTube. During the countdown, YouTube state notifications cannot pause the tab or trigger position/speed corrections; cancelling UG playback also cancels the pending video start.
- Playing, pausing, seeking or buffering in YouTube moves or pauses the tab accordingly.
- Between sync points, UG's playback speed is adjusted to follow the recording. Remaining drift is corrected by repositioning the tab, at most once every 500 ms.
- Clicking a measure seeks YouTube to its matching time using the sync points. Seeking in YouTube moves the tab in the other direction. Paused navigation stays paused; normal playback still follows the audio without automatic video seeks. Only an explicit pointer or keyboard gesture on the score canvas or Parts timeline can navigate YouTube; native position callbacks alone never do so, including late or beat-rounded correction callbacks.

The panel's single **Play/Pause** button controls YouTube and follows its playback state. Collapsing the panel does not stop playback. Unchecking **Align tab to YouTube audio** retains simple Play/Pause linking. Sync mode temporarily suspends automatic following so you can calibrate both players independently.

The adapter identifies the existing XTZ service by its factory signature in the site's Webpack runtime, without hardcoded module numbers. It preserves original player calls. This is an internal interface and may change. The implementation was based on the public [October 2026 player module](https://tabs.ultimate-guitar.com/static/public/build/ug_react_i18n_es6/202610/8811.183687d6cad60a528268428ad961cf8a.js), located through a saved page supplied by the user. If the adapter cannot connect, the panel reports it and simple Play/Pause remains available.

## Keep the UG metronome over YouTube

Enable the metronome using **Ultimate Guitar's own metronome switch**, then check **Keep UG metronome** in Jamingo and start playback from UG. **Replace site audio** must also be enabled for instrument isolation to apply.

The extension preserves the native metronome rather than generating new clicks. It uses UG's current tempo, meter, metronome switch and master volume. If UG's master volume is zero or muted, the clicks will also be silent. Timing calibration aligns the tab to the recording, and the native metronome follows the adjusted tab tempo. Beats are not detected automatically.

To retain the clicks, the extension mutes the score's instrument parts inside XTZ before opening only its specific AudioContext. Other page audio contexts and HTML media remain muted. Adjustments to instrument volumes while isolation is active remain inaudible but are remembered in memory and restored when isolation ends. Turning off **Keep UG metronome** restores normal full-site muting; turning off **Replace site audio** restores the original site sound. Leaving the song also clears the temporary isolation.

Instrument levels are captured from the player's normal score-load notification. Early lazy-module observation allows capture before initialization finishes. If the complete levels or the native context cannot be identified, the extension keeps the site muted and reports that metronome routing is not ready. Reload the Ultimate Guitar page with the extension active. It will not open the native output based on a partial instrument snapshot.

The option starts unchecked and applies to the current page session. This relies on the same internal XTZ API as playback sync and still requires a real playback check on your browser.

## Sync points: correcting changing drift

A fixed offset cannot follow varying tempo or a different performance. **Sync points** let you anchor several correspondences between tab and video time.

### Calibrating in Sync mode

1. Open **Sync points** and click **Enter Sync mode**. Ultimate Guitar pauses and its audio is silenced while you calibrate.
2. Click a position on the tab. YouTube moves to the corresponding timecode, and that tab position stays fixed.
3. Use only YouTube's controls to find the matching sound. You can play, pause and seek freely without moving the selected tab position. Click another position on the tab to choose a different anchor.
4. Click **Save sync point**. Once saving succeeds, Sync mode closes and normal following is restored. Both players remain paused until you resume playback. **Cancel** leaves without saving.

The selected tab time and current video time use number inputs in seconds, with a 0.001-second step. Each field has **−10 ms**, **−1 ms**, **+1 ms** and **+10 ms** buttons. Button adjustments apply immediately and stay within 0–86400 seconds. Use the arrow keys to move the caret and change any digit; incoming playback updates do not overwrite a focused field. Press Enter or leave the field to apply the value. Decimal separator entry follows your browser locale. Editing a time seeks the corresponding player. Save waits for a confirmed tab pause and a video timecode after the seek. Pending seeks periodically request fresh YouTube telemetry. If YouTube remains at a different position, **Use reported YouTube position** explicitly accepts its recent reported time so you can continue adjusting; buffering or missing telemetry never enables saving a guessed time. Requests past the reported end of the clip accept its end position. A storage failure leaves Sync mode open so you can retry.

**Existing points retain their stored coordinates when you add a point.** For example, adding `30 → 31.200` and then `60 → 63.000` maps tab time 45 to video time 47.100. Saving again at exactly the same tab time replaces that point.

Each saved row provides **Edit** and **Delete**. Edit opens the same Sync mode at that point's tab position. Video times must move forward as tab times increase. There is a maximum of 100 points per song/video, with coordinates between 0 and 86400 seconds. Invalid edits leave the current calibration intact. Deleting all points returns to direct time matching (tab time equals video time).

### How playback follows the points

Saved points keep their existing tab/video coordinates. During playback the mapping is inverted: the current video time determines the tab time, with linear interpolation between points. Before the first point and after the last point, the nearest point's fixed offset is maintained. With one point, the result is a constant offset. No global offset is applied.

Within a segment, UG's playback speed follows YouTube's speed multiplied by the inverse segment slope, bounded to 10–200%. Deviations over 150 ms can reposition the tab, at most once every 500 ms. YouTube audio continues uninterrupted. Very large tempo differences can still cause visible tab corrections when UG reaches its speed limits.

Calibration is saved automatically per song and video and restored on future visits. Legacy global offsets are automatically converted to explicit points: a standalone positive offset becomes `0 → offset`, and a negative offset becomes `−offset → 0`. With existing points, their video coordinates are shifted; negative video coordinates are replaced by a zero-boundary anchor. Migration saves points and clears the legacy offset together, so it is applied only once. If migration cannot be saved, stored settings are kept for a later retry. Rapid adjustments are serialized so earlier writes cannot overwrite later settings. A failed sync-point save leaves the previous calibration unchanged.

## Import and export calibration

In **Sync points**, use **Export sync file** to download a `.riff-sync.json` file containing the current song, YouTube video ID and saved points. Empty calibrations can also be exported. Files can be edited in a text editor or shared with someone using the same tab and recording.

Use **Import sync file** to select a file. Jamingo validates the format, version, artist/song and exact YouTube ID before showing how many saved points will be replaced. Click **Replace saved points** to persist the replacement, or **Cancel import** to leave the calibration unchanged. Import replaces rather than merges points. An empty points array explicitly clears the calibration after confirmation. Failed writes keep the previous calibration and allow retrying.

Version 1 uses this structure:

```json
{
  "version": 1,
  "artist": "Black Sabbath",
  "song": "Snowblind",
  "youtubeId": "dQw4w9WgXcQ",
  "points": [
    {"tab": "00:00:00.000", "video": "00:00:12.350"},
    {"tab": "00:00:30.000", "video": "00:00:43.100"}
  ]
}
```

The video ID above is illustrative; exported files contain your selected recording's ID. Timecodes must use `HH:MM:SS.mmm`, from `00:00:00.000` through `24:00:00.000`. Files are limited to 64 KB and 100 points, with strictly increasing times in both players. The importer sorts points by tab time. Import/export is unavailable during Sync mode or a pending point save. Files are handled locally without uploading them.

## Limits

- Input precision does not guarantee millisecond playback accuracy. YouTube telemetry latency, buffering, ads and UG's playback controls can cause visible tab corrections. The extension does not analyze the audio waveform or alter its tempo.
- Sync points describe a forward-moving correspondence. They do not detect matching music automatically or represent inserted/deleted sections as discontinuous jumps. Substantial arrangement differences may require a different video.
- Some videos cannot be embedded or are unavailable in your region. Choose another version. Browser autoplay rules may require one direct click inside the video.
- Audio replacement covers the main Ultimate Guitar page. A separate site iframe is not covered.
- Labelled controls are recognized by their accessible labels, titles, text or test attributes. The unlabelled Official Play button is recognized by its SVG glyph inside `#pro-player-scroll-container`, independently of generated React IDs and classes. React Aria gesture intent is captured before the icon can change. Other unlabelled controls may require adaptation.
- Automated tests use simulated engine events and DOM/YouTube boundaries. They do not prove live streaming behavior. Previous versions have been tried successfully by the user; the new point calibration needs evaluation on actual recordings.

## Data and permissions

The only extension permission is `storage`. `chrome.storage.local` stores the panel mode, selected video IDs and numeric sync-point coordinates (plus legacy offset keys retained at zero after migration) by song/video. There is no server or cloud sync. Uninstalling removes preferences. No diagnostic recording panel is included.

Content scripts are limited to `tabs.ultimate-guitar.com`. Access to `www.youtube.com` is used for search, which sends the artist and song title to YouTube. Loading an embedded video also connects to YouTube and is subject to its privacy/cookie behavior. The extension does not download or execute remote extension code.

## Development

```sh
npm ci
npm test
npm run check
npm run test:browser
```

Install the matching test browser with `npx playwright install chromium`. To use a system browser instead, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` (or another executable path). CI installs Playwright's Chromium and its OS dependencies. Unit and DOM tests can run independently of Chromium. Browser tests use simulated Ultimate Guitar and YouTube pages; they do not replace a check against the live site.

The [CI and release workflow](.github/workflows/ci.yml) checks syntax, runs unit/DOM and Chromium tests, validates package metadata, and uploads the verified ZIP. A pushed `vX.Y.Z` tag publishes a release only after these checks succeed and only if the tag matches the manifest and npm versions. See [publishing instructions](docs/publishing.md).

Performance regression tests cover disabled player discovery, inactive audio observation, subtree-only media scans, stable calibration controls during telemetry, and bounded YouTube result traversal. A lightweight one-second navigation check remains active while the extension is disabled so the launcher can follow Ultimate Guitar navigation. Audio graph interception remains installed from document start to support later activation.

- `core.js`: storage keys, video URL validation and search result parsing.
- `background.js`: YouTube search, restricted to messages from Ultimate Guitar tabs.
- `player-bridge.js`: observe XTZ playback, time, count-in and seek events.
- `sync.js`: point validation, interpolation, legacy calibration migration and playback synchronization.
- `native-metronome.js`: reversible instrument isolation and native metronome context routing.
- `site-audio.js`: reversible muting in the main page world.
- `content.js`: panel, calibration editing, persistence and page navigation.

References: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [YouTube iframe player API](https://developers.google.com/youtube/iframe_api_reference), [Web Audio connections](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect).

## License and third-party services

Jamingo's code and original assets are released under the [MIT license](LICENSE). That license grants no rights to Ultimate Guitar or YouTube content, services, software or trademarks. The project is distributed independently through GitHub; it is not an official integration or an approved store listing. Ultimate Guitar permission remains unresolved, and YouTube search currently reads its results page rather than using the official Data API. Free distribution and optional contributions do not resolve those separate terms-of-service questions.
