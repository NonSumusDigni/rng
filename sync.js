// Optional sync of saved sets with an rng-backend server.
// See https://github.com/NonSumusDigni/rng-backend for the API.
//
// The app owns the saved-sets store; it gives us hooks to read sets and merge
// remote ones. We track which set names have unsynced local changes, poll the
// server with progressive backoff while it's unreachable, and sync whenever
// it's reachable.
window.RngSync = (function () {
  'use strict';

  const KEY_URL = 'rng_sync_url';
  const KEY_META = 'rng_sync_meta';       // { dbId, rev } of the server we last synced with
  const KEY_PENDING = 'rng_sync_pending'; // names of sets with unsynced local changes

  const MIN_DELAY = 2000;       // first retry after failure
  const MAX_DELAY = 5 * 60000;  // backoff cap
  const POLL_INTERVAL = 60000;  // while reachable and visible
  const CHANGE_DEBOUNCE = 1000; // after a local save/delete
  const TIMEOUT = 8000;

  let hooks = null;
  let url = '';
  let meta = { dbId: null, rev: 0 };
  let pending = new Set();

  let timer = null;
  let delay = MIN_DELAY;
  let running = false;
  let rerun = false;

  let status = { state: 'off', detail: '', lastSyncAt: null, nextAttemptAt: null };
  const listeners = [];

  // ---------- Storage ----------
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* */ }
  }

  const saveMeta = () => store(KEY_META, meta);
  const savePending = () => store(KEY_PENDING, [...pending]);

  function markAllPending() {
    hooks.getSets().forEach(s => pending.add(s.name));
    savePending();
  }

  // ---------- Status ----------
  function setStatus(state, detail) {
    status = { ...status, state, detail: detail || '' };
    listeners.forEach(fn => fn(getStatus()));
  }

  function getStatus() {
    return { ...status, url, pendingCount: pending.size };
  }

  // ---------- Scheduling ----------
  function schedule(ms) {
    clearTimeout(timer);
    timer = null;
    status.nextAttemptAt = null;
    if (!url) return;
    status.nextAttemptAt = Date.now() + ms;
    timer = setTimeout(tick, ms);
  }

  // Try now and reset the backoff (network came back, tab became visible, user asked).
  function kick() {
    delay = MIN_DELAY;
    schedule(0);
  }

  async function tick() {
    timer = null;
    status.nextAttemptAt = null;
    if (!url) return;
    if (document.hidden) return; // resumed by the visibilitychange listener
    if (running) { rerun = true; return; }

    running = true;
    const base = url;
    try {
      do {
        rerun = false;
        await runOnce(base);
      } while (rerun && base === url);
      if (base !== url) return; // URL changed mid-sync; handled in finally
      delay = MIN_DELAY;
      status.lastSyncAt = Date.now();
      schedule(POLL_INTERVAL);
      setStatus('synced');
    } catch (err) {
      if (base !== url) return;
      schedule(delay);
      delay = Math.min(delay * 2, MAX_DELAY);
      setStatus(err.offline ? 'offline' : 'error', err.message);
    } finally {
      running = false;
      // setUrl() during the request: its kick was absorbed by `running`, so start fresh.
      if (base !== url && url) kick();
    }
  }

  // ---------- Sync ----------
  async function request(path, body) {
    let res;
    try {
      res = await fetch(url + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch (e) {
      // Network failure, timeout, CORS rejection, or mixed-content block all look alike.
      const err = new Error('Server unreachable');
      err.offline = true;
      throw err;
    }
    if (!res.ok) throw new Error('Server error ' + res.status);
    return res.json();
  }

  // A different dbId means a different or wiped server: start over and push everything.
  function adoptServer(dbId) {
    if (dbId === meta.dbId) return false;
    meta = { dbId, rev: 0 };
    saveMeta();
    markAllPending();
    return true;
  }

  async function runOnce(base) {
    setStatus('syncing');

    const health = await request('/api/health');
    if (base !== url) return;
    adoptServer(health.dbId);

    const changes = hooks.getSets().filter(s => pending.has(s.name));
    const sent = new Map(changes.map(s => [s.name, s.updatedAt]));

    const res = await request('/api/sync', { since: meta.rev, changes });
    if (base !== url) return;
    if (adoptServer(res.dbId)) { rerun = true; return; }

    hooks.applyRemote(res.sets);

    // Clear pending for sets the server now has. Anything re-saved locally while
    // the request was in flight has a new updatedAt and stays pending.
    const remote = new Map(res.sets.map(s => [s.name, s.updatedAt]));
    hooks.getSets().forEach(s => {
      if (!pending.has(s.name)) return;
      if (sent.get(s.name) === s.updatedAt || remote.get(s.name) >= s.updatedAt) {
        pending.delete(s.name);
      }
    });
    savePending();

    meta.rev = res.rev;
    saveMeta();
  }

  // ---------- Public API ----------
  function normalizeUrl(raw) {
    let u = (raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u.replace(/\/+$/, '').replace(/\/api$/, '');
  }

  function init(h) {
    hooks = h;
    url = normalizeUrl(load(KEY_URL, ''));
    meta = load(KEY_META, { dbId: null, rev: 0 });
    pending = new Set(load(KEY_PENDING, []));

    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

    if (url) kick();
  }

  /** Record a local save/delete of a set so it's pushed on the next sync. */
  function noteChange(name) {
    pending.add(name);
    savePending();
    if (!url) return;
    if (running) { rerun = true; return; }
    // While reachable, push soon. While offline, leave it to the backoff loop.
    if (status.state === 'synced') schedule(CHANGE_DEBOUNCE);
  }

  function setUrl(raw) {
    const next = normalizeUrl(raw);
    if (next === url) { if (url) kick(); return url; }

    url = next;
    store(KEY_URL, url);
    meta = { dbId: null, rev: 0 };
    saveMeta();
    status.lastSyncAt = null;

    if (url) {
      kick();
      setStatus('syncing');
    } else {
      schedule(0); // clears the timer
      setStatus('off');
    }
    return url;
  }

  function onStatus(fn) {
    listeners.push(fn);
  }

  return { init, noteChange, setUrl, getUrl: () => url, syncNow: kick, getStatus, onStatus };
})();
