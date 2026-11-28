// The disclosure, player and direct file link all work without scripting.
const caseStudy = document.querySelector('.case-gallery');
if (caseStudy) {
  const players = Array.from(caseStudy.querySelectorAll('video'));
  for (const player of players) {
    player.addEventListener('play', () => {
      for (const other of players) if (other !== player && !other.paused) other.pause();
    });
  }
  for (const panel of caseStudy.querySelectorAll('details[data-workshop-media]')) {
    panel.addEventListener('toggle', () => {
      if (!panel.open) panel.querySelector('video').pause();
    });
  }
}
