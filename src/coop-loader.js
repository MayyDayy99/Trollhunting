// CO-OP: expose connectCoop to the game without changing single-player.
// net-client.js only exists next to the game when it is served by mp-server; it never runs unless
// the game opts in via ?room. The URL is resolved against the page (not this module), and Vite is
// told to leave the import alone so it stays a runtime request.
(async () => {
  try {
    const m = await import(/* @vite-ignore */ new URL('./net-client.js', document.baseURI).href);
    window.__coopConnect = m.connectCoop || (m.default && m.default.connectCoop) || null;
  } catch (e) { window.__coopConnect = null; console.warn('[coop] net-client load failed', e); }
  window.dispatchEvent(new Event('coop-net-ready'));
})();
