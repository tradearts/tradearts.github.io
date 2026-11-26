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
  button.addEventListener('click', () => {
    status.hidden = true;
    button.hidden = true;
    video.hidden = false;
    if (video.error || video.networkState === video.NETWORK_NO_SOURCE) video.load();
    video.focus({preventScroll: true});
    video.play().catch(err => {
      if (err.name !== 'AbortError') onFailure();
    });
  });
}
