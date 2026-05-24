import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://hpiyvnfhoqnnnotrmwaz.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwaXl2bmZob3Fubm5vdHJtd2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzIwNDEsImV4cCI6MjA4ODA0ODA0MX0.AsGhYitkSnyVMwpJII05UseS_gICaXiCy7d8iHsr6Qw';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAID_BY_OPTIONS = {
  allison_avital: ['joint', 'Allison', 'Avital'],
};

const SECTIONS = [
  'Vegetables',
  'Fruit',
  'Dairy',
  'Meat & Fish',
  'Bread & Wraps',
  'Grains & Pasta',
  'Baking',
  'Nuts & Seeds',
  'Oils & Vinegar',
  'Spices',
  'Snacks & Chocolate',
  'Pantry',
  'Beverages',
  'Wine & Beer',
  'Frozen',
  'Cleaning',
  'Personal Care',
  'Other',
];

// All lists rendered on the single surface.
const ALL_LISTS = ['apt', 'allison', 'avital', 'allison_avital', 'allison_nutritionist'];

let catalog = {};
let items = {};
let history = [];
let future = [];

// ========== INIT ==========
async function init() {
  await loadCatalog();
  await loadItems();
  populateSectionDropdowns();
  renderAll();
}

async function loadCatalog() {
  const { data } = await db.from('grocery_catalog').select('*').order('name');
  catalog = {};
  (data || []).forEach((r) => (catalog[r.name.toLowerCase()] = { section: r.section, id: r.id }));
}

async function loadItems() {
  const { data } = await db.from('grocery_items').select('*').order('created_at');
  items = {};
  (data || []).forEach((r) => {
    if (!items[r.list_type]) items[r.list_type] = [];
    items[r.list_type].push(r);
  });
}

function populateSectionDropdowns() {
  document.querySelectorAll('.section-select').forEach((sel) => {
    sel.innerHTML = '<option value="">Section (optional)</option>';
    SECTIONS.forEach((s) => {
      const o = document.createElement('option');
      o.value = o.textContent = s;
      sel.appendChild(o);
    });
  });
  const editSec = document.getElementById('edit-section');
  if (editSec) {
    editSec.innerHTML = '<option value="">Choose section...</option>';
    SECTIONS.forEach((s) => {
      const o = document.createElement('option');
      o.value = o.textContent = s;
      editSec.appendChild(o);
    });
  }
}

// ========== SORT ==========
function sortItems(list) {
  return [...list].sort((a, b) => {
    const si = SECTIONS.indexOf(a.section);
    const sj = SECTIONS.indexOf(b.section);
    if (si !== sj) return si - sj;
    return a.item_name.localeCompare(b.item_name);
  });
}

// ========== RENDER ==========
function renderAll() {
  ALL_LISTS.forEach((k) => renderList(k));
  renderCatalog();
  updateUndoRedo();
}

function renderList(key) {
  const ul = document.getElementById(`${key}-items`);
  const empty = document.getElementById(`${key}-empty`);
  const count = document.getElementById(`${key}-count`);
  if (!ul) return;
  const list = sortItems(items[key] || []);
  ul.innerHTML = '';
  const isNutri = key === 'allison_nutritionist';
  const isAllison = key === 'allison';
  buildGroupedList(ul, list, key, isNutri);
  empty.style.display = list.length ? 'none' : 'block';
  count.textContent = list.length;
  // Auto-collapse section-card when empty (except nutritionist + Allison's own list — primary surfaces stay open)
  const body = document.getElementById(`${key}-body`);
  const chev = document.getElementById(`${key}-chev`);
  if (body && list.length === 0 && !isNutri && !isAllison) {
    body.classList.add('collapsed');
    if (chev) chev.classList.remove('open');
  }
  if (body && list.length > 0) {
    body.classList.remove('collapsed');
    if (chev) chev.classList.add('open');
  }
}

function buildGroupedList(ul, sortedList, displayKey, isNutri) {
  let lastSection = null;
  sortedList.forEach((item) => {
    if (item.section !== lastSection) {
      const gh = document.createElement('li');
      gh.className = 'group-header';
      gh.textContent = item.section;
      ul.appendChild(gh);
      lastSection = item.section;
    }
    ul.appendChild(isNutri ? makeNutriRow(item) : makeRow(item, displayKey));
  });
}

function makeRow(item, displayKey) {
  const li = document.createElement('li');
  li.className = 'item-row';
  // Mark optimistically-added rows so we can detect them if needed.
  if (item._optimistic) li.dataset.optimistic = '1';

  const chk = document.createElement('div');
  chk.className = 'item-check' + (item.checked ? ' checked' : '');
  chk.onclick = () => toggleCheck(item, displayKey);

  const info = document.createElement('div');
  info.className = 'item-info';

  const name = document.createElement('span');
  name.className = 'item-name' + (item.checked ? ' checked' : '');
  name.textContent = item.item_name;

  info.append(name);

  // paid_by pills for shared lists
  const paidByOpts = PAID_BY_OPTIONS[displayKey];
  if (paidByOpts) {
    const pills = document.createElement('div');
    pills.className = 'paid-by-pills';
    paidByOpts.forEach((opt) => {
      const pill = document.createElement('button');
      pill.className =
        'paid-by-pill' +
        (opt !== 'joint' ? ' mine' : '') +
        ((item.paid_by || 'joint') === opt ? ' active' : '');
      pill.textContent = opt === 'joint' ? 'joint' : opt;
      pill.onclick = (e) => {
        e.stopPropagation();
        setPaidBy(item, displayKey, opt, pill);
      };
      pills.appendChild(pill);
    });
    info.append(pills);
  }

  const qty = document.createElement('span');
  qty.className = 'item-qty';
  qty.textContent = `x${item.quantity || 1}`;
  qty.style.display = item.quantity && item.quantity > 1 ? '' : 'none';

  const del = document.createElement('button');
  del.className = 'item-delete';
  del.textContent = '✕';
  del.onclick = () => deleteItem(item, displayKey);

  const edit = document.createElement('button');
  edit.className = 'item-edit';
  edit.textContent = '✏';
  edit.title = 'Edit item';
  edit.onclick = (e) => {
    e.stopPropagation();
    openEditModal(item, displayKey);
  };

  li.append(chk, info, qty, edit, del);
  return li;
}

function makeNutriRow(item) {
  // Reference list: leading + (copies to Allison's list), name (tap to inline-rename), trailing ✕ to remove
  const li = document.createElement('li');
  li.className = 'item-row nutri-row';

  const addBtn = document.createElement('button');
  addBtn.className = 'nutri-add-btn';
  addBtn.textContent = '+';
  addBtn.title = "Add to Allison's List";
  addBtn.setAttribute('aria-label', "Add to Allison's List");
  addBtn.onclick = (e) => {
    e.stopPropagation();
    nutriAddToAllison(item);
  };

  const info = document.createElement('div');
  info.className = 'item-info';
  const name = document.createElement('span');
  name.className = 'item-name nutri-name';
  name.textContent = item.item_name;
  name.title = 'Tap to rename';
  name.onclick = (e) => {
    e.stopPropagation();
    inlineRenameNutri(item, name);
  };
  info.append(name);

  const qty = document.createElement('span');
  qty.className = 'item-qty';
  qty.textContent = `x${item.quantity || 1}`;
  qty.style.display = item.quantity && item.quantity > 1 ? '' : 'none';

  const del = document.createElement('button');
  del.className = 'item-delete';
  del.textContent = '✕';
  del.title = 'Remove from nutritionist list';
  del.onclick = (e) => {
    e.stopPropagation();
    deleteItem(item, 'allison_nutritionist');
  };

  li.append(addBtn, info, qty, del);
  return li;
}

function inlineRenameNutri(item, nameEl) {
  // Replace name span with input; commit on Enter/blur, cancel on Escape.
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'nutri-rename-input';
  input.value = item.item_name;
  input.spellcheck = true;

  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (!newName || newName === item.item_name) {
      nameEl.textContent = item.item_name;
      input.replaceWith(nameEl);
      return;
    }
    await db.from('grocery_items').update({ item_name: newName }).eq('id', item.id);
    item.item_name = newName;
    nameEl.textContent = newName;
    input.replaceWith(nameEl);
    renderAll();
    setStatus(`Renamed to "${newName}"`);
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    input.replaceWith(nameEl);
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };
  input.onblur = commit;

  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

function renderCatalog() {
  const tbody = document.getElementById('catalog-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  Object.entries(catalog)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, data]) => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = name;
      const tdSec = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'catalog-section-select';
      SECTIONS.forEach((s) => {
        const o = document.createElement('option');
        o.value = o.textContent = s;
        if (s === data.section) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => updateCatalogSection(name, data.id, sel.value);
      tdSec.appendChild(sel);
      tr.append(tdName, tdSec);
      tbody.appendChild(tr);
    });
}

// ========== AUTOCOMPLETE ==========
window.onInput = function (key) {
  const input = document.getElementById(`${key}-input`);
  const ac = document.getElementById(`${key}-ac`);
  const sec = document.getElementById(`${key}-sec`);
  const val = input.value.toLowerCase().trim();
  ac.innerHTML = '';
  ac.style.display = 'none';
  if (!val) return;
  const exact = catalog[val];
  if (exact) {
    sec.value = exact.section;
  }
  const matches = Object.entries(catalog)
    .filter(([n]) => n.includes(val))
    .slice(0, 8);
  if (!matches.length) return;
  matches.forEach(([name, data]) => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.innerHTML = `<span>${name}</span><span class="ac-section">${data.section}</span>`;
    div.onmousedown = (e) => {
      e.preventDefault();
      input.value = name;
      sec.value = data.section;
      ac.style.display = 'none';
    };
    ac.appendChild(div);
  });
  ac.style.display = 'block';
};

window.onKey = function (e, key) {
  if (e.key === 'Enter') {
    document.getElementById(`${key}-ac`).style.display = 'none';
    addItem(key);
  }
  if (e.key === 'Escape') document.getElementById(`${key}-ac`).style.display = 'none';
};

document.addEventListener('click', () => {
  document.querySelectorAll('.autocomplete-list').forEach((el) => (el.style.display = 'none'));
});

// ========== ADD (optimistic) ==========
// Render with a temp id immediately, fire INSERT in background, swap temp id for real id on success.
let _addingItem = false;
window.addItem = async function (key) {
  if (_addingItem) return;
  _addingItem = true;
  const input = document.getElementById(`${key}-input`);
  const sec = document.getElementById(`${key}-sec`);
  const qtyEl = document.getElementById(`${key}-qty`);
  const name = input.value.trim();
  const quantity = parseInt(qtyEl?.value) || 1;
  if (!name) {
    _addingItem = false;
    return;
  }
  if (!sec.value) sec.value = 'Other';
  const finalSection = sec.value || 'Other';
  document.getElementById(`${key}-ac`).style.display = 'none';

  // Step 1: optimistic local state with a temp id.
  const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const optimisticItem = {
    id: tempId,
    list_type: key,
    item_name: name,
    section: finalSection,
    checked: false,
    quantity,
    paid_by: 'joint',
    _optimistic: true,
  };
  if (!items[key]) items[key] = [];
  items[key].push(optimisticItem);
  // Reset inputs so she can keep typing.
  input.value = '';
  sec.value = '';
  if (qtyEl) qtyEl.value = 1;
  renderAll();
  _addingItem = false;

  // Step 2: catalog ensure (background) + INSERT.
  try {
    const lower = name.toLowerCase();
    if (!catalog[lower]) {
      const { data: catRow } = await db
        .from('grocery_catalog')
        .insert({ name: lower, section: finalSection })
        .select()
        .single();
      if (catRow) catalog[lower] = { section: finalSection, id: catRow.id };
    }

    const { data: newItem, error: addErr } = await db
      .from('grocery_items')
      .insert({
        list_type: key,
        item_name: name,
        section: finalSection,
        checked: false,
        added_by: '',
        quantity,
      })
      .select()
      .single();

    if (addErr || !newItem) throw addErr || new Error('No row returned');

    // Step 3: swap temp id for real id in local state.
    const stored = (items[key] || []).find((i) => i.id === tempId);
    if (stored) {
      Object.assign(stored, newItem);
      delete stored._optimistic;
    }
    pushHistory({ type: 'add', item: { ...newItem }, canonKey: key });
    renderAll();
  } catch (err) {
    console.error('add item error:', err);
    // Rollback optimistic row + retry-on-tap snackbar.
    items[key] = (items[key] || []).filter((i) => i.id !== tempId);
    renderAll();
    showRetrySnackbar(`Could not add "${name}" — tap to retry`, () => {
      input.value = name;
      sec.value = finalSection;
      if (qtyEl) qtyEl.value = quantity;
      addItem(key);
    });
  }
};

// ========== CHECK (optimistic + undo) ==========
async function toggleCheck(item, displayKey) {
  if (item._optimistic) return; // can't check a row that hasn't persisted
  const prevChecked = item.checked;
  const newVal = !prevChecked;

  // Step 1: optimistic local + render.
  const stored = (items[displayKey] || []).find((i) => i.id === item.id);
  if (stored) stored.checked = newVal;
  renderAll();

  // Step 2: snackbar offering Undo.
  const verb = newVal ? 'Checked' : 'Unchecked';
  let undone = false;
  showUndoSnackbar(`${verb} "${item.item_name}"`, async () => {
    if (undone) return;
    undone = true;
    const s2 = (items[displayKey] || []).find((i) => i.id === item.id);
    if (s2) s2.checked = prevChecked;
    renderAll();
    // Fire inverse Supabase op (race-safe: works whether original write completed or not).
    await dbWriteWithRetry(() =>
      db.from('grocery_items').update({ checked: prevChecked }).eq('id', item.id),
    );
  });

  // Step 3: background write + auto-retry.
  const ok = await dbWriteWithRetry(() =>
    db.from('grocery_items').update({ checked: newVal }).eq('id', item.id),
  );
  if (!ok && !undone) {
    // Rollback local + flip snackbar to retry.
    const s3 = (items[displayKey] || []).find((i) => i.id === item.id);
    if (s3) s3.checked = prevChecked;
    renderAll();
    showRetrySnackbar(`Save failed — tap to retry`, () => toggleCheck(item, displayKey));
    return;
  }

  if (!undone) {
    pushHistory({ type: newVal ? 'check' : 'uncheck', item: { ...item }, canonKey: displayKey });
  }
}

// ========== DELETE (optimistic + undo) ==========
async function deleteItem(item, displayKey) {
  if (item._optimistic) {
    // Row not persisted yet — just yank it from local state.
    items[displayKey] = (items[displayKey] || []).filter((i) => i.id !== item.id);
    renderAll();
    return;
  }
  const snapshot = { ...item };

  // Step 1: optimistic local remove.
  items[displayKey] = (items[displayKey] || []).filter((i) => i.id !== item.id);
  renderAll();

  // Step 2: snackbar Undo (re-insert restored row).
  let undone = false;
  showUndoSnackbar(`Removed "${snapshot.item_name}"`, async () => {
    if (undone) return;
    undone = true;
    // Optimistically restore visually first.
    if (!items[displayKey]) items[displayKey] = [];
    items[displayKey].push({ ...snapshot, _optimistic: true });
    renderAll();
    // Re-insert in DB with a fresh row (id will change — that's fine for undo semantics).
    try {
      const { data: r } = await db
        .from('grocery_items')
        .insert({
          list_type: snapshot.list_type,
          item_name: snapshot.item_name,
          section: snapshot.section,
          checked: snapshot.checked,
          added_by: snapshot.added_by || '',
          quantity: snapshot.quantity || 1,
          paid_by: snapshot.paid_by || 'joint',
        })
        .select()
        .single();
      if (r) {
        const placeholder = (items[displayKey] || []).find(
          (i) => i._optimistic && i.item_name === snapshot.item_name,
        );
        if (placeholder) {
          Object.assign(placeholder, r);
          delete placeholder._optimistic;
        }
        renderAll();
      }
    } catch (err) {
      console.error('undo-delete reinsert failed:', err);
      showRetrySnackbar('Could not undo — tap to retry', async () => {
        const placeholder = (items[displayKey] || []).find(
          (i) => i._optimistic && i.item_name === snapshot.item_name,
        );
        if (placeholder) {
          items[displayKey] = (items[displayKey] || []).filter((i) => i !== placeholder);
          renderAll();
        }
      });
    }
  });

  // Step 3: background DELETE + auto-retry.
  const ok = await dbWriteWithRetry(() => db.from('grocery_items').delete().eq('id', item.id));
  if (!ok && !undone) {
    // Restore row visually + flip snackbar to retry.
    if (!items[displayKey]) items[displayKey] = [];
    items[displayKey].push(snapshot);
    renderAll();
    showRetrySnackbar('Save failed — tap to retry', () => deleteItem(item, displayKey));
    return;
  }

  if (!undone) {
    pushHistory({ type: 'delete', item: snapshot, canonKey: displayKey });
  }
}

// ========== CLEAR CHECKED (optimistic + bulk undo) ==========
window.clearChecked = async function (key) {
  const checked = (items[key] || []).filter((i) => i.checked && !i._optimistic);
  if (!checked.length) return;
  const snapshots = checked.map((i) => ({ ...i }));
  const ids = checked.map((i) => i.id);

  // Step 1: optimistic local remove.
  items[key] = (items[key] || []).filter((i) => !ids.includes(i.id));
  renderAll();

  // Step 2: silent trip save (best-effort, non-blocking) + bulk undo snackbar.
  const tripPromise = db
    .from('grocery_trips')
    .insert({
      trip_date: new Date().toISOString().split('T')[0],
      shopper: 'Allison',
      items: snapshots.map((i) => ({
        item_name: i.item_name,
        section: i.section,
        list_type: i.list_type,
        quantity: i.quantity || 1,
        paid_by: i.paid_by || 'joint',
      })),
    })
    .then(null, (err) => console.warn('Silent trip save failed:', err));

  let undone = false;
  showUndoSnackbar(
    `Cleared ${snapshots.length} item${snapshots.length === 1 ? '' : 's'}`,
    async () => {
      if (undone) return;
      undone = true;
      // Optimistically restore — best-effort re-insert (ids may change).
      if (!items[key]) items[key] = [];
      snapshots.forEach((s) => items[key].push({ ...s, _optimistic: true }));
      renderAll();
      try {
        const inserts = snapshots.map((s) => ({
          list_type: s.list_type,
          item_name: s.item_name,
          section: s.section,
          checked: s.checked,
          added_by: s.added_by || '',
          quantity: s.quantity || 1,
          paid_by: s.paid_by || 'joint',
        }));
        const { data: rows } = await db.from('grocery_items').insert(inserts).select();
        if (rows) {
          // Replace optimistic placeholders by item_name match (good-enough for bulk undo).
          rows.forEach((r) => {
            const ph = (items[key] || []).find(
              (i) => i._optimistic && i.item_name === r.item_name && i.section === r.section,
            );
            if (ph) {
              Object.assign(ph, r);
              delete ph._optimistic;
            }
          });
          renderAll();
        }
      } catch (err) {
        console.error('undo-clear reinsert failed:', err);
        showRetrySnackbar('Could not undo all — tap to retry', () => clearChecked(key));
      }
    },
  );

  // Step 3: background bulk delete + auto-retry.
  const ok = await dbWriteWithRetry(() => db.from('grocery_items').delete().in('id', ids));
  if (!ok && !undone) {
    if (!items[key]) items[key] = [];
    snapshots.forEach((s) => items[key].push(s));
    renderAll();
    showRetrySnackbar('Save failed — tap to retry', () => clearChecked(key));
    return;
  }

  // Wait on trip save to surface any warning (silently).
  await tripPromise;

  if (!undone) {
    snapshots.forEach((s) => pushHistory({ type: 'delete', item: s, canonKey: key }));
  }
};

// ========== EDIT (non-optimistic by design — modal commit) ==========
let _editItem = null;
let _editDisplayKey = null;

window.openEditModal = function (item, displayKey) {
  if (item._optimistic) {
    setStatus('Still saving — try again in a moment');
    return;
  }
  _editItem = item;
  _editDisplayKey = displayKey;
  document.getElementById('edit-name').value = item.item_name;
  document.getElementById('edit-section').value = item.section;
  document.getElementById('edit-list').value = item.list_type;
  document.getElementById('edit-qty').value = item.quantity || 1;
  document.getElementById('edit-modal-bg').classList.add('active');
  document.getElementById('edit-name').focus();
};

window.closeEditModal = function () {
  document.getElementById('edit-modal-bg').classList.remove('active');
  _editItem = null;
  _editDisplayKey = null;
};

window.saveEdit = async function () {
  if (!_editItem) return;
  const newName = document.getElementById('edit-name').value.trim();
  const newSection = document.getElementById('edit-section').value;
  const newList = document.getElementById('edit-list').value;
  const newQty = parseInt(document.getElementById('edit-qty').value) || 1;
  if (!newName || !newSection || !newList) {
    setStatus('Please fill all fields');
    return;
  }

  const oldKey = _editDisplayKey;

  await db
    .from('grocery_items')
    .update({
      item_name: newName,
      section: newSection,
      list_type: newList,
      quantity: newQty,
    })
    .eq('id', _editItem.id);

  items[oldKey] = (items[oldKey] || []).filter((i) => i.id !== _editItem.id);
  const updatedItem = {
    ..._editItem,
    item_name: newName,
    section: newSection,
    list_type: newList,
    quantity: newQty,
  };
  if (!items[newList]) items[newList] = [];
  items[newList].push(updatedItem);

  setStatus(`Updated "${newName}"`);
  closeEditModal();
  renderAll();
};

// ========== CATALOG ==========
async function updateCatalogSection(name, id, newSection) {
  await db.from('grocery_catalog').update({ section: newSection }).eq('id', id);
  catalog[name].section = newSection;
  setStatus(`Updated "${name}" → ${newSection}`);
}
window.toggleCatalog = function () {
  document.getElementById('catalog-editor').classList.toggle('open');
};

// ========== UNDO / REDO (desktop ↩/↪ — separate from snackbar undo) ==========
function pushHistory(action) {
  history.push(action);
  future = [];
  updateUndoRedo();
}

window.undo = async function () {
  if (!history.length) return;
  const action = history.pop();
  future.push(action);
  await reverseAction(action);
  updateUndoRedo();
};
window.redo = async function () {
  if (!future.length) return;
  const action = future.pop();
  history.push(action);
  await applyAction(action);
  updateUndoRedo();
};

async function reverseAction({ type, item, canonKey }) {
  if (type === 'add') {
    await db.from('grocery_items').delete().eq('id', item.id);
    items[canonKey] = (items[canonKey] || []).filter((i) => i.id !== item.id);
  } else if (type === 'delete') {
    const { data: r } = await db
      .from('grocery_items')
      .insert({
        list_type: item.list_type,
        item_name: item.item_name,
        section: item.section,
        checked: item.checked,
        added_by: item.added_by || '',
        quantity: item.quantity || 1,
        paid_by: item.paid_by || 'joint',
      })
      .select()
      .single();
    if (r) {
      if (!items[canonKey]) items[canonKey] = [];
      items[canonKey].push(r);
      item.id = r.id;
    }
  } else if (type === 'check') {
    await db.from('grocery_items').update({ checked: false }).eq('id', item.id);
    const s = (items[canonKey] || []).find((i) => i.id === item.id);
    if (s) s.checked = false;
  } else if (type === 'uncheck') {
    await db.from('grocery_items').update({ checked: true }).eq('id', item.id);
    const s = (items[canonKey] || []).find((i) => i.id === item.id);
    if (s) s.checked = true;
  }
  renderAll();
}

async function applyAction({ type, item, canonKey }) {
  if (type === 'add') {
    const { data: r } = await db
      .from('grocery_items')
      .insert({
        list_type: item.list_type,
        item_name: item.item_name,
        section: item.section,
        checked: item.checked,
        added_by: item.added_by || '',
        quantity: item.quantity || 1,
        paid_by: item.paid_by || 'joint',
      })
      .select()
      .single();
    if (r) {
      if (!items[canonKey]) items[canonKey] = [];
      items[canonKey].push(r);
      item.id = r.id;
    }
  } else if (type === 'delete') {
    await db.from('grocery_items').delete().eq('id', item.id);
    items[canonKey] = (items[canonKey] || []).filter((i) => i.id !== item.id);
  } else if (type === 'check') {
    await db.from('grocery_items').update({ checked: true }).eq('id', item.id);
    const s = (items[canonKey] || []).find((i) => i.id === item.id);
    if (s) s.checked = true;
  } else if (type === 'uncheck') {
    await db.from('grocery_items').update({ checked: false }).eq('id', item.id);
    const s = (items[canonKey] || []).find((i) => i.id === item.id);
    if (s) s.checked = false;
  }
  renderAll();
}

function updateUndoRedo() {
  document.querySelectorAll('.undo-btn').forEach((b) => (b.disabled = !history.length));
  document.querySelectorAll('.redo-btn').forEach((b) => (b.disabled = !future.length));
}

window.toggleSection = function (bodyId, chevId) {
  document.getElementById(bodyId).classList.toggle('collapsed');
  document.getElementById(chevId).classList.toggle('open');
};

let _statusTimer = null;
function setStatus(msg, isHtml) {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  if (isHtml) {
    bar.innerHTML = msg;
  } else {
    bar.textContent = msg;
  }
  clearTimeout(_statusTimer);
  if (msg && !isHtml) {
    _statusTimer = setTimeout(() => (bar.textContent = ''), 3000);
  }
}

// ========== NUTRITIONIST → ALLISON COPY (with snackbar undo) ==========
let _lastNutriCopyId = null;

async function nutriAddToAllison(nutriItem) {
  const existing = (items['allison'] || []).find(
    (i) => i.item_name.toLowerCase() === nutriItem.item_name.toLowerCase(),
  );
  if (existing) {
    showUndoSnackbar(`"${nutriItem.item_name}" already on your list`, null);
    return;
  }
  const { data: newItem, error } = await db
    .from('grocery_items')
    .insert({
      list_type: 'allison',
      item_name: nutriItem.item_name,
      section: nutriItem.section || 'Other',
      checked: false,
      added_by: 'Allison',
      quantity: nutriItem.quantity || 1,
    })
    .select()
    .single();
  if (error || !newItem) {
    console.error('nutri copy error:', error);
    showUndoSnackbar('Could not add — try again', null);
    return;
  }
  if (!items['allison']) items['allison'] = [];
  items['allison'].push(newItem);
  _lastNutriCopyId = newItem.id;
  renderAll();
  showUndoSnackbar("Added to Allison's List", () => undoNutriCopy(newItem.id));
}

async function undoNutriCopy(itemId) {
  if (_lastNutriCopyId !== itemId) return;
  await db.from('grocery_items').delete().eq('id', itemId);
  items['allison'] = (items['allison'] || []).filter((i) => i.id !== itemId);
  _lastNutriCopyId = null;
  renderAll();
  hideSnackbar();
}

// ========== SNACKBAR (shared: undo + retry variants) ==========
let _snackTimer = null;

function showUndoSnackbar(msg, undoCallback) {
  const bar = document.getElementById('snackbar');
  if (!bar) return;
  bar.classList.remove('snackbar-warn');
  bar.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  bar.appendChild(span);
  if (undoCallback) {
    const btn = document.createElement('button');
    btn.className = 'snackbar-undo';
    btn.textContent = 'Undo';
    btn.onclick = () => {
      hideSnackbar();
      undoCallback();
    };
    bar.appendChild(btn);
  }
  bar.classList.add('visible');
  clearTimeout(_snackTimer);
  _snackTimer = setTimeout(() => hideSnackbar(), 5000);
}

function showRetrySnackbar(msg, retryCallback) {
  // Warn-style (orange) snackbar with tap-to-retry. Longer timeout — 8s.
  const bar = document.getElementById('snackbar');
  if (!bar) return;
  bar.classList.add('snackbar-warn');
  bar.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  bar.appendChild(span);
  if (retryCallback) {
    const btn = document.createElement('button');
    btn.className = 'snackbar-undo';
    btn.textContent = 'Retry';
    btn.onclick = () => {
      hideSnackbar();
      retryCallback();
    };
    bar.appendChild(btn);
  }
  bar.classList.add('visible');
  clearTimeout(_snackTimer);
  _snackTimer = setTimeout(() => hideSnackbar(), 8000);
}

function hideSnackbar() {
  const bar = document.getElementById('snackbar');
  if (bar) {
    bar.classList.remove('visible');
    bar.classList.remove('snackbar-warn');
  }
  clearTimeout(_snackTimer);
}

// ========== DB WRITE WITH ONE AUTO-RETRY ==========
// Returns true on success, false on terminal failure.
async function dbWriteWithRetry(opFn) {
  try {
    const res = await opFn();
    if (!res || !res.error) return true;
    throw res.error;
  } catch (err) {
    console.warn('DB op failed, retrying in 1s:', err);
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res2 = await opFn();
      if (!res2 || !res2.error) return true;
      console.error('DB op failed on retry:', res2.error);
      return false;
    } catch (err2) {
      console.error('DB op failed on retry (throw):', err2);
      return false;
    }
  }
}

window.setPaidBy = async function (item, listKey, value, btnEl) {
  item.paid_by = value;
  btnEl
    .closest('.paid-by-pills')
    .querySelectorAll('.paid-by-pill')
    .forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
  await db.from('grocery_items').update({ paid_by: value }).eq('id', item.id);
};

init();
