// Keep a working native player without JS. With JS, show an uncropped, accessible
// still until the visitor starts the excerpt; no play on load, scroll or focus.
for (const film of document.querySelectorAll('.case-film')) {
  const video = film.querySelector('video');
  const button = film.querySelector('button');
  const status = film.querySelector('[role="status"]');
  if (!video || !button || !status) continue;
  video.hidden = true;
  button.hidden = false;
  const onFailure = () => {
    if (!button.hidden) return;
    video.hidden = true;
    button.hidden = false;
    status.hidden = false;
    button.focus({preventScroll: true});
  };
  video.addEventListener('error', onFailure, true);
  function start(at, cue) {
    status.hidden = true;
    button.hidden = true;
    video.hidden = false;
    if (video.error || video.networkState === video.NETWORK_NO_SOURCE) video.load();
    if (cue) {
      // A single-frame-accurate seek in the original MP4; never change its src.
      video.currentTime = at;
      video.scrollIntoView({block: 'center', behavior: 'instant'});
    } else {
      video.currentTime = 0;
    }
    const fallback = status.querySelector('a');
    if (fallback) fallback.href = cue ? cue.href : video.querySelector('source').src;
    video.focus({preventScroll: true});
    video.play().catch(err => {
      if (err.name !== 'AbortError') onFailure();
    });
  }
  button.addEventListener('click', () => start(0, null));
  for (const link of document.querySelectorAll('a[data-film-cue]')) {
    if (!video.id || link.getAttribute('aria-controls') !== video.id) continue;
    const target = new URL(link.href);
    const source = video.querySelector('source');
    const match = /^#t=(\d+(?:\.\d+)?)$/.exec(target.hash);
    target.hash = '';
    if (!source || target.href !== source.src || !match) continue;
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      start(Number(match[1]), link);
    });
  }
}
