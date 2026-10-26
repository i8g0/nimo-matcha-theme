/** Light motion shared by every page: scroll reveals, product rails, lazy videos, countdowns. */
import { arabicDigits } from './store.js';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let io;
/* a photo hidden behind its curtain (clip-path) has no visible area, so its parent is watched instead */
const waiting = new Map();
const watchTarget = (el) => (el.getAttribute('data-reveal') === 'clip' && el.parentElement) || el;
export function reveals(root = document) {
  const items = $$('[data-reveal]:not(.is-in), [data-reveal-group]:not(.is-in)', root);
  if (!('IntersectionObserver' in window) || reduced()) { items.forEach((el) => el.classList.add('is-in')); return; }
  io = io || new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      (waiting.get(en.target) || [en.target]).forEach((el) => el.classList.add('is-in'));
      waiting.delete(en.target);
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => {
    const t = watchTarget(el);
    const list = waiting.get(t) || [];
    if (list.includes(el)) return;
    list.push(el);
    waiting.set(t, list);
    io.observe(t);
  });
}

/** Rails: arrows (anywhere in the same section) scroll by one viewport of cards; arrows disable at the ends. */
export function rails(root = document) {
  $$('[data-nm-rail]:not([data-ready])', root).forEach((rail) => {
    rail.dataset.ready = '1';
    const track = rail.querySelector('[data-nm-rail-track]');
    const scope = rail.closest('section') || rail;
    const prev = scope.querySelector('[data-nm-rail-prev]');
    const next = scope.querySelector('[data-nm-rail-next]');
    if (!track) return;
    const rtl = getComputedStyle(track).direction === 'rtl';
    const max = () => track.scrollWidth - track.clientWidth;
    const pos = () => Math.abs(track.scrollLeft);
    const sync = () => {
      if (prev) prev.disabled = pos() < 4;
      if (next) next.disabled = pos() > max() - 4;
    };
    const go = (dir) => {
      const step = track.clientWidth * 0.85 * dir * (rtl ? -1 : 1);
      track.scrollBy({ left: step, behavior: reduced() ? 'auto' : 'smooth' });
    };
    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    addEventListener('resize', sync);
    sync();

    /* data-autoplay="ms": slides one item at a time and starts over at the end; rests on hover, touch and off-screen */
    const every = Number(rail.dataset.autoplay);
    if (every && !reduced()) {
      let held = false;
      let seen = false;
      const step = () => {
        if (held || !seen || document.hidden) return;
        const item = track.firstElementChild;
        const w = item ? item.getBoundingClientRect().width : track.clientWidth;
        if (pos() >= max() - 4) track.scrollTo({ left: 0, behavior: 'smooth' });
        else track.scrollBy({ left: w * (rtl ? -1 : 1), behavior: 'smooth' });
      };
      setInterval(step, every);
      rail.addEventListener('pointerenter', () => { held = true; });
      rail.addEventListener('pointerleave', () => { held = false; });
      track.addEventListener('touchstart', () => { held = true; }, { passive: true });
      track.addEventListener('touchend', () => { setTimeout(() => { held = false; }, 4000); }, { passive: true });
      new IntersectionObserver(([e]) => { seen = e.isIntersecting; }, { threshold: 0.3 }).observe(rail);
    }
  });
}

/** Videos load and play only while on screen. A [data-nm-vpause] button inside the same frame pauses
    and resumes; a film the shopper paused stays paused until they press play again. */
let pauseBound = false;
const filmState = (v) => {
  const frame = v.parentElement;
  const btn = frame && frame.querySelector('[data-nm-vpause]');
  if (!btn) return;
  const paused = v.paused;
  frame.classList.toggle('is-paused', paused);
  btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  btn.setAttribute('aria-label', paused ? btn.dataset.labelPlay : btn.dataset.labelPause);
};
export function videos(root = document) {
  if (!pauseBound) {
    pauseBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nm-vpause]');
      if (!btn) return;
      const v = btn.parentElement.querySelector('video');
      if (!v) return;
      if (v.paused) {
        delete v.dataset.held;
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else {
        v.dataset.held = '1';
        v.pause();
      }
    });
  }
  const list = $$('video[data-nm-video]:not([data-ready])', root);
  if (!list.length) return;
  const vio = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (v.dataset.held) return;
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        if (!reduced()) v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    });
  }, { threshold: 0.25 });
  list.forEach((v) => {
    v.dataset.ready = '1';
    v.muted = true;
    v.addEventListener('play', () => filmState(v));
    v.addEventListener('pause', () => filmState(v));
    vio.observe(v);
  });
}

/** Countdown to the end of the given day (store time ≈ Riyadh, UTC+3). Hides itself when the date passes. */
export function timers(root = document) {
  $$('[data-nm-timer]:not([data-ready])', root).forEach((el) => {
    el.dataset.ready = '1';
    const raw = el.dataset.nmTimer;
    const end = Date.parse(/T/.test(raw) ? raw : `${raw}T23:59:59+03:00`);
    if (!end) return;
    const pad = (n) => arabicDigits(String(n).padStart(2, '0'));
    const part = (k) => el.querySelector(`[data-${k}]`);
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) { el.hidden = true; clearInterval(timer); return; }
      el.hidden = false;
      const s = Math.floor(left / 1000);
      part('d').textContent = pad(Math.floor(s / 86400));
      part('h').textContent = pad(Math.floor((s % 86400) / 3600));
      part('m').textContent = pad(Math.floor((s % 3600) / 60));
      part('s').textContent = pad(s % 60);
    };
    const timer = setInterval(tick, 1000);
    tick();
  });
}


/* ---------- scroll story ----------
   Tags the page so sections unfold as you scroll: photos open like a curtain, product cards rise one
   after another, rails slide in, heading lines draw themselves. Everything is opacity / transform only,
   so it stays smooth on modest devices. */
const lite = () => document.documentElement.classList.contains('nm-lite');

export function story(root = document) {
  $$('.nm-reel, .nm-ritual__media, .nm-story__img, .nm-vcard__film, .nm-spot__life, .nm-banner__link', root)
    .forEach((el) => { if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', 'clip'); });
  $$('.nm-grid', root).forEach((grid) => {
    const cols = (getComputedStyle(grid).gridTemplateColumns || '').split(' ').filter(Boolean).length || 2;
    $$(':scope > .nm-card, :scope > nm-product-card > .nm-card', grid).forEach((card, i) => {
      if (card.hasAttribute('data-reveal')) return;
      card.setAttribute('data-reveal', 'card');
      card.style.setProperty('--i', i % cols);
    });
  });
  $$('.nm-rail__track:not(.nm-reel__track), .nm-bundle__items', root).forEach((track) => {
    if (track.hasAttribute('data-reveal-group')) return;
    track.setAttribute('data-reveal-group', '');
    [...track.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 6)));
  });
  reveals(root);
}

/** A thin orange line under the header shows how far down the page you are. */
export function progress() {
  const bar = document.querySelector('[data-nm-progress]');
  if (!bar || lite() || reduced()) return;
  if (window.CSS && CSS.supports('animation-timeline: scroll()')) return; /* the browser draws it by itself */
  let ticking = false;
  const draw = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0})`;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
  draw();
}

/** Watches the first seconds after load; if this device keeps dropping frames, switch to lite mode
    for this visit and the next ones. */
export function perfGuard() {
  if (lite() || reduced() || document.hidden) return;
  const start = () => setTimeout(() => {
    let frames = 0;
    let slow = 0;
    let last = performance.now();
    const tick = (t) => {
      if (document.hidden) return;
      if (t - last > 50) slow += 1;
      last = t;
      frames += 1;
      if (frames < 120) { requestAnimationFrame(tick); return; }
      if (slow / frames > 0.3) {
        document.documentElement.classList.add('nm-lite');
        try { localStorage.setItem('nm-lite', '1'); } catch { /* private mode */ }
      }
    };
    requestAnimationFrame(tick);
  }, 900);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}
