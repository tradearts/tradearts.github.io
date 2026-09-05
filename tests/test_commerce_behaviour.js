// Run with: node --test tests/test_commerce_behaviour.js
// These fixtures never make network requests or send real enquiries.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

function submissionFixture({ result = { success: true }, ok = true, order = false, fetchError = false } = {}) {
  const events = [], statuses = { success: { style: {} }, failure: { style: {} } };
  const button = { disabled: false, tagName: 'BUTTON', textContent: 'Send enquiry', dataset: {} };
  let handler, resets = 0, requests = 0;
  const form = {
    action: 'https://formsubmit.co/info@tradearts.work', dataset: {},
    reportValidity: () => true, setAttribute() {}, removeAttribute() {},
    hasAttribute: name => name === 'data-order-form' && order,
    querySelector: () => button,
    closest: () => ({ querySelector: selector => selector.includes('success') || selector.includes('done') ? statuses.success : statuses.failure }),
    reset: () => resets++
  };
  class FormDataFixture {
    get() { return ''; }
    forEach(fn) { fn('Private customer name', 'name'); fn('private@example.test', 'email'); }
  }
  const window = { location: { search: '' }, tradeArtsTrackEnquiry: kind => events.push(kind) };
  const document = { querySelector: () => null, addEventListener: (_, callback) => handler = callback };
  vm.runInNewContext(source('assets/forms.js'), { window, document, FormData: FormDataFixture, URLSearchParams,
    fetch: async () => { requests++; if (fetchError) throw Error('offline'); return { ok, json: async () => result }; }
  });
  return {
    submit: () => handler({ target: { closest: () => form }, preventDefault() {}, stopImmediatePropagation() {} }),
    events, statuses, button,
    get resets() { return resets; }, get requests() { return requests; }
  };
}

test('a confirmed service success tracks the enquiry kind and clears the form once', async () => {
  for (const order of [false, true]) {
    for (const success of [true, 'true']) {
      const fixture = submissionFixture({ order, result: { success } });
      await fixture.submit();
      assert.deepEqual(fixture.events, [order ? 'product' : 'project']);
      assert.equal(fixture.resets, 1);
      assert.equal(fixture.statuses.success.style.display, 'block');
      assert.equal(fixture.button.disabled, false);
    }
  }
});

test('HTTP errors, rejected responses and network failures never record a lead or clear customer input', async () => {
  for (const options of [{ ok: false }, { result: { success: false } }, { result: { success: 'false' } }, { result: {} }, { result: null }, { fetchError: true }]) {
    const fixture = submissionFixture(options);
    await fixture.submit();
    assert.deepEqual(fixture.events, []);
    assert.equal(fixture.resets, 0);
    assert.equal(fixture.statuses.failure.style.display, 'block');
    assert.equal(fixture.button.disabled, false);
  }
});

test('repeated submit while sending creates only one request', async () => {
  const fixture = submissionFixture();
  await Promise.all([fixture.submit(), fixture.submit()]);
  assert.equal(fixture.requests, 1);
  assert.equal(fixture.resets, 1);
});

test('successful enquiries are measured only with explicit analytics consent, with no form values', () => {
  for (const choice of [null, 'denied', 'granted']) {
    const calls = [];
    const window = { localStorage: { getItem: () => choice }, gtag: (...args) => calls.push(args) };
    vm.runInNewContext(source('assets/consent.js'), { window, document: { addEventListener() {} } });
    window.tradeArtsTrackEnquiry('project');
    window.tradeArtsTrackEnquiry('product');
    window.tradeArtsTrackEnquiry('private@example.test');
    const leads = JSON.parse(JSON.stringify(calls.filter(call => call[0] === 'event')));
    assert.deepEqual(leads, choice === 'granted' ? [
      ['event', 'generate_lead', { enquiry_type: 'project' }],
      ['event', 'generate_lead', { enquiry_type: 'product' }]
    ] : []);
  }
});

test('contact context is rendered as plain text and leaves an existing draft untouched', () => {
  for (const draft of ['', 'Already writing my brief']) {
    const nodes = [], message = { value: draft };
    const form = { prepend: note => nodes.push(note), querySelector: () => message };
    const document = { querySelector: () => form, createElement: () => ({}), addEventListener() {} };
    const window = { location: { search: '?service=%3Cimg%20src%3Dx%20onerror%3Devil%28%29%3E' } };
    vm.runInNewContext(source('assets/forms.js'), { window, document, URLSearchParams });
    assert.equal(nodes[0].textContent, 'Interested in: <img src=x onerror=evil()>');
    assert.equal(nodes[0].innerHTML, undefined);
    if (draft) assert.equal(message.value, draft);
    else assert.match(message.value, /^I’m interested in /);
  }
});

test('category links select only a matching project type without replacing the visitor’s choice', () => {
  const optionValues = ['', 'Film or television', 'Exhibition or museum', 'Public art', 'Commercial or brand activation', 'Product or prototype', 'Other'];
  for (const current of ['', 'Public art']) {
    for (const requested of ['Film or television', 'Exhibition or museum', 'Commercial or brand activation', 'film or television', ' Film or television ', 'Unknown', '<script>']) {
      const select = { value: current, options: optionValues.map(value => ({ value })) };
      const form = { querySelector: selector => selector === 'select[name="project_type"]' ? select : null };
      const document = { querySelector: () => form, addEventListener() {} };
      const window = { location: { search: '?project_type=' + encodeURIComponent(requested) } };
      vm.runInNewContext(source('assets/forms.js'), { window, document, URLSearchParams });
      assert.equal(select.value, current || (optionValues.includes(requested) ? requested : ''));
    }
  }
});

function orderFixture(search = '') {
  const listeners = {};
  const timers = [];
  const element = (value = '') => ({ value, addEventListener: (name, callback) => {}, hidden: false, textContent: '' });
  const product = element(''), quantity = element('1'), subject = element('');
  const size = element('');
  let options = [];
  Object.defineProperty(size, 'innerHTML', { set() { options = []; size.value = ''; } });
  size.append = option => { if (!options.length || option.selected) size.value = option.value; options.push(option); };
  for (const [name, el] of Object.entries({ product, quantity, size })) el.addEventListener = (event, callback) => listeners[name + event] = callback;
  const fields = { '[data-product-select]': product, '[data-size-select]': size, '[data-order-subject]': subject, '[name="quantity"]': quantity };
  const form = { querySelector: selector => fields[selector], addEventListener: (event, callback) => listeners['form' + event] = callback };
  const summaryNodes = {};
  const summary = { querySelector: selector => summaryNodes[selector] || (summaryNodes[selector] = element()) };
  const document = { querySelectorAll: () => [], querySelector: selector => selector === '[data-order-form]' ? form : summary };
  const window = { location: { search }, setTimeout: callback => timers.push(callback) };
  const context = vm.createContext({ window, document, URLSearchParams, Option: function (text, value, defaultSelected, selected) { return { text, value, selected }; } });
  vm.runInContext(source('shop/assets/products.js'), context);
  vm.runInContext(source('shop/assets/shop.js'), context);
  return { product, quantity, size, subject, summaryNodes, listeners, reset() {
    // Native reset events precede restoring controls to their HTML defaults.
    listeners.formreset();
    product.value = ''; quantity.value = '1'; size.value = '';
    timers.splice(0).forEach(callback => callback());
  } };
}

test('an enquiry handoff preserves the product, size and quantity and recalculates visible totals', () => {
  const f = orderFixture('?product=workshop-hammer-ls-tee&size=L&quantity=2');
  assert.equal(f.product.value, 'workshop-hammer-ls-tee');
  assert.equal(f.size.value, 'L');
  assert.equal(f.quantity.value, 2);
  assert.equal(f.summaryNodes['[data-summary-total]'].textContent, '$180.00 AUD');
  assert.equal(f.summaryNodes['[data-summary-selection]'].textContent, 'L · Quantity 2');
  f.quantity.value = '3'; f.listeners.quantityinput();
  assert.equal(f.summaryNodes['[data-summary-total]'].textContent, '$270.00 AUD');
  f.product.value = 'workshop-gloves'; f.listeners.productchange();
  assert.equal(f.size.value, 'One size');
  assert.equal(f.summaryNodes['[data-summary-total]'].textContent, '$60.00 AUD');
  assert.equal(f.summaryNodes['[data-summary-title]'].href, '/shop/products/workshop-gloves/');
});

test('reset clears the enquiry summary after native form defaults are restored', () => {
  const f = orderFixture('?product=workshop-hammer-ls-tee&size=L&quantity=2');
  assert.equal(f.summaryNodes['[data-summary-content]'].hidden, false);
  f.reset();
  assert.equal(f.product.value, '');
  assert.equal(f.quantity.value, '1');
  assert.equal(f.size.value, '');
  assert.equal(f.size.disabled, true);
  assert.equal(f.subject.value, 'New Trade Arts Shop product enquiry');
  assert.equal(f.summaryNodes['[data-summary-content]'].hidden, true);
  assert.equal(f.summaryNodes['[data-summary-empty]'].hidden, false);
});

test('invalid products and quantities do not create a misleading selection or subtotal', () => {
  for (const product of ['unknown', '__proto__', 'constructor']) {
    const f = orderFixture('?product=' + product);
    assert.equal(f.product.value, '');
    assert.equal(f.size.disabled, true);
    assert.equal(f.summaryNodes['[data-summary-content]'].hidden, true);
  }
  for (const quantity of ['0', '-2', '100', '2broken', '1.5']) {
    const f = orderFixture('?product=workshop-hammer-ls-tee&quantity=' + quantity);
    assert.equal(f.quantity.value, '1');
    f.quantity.value = quantity; f.listeners.quantityinput();
    assert.equal(f.summaryNodes['[data-summary-total]'].textContent, '—');
  }
});

test('selecting a gallery photo updates both visible and accessible state', () => {
  const main = { src: 'front.jpg', alt: 'Front' }, caption = { textContent: 'Front view / 01' };
  const buttons = ['Front', 'Back'].map((view, i) => ({
    dataset: { galleryImage: view.toLowerCase() + '.jpg', galleryAlt: 'Hammer tee — ' + view.toLowerCase() + ' view', galleryCaption: view + ' view / 0' + (i + 1) },
    attrs: {}, classList: { toggle() {} },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, callback) { this.click = callback; }
  }));
  const gallery = { querySelector: selector => selector === '[data-gallery-main]' ? main : caption, querySelectorAll: () => buttons };
  buttons.forEach(button => button.closest = () => gallery);
  const document = { querySelectorAll: () => buttons, querySelector: () => null };
  vm.runInNewContext(source('shop/assets/shop.js'), { window: {}, document });
  buttons[1].click();
  assert.equal(main.src, 'back.jpg');
  assert.equal(main.alt, 'Hammer tee — back view');
  assert.equal(caption.textContent, 'Back view / 02');
  assert.equal(buttons[0].attrs['aria-pressed'], 'false');
  assert.equal(buttons[1].attrs['aria-pressed'], 'true');
});
