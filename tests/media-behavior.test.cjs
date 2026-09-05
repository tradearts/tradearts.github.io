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
  const window = {
    innerWidth: 1000, innerHeight: 700,
    matchMedia() { return motion; },
    addEventListener(name, callback) { listeners[name] = callback; },
    requestAnimationFrame(fn) { fn(); }
  };
  if (observer) window.IntersectionObserver = class {
    constructor(callback) { intersection = callback; }
    observe() {}
  };
  vm.runInNewContext(source, { document, window, IntersectionObserver: window.IntersectionObserver, Map });
  return {
    player, container, frames, document, motion, listeners,
    button: linked ? container.children[1] : player.children[0],
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
