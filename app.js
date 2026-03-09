(function () {
  'use strict';

  // ========== Utilities ==========
  const $ = (id) => document.getElementById(id);
  const genId = () => Math.random().toString(36).substr(2, 9);
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const isDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

  // ========== Constants ==========
  const STORAGE_STATE = 'rng_state';
  const STORAGE_SETS = 'rng_sets';
  const DRAG_THRESHOLD = 10;

  const SECTION_COLORS = [
    { light: '#fee2e2', dark: '#2d1b1b', name: 'Red' },
    { light: '#ffedd5', dark: '#2d2418', name: 'Orange' },
    { light: '#fef9c3', dark: '#2d2b14', name: 'Yellow' },
    { light: '#dcfce7', dark: '#1b2d1e', name: 'Green' },
    { light: '#ccfbf1', dark: '#182d2a', name: 'Teal' },
    { light: '#dbeafe', dark: '#1b2336', name: 'Blue' },
    { light: '#e0e7ff', dark: '#1e1f36', name: 'Indigo' },
    { light: '#f3e8ff', dark: '#251b2d', name: 'Purple' },
    { light: '#fce7f3', dark: '#2d1b27', name: 'Pink' },
  ];

  // ========== State ==========
  let state = null;
  let dragCtx = null;
  let editGenId = null;
  let editSectionId = null;
  let editSectionColor = null;

  function createGen() {
    return { id: genId(), min: 1, max: 20, name: '', icon: '', result: null };
  }

  function createSection(gens) {
    return { id: genId(), name: null, color: null, generators: gens || [createGen()] };
  }

  function freshState() {
    return { sections: [createSection()], loadedSetName: null, dirty: false };
  }

  function markDirty() {
    if (state.loadedSetName) state.dirty = true;
    persistState();
    renderHeader();
  }

  // ========== Storage ==========
  function persistState() {
    try { localStorage.setItem(STORAGE_STATE, JSON.stringify(state)); } catch (e) { /* */ }
  }

  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (raw) { state = JSON.parse(raw); return true; }
    } catch (e) { /* */ }
    return false;
  }

  function getSavedSets() {
    try { return JSON.parse(localStorage.getItem(STORAGE_SETS) || '[]'); }
    catch (e) { return []; }
  }

  function saveSets(sets) {
    try { localStorage.setItem(STORAGE_SETS, JSON.stringify(sets)); } catch (e) { /* */ }
  }

  function saveSetByName(name, sections) {
    const sets = getSavedSets();
    const data = JSON.parse(JSON.stringify(sections));
    data.forEach(s => s.generators.forEach(g => { g.result = null; }));
    const idx = sets.findIndex(s => s.name === name);
    if (idx >= 0) sets[idx].sections = data;
    else sets.push({ name, sections: data });
    saveSets(sets);
  }

  function deleteSavedSet(name) {
    saveSets(getSavedSets().filter(s => s.name !== name));
  }

  // ========== Lookups ==========
  function findGen(id) {
    for (const sec of state.sections) {
      const g = sec.generators.find(g => g.id === id);
      if (g) return { section: sec, gen: g };
    }
    return null;
  }

  function findSection(id) {
    return state.sections.find(s => s.id === id);
  }

  // ========== Rendering ==========
  function render() {
    renderHeader();
    renderSections();
  }

  function renderHeader() {
    const t = $('set-title');
    if (state.loadedSetName) {
      t.textContent = state.loadedSetName + (state.dirty ? ' *' : '');
    } else {
      t.textContent = 'Untitled';
    }
  }

  function renderSections() {
    const container = $('sections-container');
    container.innerHTML = '';
    const multi = state.sections.length > 1;

    state.sections.forEach((sec, i) => {
      const el = document.createElement('div');
      el.className = 'section' + (multi ? ' multi' : '');
      el.dataset.sectionId = sec.id;

      if (multi) {
        if (sec.color != null) {
          const c = SECTION_COLORS[sec.color];
          el.style.backgroundColor = isDark() ? c.dark : c.light;
        }
        const label = document.createElement('div');
        label.className = 'section-label';
        label.textContent = sec.name || String(i + 1);
        label.addEventListener('click', (e) => { e.stopPropagation(); openEditSectionModal(sec.id); });
        el.appendChild(label);
      }

      sec.generators.forEach(g => el.appendChild(renderCard(g, sec.id)));
      container.appendChild(el);
    });

    // New section drop zone
    const dz = document.createElement('div');
    dz.id = 'new-section-drop';
    dz.className = 'new-section-drop';
    dz.innerHTML = '<span>Drop here to create a new section</span>';
    container.appendChild(dz);
  }

  function renderCard(gen, sectionId) {
    const card = document.createElement('div');
    card.className = 'gen-card';
    card.dataset.genId = gen.id;
    card.dataset.sectionId = sectionId;

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'gen-drag-handle';
    for (let i = 0; i < 6; i++) handle.appendChild(document.createElement('span'));
    card.appendChild(handle);

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'gen-content';

    const result = document.createElement('div');
    result.className = 'gen-result';
    result.textContent = gen.result != null ? gen.result : '\u2014';
    content.appendChild(result);

    const label = document.createElement('div');
    label.className = 'gen-label';
    if (gen.name) {
      label.textContent = (gen.icon ? gen.icon + ' ' : '') + gen.name;
      const rh = document.createElement('div');
      rh.className = 'gen-range-hover';
      rh.textContent = gen.min + ' \u2013 ' + gen.max;
      content.appendChild(rh);
    } else {
      label.textContent = (gen.icon ? gen.icon + ' ' : '') + gen.min + ' \u2013 ' + gen.max;
    }
    content.appendChild(label);
    card.appendChild(content);

    // Events
    handle.addEventListener('pointerdown', (e) => onDragStart(e, gen.id, sectionId, card));
    card.addEventListener('click', (e) => {
      if (e.target.closest('.gen-drag-handle')) return;
      openEditGenModal(gen.id);
    });

    return card;
  }

  function renderSetsView() {
    const list = $('sets-list');
    list.innerHTML = '';
    const sets = getSavedSets();

    if (sets.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-message';
      p.textContent = 'No saved sets yet.';
      list.appendChild(p);
      return;
    }

    sets.forEach(set => {
      const item = document.createElement('div');
      item.className = 'set-item';

      const name = document.createElement('span');
      name.className = 'set-item-name';
      name.textContent = set.name;
      item.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'set-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn btn-primary btn-sm';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => loadSet(set.name));
      actions.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => confirmDeleteSet(set.name));
      actions.appendChild(delBtn);

      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  // ========== Actions ==========
  function rollAll() {
    state.sections.forEach(sec => {
      sec.generators.forEach(g => { g.result = randInt(g.min, g.max); });
    });
    persistState();
    renderSections();

    // Trigger animation
    requestAnimationFrame(() => {
      document.querySelectorAll('.gen-result').forEach(el => {
        el.classList.add('rolled');
        el.addEventListener('animationend', () => el.classList.remove('rolled'), { once: true });
      });
    });
  }

  function addGenerator() {
    const last = state.sections[state.sections.length - 1];
    last.generators.push(createGen());
    markDirty();
    renderSections();
  }

  // ========== Drag and Drop ==========
  function onDragStart(e, gId, secId, card) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    dragCtx = {
      genId: gId,
      sectionId: secId,
      startX: e.clientX,
      startY: e.clientY,
      card,
      clone: null,
      isDragging: false,
      pointerId: e.pointerId,
      dropTarget: null,
    };

    const onMove = (ev) => {
      if (!dragCtx) return;
      const dx = ev.clientX - dragCtx.startX;
      const dy = ev.clientY - dragCtx.startY;

      if (!dragCtx.isDragging) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        beginDrag(ev);
      }

      if (dragCtx.clone) {
        dragCtx.clone.style.left = (ev.clientX - dragCtx.offsetX) + 'px';
        dragCtx.clone.style.top = (ev.clientY - dragCtx.offsetY) + 'px';
      }
      updateDropTarget(ev.clientX, ev.clientY);
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      if (dragCtx && dragCtx.isDragging) completeDrag();
      dragCtx = null;
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function beginDrag(e) {
    dragCtx.isDragging = true;
    document.body.classList.add('dragging');

    const rect = dragCtx.card.getBoundingClientRect();
    const clone = dragCtx.card.cloneNode(true);
    clone.className = 'gen-card drag-clone';
    clone.style.width = rect.width + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    document.body.appendChild(clone);

    dragCtx.clone = clone;
    dragCtx.offsetX = e.clientX - rect.left;
    dragCtx.offsetY = e.clientY - rect.top;
    dragCtx.card.classList.add('drag-placeholder');

    const dz = $('new-section-drop');
    if (dz) dz.classList.add('visible');
  }

  function updateDropTarget(x, y) {
    // Clear indicators
    document.querySelectorAll('.drop-before, .drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
    const dz = $('new-section-drop');
    if (dz) dz.classList.remove('drop-hover');

    // Check new-section drop zone
    if (dz) {
      const r = dz.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) {
        dz.classList.add('drop-hover');
        dragCtx.dropTarget = { newSection: true };
        return;
      }
    }

    // Find closest card
    const cards = document.querySelectorAll('.gen-card:not(.drag-clone):not(.drag-placeholder)');
    let closest = null, closestDist = Infinity, before = true;

    cards.forEach(c => {
      const r = c.getBoundingClientRect();
      const midY = r.top + r.height / 2;
      const d = Math.abs(y - midY);
      if (d < closestDist) {
        closestDist = d;
        closest = c;
        before = y < midY;
      }
    });

    if (closest) {
      closest.classList.add(before ? 'drop-before' : 'drop-after');
      dragCtx.dropTarget = {
        genId: closest.dataset.genId,
        sectionId: closest.dataset.sectionId,
        before,
      };
    } else {
      dragCtx.dropTarget = null;
    }
  }

  function completeDrag() {
    if (dragCtx.clone) dragCtx.clone.remove();
    document.body.classList.remove('dragging');
    const dz = $('new-section-drop');
    if (dz) dz.classList.remove('visible', 'drop-hover');
    document.querySelectorAll('.drop-before, .drop-after, .drag-placeholder').forEach(el => {
      el.classList.remove('drop-before', 'drop-after', 'drag-placeholder');
    });

    const target = dragCtx.dropTarget;
    if (!target) return;

    const srcSec = findSection(dragCtx.sectionId);
    if (!srcSec) return;
    const idx = srcSec.generators.findIndex(g => g.id === dragCtx.genId);
    if (idx < 0) return;
    const [gen] = srcSec.generators.splice(idx, 1);

    if (target.newSection) {
      state.sections.push({ id: genId(), name: null, color: null, generators: [gen] });
    } else {
      const destSec = findSection(target.sectionId);
      if (!destSec) { srcSec.generators.splice(idx, 0, gen); return; }
      let ti = destSec.generators.findIndex(g => g.id === target.genId);
      if (!target.before) ti++;
      destSec.generators.splice(ti, 0, gen);
    }

    // Remove empty sections
    state.sections = state.sections.filter(s => s.generators.length > 0);
    if (state.sections.length === 0) state.sections.push(createSection());

    markDirty();
    render();
  }

  // ========== Modals ==========
  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }

  // -- Edit Generator --
  function openEditGenModal(id) {
    const f = findGen(id);
    if (!f) return;
    editGenId = id;
    $('gen-icon').value = f.gen.icon || '';
    $('gen-name').value = f.gen.name || '';
    $('gen-min').value = f.gen.min;
    $('gen-max').value = f.gen.max;
    $('gen-min').classList.remove('input-error');
    $('gen-max').classList.remove('input-error');
    openModal('edit-gen-modal');
  }

  function saveEditGen() {
    const f = findGen(editGenId);
    if (!f) return;
    const min = parseInt($('gen-min').value, 10);
    const max = parseInt($('gen-max').value, 10);
    if (isNaN(min) || isNaN(max) || min > max) {
      $('gen-min').classList.add('input-error');
      $('gen-max').classList.add('input-error');
      return;
    }
    f.gen.name = $('gen-name').value.trim();
    f.gen.icon = $('gen-icon').value.trim();
    f.gen.min = min;
    f.gen.max = max;
    if (f.gen.result != null && (f.gen.result < min || f.gen.result > max)) f.gen.result = null;
    editGenId = null;
    closeModal('edit-gen-modal');
    markDirty();
    render();
  }

  function deleteEditGen() {
    if (!editGenId) return;
    const f = findGen(editGenId);
    if (!f) return;
    f.section.generators = f.section.generators.filter(g => g.id !== editGenId);
    state.sections = state.sections.filter(s => s.generators.length > 0);
    if (state.sections.length === 0) state.sections.push(createSection());
    editGenId = null;
    closeModal('edit-gen-modal');
    markDirty();
    render();
  }

  // -- Edit Section --
  function openEditSectionModal(id) {
    const sec = findSection(id);
    if (!sec) return;
    editSectionId = id;
    editSectionColor = sec.color;
    $('section-name').value = sec.name || '';

    const palette = $('color-palette');
    palette.innerHTML = '';

    // None swatch
    const none = document.createElement('button');
    none.className = 'color-swatch' + (sec.color == null ? ' selected' : '');
    none.style.background = 'var(--bg)';
    none.style.border = '2px dashed var(--border)';
    none.title = 'None';
    none.addEventListener('click', () => pickColor(null));
    palette.appendChild(none);

    SECTION_COLORS.forEach((c, i) => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch' + (sec.color === i ? ' selected' : '');
      sw.style.backgroundColor = isDark() ? c.dark : c.light;
      sw.title = c.name;
      sw.addEventListener('click', () => pickColor(i));
      palette.appendChild(sw);
    });

    openModal('edit-section-modal');
  }

  function pickColor(idx) {
    editSectionColor = idx;
    document.querySelectorAll('#color-palette .color-swatch').forEach((el, i) => {
      el.classList.toggle('selected', idx === null ? i === 0 : i === idx + 1);
    });
  }

  function saveEditSection() {
    const sec = findSection(editSectionId);
    if (!sec) return;
    sec.name = $('section-name').value.trim() || null;
    sec.color = editSectionColor;
    editSectionId = null;
    closeModal('edit-section-modal');
    markDirty();
    render();
  }

  // -- Save Modal --
  function openSaveModal() {
    $('save-name').value = '';
    $('save-error').classList.add('hidden');
    openModal('save-modal');
    $('save-name').focus();
  }

  function confirmSave() {
    const name = $('save-name').value.trim();
    if (!name) {
      showSaveError('Name is required.');
      return;
    }
    if (name !== state.loadedSetName && getSavedSets().find(s => s.name === name)) {
      showSaveError('A set with this name already exists.');
      return;
    }
    saveSetByName(name, state.sections);
    state.loadedSetName = name;
    state.dirty = false;
    persistState();
    closeModal('save-modal');
    renderHeader();
  }

  function showSaveError(msg) {
    const el = $('save-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // -- Confirm Modal --
  function showConfirm(message, onOk) {
    $('confirm-message').textContent = message;
    openModal('confirm-modal');

    const ok = $('confirm-ok-btn');
    const cancel = $('confirm-cancel-btn');
    const cleanup = () => {
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
      closeModal('confirm-modal');
    };

    $('confirm-ok-btn').addEventListener('click', () => { cleanup(); onOk(); });
    $('confirm-cancel-btn').addEventListener('click', cleanup);
  }

  function confirmDeleteSet(name) {
    showConfirm('Delete "' + name + '"?', () => {
      deleteSavedSet(name);
      if (state.loadedSetName === name) {
        state.loadedSetName = null;
        state.dirty = false;
        persistState();
        renderHeader();
      }
      renderSetsView();
    });
  }

  // ========== Navigation ==========
  function showRollView() {
    $('roll-view').classList.remove('hidden');
    $('header').classList.remove('hidden');
    $('footer').classList.remove('hidden');
    $('sets-view').classList.add('hidden');
    render();
  }

  function showSetsView() {
    $('roll-view').classList.add('hidden');
    $('header').classList.add('hidden');
    $('footer').classList.add('hidden');
    $('sets-view').classList.remove('hidden');
    renderSetsView();
  }

  function checkUnsaved(cb) {
    if (state.loadedSetName && state.dirty) {
      showConfirm('You have unsaved changes to "' + state.loadedSetName + '". Discard?', cb);
    } else {
      cb();
    }
  }

  function newSet() {
    checkUnsaved(() => {
      state = freshState();
      persistState();
      showRollView();
    });
  }

  function loadSet(name) {
    const doLoad = () => {
      const set = getSavedSets().find(s => s.name === name);
      if (!set) return;
      state.sections = JSON.parse(JSON.stringify(set.sections));
      state.sections.forEach(s => {
        if (!s.id) s.id = genId();
        s.generators.forEach(g => { if (!g.id) g.id = genId(); });
      });
      state.loadedSetName = name;
      state.dirty = false;
      persistState();
      showRollView();
    };
    checkUnsaved(doLoad);
  }

  // ========== Event Listeners ==========
  function initEvents() {
    $('roll-btn').addEventListener('click', rollAll);
    $('add-btn').addEventListener('click', addGenerator);
    $('sets-btn').addEventListener('click', () => showSetsView());
    $('back-btn').addEventListener('click', showRollView);

    // Save
    $('save-btn').addEventListener('click', () => {
      if (state.loadedSetName && !state.dirty) return;
      if (state.loadedSetName) {
        saveSetByName(state.loadedSetName, state.sections);
        state.dirty = false;
        persistState();
        renderHeader();
      } else {
        openSaveModal();
      }
    });

    // More menu
    $('more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      $('more-menu').classList.toggle('visible');
    });
    document.addEventListener('click', () => $('more-menu').classList.remove('visible'));

    $('save-as-btn').addEventListener('click', () => {
      $('more-menu').classList.remove('visible');
      openSaveModal();
    });

    $('new-set-btn').addEventListener('click', () => {
      $('more-menu').classList.remove('visible');
      newSet();
    });

    // Edit gen modal
    $('gen-save-btn').addEventListener('click', saveEditGen);
    $('gen-cancel-btn').addEventListener('click', () => { editGenId = null; closeModal('edit-gen-modal'); });
    $('gen-delete-btn').addEventListener('click', deleteEditGen);
    $('gen-min').addEventListener('input', () => { $('gen-min').classList.remove('input-error'); $('gen-max').classList.remove('input-error'); });
    $('gen-max').addEventListener('input', () => { $('gen-min').classList.remove('input-error'); $('gen-max').classList.remove('input-error'); });

    // Edit section modal
    $('section-save-btn').addEventListener('click', saveEditSection);
    $('section-cancel-btn').addEventListener('click', () => { editSectionId = null; closeModal('edit-section-modal'); });

    // Save modal
    $('save-confirm-btn').addEventListener('click', confirmSave);
    $('save-cancel-btn').addEventListener('click', () => closeModal('save-modal'));
    $('save-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmSave(); });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    // Re-render on color scheme change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  }

  // ========== Init ==========
  function init() {
    if (!loadPersistedState()) state = freshState();
    initEvents();
    render();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
