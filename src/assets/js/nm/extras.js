/**
 * Small behaviours for the optional sections and store-wide extras:
 * numbers that count up, copy-the-coupon, shop-the-photo dots, back-to-top and recently viewed products.
 * Each one does nothing when its markup is not on the page.
 */
import { digits, money } from './store.js';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('nm-lite');

/** [data-nm-count="1250"] counts from 0 the first time it is seen. Keeps decimals (4.9) and thousands separators. */
export function counters(root = document) {
  const list = $$('[data-nm-count]:not([data-ready])', root);
  if (!list.length) return;
  const show = (el, v, dec) => { el.textContent = digits(v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })); };
  const run = (el) => {
    const raw = digits(el.dataset.nmCount).replace(/,/g, '');
    const end = parseFloat(raw);
    if (!Number.isFinite(end)) return;
    const dec = (raw.split('.')[1] || '').length;
    if (calm()) { show(el, end, dec); return; }
    const t0 = performance.now();
    const dur = 1400;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      show(el, end * (1 - (1 - k) ** 3), dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    run(e.target);
  }), { threshold: 0.4 });
  list.forEach((el) => {
    el.dataset.ready = '1';
    if (!calm()) el.textContent = '0';
    io.observe(el);
  });
}

/** [data-nm-copy="CODE"] copies its value and says so for two seconds. */
export function copy() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-nm-copy]');
    if (!btn) return;
    const code = btn.dataset.nmCopy;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const t = Object.assign(document.createElement('textarea'), { value: code });
      t.style.cssText = 'position:fixed;opacity:0';
      document.body.append(t);
      t.select();
      try { document.execCommand('copy'); } catch { /* the code stays visible to copy by hand */ }
      t.remove();
    }
    const label = btn.querySelector('[data-nm-copy-label]');
    if (!label) return;
    const before = label.dataset.before || label.textContent;
    label.dataset.before = before;
    label.textContent = btn.dataset.done;
    btn.classList.add('is-done');
    clearTimeout(btn.nmT);
    btn.nmT = setTimeout(() => { label.textContent = before; btn.classList.remove('is-done'); }, 2000);
  });
}

/** Shop-the-photo: one product card open at a time; Escape or a tap elsewhere closes it. */
export function lookbook() {
  if (!document.querySelector('[data-nm-spot]')) return;
  const closeAll = (except) => $$('.nm-look__spot.is-open').forEach((s) => {
    if (s === except) return;
    s.classList.remove('is-open');
    s.querySelector('[data-nm-spot]').setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-nm-spot]');
    if (!dot) { if (!e.target.closest('.nm-look__card')) closeAll(); return; }
    const spot = dot.parentElement;
    const open = !spot.classList.contains('is-open');
    closeAll(spot);
    spot.classList.toggle('is-open', open);
    dot.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  /* the first dot opens on its own the first time the photo is seen, so shoppers notice it is interactive */
  const first = document.querySelector('[data-nm-spot]');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(() => { if (!document.querySelector('.nm-look__spot.is-open')) first.click(); }, 900);
  }, { threshold: 0.6 });
  io.observe(first.closest('.nm-look'));
}

/** Back-to-top button: appears after two screens of scrolling. */
export function toTop() {
  const btn = document.querySelector('[data-nm-top]');
  if (!btn) return;
  let ticking = false;
  const check = () => { ticking = false; btn.classList.toggle('is-on', scrollY > innerHeight * 2); };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' }));
  check();
}

/** Recently viewed: the product page remembers itself; [data-nm-recent] lists the others (newest first). */
const KEY = 'nm-recent';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
export function recent() {
  const page = document.querySelector('[data-nm-product][data-id]');
  const list = readRecent();
  if (page) {
    const d = page.dataset;
    const me = { id: d.id, name: d.name, url: location.pathname, image: d.image, price: Number(d.price), old: Number(d.old) || 0 };
    const next = [me, ...list.filter((p) => String(p.id) !== String(me.id))].slice(0, 12);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: nothing to remember */ }
  }
  const box = document.querySelector('[data-nm-recent]');
  if (!box) return;
  const others = list.filter((p) => !page || String(p.id) !== String(page.dataset.id)).slice(0, 10);
  if (!others.length) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  box.querySelector('[data-nm-recent-list]').innerHTML = others.map((p) => `
    <li><a class="nm-recent__item" href="${esc(p.url)}">
      <img src="${esc(p.image)}" alt="" loading="lazy" width="72" height="72">
      <span><strong>${esc(p.name)}</strong><span class="nm-card__price"><b class="nm-price ${p.old > p.price ? 'nm-price--sale' : ''}">${money(p.price)}</b>${p.old > p.price ? `<del class="nm-price-old">${money(p.old)}</del>` : ''}</span></span>
    </a></li>`).join('');
  box.hidden = false;
}

export function init() {
  counters();
  copy();
  lookbook();
  toTop();
  recent();
}
