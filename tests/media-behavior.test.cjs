/* Exercise the production loader with fake viewport and Vimeo events, without a network. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/media.js'), 'utf8');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.events = {};
    this.style = {};
    this.classList = { add() {}, contains() { return false; } };
    this.textContent = '';
    this.id = '';
  }
  getAttribute(key) { return this.attributes[key]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  appendChild(child) { this.children.push(child); child.parentElement = this; }
  prepend(child) { this.children.unshift(child); child.parentElement = this; }
  remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  insertAdjacentElement(_, child) { this.parentElement.appendChild(child); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return this.card || null; }
  addEventListener(name, fn) { this.events[name] = fn; }
  getBoundingClientRect() { return { width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400 }; }
}

function harness({ reduce = false, linked = false, observer = true } = {}) {
  const player = new Element();
  player.setAttribute('data-vimeo-video-id', '123456');
  const container = new Element();
  if (linked) {
    const card = new Element('a');
    container.appendChild(card);
    card.appendChild(player);
    player.card = card;
  } else container.appendChild(player);
  const listeners = {};
  const motion = { matches: reduce, addEventListener(_, callback) { this.change = callback; } };
  const frames = [];
  const document = {
    hidden: false,
    querySelectorAll() { return [player]; },
    querySelector() { return { textContent: 'Plane Interior' }; },
    addEventListener(name, callback) { listeners[name] = callback; },
    createElement(tag) {
      const element = new Element(tag);
      if (tag === 'iframe') {
        element.messages = [];
        element.contentWindow = { postMessage(message, origin) { element.messages.push({ ...JSON.parse(message), origin }); } };
        frames.push(element);
      }
      return element;
    }
  };
  let intersection;
  const timers = new Map(); let timerId = 0;
  const window = {
    innerWidth: 1000, innerHeight: 700,
    matchMedia() { return motion; },
    addEventListener(name, callback) { listeners[name] = callback; },
    requestAnimationFrame(fn) { fn(); }
    ,setTimeout(fn) { timers.set(++timerId, fn); return timerId; }
    ,clearTimeout(id) { timers.delete(id); }
  };
  if (observer) window.IntersectionObserver = class {
    constructor(callback) { intersection = callback; }
    observe() {}
  };
  vm.runInNewContext(source, { document, window, IntersectionObserver: window.IntersectionObserver, Map });
  return {
    player, container, frames, document, motion, listeners,
    button: linked ? container.children[1] : player.children[0],
    timeout() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    visible(value) { intersection([{ target: player, isIntersecting: value, intersectionRatio: value ? 1 : 0 }]); },
    event(data, origin = 'https://player.vimeo.com', eventSource = frames[0].contentWindow) {
      listeners.message({ data: JSON.stringify(data), origin, source: eventSource });
    },
    ready() { this.event({ event: 'ready' }); },
    command() { return frames[0].messages.at(-1)?.method; }
  };
}

test('reduced motion keeps a still poster and loads video only on explicit play', () => {
  const h = harness({ reduce: true });
  h.visible(true);
  assert.equal(h.frames.length, 0);
  assert.equal(h.button.textContent, 'Play video');
  h.button.events.click();
  assert.equal(h.frames.length, 1);
  assert.match(h.frames[0].src, /autoplay=0/);
  h.ready();
  assert.equal(h.command(), 'play');
});

test('visible video pauses offscreen and resumes on return', () => {
  const h = harness();
  h.visible(false);
  assert.equal(h.frames.length, 0);
  h.visible(true);
  h.ready();
  h.event({ event: 'play' });
  assert.equal(h.button.textContent, 'Pause video');
  h.visible(false);
  assert.equal(h.command(), 'pause');
  h.event({ event: 'pause' });
  h.visible(true);
  assert.equal(h.command(), 'play');
});

test('visitor pause persists through viewport and tab visibility changes', () => {
  const h = harness();
  h.visible(true); h.ready(); h.event({ event: 'play' });
  h.button.events.click();
  assert.equal(h.command(), 'pause');
  h.visible(false); h.visible(true);
  h.document.hidden = true; h.listeners.visibilitychange();
  h.document.hidden = false; h.listeners.visibilitychange();
  assert.equal(h.command(), 'pause');
  assert.equal(h.button.textContent, 'Play video');
  h.button.events.click();
  assert.equal(h.command(), 'play');
});

test('hidden tabs pause video, and enabling reduced motion cancels automatic playback', () => {
  const h = harness();
  h.visible(true); h.ready(); h.event({ event: 'play' });
  h.document.hidden = true; h.listeners.visibilitychange();
  assert.equal(h.command(), 'pause');
  h.document.hidden = false; h.listeners.visibilitychange();
  assert.equal(h.command(), 'play');
  h.motion.matches = true; h.motion.change();
  assert.equal(h.command(), 'pause');
  h.visible(false); h.visible(true);
  assert.equal(h.command(), 'pause');
});

test('ignores forged frame events and cancels delayed play after pause', () => {
  const h = harness();
  h.visible(true); h.ready();
  h.event({ event: 'play' }, 'https://example.com');
  assert.notEqual(h.player.dataset.vimeoLoaded, 'true');
  h.event({ event: 'play' }, 'https://player.vimeo.com', {});
  assert.notEqual(h.player.dataset.vimeoLoaded, 'true');
  h.visible(false);
  h.event({ event: 'play' });
  assert.equal(h.command(), 'pause');
  assert.equal(h.player.dataset.vimeoPlaying, 'false');
});

test('controls remain outside project links and identify their video', () => {
  const h = harness({ linked: true });
  assert.equal(h.button.tagName, 'button');
  assert.equal(h.button.parentElement, h.container);
  assert.equal(h.button.getAttribute('aria-controls'), h.player.id);
  assert.equal(h.button.getAttribute('aria-label'), 'Play Plane Interior video preview');
});

test('fallback browsers check actual visibility rather than playing every gallery video', () => {
  const h = harness({ observer: false });
  h.ready();
  assert.equal(h.command(), 'play');
  h.player.getBoundingClientRect = () => ({ width: 600, height: 400, top: 900, bottom: 1300, left: 0, right: 600 });
  h.listeners.scroll();
  assert.equal(h.command(), 'pause');
});

test('pending video has a truthful cancel-loading label, never Pause before play', () => {
  const h = harness(); h.visible(true);
  assert.equal(h.button.textContent, 'Cancel loading');
  h.ready(); assert.equal(h.button.textContent, 'Cancel loading');
  h.event({ event: 'play' }); assert.equal(h.button.textContent, 'Pause video');
});
test('blocked provider times out to a poster and explicit retry without an autoplay loop', () => {
  const h = harness(); h.visible(true); h.timeout();
  assert.equal(h.player.dataset.vimeoFailed, 'true');
  assert.equal(h.player.dataset.vimeoLoaded, 'false');
  assert.equal(h.button.textContent, 'Retry video');
  h.visible(false); h.visible(true); assert.equal(h.frames.length, 1);
  h.button.events.click(); assert.equal(h.frames.length, 2);
  h.event({event:'ready'}, 'https://player.vimeo.com', h.frames[1].contentWindow);
  h.event({event:'play'}, 'https://player.vimeo.com', h.frames[1].contentWindow);
  assert.equal(h.player.dataset.vimeoFailed, 'false');
  assert.equal(h.button.textContent, 'Pause video');
});
test('provider errors preserve the poster and ignore late play events', () => {
  const h = harness(); h.visible(true); h.ready(); h.event({event:'error'});
  h.event({event:'play'}); assert.equal(h.button.textContent, 'Retry video');
  assert.equal(h.player.dataset.vimeoLoaded, 'false');
});
test('offscreen pending video does not become a false timeout failure', () => {
  const h = harness(); h.visible(true); h.visible(false); h.timeout();
  assert.equal(h.player.dataset.vimeoFailed, 'false');
  assert.equal(h.button.textContent, 'Play video');
});

function nativeHarness(reduce = false, observer = true) {
  const events = {}, listeners = {};
  const video = {
    paused: true, plays: 0,
    addEventListener(name, fn) { events[name] = fn; },
    play() { this.plays++; if (this.paused) { this.paused = false; events.play(); } return Promise.resolve(); },
    pause() { if (!this.paused) { this.paused = true; events.pause(); } }
  };
  const motion = { matches: reduce, addEventListener(_, fn) { this.change = fn; } };
  const document = { hidden: false, querySelectorAll() { return [video]; }, addEventListener(name, fn) { listeners[name] = fn; } };
  let intersection;
  const window = { matchMedia() { return motion; } };
  if (observer) window.IntersectionObserver = class { constructor(fn) { intersection = fn; } observe() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/project-motion.js'), 'utf8'), { document, window, IntersectionObserver: window.IntersectionObserver, Map });
  return { video, motion, document, listeners, visible(yes) { intersection([{ target: video, isIntersecting: yes, intersectionRatio: yes ? 1 : 0 }]); } };
}
test('native project loops play only in view and retain a visitor pause', () => {
  const h = nativeHarness(); assert.equal(h.video.plays, 0);
  h.visible(true); assert.equal(h.video.paused, false); assert.equal(h.video.muted, true);
  h.visible(false); assert.equal(h.video.paused, true);
  h.visible(true); assert.equal(h.video.paused, false);
  h.video.pause(); h.visible(false); h.visible(true); assert.equal(h.video.paused, true);
  h.video.play(); assert.equal(h.video.paused, false);
});
test('native project loops respect reduced motion, explicit play and hidden tabs', () => {
  const h = nativeHarness(true); h.visible(true); assert.equal(h.video.plays, 0);
  h.video.play(); assert.equal(h.video.paused, false);
  h.document.hidden = true; h.listeners.visibilitychange(); assert.equal(h.video.paused, true);
  h.document.hidden = false; h.listeners.visibilitychange(); assert.equal(h.video.paused, false);
  h.motion.change(); assert.equal(h.video.paused, true);
  h.visible(false); h.visible(true); assert.equal(h.video.paused, true);
});
test('native project loops keep manual playback without an intersection observer', () => {
  const h = nativeHarness(false, false); assert.equal(h.video.plays, 0);
  h.video.play(); assert.equal(h.video.paused, false);
});

function modelHarness({ reduce = false, helper = true } = {}) {
  const calls = [], timers = new Map(); let timerId = 0;
  const frame = new Element(); frame.dataset.modelUrl = 'https://sketchfab.com/models/original-geometry/embed?autospin=-1&transparent=1';
  let iframe = new Element('iframe');
  function prepare(e) { e.cloneNode = () => prepare(new Element('iframe')); e.replaceWith = fresh => { iframe = fresh; }; return e; }
  prepare(iframe);
  const status = new Element('p'), retry = new Element('button');
  frame.querySelector = selector => selector === 'iframe' ? iframe : selector === '.model-preview__status' ? status : retry;
  const window = { matchMedia: () => ({ matches: reduce }),
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  if (helper) window.Sketchfab = function (version, target) { this.init = (uid, options) => calls.push({ version, target, uid, options }); };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/model-preview.js'), 'utf8'), {
    document: { querySelectorAll: () => [frame] }, window, URL
  });
  return { frame, status, retry, calls,
    timeout() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
    ready(index = calls.length - 1) {
      const callbacks = {};
      calls[index].options.success({addEventListener(event, fn) { callbacks[event] = fn; }, start() {}, stop() {}});
      callbacks.viewerready?.();
    }
  };
}
test('model starts automatically using original ID and reveals only on viewerready', () => {
  const h = modelHarness(); assert.equal(h.calls[0].uid, 'original-geometry');
  assert.equal(h.calls[0].options.autostart, 1);
  assert.equal(h.frame.dataset.modelState, 'loading');
  h.ready(); assert.equal(h.frame.dataset.modelState, 'ready');
  h.timeout(); assert.equal(h.frame.dataset.modelState, 'ready');
});
test('failed model retains fallback and offers retry; stale callbacks cannot reveal new frame', () => {
  const h = modelHarness(); h.timeout();
  assert.equal(h.frame.dataset.modelState, 'failed'); assert.equal(h.retry.hidden, false);
  h.retry.events.click(); assert.equal(h.calls.length, 2);
  h.calls[0].options.error(); assert.equal(h.frame.dataset.modelState, 'loading');
  h.ready(1); assert.equal(h.frame.dataset.modelState, 'ready'); assert.equal(h.retry.hidden, true);
});
test('missing helper is a recoverable fallback and reduced motion disables automatic spin', () => {
  const missing = modelHarness({helper:false}); assert.equal(missing.frame.dataset.modelState, 'failed');
  const reduced = modelHarness({reduce:true}); assert.equal(reduced.calls[0].options.autospin, 0);
});
