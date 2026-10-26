/**
 * Loaded on every page (master.twig). Page code lives in nm-home / nm-product / nm-listing / nm-cart,
 * mirroring Raed's entry points so the files drop into a Salla theme as they are.
 */
import * as cartUI from './nm/cart-ui.js';
import * as chrome from './nm/chrome.js';
import * as motion from './nm/motion.js';
import { defineCard, fillCups } from './nm/card.js';
import { popup } from './nm/popup.js';
import * as extras from './nm/extras.js';

defineCard();
cartUI.init();

const boot = () => {
  chrome.announce();
  chrome.header();
  chrome.menu();
  chrome.search();
  chrome.catbars();
  chrome.themeToggle();
  popup();
  fillCups();
  motion.story();
  motion.progress();
  motion.perfGuard();
  motion.rails();
  motion.videos();
  motion.timers();
  extras.init();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

/* Salla's web components (product lists, sliders, comments) render late: give their content the same treatment. */
let late;
new MutationObserver(() => {
  clearTimeout(late);
  late = setTimeout(() => { fillCups(); motion.story(); motion.rails(); extras.counters(); }, 120);
}).observe(document.body, { childList: true, subtree: true });
