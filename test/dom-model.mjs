// Deliberately small offline DOM model for JS wiring assertions.
// It has no layout, browser, network, accessibility tree or native input.
export class ModelNode {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase(); this.document = document;
    this.children = []; this.attributes = new Map(); this.events = new Map();
    this._text = ''; this.hidden = false; this.disabled = false; this.value = '';
    this.dataset = {}; this.files = []; this.parent = null;
    const classes = new Set();
    this.classList = { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('MODEL_REJECTS_MARKUP_INSERTION'); }
  append(...nodes) {
    for (const value of nodes) {
      const child = typeof value === 'string' ? this.document.createTextNode(value) : value;
      child.parent = this; this.children.push(child);
    }
  }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(listener); }
  async dispatch(type) { for (const listener of this.events.get(type) ?? []) await listener({ target: this }); }
  focus() { this.document.activeElement = this; }
  click() { if (this.tagName === 'A') this.document.downloads.push({ href: this.href, download: this.download }); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}

export function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }

export function createDocumentModel(html, locale) {
  const document = {
    created: [], ids: new Map(), downloads: [], activeElement: null,
    createElement(tag) { const node = new ModelNode(tag, this); this.created.push(node); return node; },
    createTextNode(text) { const node = new ModelNode('#text', this); node.textContent = text; return node; },
    getElementById(id) { return this.ids.get(id) ?? null; },
  };
  document.body = document.createElement('body'); document.body.dataset.locale = locale;
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node = document.createElement(match[1]); node.id = match[3];
    node.hidden = /\bhidden\b/.test(match[2]); node.disabled = /\bdisabled\b/.test(match[2]);
    document.ids.set(node.id, node); document.body.append(node);
  }
  return document;
}
