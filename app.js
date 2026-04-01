import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://hpiyvnfhoqnnnotrmwaz.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwaXl2bmZob3Fubm5vdHJtd2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzIwNDEsImV4cCI6MjA4ODA0ODA0MX0.AsGhYitkSnyVMwpJII05UseS_gICaXiCy7d8iHsr6Qw';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAID_BY_OPTIONS = {
  allison_ruthie: ['joint', 'Allison', 'Ruthie'],
  ruthie_allison: ['joint', 'Allison', 'Ruthie'],
  allison_avital: ['joint', 'Allison', 'Avital'],
  avital_allison: ['joint', 'Allison', 'Avital'],
  ruthie_avital: ['joint', 'Ruthie', 'Avital'],
  avital_ruthie: ['joint', 'Ruthie', 'Avital'],
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

const ALIAS = {
  ruthie_allison: 'allison_ruthie',
  avital_allison: 'allison_avital',
  avital_ruthie: 'ruthie_avital',
};
function canonical(k) {
  return ALIAS[k] || k;
}

let catalog = {};
let items = {};
let staples = []; // { name, section, id }
let history = [];
let future = [];
let currentUser = localStorage.getItem('grocery_who') || '';

const DEFAULT_STAPLES = {
  Allison: [
    { name: 'Milk', section: 'Dairy' },
    { name: 'Eggs', section: 'Dairy' },
    { name: 'Butter', section: 'Dairy' },
    { name: 'Bread', section: 'Bread & Wraps' },
    { name: 'Olive oil', section: 'Oils & Vinegar' },
    { name: 'Coffee', section: 'Beverages' },
  ],
  Ruthie: [
    { name: 'Milk', section: 'Dairy' },
    { name: 'Bread', section: 'Bread & Wraps' },
  ],
  Avital: [
    { name: 'Milk', section: 'Dairy' },
    { name: 'Bread', section: 'Bread & Wraps' },
  ],
};

// ========== WHO AM I ==========
window.setWho = async function (name) {
  currentUser = name;
  localStorage.setItem('grocery_who', name);
  document.querySelectorAll('.who-btn').forEach((b) => b.classList.remove('selected'));
  document.getElementById(`who-${name}`).classList.add('selected');
  switchTab(name.toLowerCase());
  await loadStaples();
  renderStaples();
};

function initWho() {
  if (currentUser) {
    const btn = document.getElementById(`who-${currentUser}`);
    if (btn) btn.classList.add('selected');
    switchTab(currentUser.toLowerCase());
  }
}

// ========== INIT ==========
async function init() {
  initWho();
  await loadCatalog();
  await loadItems();
  await loadStaples();
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

async function loadStaples() {
  if (!currentUser) {
    staples = [];
    return;
  }
  const { data } = await db
    .from('grocery_staples')
    .select('*')
    .eq('owner', currentUser)
    .order('name');
  if (data && data.length) {
    staples = data;
  } else {
    // Pre-populate with defaults on first load for this user
    const defaults = (DEFAULT_STAPLES[currentUser] || []).map((s) => ({
      ...s,
      owner: currentUser,
    }));
    if (defaults.length) {
      const { data: inserted } = await db.from('grocery_staples').insert(defaults).select();
      staples = inserted || [];
    } else {
      staples = [];
    }
  }
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
  const allLists = [
    'apt',
    'allison',
    'ruthie',
    'avital',
    'allison_ruthie',
    'allison_avital',
    'ruthie_avital',
    'allison_nutritionist',
  ];
  allLists.forEach((k) => renderList(k));
  renderMirror('ruthie_allison', 'allison_ruthie');
  renderMirror('avital_allison', 'allison_avital');
  renderMirror('avital_ruthie', 'ruthie_avital');
  renderStaples();
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
  buildGroupedList(ul, list, key);
  empty.style.display = list.length ? 'none' : 'block';
  count.textContent = list.length;
  // Auto-collapse section-card when empty
  const body = document.getElementById(`${key}-body`);
  const chev = document.getElementById(`${key}-chev`);
  if (body && list.length === 0) {
    body.classList.add('collapsed');
    if (chev) chev.classList.remove('open');
  }
  if (body && list.length > 0) {
    body.classList.remove('collapsed');
    if (chev) chev.classList.add('open');
  }
}

function renderMirror(mirrorKey, canonKey) {
  const ul = document.getElementById(`${mirrorKey}-items`);
  const empty = document.getElementById(`${mirrorKey}-empty`);
  const count = document.getElementById(`${mirrorKey}-count`);
  if (!ul) return;
  const list = sortItems(items[canonKey] || []);
  ul.innerHTML = '';
  buildGroupedList(ul, list, mirrorKey);
  empty.style.display = list.length ? 'none' : 'block';
  count.textContent = list.length;
  const body = document.getElementById(`${mirrorKey}-body`);
  const chev = document.getElementById(`${mirrorKey}-chev`);
  if (body && list.length === 0) {
    body.classList.add('collapsed');
    if (chev) chev.classList.remove('open');
  }
  if (body && list.length > 0) {
    body.classList.remove('collapsed');
    if (chev) chev.classList.add('open');
  }
}

function buildGroupedList(ul, sortedList, displayKey) {
  let lastSection = null;
  sortedList.forEach((item) => {
    if (item.section !== lastSection) {
      const gh = document.createElement('li');
      gh.className = 'group-header';
      gh.textContent = item.section;
      ul.appendChild(gh);
      lastSection = item.section;
    }
    ul.appendChild(makeRow(item, displayKey));
  });
}

function makeRow(item, displayKey) {
  const li = document.createElement('li');
  li.className = 'item-row';

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

// ========== ADD ==========
let _addingItem = false;
window.addItem = async function (key) {
  if (_addingItem) return;
  _addingItem = true;
  const canonKey = canonical(key);
  const input = document.getElementById(`${key}-input`);
  const sec = document.getElementById(`${key}-sec`);
  const qtyEl = document.getElementById(`${key}-qty`);
  const name = input.value.trim();
  const section = sec.value;
  const quantity = parseInt(qtyEl?.value) || 1;
  if (!name) {
    _addingItem = false;
    return;
  }
  if (!section) {
    sec.value = 'Other';
  }
  const finalSection = sec.value || 'Other';
  document.getElementById(`${key}-ac`).style.display = 'none';

  const lower = name.toLowerCase();
  if (!catalog[lower]) {
    const { data: catRow, error: catErr } = await db
      .from('grocery_catalog')
      .insert({ name: lower, section: finalSection })
      .select()
      .single();
    if (catErr) console.error('catalog insert error:', catErr);
    if (catRow) catalog[lower] = { section: finalSection, id: catRow.id };
  }

  const { data: newItem, error: addErr } = await db
    .from('grocery_items')
    .insert({
      list_type: canonKey,
      item_name: name,
      section: finalSection,
      checked: false,
      added_by: currentUser || '',
      quantity,
    })
    .select()
    .single();

  if (addErr) {
    setStatus(`Error adding "${name}": ${addErr.message}`);
    console.error('add item error:', addErr);
  } else if (newItem) {
    if (!items[canonKey]) items[canonKey] = [];
    items[canonKey].push(newItem);
    pushHistory({ type: 'add', item: newItem, canonKey });
    input.value = '';
    sec.value = '';
    if (qtyEl) qtyEl.value = 1;
    setStatus(`Added "${name}" x${quantity}`);
  }
  renderAll();
  _addingItem = false;
};

// ========== CHECK ==========
async function toggleCheck(item, displayKey) {
  const newVal = !item.checked;
  const { error } = await db.from('grocery_items').update({ checked: newVal }).eq('id', item.id);
  if (error) {
    setStatus(`Error: ${error.message}`);
    console.error('check error:', error);
  }
  const canonKey = canonical(displayKey);
  const stored = (items[canonKey] || []).find((i) => i.id === item.id);
  if (stored) {
    pushHistory({ type: newVal ? 'check' : 'uncheck', item: { ...stored }, canonKey });
    stored.checked = newVal;
  }
  renderAll();
}

// ========== DELETE ==========
async function deleteItem(item, displayKey) {
  const canonKey = canonical(displayKey);
  const { error } = await db.from('grocery_items').delete().eq('id', item.id);
  if (error) {
    setStatus(`Error: ${error.message}`);
    console.error('delete error:', error);
  }
  items[canonKey] = (items[canonKey] || []).filter((i) => i.id !== item.id);
  pushHistory({ type: 'delete', item, canonKey });
  renderAll();
  setStatus(`Removed "${item.item_name}"`);
}

// ========== CLEAR CHECKED ==========
window.clearChecked = async function (key) {
  const canonKey = canonical(key);
  const checked = (items[canonKey] || []).filter((i) => i.checked);
  if (!checked.length) return;
  await db
    .from('grocery_items')
    .delete()
    .in(
      'id',
      checked.map((i) => i.id),
    );
  items[canonKey] = (items[canonKey] || []).filter((i) => !i.checked);
  checked.forEach((item) => pushHistory({ type: 'delete', item, canonKey }));
  renderAll();
  setStatus(`Cleared ${checked.length} item(s)`);
};

// ========== EDIT ==========
let _editItem = null;
let _editDisplayKey = null;

window.openEditModal = function (item, displayKey) {
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

  const oldCanon = canonical(_editDisplayKey);
  const newCanon = canonical(newList);

  await db
    .from('grocery_items')
    .update({
      item_name: newName,
      section: newSection,
      list_type: newCanon,
      quantity: newQty,
    })
    .eq('id', _editItem.id);

  items[oldCanon] = (items[oldCanon] || []).filter((i) => i.id !== _editItem.id);
  const updatedItem = {
    ..._editItem,
    item_name: newName,
    section: newSection,
    list_type: newCanon,
    quantity: newQty,
  };
  if (!items[newCanon]) items[newCanon] = [];
  items[newCanon].push(updatedItem);

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

// ========== UNDO / REDO ==========
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
        added_by: item.added_by,
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
        added_by: item.added_by,
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

// ========== TABS ==========
window.switchTab = function (person) {
  ['allison', 'ruthie', 'avital'].forEach((p) => {
    document.getElementById(`content-${p}`).classList.toggle('active', p === person);
    const btn = document.getElementById(`tab-${p}`);
    btn.className = 'tab-btn';
    if (p === person) btn.classList.add(`active-${p}`);
  });
};

window.toggleSection = function (bodyId, chevId) {
  document.getElementById(bodyId).classList.toggle('collapsed');
  document.getElementById(chevId).classList.toggle('open');
};

function setStatus(msg) {
  const bar = document.getElementById('status-bar');
  bar.textContent = msg;
  setTimeout(() => (bar.textContent = ''), 3000);
}

// ========== SHOPPING MODE ==========
const LIST_LABEL = {
  apt: '🏠 Apt',
  allison: '👤 Allison',
  ruthie: '👤 Ruthie',
  avital: '👤 Avital',
  allison_ruthie: '👥 Allison+Ruthie',
  allison_avital: '👥 Allison+Avital',
  ruthie_avital: '👥 Ruthie+Avital',
};

const PERSON_LISTS = {
  Allison: ['apt', 'allison', 'allison_ruthie', 'allison_avital'],
  Ruthie: ['apt', 'ruthie', 'allison_ruthie', 'ruthie_avital'],
  Avital: ['apt', 'avital', 'allison_avital', 'ruthie_avital'],
};

window.enterShoppingMode = function () {
  if (!currentUser) {
    alert('Pick who you are first (top of page)');
    return;
  }
  renderShoppingList();
  document.getElementById('shopping-overlay').classList.add('active');
  document.getElementById('shop-title').textContent = `🛍 ${currentUser}'s Shopping List`;
};

window.exitShoppingMode = function () {
  document.getElementById('shopping-overlay').classList.remove('active');
  renderAll(); // refresh main view
};

function getShoppingItems() {
  const lists = PERSON_LISTS[currentUser] || [];
  const all = [];
  lists.forEach((listKey) => {
    (items[listKey] || []).forEach((item) => {
      all.push({ ...item, _listKey: listKey });
    });
  });
  // Sort: unchecked first, then by section order, then name. Checked items sink to bottom.
  return all.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    const si = SECTIONS.indexOf(a.section);
    const sj = SECTIONS.indexOf(b.section);
    if (si !== sj) return si - sj;
    return a.item_name.localeCompare(b.item_name);
  });
}

function updateShopCounter() {
  const lists = PERSON_LISTS[currentUser] || [];
  let total = 0,
    done = 0;
  lists.forEach((k) => {
    (items[k] || []).forEach((i) => {
      total++;
      if (i.checked) done++;
    });
  });
  const left = total - done;
  const el = document.getElementById('shop-items-left');
  if (el) el.textContent = left === 0 && total > 0 ? 'All done! ✓' : `${left} of ${total} left`;
}

function renderShoppingList() {
  const container = document.getElementById('shop-list-content');
  container.innerHTML = '';
  const allItems = getShoppingItems();
  updateShopCounter();

  if (!allItems.length) {
    container.innerHTML = '<div class="shop-empty">Nothing on any of your lists!</div>';
    return;
  }

  const unchecked = allItems.filter((i) => !i.checked);
  const checked = allItems.filter((i) => i.checked);

  function makeShopRow(item) {
    const row = document.createElement('div');
    row.className = 'shop-item-row';
    row.id = `shop-row-${item.id}`;
    const chk = document.createElement('div');
    chk.className = 'item-check' + (item.checked ? ' checked' : '');
    chk.onclick = () => shopToggleCheck(item);
    const info = document.createElement('div');
    info.className = 'shop-item-info';
    const name = document.createElement('div');
    name.className = 'shop-item-name' + (item.checked ? ' checked' : '');
    name.textContent = item.item_name;
    info.append(name);
    if (item.quantity && item.quantity > 1) {
      const qtyTag = document.createElement('span');
      qtyTag.className = 'item-qty';
      qtyTag.textContent = `x${item.quantity}`;
      row.appendChild(qtyTag);
    }
    const tag = document.createElement('span');
    tag.className = 'shop-list-tag';
    tag.textContent = LIST_LABEL[item._listKey] || item._listKey;
    row.append(chk, info, tag);
    return row;
  }

  // Render unchecked grouped by section
  let currentSection = null;
  let currentBlock = null;
  unchecked.forEach((item) => {
    if (item.section !== currentSection) {
      currentSection = item.section;
      currentBlock = document.createElement('div');
      currentBlock.className = 'shop-section-block';
      const title = document.createElement('div');
      title.className = 'shop-section-title';
      title.textContent = item.section;
      currentBlock.appendChild(title);
      container.appendChild(currentBlock);
    }
    currentBlock.appendChild(makeShopRow(item));
  });

  // Render checked items in a single "Done" block
  if (checked.length) {
    const doneBlock = document.createElement('div');
    doneBlock.className = 'shop-section-block';
    doneBlock.style.opacity = '0.6';
    const doneTitle = document.createElement('div');
    doneTitle.className = 'shop-section-title';
    doneTitle.style.background = '#d0e8d0';
    doneTitle.style.color = '#5a8a5a';
    doneTitle.textContent = '✓ Done';
    doneBlock.appendChild(doneTitle);
    checked.forEach((item) => doneBlock.appendChild(makeShopRow(item)));
    container.appendChild(doneBlock);
  }
}

async function shopToggleCheck(item) {
  const newVal = !item.checked;
  await db.from('grocery_items').update({ checked: newVal }).eq('id', item.id);
  const stored = (items[item._listKey] || []).find((i) => i.id === item.id);
  if (stored) stored.checked = newVal;
  item.checked = newVal;
  // Re-render so checked items sink to bottom
  renderShoppingList();
}

// ========== STAPLES ==========
const PERSON_LIST_LABELS = {
  Allison: {
    apt: '🏠 Apt',
    allison: '👤 My list',
    allison_ruthie: '👥 Allison+Ruthie',
    allison_avital: '👥 Allison+Avital',
  },
  Ruthie: {
    apt: '🏠 Apt',
    ruthie: '👤 My list',
    allison_ruthie: '👥 Ruthie+Allison',
    ruthie_avital: '👥 Ruthie+Avital',
  },
  Avital: {
    apt: '🏠 Apt',
    avital: '👤 My list',
    allison_avital: '👥 Avital+Allison',
    ruthie_avital: '👥 Avital+Ruthie',
  },
};

function renderStaples() {
  const noUser = document.getElementById('staples-no-user');
  const content = document.getElementById('staples-user-content');
  const container = document.getElementById('staples-list');
  const countEl = document.getElementById('staples-count');
  if (!container) return;

  if (!currentUser) {
    if (noUser) noUser.style.display = 'block';
    if (content) content.style.display = 'none';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (noUser) noUser.style.display = 'none';
  if (content) content.style.display = 'block';

  // Populate target list dropdown
  const sel = document.getElementById('staples-target-list');
  if (sel) {
    sel.innerHTML = '';
    const labels = PERSON_LIST_LABELS[currentUser] || {};
    Object.entries(labels).forEach(([key, label]) => {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = label;
      sel.appendChild(o);
    });
  }

  container.innerHTML = '';
  staples.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'staple-row';
    row.title = 'Click to add to selected list';
    row.style.cursor = 'pointer';
    row.onclick = (e) => {
      if (!e.target.classList.contains('staple-delete')) addOneStaple(s);
    };
    const name = document.createElement('span');
    name.className = 'staple-name';
    name.textContent = s.name;
    const del = document.createElement('button');
    del.className = 'staple-delete';
    del.textContent = '✕';
    del.onclick = (e) => {
      e.stopPropagation();
      deleteStaple(s);
    };
    row.append(name, del);
    container.appendChild(row);
  });
  if (countEl) countEl.textContent = staples.length;
}

window.addStaple = async function () {
  if (!currentUser) {
    alert('Pick who you are first (top of page)');
    return;
  }
  const input = document.getElementById('staples-input');
  const name = input.value.trim();
  if (!name) return;
  const lower = name.toLowerCase();
  const section = catalog[lower]?.section || 'Other';
  const { data } = await db
    .from('grocery_staples')
    .insert({ name, section, owner: currentUser })
    .select()
    .single();
  if (data) {
    staples.push(data);
    renderStaples();
    input.value = '';
  }
};

async function deleteStaple(s) {
  await db.from('grocery_staples').delete().eq('id', s.id);
  staples = staples.filter((x) => x.id !== s.id);
  renderStaples();
}

async function addOneStaple(s) {
  const sel = document.getElementById('staples-target-list');
  const targetList = sel ? sel.value : currentUser.toLowerCase();
  const canonTarget = canonical(targetList);
  const existing = (items[canonTarget] || []).map((i) => i.item_name.toLowerCase());
  if (existing.includes(s.name.toLowerCase())) {
    setStatus(`"${s.name}" already on that list`);
    return;
  }
  const { data: newItem } = await db
    .from('grocery_items')
    .insert({
      list_type: canonTarget,
      item_name: s.name,
      section: s.section,
      checked: false,
      added_by: currentUser,
      quantity: 1,
    })
    .select()
    .single();
  if (newItem) {
    if (!items[canonTarget]) items[canonTarget] = [];
    items[canonTarget].push(newItem);
    renderAll();
    const label = PERSON_LIST_LABELS[currentUser]?.[targetList] || targetList;
    setStatus(`Added "${s.name}" to ${label}`);
  }
}

window.addAllStaplesToList = async function () {
  if (!currentUser) {
    alert('Pick who you are first (top of page)');
    return;
  }
  const sel = document.getElementById('staples-target-list');
  const targetList = sel ? sel.value : currentUser.toLowerCase();
  const canonTarget = canonical(targetList);
  const existing = (items[canonTarget] || []).map((i) => i.item_name.toLowerCase());
  const toAdd = staples.filter((s) => !existing.includes(s.name.toLowerCase()));
  if (!toAdd.length) {
    setStatus('All staples already on that list!');
    return;
  }
  for (const s of toAdd) {
    const { data: newItem } = await db
      .from('grocery_items')
      .insert({
        list_type: canonTarget,
        item_name: s.name,
        section: s.section,
        checked: false,
        added_by: currentUser,
        quantity: 1,
      })
      .select()
      .single();
    if (newItem) {
      if (!items[canonTarget]) items[canonTarget] = [];
      items[canonTarget].push(newItem);
    }
  }
  renderAll();
  const label = PERSON_LIST_LABELS[currentUser]?.[targetList] || targetList;
  setStatus(`Added ${toAdd.length} staple(s) to ${label}`);
};

// ========== NUTRITIONIST ==========
window.addNutriToShopping = async function () {
  const nutriItems = items['allison_nutritionist'] || [];
  const notChecked = nutriItems.filter((i) => !i.checked);
  if (!notChecked.length) {
    setStatus('No nutritionist items to add!');
    return;
  }
  const existing = (items['allison'] || []).map((i) => i.item_name.toLowerCase());
  const toAdd = notChecked.filter((s) => !existing.includes(s.item_name.toLowerCase()));
  if (!toAdd.length) {
    setStatus('All items already on your list!');
    return;
  }
  for (const s of toAdd) {
    const { data: newItem } = await db
      .from('grocery_items')
      .insert({
        list_type: 'allison',
        item_name: s.item_name,
        section: s.section,
        checked: false,
        added_by: 'Allison',
        quantity: s.quantity || 1,
      })
      .select()
      .single();
    if (newItem) {
      if (!items['allison']) items['allison'] = [];
      items['allison'].push(newItem);
    }
  }
  renderAll();
  setStatus(`Added ${toAdd.length} nutritionist item(s) to your shopping list`);
};

window.setPaidBy = async function (item, listKey, value, btnEl) {
  item.paid_by = value;
  btnEl
    .closest('.paid-by-pills')
    .querySelectorAll('.paid-by-pill')
    .forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
  await db.from('grocery_items').update({ paid_by: value }).eq('id', item.id);
};

window.shopClearChecked = async function () {
  const lists = PERSON_LISTS[currentUser] || [];
  const allChecked = [];
  for (const listKey of lists) {
    (items[listKey] || [])
      .filter((i) => i.checked)
      .forEach((i) => {
        allChecked.push({
          item_name: i.item_name,
          section: i.section,
          list_type: i.list_type,
          quantity: i.quantity || 1,
          paid_by: i.paid_by || 'joint',
        });
      });
  }
  if (!allChecked.length) return;

  // Save trip to Supabase
  await db.from('grocery_trips').insert({
    trip_date: new Date().toISOString().split('T')[0],
    shopper: currentUser || 'Unknown',
    items: allChecked,
  });

  // Now delete
  for (const listKey of lists) {
    const checked = (items[listKey] || []).filter((i) => i.checked);
    if (!checked.length) continue;
    await db
      .from('grocery_items')
      .delete()
      .in(
        'id',
        checked.map((i) => i.id),
      );
    items[listKey] = (items[listKey] || []).filter((i) => !i.checked);
  }
  renderShoppingList();
  setStatus(`Trip saved! Cleared ${allChecked.length} item(s)`);
};

// ========== TRIP HISTORY ==========
const _tripData = {}; // keyed by trip.id

const LIST_BADGE_COLOR = {
  apt: '#4a90d9',
  allison: '#52b788',
  ruthie: '#9b59b6',
  avital: '#e67e22',
  allison_ruthie: '#1abc9c',
  allison_avital: '#e74c3c',
  ruthie_avital: '#f39c12',
};

window.openTrips = async function () {
  document.getElementById('trips-overlay').classList.add('active');
  const body = document.getElementById('trips-body');
  body.innerHTML = '<div class="trips-empty">Loading...</div>';

  const { data: trips, error } = await db
    .from('grocery_trips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !trips || !trips.length) {
    body.innerHTML =
      '<div class="trips-empty">No trips logged yet. Clear checked items after shopping to save a trip.</div>';
    return;
  }

  body.innerHTML = '';
  trips.forEach((trip, idx) => {
    const date = new Date(trip.created_at || trip.trip_date);
    const dateStr = date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const tripItems = Array.isArray(trip.items) ? trip.items : [];
    const whoShopped = trip.shopper || 'Unknown';
    _tripData[trip.id] = { items: tripItems, trip };

    const card = document.createElement('div');
    card.className = 'trip-card';
    card.id = `trip-card-${trip.id}`;

    // Header
    const header = document.createElement('div');
    header.className = 'trip-card-header';

    const titleArea = document.createElement('div');
    titleArea.style.cssText = 'flex:1;cursor:pointer;min-width:0';
    titleArea.onclick = () => tripBody.classList.toggle('open');

    const nameEl = document.createElement('div');
    nameEl.className = 'trip-date-label';
    nameEl.innerHTML = `🛒 ${trip.trip_name ? `<strong>${trip.trip_name}</strong> · ` : ''}${dateStr} · ${timeStr}
        <button onclick="event.stopPropagation();editTripName('${trip.id}','${(trip.trip_name || '').replace(/'/g, '')}')" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:0.75rem;padding:0 2px">✏</button>`;
    const metaEl = document.createElement('div');
    metaEl.className = 'trip-meta';
    metaEl.textContent = `Shopped by: ${whoShopped} · ${tripItems.length} item(s)`;
    titleArea.append(nameEl, metaEl);

    const receiptBtn = document.createElement('button');
    receiptBtn.className = 'receipt-upload-btn';
    receiptBtn.textContent = '📄 Receipt';
    receiptBtn.onclick = (e) => {
      e.stopPropagation();
      openReceiptUpload(trip.id);
    };

    const manualBtn = document.createElement('button');
    manualBtn.className = 'receipt-upload-btn';
    manualBtn.style.cssText = 'border-color:#aaa;color:#aaa';
    manualBtn.textContent = '✏ Manual';
    manualBtn.onclick = (e) => {
      e.stopPropagation();
      openManualReceipt(trip.id);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'trip-delete-btn';
    delBtn.textContent = '🗑';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteTrip(trip.id, card);
    };

    header.append(titleArea, receiptBtn, manualBtn, delBtn);

    const tripBody = document.createElement('div');
    tripBody.className = 'trip-items-body';
    tripBody.id = `trip-body-${idx}`;

    // Group by section, each item has checkbox + list badge + price
    const bySection = {};
    tripItems.forEach((i, iIdx) => {
      const sec = i.section || 'Other';
      if (!bySection[sec]) bySection[sec] = [];
      bySection[sec].push({ ...i, _iIdx: iIdx });
    });
    SECTIONS.concat(['Other']).forEach((sec) => {
      if (!bySection[sec]) return;
      const label = document.createElement('div');
      label.className = 'trip-section-label';
      label.textContent = sec;
      tripBody.appendChild(label);
      bySection[sec].forEach((i) => {
        const line = document.createElement('div');
        line.className = 'trip-item-line';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.className = 'trip-item-cb';
        cb.id = `trip-cb-${idx}-${i._iIdx}`;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'trip-item-name';
        nameSpan.style.flex = '1';
        nameSpan.textContent = i.quantity > 1 ? `${i.item_name} ×${i.quantity}` : i.item_name;
        // List badge
        const listKey = canonical(i.list_type || 'apt');
        const badge = document.createElement('span');
        badge.style.cssText = `font-size:0.65rem;padding:1px 6px;border-radius:8px;background:${LIST_BADGE_COLOR[listKey] || '#aaa'}22;color:${LIST_BADGE_COLOR[listKey] || '#aaa'};font-weight:600;flex-shrink:0`;
        badge.textContent = LIST_LABEL[listKey] || listKey;
        // Price
        const priceSpan = document.createElement('span');
        priceSpan.style.cssText =
          'font-size:0.8rem;color:#2d6a4f;font-weight:600;min-width:42px;text-align:right;flex-shrink:0';
        priceSpan.textContent = i.price ? `₪${parseFloat(i.price).toFixed(2)}` : '';
        line.append(cb, nameSpan, badge, priceSpan);
        tripBody.appendChild(line);
      });
    });

    // Breakdown by list
    const breakdown = {};
    tripItems.forEach((i) => {
      const key = canonical(i.list_type || 'apt');
      if (!breakdown[key]) breakdown[key] = { count: 0, total: 0 };
      breakdown[key].count++;
      if (i.price) breakdown[key].total += parseFloat(i.price);
    });
    if (Object.keys(breakdown).length > 1 || tripItems.some((i) => i.price)) {
      const bd = document.createElement('div');
      bd.className = 'trip-breakdown';
      Object.entries(breakdown).forEach(([listKey, { count, total }]) => {
        const row = document.createElement('div');
        row.className = 'trip-breakdown-row';
        const label = LIST_LABEL[listKey] || listKey;
        const priceStr = total > 0 ? ` · ₪${total.toFixed(2)}` : '';
        row.innerHTML = `<span>${label}</span><strong>${count} item${count > 1 ? 's' : ''}${priceStr}</strong>`;
        bd.appendChild(row);
      });
      tripBody.appendChild(bd);
    }

    // Footer: list picker + add button
    const footer = document.createElement('div');
    footer.className = 'trip-add-footer';
    const picker = document.createElement('select');
    picker.className = 'trip-list-picker';
    picker.id = `trip-picker-${idx}`;
    Object.entries(LIST_LABEL).forEach(([key, label]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      if (key === (currentUser ? currentUser.toLowerCase() : 'apt')) opt.selected = true;
      picker.appendChild(opt);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'trip-add-btn';
    addBtn.textContent = '+ Add selected';
    addBtn.onclick = () => addTripItems(idx, tripItems.length);
    footer.append(picker, addBtn);
    tripBody.appendChild(footer);

    card.append(header, tripBody);
    body.appendChild(card);
  });
};

window.addTripItems = async function (idx, totalCount) {
  const tripItems = _tripData[idx] || [];
  const picker = document.getElementById(`trip-picker-${idx}`);
  const targetList = canonical(picker ? picker.value : 'apt');

  const toAdd = tripItems.filter((_, iIdx) => {
    const cb = document.getElementById(`trip-cb-${idx}-${iIdx}`);
    return cb && cb.checked;
  });

  if (!toAdd.length) {
    setStatus('No items selected');
    return;
  }

  const existing = (items[targetList] || []).map((i) => i.item_name.toLowerCase());
  let added = 0;
  for (const i of toAdd) {
    if (existing.includes(i.item_name.toLowerCase())) continue;
    const { data: newItem } = await db
      .from('grocery_items')
      .insert({
        list_type: targetList,
        item_name: i.item_name,
        section: i.section,
        checked: false,
        added_by: currentUser || 'Unknown',
        quantity: i.quantity || 1,
      })
      .select()
      .single();
    if (newItem) {
      if (!items[targetList]) items[targetList] = [];
      items[targetList].push(newItem);
      added++;
    }
  }
  renderAll();
  setStatus(`Added ${added} item(s) to ${LIST_LABEL[targetList] || targetList}`);
};

window.deleteTrip = async function (tripId, cardEl) {
  cardEl.style.opacity = '0.4';
  const { error } = await db.from('grocery_trips').delete().eq('id', tripId);
  if (error) {
    cardEl.style.opacity = '1';
    setStatus('Delete failed');
    return;
  }
  cardEl.remove();
};

// ========== RECEIPT ==========
let _receiptTripId = null;
let _receiptTripItems = [];
let _receiptMatches = [];

window.editTripName = async function (tripId, currentName) {
  const name = prompt('Trip name:', currentName || '');
  if (name === null) return;
  await db.from('grocery_trips').update({ trip_name: name }).eq('id', tripId);
  openTrips();
};

window.openReceiptUpload = function (tripId) {
  const stored = _tripData[tripId];
  if (!stored) {
    setStatus('Trip data not found');
    return;
  }
  _receiptTripId = tripId;
  _receiptTripItems = stored.items;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('Reading receipt... ⏳');
    try {
      const pages = await fileToBase64Pages(file);
      const allMatched = [],
        allUnmatched = [];
      let pagesOk = 0;
      for (let pi = 0; pi < pages.length; pi++) {
        const { data, mimeType } = pages[pi];
        setStatus(`Reading receipt... ⏳ (page ${pi + 1}/${pages.length})`);
        try {
          const res = await fetch(
            'https://hpiyvnfhoqnnnotrmwaz.supabase.co/functions/v1/parse-receipt',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
              body: JSON.stringify({ imageData: data, mimeType, tripItems: _receiptTripItems }),
            },
          );
          const result = await res.json();
          if (result.error) {
            console.warn(`Receipt page ${pi + 1} error:`, result.error);
            continue;
          }
          if (result.matched) allMatched.push(...result.matched);
          if (result.unmatched) allUnmatched.push(...result.unmatched);
          pagesOk++;
        } catch (pageErr) {
          console.warn(`Receipt page ${pi + 1} failed:`, pageErr);
        }
      }
      if (pagesOk > 0 && (allMatched.length || allUnmatched.length)) {
        const partial = pagesOk < pages.length ? ` (${pagesOk}/${pages.length} pages read)` : '';
        showReceiptReviewAI({ matched: allMatched, unmatched: allUnmatched });
        setStatus(partial ? `⚠ Some pages could not be read${partial}` : '');
      } else {
        setStatus('Could not read receipt — opening manual entry');
        openManualReceipt(tripId);
      }
    } catch (err) {
      console.error(err);
      setStatus('Could not read receipt — opening manual entry');
      openManualReceipt(tripId);
    }
  };
  input.click();
};

async function fileToBase64Pages(file) {
  const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  if (isPDF) {
    if (!window.pdfjsLib) throw new Error('PDF.js not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pages.push({
        data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1],
        mimeType: 'image/jpeg',
      });
    }
    return pages;
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve([{ data: reader.result.split(',')[1], mimeType: file.type }]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

function showReceiptReviewAI({ matched, unmatched }) {
  let html = '';
  if (matched.length) {
    html += `<div class="receipt-section-title">✅ Matched (${matched.length})</div>`;
    matched.forEach((m, i) => {
      html += `<div class="receipt-match-row">
          <span class="receipt-match-name">${m.list_item}</span>
          <span style="font-size:0.72rem;color:#aaa;flex:1;padding:0 4px;overflow:hidden;white-space:nowrap">${m.receipt_name}</span>
          <input class="manual-price-input" id="rp-${i}" type="number" value="${m.price || ''}" min="0" step="0.01" />
        </div>`;
    });
  }
  if (unmatched.length) {
    html += `<div class="receipt-section-title receipt-unmatched">🧾 On receipt, not on your list (${unmatched.length})</div>`;
    unmatched.forEach((u) => {
      html += `<div class="receipt-match-row">
          <span class="receipt-match-name">${u.receipt_name}</span>
          <span class="receipt-match-price">₪${parseFloat(u.price || 0).toFixed(2)}</span>
        </div>`;
    });
  }
  const matchedNames = new Set(matched.map((m) => m.list_item));
  const notOnReceipt = _receiptTripItems.filter((t) => !matchedNames.has(t.item_name));
  if (notOnReceipt.length) {
    html += `<div class="receipt-section-title" style="color:#e67e22">❓ On list, not found on receipt (${notOnReceipt.length})</div>`;
    notOnReceipt.forEach((t, i) => {
      html += `<div class="receipt-match-row">
          <span class="receipt-match-name">${t.item_name}</span>
          <input class="manual-price-input" id="rp-extra-${i}" type="number" min="0" step="0.01" placeholder="₪" value="${t.price || ''}" />
        </div>`;
    });
  }
  _receiptMatches = matched;
  _receiptMatches._unmatchedTrip = notOnReceipt;
  document.getElementById('receipt-modal-body').innerHTML = html;
  document.getElementById('receipt-modal-bg').classList.add('active');
  setStatus('');
}

window.openManualReceipt = function (tripId) {
  const stored = _tripData[tripId];
  if (!stored) {
    setStatus('Trip data not found');
    return;
  }
  _receiptTripId = tripId;
  _receiptTripItems = stored.items;
  const body = document.getElementById('receipt-modal-body');
  body.innerHTML =
    `<div class="receipt-section-title">Enter prices manually</div>` +
    _receiptTripItems
      .map(
        (item, i) => `
        <div class="receipt-match-row">
          <span class="receipt-match-name">${item.item_name}</span>
          <input class="manual-price-input" id="manual-price-${i}" type="number" min="0" step="0.01" placeholder="₪" value="${item.price || ''}" />
        </div>`,
      )
      .join('');
  _receiptMatches = _receiptTripItems.map((item, i) => ({
    tripItem: item,
    tripIdx: i,
    manual: true,
  }));
  document.getElementById('receipt-modal-bg').classList.add('active');
};

async function parsePairzonPDF(file) {
  if (!window.pdfjsLib) throw new Error('PDF.js not loaded');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // Group by row (y position within 4pt)
    const rows = [];
    tc.items
      .filter((i) => i.str.trim())
      .forEach((item) => {
        const y = item.transform[5];
        const row = rows.find((r) => Math.abs(r.y - y) < 4);
        if (row) row.items.push({ str: item.str, x: item.transform[4] });
        else rows.push({ y, items: [{ str: item.str, x: item.transform[4] }] });
      });
    rows.sort((a, b) => b.y - a.y);
    rows.forEach((row) => {
      row.items.sort((a, b) => a.x - b.x);
      const full = row.items.map((i) => i.str).join(' ');
      const hasHebrew = /[\u05D0-\u05EA]{2,}/.test(full);
      const prices = full.match(/\b\d{1,3}\.\d{2}\b/g);
      if (!hasHebrew || !prices) return;
      const price = parseFloat(prices[prices.length - 1]);
      if (price <= 0 || price >= 500) return;
      const name = full
        .replace(/\d{7,}/g, '')
        .replace(/\b\d{1,3}\.\d{2}\b/g, '')
        .replace(/\b\d+\b/g, '')
        .replace(/["']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (name.length > 1) allItems.push({ name, price });
    });
  }
  // Deduplicate
  const seen = new Set();
  return allItems.filter((i) => {
    const k = `${i.price}|${i.name}`;
    return seen.has(k) ? false : seen.add(k);
  });
}

function hebrewMatch(a, b) {
  if (!a || !b) return 0;
  const words = (s) =>
    s
      .replace(/[^\u05D0-\u05FAa-zA-Z ]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2);
  const wa = words(a),
    wb = words(b);
  if (!wa.length || !wb.length) return 0;
  let hits = 0;
  wa.forEach((w) => {
    if (wb.some((x) => x.includes(w) || w.includes(x))) hits++;
  });
  return hits / Math.max(wa.length, wb.length);
}

function showReceiptReview(receiptItems) {
  const matched = [],
    unmatchedReceipt = [];
  const usedTrip = new Set();
  receiptItems.forEach((ri) => {
    let best = 0,
      bestIdx = -1;
    _receiptTripItems.forEach((ti, idx) => {
      if (usedTrip.has(idx)) return;
      const s = hebrewMatch(ri.name, ti.item_name);
      if (s > best) {
        best = s;
        bestIdx = idx;
      }
    });
    if (best > 0.25 && bestIdx >= 0) {
      matched.push({ receiptItem: ri, tripItem: _receiptTripItems[bestIdx], tripIdx: bestIdx });
      usedTrip.add(bestIdx);
    } else {
      unmatchedReceipt.push(ri);
    }
  });
  const unmatchedTrip = _receiptTripItems.filter((_, i) => !usedTrip.has(i));
  _receiptMatches = matched;

  let html = '';
  if (matched.length) {
    html += `<div class="receipt-section-title">✅ Matched (${matched.length})</div>`;
    matched.forEach((m, i) => {
      html += `<div class="receipt-match-row">
          <span class="receipt-match-name">${m.tripItem.item_name}</span>
          <input class="manual-price-input" id="rp-${i}" type="number" value="${m.receiptItem.price.toFixed(2)}" min="0" step="0.01" />
        </div>`;
    });
  }
  if (unmatchedReceipt.length) {
    html += `<div class="receipt-section-title receipt-unmatched">🧾 On receipt, not on list (${unmatchedReceipt.length})</div>`;
    unmatchedReceipt.forEach((ri) => {
      html += `<div class="receipt-match-row"><span class="receipt-match-name">${ri.name}</span><span class="receipt-match-price">₪${ri.price.toFixed(2)}</span></div>`;
    });
  }
  if (unmatchedTrip.length) {
    html += `<div class="receipt-section-title" style="color:#e67e22">❓ On list, no price found (${unmatchedTrip.length})</div>`;
    unmatchedTrip.forEach((ti, i) => {
      html += `<div class="receipt-match-row">
          <span class="receipt-match-name">${ti.item_name}</span>
          <input class="manual-price-input" id="rp-extra-${i}" type="number" min="0" step="0.01" placeholder="₪" />
        </div>`;
    });
    _receiptMatches._unmatchedTrip = unmatchedTrip;
  }
  const total = matched.reduce((s, m) => s + m.receiptItem.price, 0);
  html += `<div class="receipt-total-line" style="margin-top:10px">Receipt total matched: ₪${total.toFixed(2)}</div>`;
  document.getElementById('receipt-modal-body').innerHTML = html;
  document.getElementById('receipt-modal-bg').classList.add('active');
}

window.saveReceiptPrices = async function () {
  const updatedItems = [..._receiptTripItems].map((i) => ({ ...i }));

  // Manual mode: manual-price-0, manual-price-1, ...
  const manualInputs = document.querySelectorAll('[id^="manual-price-"]');
  if (manualInputs.length) {
    manualInputs.forEach((input, i) => {
      const price = parseFloat(input.value) || null;
      if (updatedItems[i]) updatedItems[i].price = price;
    });
  } else {
    // Receipt match mode: rp-0, rp-1, ...
    _receiptMatches.forEach((m, i) => {
      const input = document.getElementById(`rp-${i}`);
      const price = input ? parseFloat(input.value) || null : null;
      const ti = updatedItems.find((u) => u.item_name === m.tripItem.item_name);
      if (ti) ti.price = price;
    });
    if (_receiptMatches._unmatchedTrip) {
      _receiptMatches._unmatchedTrip.forEach((ti, i) => {
        const input = document.getElementById(`rp-extra-${i}`);
        const price = input ? parseFloat(input.value) || null : null;
        const u = updatedItems.find((u) => u.item_name === ti.item_name);
        if (u && price) u.price = price;
      });
    }
  }

  await db.from('grocery_trips').update({ items: updatedItems }).eq('id', _receiptTripId);
  closeReceiptModal();
  setStatus('Prices saved!');
  openTrips();
};

window.closeReceiptModal = function () {
  document.getElementById('receipt-modal-bg').classList.remove('active');
};

window.closeTrips = function () {
  document.getElementById('trips-overlay').classList.remove('active');
};

init();
