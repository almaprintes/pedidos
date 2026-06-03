/* ===================================================
   AlmaPrint Pedidos — app.js
   IndexedDB + vanilla JS SPA
   =================================================== */

// ─── DB ──────────────────────────────────────────────
const DB_NAME = 'almaprint_db';
const DB_VER  = 3;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('orders')) {
        const store = d.createObjectStore('orders', { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('client', 'client');
        store.createIndex('followup', 'followup');
      }
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'key' });
      }
             if (!d.objectStoreNames.contains('clients')) {
        const clientStore = d.createObjectStore('clients', { keyPath: 'id' });
        clientStore.createIndex('normalizedName', 'normalizedName', { unique: true });
        clientStore.createIndex('name', 'name');
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbPut(store, obj) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(obj);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

function dbClear(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// ─── CONSTANTS ───────────────────────────────────────
const STATUSES = [
  { id: 'idea',       label: 'Idea / Cliente potencial',  css: 's-idea',       short: 'Idea' },
  { id: 'pendiente',  label: 'Pedido pendiente',           css: 's-pendiente',  short: 'Pendiente' },
  { id: 'diseño',     label: 'Diseño',                     css: 's-diseño',     short: 'Diseño' },
  { id: 'aprobacion', label: 'Esperando aprobación',       css: 's-aprobacion', short: 'Aprob.' },
  { id: 'produccion', label: 'Producción',                 css: 's-produccion', short: 'Producción' },
  { id: 'listo',      label: 'Listo para entregar',        css: 's-listo',      short: 'Listo' },
  { id: 'entregado',  label: 'Entregado',                  css: 's-entregado',  short: 'Entregado' },
  { id: 'seguimiento',label: 'Seguimiento',                css: 's-seguimiento',short: 'Seguim.' },
];

const PRIORITIES = ['Normal', 'Importante', 'Urgente'];

const PAYMENT_STATES = [
  { id: 'no',       label: 'No presupuestado', css: 'pago-no' },
  { id: 'pres',     label: 'Presupuesto enviado', css: 'pago-pres' },
  { id: 'pendiente',label: 'Pendiente de pago', css: 'pago-pend' },
  { id: 'senal',    label: 'Señal pagada', css: 'pago-senal' },
  { id: 'pagado',   label: 'Pagado', css: 'pago-ok' },
];

const PRODUCTS = [
  'Taza personalizada','Camiseta DTF','Azulejo 15x15','Aluminio A4',
  'Imán de nevera','Pegatina','Tarjeta de visita','Gorra sublimada',
  'Pack personalizado','Otro'
];

const DEFAULT_TASKS = [
  'Recibir fotos','Crear diseño','Enviar diseño','Aprobar diseño',
  'Imprimir','Sublimar / estampar','Cobrar','Entregar'
];

const DEFAULT_WA_MSG = 'Hola {cliente}, soy Juan de AlmaPrint. Te escribo para recordarte lo que hablamos sobre tu pedido de {producto}. Cuando quieras, lo retomamos. ¡Gracias!';

// ─── STATE ───────────────────────────────────────────
let orders = [];
let clients = [];
let currentClient = null;
let editingClientId = null;
let clientSearch = '';
let orderFormReturnAfterClient = false;
let currentView = 'dashboard';
let currentOrder = null;
let editingOrderId = null;
let listFilter = 'todos';
let listSearch = '';
let detailTab = 'info';
let formPhotos = []; // base64 strings

// ─── UTILS ───────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function fmtDate(d) {
  if (!d) return 'Sin fecha';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function getStatus(id) { return STATUSES.find(s => s.id === id) || STATUSES[0]; }
function getPrioCss(p) {
  if (p === 'Urgente') return 'prio-urgente';
  if (p === 'Importante') return 'prio-importante';
  return 'prio-normal';
}
function getPrioBadge(p) {
  if (p === 'Urgente') return `<span class="badge badge-urgente">🔥 Urgente</span>`;
  if (p === 'Importante') return `<span class="badge badge-importante">⭐ Importante</span>`;
  return `<span class="badge badge-normal">Normal</span>`;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
function today() { return new Date().toISOString().split('T')[0]; }
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) <= new Date();
}
function toNumber(value) {
  const n = parseFloat(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizePaymentStatus(order) {
  const price = toNumber(order.price);
  const paid = toNumber(order.paid);

  if (price > 0 && paid >= price) {
    order.payment = 'pagado';
  } else if (price > 0 && paid > 0 && paid < price) {
    order.payment = 'senal';
  } else if (price > 0 && paid <= 0 && (order.payment === 'pagado' || order.payment === 'senal')) {
    order.payment = 'pendiente';
  }

  return order;
}

function normalizeClientName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
function findClientByName(name) {
  const normalizedName = normalizeClientName(name);
  if (!normalizedName) return null;
  return clients.find(c => c.normalizedName === normalizedName) || null;
}
async function upsertClientFromOrder(order) {
  const normalizedName = normalizeClientName(order.client);
  if (!normalizedName) return order;

  let client = findClientByName(order.client);
  const now = Date.now();

  if (client) {
    if (order.phone && order.phone !== client.phone) {
      client.phone = order.phone;
    }

    client.lastOrderAt = now;
    client.updatedAt = now;

    await dbPut('clients', client);

    clients = clients.map(c => c.id === client.id ? client : c);

    order.clientId = client.id;
    order.client = client.name;
    order.phone = order.phone || client.phone || '';

    return order;
  }

  client = {
    id: uid(),
    name: order.client,
    normalizedName,
    phone: order.phone || '',
    createdAt: now,
    updatedAt: now,
    lastOrderAt: now
  };

  await dbPut('clients', client);
  clients.push(client);

  order.clientId = client.id;

  return order;
}
function refreshClientSelect(selectedId = '') {
  const select = document.getElementById('f-client-select');
  if (!select) return;

  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  select.innerHTML = '<option value="">— Selecciona cliente —</option>' + sorted.map(c =>
    `<option value="${escHtml(c.id)}">${escHtml(c.name)}${c.phone ? ' · ' + escHtml(c.phone) : ''}</option>`
  ).join('');

  if (selectedId) select.value = selectedId;
}

function syncClientFromSelect() {
  const select = document.getElementById('f-client-select');
  const phoneInput = document.getElementById('f-phone');
  if (!select || !phoneInput) return null;

  const client = clients.find(c => c.id === select.value) || null;
  if (client) phoneInput.value = client.phone || '';
  return client;
}

function renderClientAutocomplete() {
  const clientInput = document.getElementById('f-client');
  const box = document.getElementById('client-autocomplete');
  if (!clientInput || !box) return;

  const q = normalizeClientName(clientInput.value);

  if (!q) {
    box.classList.remove('active');
    box.innerHTML = '';
    return;
  }

  const matches = clients
    .filter(c => c.normalizedName.includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, 8);

  if (!matches.length) {
    box.classList.remove('active');
    box.innerHTML = '';
    return;
  }

  box.innerHTML = matches.map(c => `
    <div class="client-autocomplete-item" onclick="selectClientFromAutocomplete('${c.id}')">
      <div class="client-autocomplete-name">${escHtml(c.name)}</div>
      ${c.phone ? `<div class="client-autocomplete-phone">${escHtml(c.phone)}</div>` : ''}
    </div>
  `).join('');

  box.classList.add('active');
}

function selectClientFromAutocomplete(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const clientInput = document.getElementById('f-client');
  const phoneInput = document.getElementById('f-phone');
  const box = document.getElementById('client-autocomplete');

  clientInput.value = client.name;

  if (client.phone) {
    phoneInput.value = client.phone;
  }

  box.classList.remove('active');
  box.innerHTML = '';
}

function autofillClientData() {
  const clientInput = document.getElementById('f-client');
  const phoneInput = document.getElementById('f-phone');
  if (!clientInput || !phoneInput) return;

  const client = findClientByName(clientInput.value);
  if (!client) return;

  clientInput.value = client.name;

  if (client.phone && !phoneInput.value.trim()) {
    phoneInput.value = client.phone;
  }

  const box = document.getElementById('client-autocomplete');
  if (box) {
    box.classList.remove('active');
    box.innerHTML = '';
  }
}
function getSetting(key, def = '') {
  return localStorage.getItem('ap_' + key) || def;
}
function setSetting(key, val) {
  localStorage.setItem('ap_' + key, val);
}

// ─── NAVIGATION ──────────────────────────────────────
function showView(viewId) {
  currentView = viewId;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');
  const nav = document.querySelector(`[data-nav="${viewId}"]`);
  if (nav) nav.classList.add('active');
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'kanban') renderKanban();
  if (viewId === 'list') renderList();
  if (viewId === 'clients') renderClients();
  if (viewId === 'seguimiento') renderSeguimiento();
  if (viewId === 'settings') renderSettings();
}

// ─── RENDER DASHBOARD ────────────────────────────────
function renderDashboard() {
  const activos = orders.filter(o => o.status !== 'entregado').length;
  const urgentes = orders.filter(o => o.priority === 'Urgente' && o.status !== 'entregado').length;
  const aprobaciones = orders.filter(o => o.status === 'aprobacion').length;
  const cobros = orders.filter(o => (o.payment === 'pendiente' || o.payment === 'senal') && o.status !== 'entregado').length;
  const produccion = orders.filter(o => o.status === 'produccion').length;
  const seguims = orders.filter(o => o.followup && o.status !== 'entregado').length;

  document.getElementById('dash-activos').textContent = activos;
  document.getElementById('dash-urgentes').textContent = urgentes;
  document.getElementById('dash-aprobaciones').textContent = aprobaciones;
  document.getElementById('dash-cobros').textContent = cobros;
  document.getElementById('dash-produccion').textContent = produccion;
  document.getElementById('dash-seguimientos').textContent = seguims;

  // Bar chart
  const maxVal = Math.max(...STATUSES.map(s => orders.filter(o => o.status === s.id).length), 1);
  const bars = document.getElementById('dash-bars');
  bars.innerHTML = STATUSES.map(s => {
    const count = orders.filter(o => o.status === s.id).length;
    const h = Math.round((count / maxVal) * 50);
    return `<div class="bar-wrap">
      <div class="bar" style="height:${h}px"></div>
      <div class="bar-label">${s.short}</div>
    </div>`;
  }).join('');

  // Recent orders
  const recent = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  document.getElementById('dash-recent').innerHTML = recent.length
    ? recent.map(o => orderListCard(o)).join('')
    : '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Sin pedidos aún</div><div class="empty-desc">Pulsa + para añadir el primero</div></div>';
}

// ─── RENDER KANBAN ───────────────────────────────────
function renderKanban() {
  const container = document.getElementById('kanban-cols');
  container.innerHTML = STATUSES.map(st => {
    const cols = orders.filter(o => o.status === st.id);
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <span class="kanban-col-title">${st.label}</span>
        <span class="kanban-count">${cols.length}</span>
      </div>
      <div class="kanban-cards">
        ${cols.length ? cols.map(o => kanbanCard(o)).join('') : '<div style="font-size:0.75rem;color:var(--text-2);text-align:center;padding:12px">Vacío</div>'}
      </div>
    </div>`;
  }).join('');
}

function kanbanCard(o) {
  return `<div class="order-card ${getPrioCss(o.priority)} ${o.favorite ? 'favorito' : ''}" onclick="openDetail('${o.id}')">
    <div class="card-client">${escHtml(o.client)}</div>
    <div class="card-product">${escHtml(o.product)}</div>
    ${getPrioBadge(o.priority)}
    <div class="card-date">${o.deliveryDate ? '📅 ' + fmtDate(o.deliveryDate) : 'Sin fecha'}</div>
  </div>`;
}

// ─── RENDER LIST ─────────────────────────────────────
function renderList() {
  let filtered = [...orders];

  // Filter
  if (listFilter === 'urgentes') filtered = filtered.filter(o => o.priority === 'Urgente' && o.status !== 'entregado');
  else if (listFilter === 'sinfecha') filtered = filtered.filter(o => !o.deliveryDate && o.status !== 'entregado');
  else if (listFilter === 'seguimiento') filtered = filtered.filter(o => o.followup);
  else if (listFilter === 'aprobacion') filtered = filtered.filter(o => o.status === 'aprobacion');
  else if (listFilter === 'cobro') filtered = filtered.filter(o => (o.payment === 'pendiente' || o.payment === 'senal') && o.status !== 'entregado');
  else if (listFilter === 'produccion') filtered = filtered.filter(o => o.status === 'produccion');
  else if (listFilter === 'entregados') filtered = filtered.filter(o => o.status === 'entregado');
  else if (listFilter !== 'todos') filtered = filtered.filter(o => o.status !== 'entregado');

  // Search
  if (listSearch) {
    const q = listSearch.toLowerCase();
    filtered = filtered.filter(o =>
      (o.client || '').toLowerCase().includes(q) ||
      (o.product || '').toLowerCase().includes(q) ||
      (o.description || '').toLowerCase().includes(q)
    );
  }

  // Sort by priority desc, then createdAt desc
  filtered.sort((a, b) => {
    const po = { Urgente: 3, Importante: 2, Normal: 1 };
    if (po[b.priority] !== po[a.priority]) return po[b.priority] - po[a.priority];
    return b.createdAt - a.createdAt;
  });

  document.getElementById('list-count').textContent = `${filtered.length} pedido${filtered.length !== 1 ? 's' : ''}`;
  document.getElementById('order-list').innerHTML = filtered.length
    ? filtered.map(o => orderListCard(o)).join('')
    : '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Sin resultados</div><div class="empty-desc">Prueba otro filtro o búsqueda</div></div>';
}

function orderListCard(o) {
  const st = getStatus(o.status);
  return `<div class="list-card ${getPrioCss(o.priority)}" onclick="openDetail('${o.id}')">
    <div class="list-card-body">
      <div class="list-card-top">
        <span class="list-card-name">${escHtml(o.client)}</span>
        ${getPrioBadge(o.priority)}
      </div>
      <div class="list-card-product">${escHtml(o.product)}</div>
      <div class="list-card-meta">
        <span class="status-pill ${st.css}">${st.short}</span>
        ${o.deliveryDate ? `<span class="list-card-date">📅 ${fmtDate(o.deliveryDate)}</span>` : '<span class="list-card-date">Sin fecha</span>'}
        ${o.favorite ? '<span style="color:var(--amber)">★</span>' : ''}
      </div>
    </div>
    <div class="list-more" onclick="event.stopPropagation(); showOrderMenu('${o.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
    </div>
  </div>`;
}

// ─── RENDER SEGUIMIENTO ──────────────────────────────
function renderSeguimiento() {
  const toFollow = orders
    .filter(o => o.followup && o.status !== 'entregado')
    .sort((a, b) => new Date(a.followup) - new Date(b.followup));

  document.getElementById('seguim-count').textContent = toFollow.length;
  const list = document.getElementById('seguim-list');
  if (!toFollow.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">Sin seguimientos pendientes</div><div class="empty-desc">Añade una fecha de seguimiento a tus pedidos</div></div>';
    return;
  }
  list.innerHTML = toFollow.map(o => `
    <div class="remind-card" onclick="openDetail('${o.id}')">
      <div class="remind-avatar">${initials(o.client)}</div>
      <div class="remind-body">
        <div class="remind-name">${escHtml(o.client)}</div>
        <div class="remind-product">${escHtml(o.product)}</div>
        <div class="remind-date">${isOverdue(o.followup) ? '⚠️ ' : '📅 '}${fmtDate(o.followup)}</div>
      </div>
      ${o.phone ? `<button class="remind-wa" onclick="event.stopPropagation(); sendWhatsApp('${o.id}')" title="WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </button>` : ''}
    </div>
  `).join('');
}


// ─── RENDER CLIENTS ───────────────────────────────────
function renderClients() {
  const input = document.getElementById('client-search');
  const list = document.getElementById('client-list');
  const countEl = document.getElementById('client-count');
  if (!list) return;

  const q = normalizeClientName(clientSearch);
  let filtered = [...clients];
  if (q) {
    filtered = filtered.filter(c =>
      c.normalizedName.includes(q) ||
      String(c.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }

  filtered.sort((a, b) => (b.lastOrderAt || b.updatedAt || 0) - (a.lastOrderAt || a.updatedAt || 0));
  if (countEl) countEl.textContent = `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''}`;
  if (input && input.value !== clientSearch) input.value = clientSearch;

  list.innerHTML = filtered.length
    ? filtered.map(clientListCard).join('')
    : '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Sin clientes</div><div class="empty-desc">Crea tu primer cliente para asociarle pedidos</div></div>';
}

function clientListCard(c) {
  const clientOrders = orders.filter(o => o.clientId === c.id || normalizeClientName(o.client) === c.normalizedName);
  const total = clientOrders.reduce((sum, o) => sum + toNumber(o.paid || o.price), 0);
  const last = c.lastOrderAt ? fmtDate(c.lastOrderAt) : 'Sin pedidos';
  return `<div class="client-card" onclick="openClientDetail('${c.id}')">
    <div class="client-avatar">${initials(c.name)}</div>
    <div class="client-card-body">
      <div class="client-card-name">${escHtml(c.name)}</div>
      <div class="client-card-phone">${c.phone ? '📱 ' + escHtml(c.phone) : 'Sin teléfono'}</div>
      <div class="client-card-meta">${clientOrders.length} pedido${clientOrders.length !== 1 ? 's' : ''} · ${total.toFixed(2).replace('.', ',')} € · ${last}</div>
    </div>
    <span class="settings-item-arrow">›</span>
  </div>`;
}

function openClientDetail(id) {
  currentClient = clients.find(c => c.id === id);
  if (!currentClient) return;
  renderClientDetail();
  document.getElementById('client-detail-view').classList.add('active');
}

function closeClientDetail() {
  document.getElementById('client-detail-view').classList.remove('active');
}

function renderClientDetail() {
  const c = currentClient;
  const body = document.getElementById('client-detail-body');
  const title = document.getElementById('client-detail-title');
  if (!c || !body || !title) return;
  title.textContent = c.name;
  const clientOrders = orders
    .filter(o => o.clientId === c.id || normalizeClientName(o.client) === c.normalizedName)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const total = clientOrders.reduce((sum, o) => sum + toNumber(o.paid || o.price), 0);
  body.innerHTML = `
    <div class="client-summary-card">
      <div class="client-summary-name">${escHtml(c.name)}</div>
      <div class="client-summary-phone">${c.phone ? '📱 ' + escHtml(c.phone) : 'Sin teléfono'}</div>
      ${c.notes ? `<div class="client-summary-notes">${escHtml(c.notes)}</div>` : ''}
      <div class="client-summary-stats">
        <div><strong>${clientOrders.length}</strong><span>Pedidos</span></div>
        <div><strong>${total.toFixed(2).replace('.', ',')} €</strong><span>Total</span></div>
      </div>
      <div class="client-summary-actions">
        ${c.phone ? `<button class="modal-btn modal-btn-primary" onclick="sendWhatsAppToClient('${c.id}')">WhatsApp</button>` : ''}
        ${c.phone ? `<button class="modal-btn modal-btn-secondary" onclick="location.href='tel:${escHtml(c.phone)}'">Llamar</button>` : ''}
        <button class="modal-btn modal-btn-secondary" onclick="openEditClientForm('${c.id}')">Editar</button>
      </div>
    </div>
    <div class="section-title">Pedidos del cliente</div>
    <div class="order-list">
      ${clientOrders.length ? clientOrders.map(orderListCard).join('') : '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Sin pedidos</div></div>'}
    </div>`;
}

function sendWhatsAppToClient(id) {
  const c = clients.find(x => x.id === id);
  if (!c || !c.phone) { showToast('Sin teléfono'); return; }
  const msg = `Hola ${c.name}, soy Juan de AlmaPrint.`;
  const phone = c.phone.replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function openNewClientForm(returnToOrderForm = false) {
  editingClientId = null;
  orderFormReturnAfterClient = !!returnToOrderForm;
  document.getElementById('client-form-title').textContent = 'Nuevo cliente';
  document.getElementById('cf-name').value = '';
  document.getElementById('cf-phone').value = '';
  document.getElementById('cf-notes').value = '';
  document.getElementById('client-form-view').classList.add('active');
}

function openEditClientForm(id) {
  const c = clients.find(x => x.id === id) || currentClient;
  if (!c) return;
  editingClientId = c.id;
  orderFormReturnAfterClient = false;
  document.getElementById('client-form-title').textContent = 'Editar cliente';
  document.getElementById('cf-name').value = c.name || '';
  document.getElementById('cf-phone').value = c.phone || '';
  document.getElementById('cf-notes').value = c.notes || '';
  document.getElementById('client-form-view').classList.add('active');
}

function closeClientForm() {
  document.getElementById('client-form-view').classList.remove('active');
}

async function saveClientForm() {
  const name = document.getElementById('cf-name').value.trim();
  const phone = document.getElementById('cf-phone').value.trim();
  const notes = document.getElementById('cf-notes').value.trim();
  if (!name) { showToast('Escribe el nombre del cliente'); return; }

  const normalizedName = normalizeClientName(name);
  const now = Date.now();
  let existing = clients.find(c => c.normalizedName === normalizedName && c.id !== editingClientId);

  if (existing) {
    existing.phone = phone || existing.phone || '';
    existing.notes = notes || existing.notes || '';
    existing.updatedAt = now;
    await dbPut('clients', existing);
    clients = clients.map(c => c.id === existing.id ? existing : c);
    refreshClientSelect(existing.id);
    showToast('Cliente ya existía, actualizado');
    if (orderFormReturnAfterClient) syncClientFromSelect();
    closeClientForm();
    renderClients();
    return;
  }

  let client = editingClientId ? clients.find(c => c.id === editingClientId) : null;
  if (client) {
    client.name = name;
    client.normalizedName = normalizedName;
    client.phone = phone;
    client.notes = notes;
    client.updatedAt = now;
  } else {
    client = { id: uid(), name, normalizedName, phone, notes, createdAt: now, updatedAt: now, lastOrderAt: null };
  }

  await dbPut('clients', client);
  if (editingClientId) clients = clients.map(c => c.id === client.id ? client : c);
  else clients.push(client);

  refreshClientSelect(client.id);
  if (orderFormReturnAfterClient) syncClientFromSelect();
  closeClientForm();
  showToast(editingClientId ? 'Cliente actualizado' : 'Cliente creado ✓');
  renderClients();
  if (currentClient?.id === client.id) { currentClient = client; renderClientDetail(); }
}

async function migrateOrdersToClients() {
  for (const order of orders) {
    if (order.clientId && clients.some(c => c.id === order.clientId)) continue;
    await upsertClientFromOrder(order);
    await dbPut('orders', order);
  }
  clients = await dbGetAll('clients');
}

// ─── RENDER SETTINGS ─────────────────────────────────
function renderSettings() {
  // nothing dynamic needed, all static
}

// ─── OPEN DETAIL ─────────────────────────────────────
function openDetail(id) {
  currentOrder = orders.find(o => o.id === id);
  if (!currentOrder) return;
  detailTab = 'info';
  renderDetailView();
  document.getElementById('detail-view').classList.add('active');
}

function closeDetail() {
  document.getElementById('detail-view').classList.remove('active');
}

function renderDetailView() {
  const o = currentOrder;
  const st = getStatus(o.status);

  // Hero
  document.getElementById('detail-client').textContent = o.client;
  document.getElementById('detail-product').textContent = o.product;
  document.getElementById('detail-badges').innerHTML = `
    <span class="detail-badge">${st.label}</span>
    <span class="detail-badge">${o.priority}</span>
    ${o.payment ? `<span class="detail-badge">${PAYMENT_STATES.find(p=>p.id===o.payment)?.label || ''}</span>` : ''}
  `;
  document.getElementById('detail-fav-btn').innerHTML = o.favorite
    ? `<svg viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  // Tabs
  renderDetailTab('info');
}

function renderDetailTab(tab) {
  detailTab = tab;
  document.querySelectorAll('.detail-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.detail-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'dtab-' + tab);
  });
  const o = currentOrder;

  if (tab === 'info') {
    document.getElementById('dtab-info').innerHTML = `
      <div class="info-row"><span class="info-label">Cliente</span><span class="info-value">${escHtml(o.client)}</span></div>
      ${o.phone ? `<div class="info-row"><span class="info-label">Teléfono</span><span class="info-value"><a href="tel:${escHtml(o.phone)}" style="color:var(--teal)">${escHtml(o.phone)}</a></span></div>` : ''}
      <div class="info-row"><span class="info-label">Producto</span><span class="info-value">${escHtml(o.product)}</span></div>
      ${o.description ? `<div class="info-row"><span class="info-label">Descripción</span><span class="info-value" style="max-width:65%">${escHtml(o.description)}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Estado</span><span class="info-value"><span class="status-pill ${getStatus(o.status).css}">${getStatus(o.status).label}</span></span></div>
      <div class="info-row"><span class="info-label">Prioridad</span><span class="info-value">${getPrioBadge(o.priority)}</span></div>
      <div class="info-row"><span class="info-label">Pago</span><span class="info-value ${PAYMENT_STATES.find(p=>p.id===o.payment)?.css || ''}">${PAYMENT_STATES.find(p=>p.id===o.payment)?.label || '—'}</span></div>
      ${o.price ? `<div class="info-row"><span class="info-label">Precio est.</span><span class="info-value">${o.price} €</span></div>` : ''}
      ${o.paid ? `<div class="info-row"><span class="info-label">Cobrado</span><span class="info-value pago-ok">${o.paid} €</span></div>` : ''}
      <div class="info-row"><span class="info-label">Creado</span><span class="info-value">${fmtDate(o.createdAt)}</span></div>
      ${o.deliveryDate ? `<div class="info-row"><span class="info-label">Entrega</span><span class="info-value">${fmtDate(o.deliveryDate)}</span></div>` : ''}
      ${o.followup ? `<div class="info-row"><span class="info-label">Seguimiento</span><span class="info-value" style="color:var(--pink)">${fmtDate(o.followup)}</span></div>` : ''}
      ${o.notes ? `<div class="info-row"><span class="info-label">Notas</span><span class="info-value" style="max-width:65%;font-style:italic">${escHtml(o.notes)}</span></div>` : ''}
      <div style="margin-top:16px">
        <div class="section-title">Cambiar estado</div>
        <div class="status-selector">
          ${STATUSES.map(s => `<button class="status-btn ${o.status === s.id ? 'active' : ''}" onclick="changeStatus('${s.id}')">${s.short}</button>`).join('')}
        </div>
      </div>
      ${o.photos && o.photos.length ? `<div style="margin-top:16px"><div class="section-title">Fotos</div><div class="photo-grid">${o.photos.map(p => `<img class="photo-thumb" src="${p}" onclick="viewPhoto('${p}')">`).join('')}</div></div>` : ''}
      ${o.history && o.history.length ? `<div style="margin-top:16px"><div class="section-title">Historial</div>${o.history.slice().reverse().map(h => `<div class="note-item"><div class="note-date">${h.date}</div><div class="note-text">${escHtml(h.text)}</div></div>`).join('')}</div>` : ''}
    `;
  }

  if (tab === 'tasks') {
    const tasks = o.tasks || [];
    const done = tasks.filter(t => t.done).length;
    document.getElementById('dtab-tasks').innerHTML = `
      <div class="section-title">Tareas <span>${done}/${tasks.length}</span></div>
      ${tasks.map((t, i) => `
        <div class="task-item">
          <div class="task-check ${t.done ? 'done' : ''}" onclick="toggleTask(${i})"></div>
          <span class="task-label ${t.done ? 'done' : ''}">${escHtml(t.label)}</span>
        </div>
      `).join('')}
      <div style="margin-top:12px">
        <div class="note-add">
          <textarea id="new-task-input" placeholder="Nueva tarea..." rows="1" style="min-height:40px"></textarea>
          <button class="btn-add-note" onclick="addCustomTask()">+</button>
        </div>
      </div>
    `;
  }

  if (tab === 'notas') {
    const notas = o.quickNotes || [];
    document.getElementById('dtab-notas').innerHTML = `
      ${notas.slice().reverse().map(n => `
        <div class="note-item">
          <div class="note-date">${n.date}</div>
          <div class="note-text">${escHtml(n.text)}</div>
        </div>
      `).join('')}
      ${!notas.length ? '<div style="color:var(--text-2);font-size:0.85rem;margin-bottom:16px">Sin notas aún</div>' : ''}
      <div class="note-add">
        <textarea id="quick-note-input" placeholder="Añadir nota rápida..." rows="2"></textarea>
        <button class="btn-add-note" onclick="addQuickNote()">OK</button>
      </div>
    `;
  }
}

async function changeStatus(newStatus) {
  currentOrder.status = newStatus;
  addHistoryEntry(currentOrder, `Estado → ${getStatus(newStatus).label}`);
  await dbPut('orders', currentOrder);
  orders = orders.map(o => o.id === currentOrder.id ? currentOrder : o);
  renderDetailView();
  showToast('Estado actualizado');
}

async function toggleTask(idx) {
  currentOrder.tasks[idx].done = !currentOrder.tasks[idx].done;
  await dbPut('orders', currentOrder);
  orders = orders.map(o => o.id === currentOrder.id ? currentOrder : o);
  renderDetailTab('tasks');
}

async function addCustomTask() {
  const input = document.getElementById('new-task-input');
  const label = input.value.trim();
  if (!label) return;
  if (!currentOrder.tasks) currentOrder.tasks = [];
  currentOrder.tasks.push({ label, done: false });
  await dbPut('orders', currentOrder);
  orders = orders.map(o => o.id === currentOrder.id ? currentOrder : o);
  input.value = '';
  renderDetailTab('tasks');
}

async function addQuickNote() {
  const input = document.getElementById('quick-note-input');
  const text = input.value.trim();
  if (!text) return;
  if (!currentOrder.quickNotes) currentOrder.quickNotes = [];
  currentOrder.quickNotes.push({ text, date: fmtDateTime(new Date()) });
  await dbPut('orders', currentOrder);
  orders = orders.map(o => o.id === currentOrder.id ? currentOrder : o);
  input.value = '';
  renderDetailTab('notas');
  showToast('Nota añadida');
}

function addHistoryEntry(order, text) {
  if (!order.history) order.history = [];
  order.history.push({ text, date: fmtDateTime(new Date()) });
}

// ─── WHATSAPP ─────────────────────────────────────────
function sendWhatsApp(id) {
  const o = orders.find(x => x.id === id) || currentOrder;
  if (!o || !o.phone) { showToast('Sin teléfono'); return; }
  const tpl = getSetting('wa_msg', DEFAULT_WA_MSG);
  const msg = tpl.replace('{cliente}', o.client || '').replace('{producto}', o.product || '');
  showWAModal(o, msg);
}

function showWAModal(o, msg) {
  const overlay = document.getElementById('modal-wa');
  document.getElementById('wa-textarea').value = msg;
  document.getElementById('wa-send-btn').onclick = () => {
    const finalMsg = document.getElementById('wa-textarea').value;
    const phone = o.phone.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(finalMsg)}`;
    window.open(url, '_blank');
    overlay.classList.remove('active');
  };
  overlay.classList.add('active');
}

// ─── FORM ─────────────────────────────────────────────
function openNewForm() {
  editingOrderId = null;
  formPhotos = [];
  refreshClientSelect();
  document.getElementById('form-title').textContent = 'Nuevo pedido';
  resetForm();
  document.getElementById('form-view').classList.add('active');
}

function openEditForm() {
  const o = currentOrder;
  if (!o) return;
  editingOrderId = o.id;
  formPhotos = o.photos ? [...o.photos] : [];
  document.getElementById('form-title').textContent = 'Editar pedido';
  
  refreshClientSelect(o.clientId || findClientByName(o.client)?.id || '');
  document.getElementById('f-phone').value = o.phone || findClientByName(o.client)?.phone || '';
  document.getElementById('f-product').value = o.product || '';
  document.getElementById('f-product-custom').value = PRODUCTS.includes(o.product) ? '' : o.product;
  document.getElementById('f-description').value = o.description || '';
  document.getElementById('f-status').value = o.status || 'idea';
  document.getElementById('f-priority').value = o.priority || 'Normal';
  document.getElementById('f-delivery').value = o.deliveryDate || '';
  document.getElementById('f-followup').value = o.followup || '';
  document.getElementById('f-payment').value = o.payment || 'no';
  document.getElementById('f-price').value = o.price || '';
  document.getElementById('f-paid').value = o.paid || '';
  document.getElementById('f-notes').value = o.notes || '';
  renderFormPhotos();
  document.getElementById('form-view').classList.add('active');
}

function closeForm() {
  document.getElementById('form-view').classList.remove('active');
  formPhotos = [];
}

function resetForm() {
  ['f-phone','f-product','f-product-custom','f-description',
   'f-delivery','f-followup','f-price','f-paid','f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-status').value = 'idea';
  document.getElementById('f-priority').value = 'Normal';
  document.getElementById('f-payment').value = 'no';
  const clientSelect = document.getElementById('f-client-select');
  if (clientSelect) clientSelect.value = '';
  renderFormPhotos();
}

async function saveForm() {
  const selectedClientId = document.getElementById('f-client-select').value;
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const client = selectedClient?.name || '';
  const productSel = document.getElementById('f-product').value;
  const productCustom = document.getElementById('f-product-custom').value.trim();
  const product = productCustom || productSel;

  if (!selectedClient) { showToast('Selecciona o crea un cliente'); return; }
  if (!product) { showToast('Selecciona o escribe un producto'); return; }

  const now = Date.now();
  const isEdit = !!editingOrderId;
  const existing = isEdit ? orders.find(o => o.id === editingOrderId) : null;

  const order = {
    id: isEdit ? editingOrderId : uid(),
    clientId: selectedClient.id,
    client: selectedClient.name,
    phone: selectedClient.phone || document.getElementById('f-phone').value.trim(),
    product,
    description: document.getElementById('f-description').value.trim(),
    status: document.getElementById('f-status').value,
    priority: document.getElementById('f-priority').value,
    deliveryDate: document.getElementById('f-delivery').value || null,
    followup: document.getElementById('f-followup').value || null,
    payment: document.getElementById('f-payment').value,
    price: document.getElementById('f-price').value || null,
    paid: document.getElementById('f-paid').value || null,
    notes: document.getElementById('f-notes').value.trim(),
    photos: formPhotos,
    tasks: existing?.tasks || DEFAULT_TASKS.map(l => ({ label: l, done: false })),
    quickNotes: existing?.quickNotes || [],
    history: existing?.history || [],
    favorite: existing?.favorite || false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

normalizePaymentStatus(order);
await upsertClientFromOrder(order);

  if (isEdit) {
    addHistoryEntry(order, 'Pedido editado');
  } else {
    addHistoryEntry(order, 'Pedido creado');
  }

  await dbPut('orders', order);
  if (isEdit) {
    orders = orders.map(o => o.id === order.id ? order : o);
    currentOrder = order;
  } else {
    orders.push(order);
  }

  closeForm();
  showToast(isEdit ? 'Pedido actualizado' : 'Pedido creado ✓');
  if (isEdit) {
    renderDetailView();
  } else {
    showView(currentView);
  }
}

// Photos
function handlePhotoAdd(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      formPhotos.push(ev.target.result);
      renderFormPhotos();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function removePhoto(idx) {
  formPhotos.splice(idx, 1);
  renderFormPhotos();
}

function renderFormPhotos() {
  const grid = document.getElementById('photo-preview-grid');
  grid.innerHTML = formPhotos.map((p, i) =>
    `<div style="position:relative;display:inline-block">
      <img class="photo-thumb" src="${p}">
      <button class="photo-remove" onclick="removePhoto(${i})">×</button>
    </div>`
  ).join('');
}

function viewPhoto(src) {
  document.getElementById('fullphoto-img').src = src;
  document.getElementById('modal-photo').classList.add('active');
}

// ─── ORDER MENU ──────────────────────────────────────
function showOrderMenu(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  currentOrder = o;
  document.getElementById('menu-order-title').textContent = o.client + ' — ' + o.product;
  document.getElementById('modal-menu').classList.add('active');
}

// ─── QUICK ACTIONS ───────────────────────────────────
async function toggleFavorite() {
  currentOrder.favorite = !currentOrder.favorite;
  await dbPut('orders', currentOrder);
  orders = orders.map(o => o.id === currentOrder.id ? currentOrder : o);
  renderDetailView();
  showToast(currentOrder.favorite ? '★ Marcado favorito' : 'Favorito eliminado');
}

async function duplicateOrder() {
  const o = { ...currentOrder, id: uid(), createdAt: Date.now(), updatedAt: Date.now(), history: [{ text: 'Duplicado de ' + currentOrder.client, date: fmtDateTime(new Date()) }], quickNotes: [] };
  await dbPut('orders', o);
  orders.push(o);
  closeModal('modal-menu');
  showToast('Pedido duplicado');
  showView(currentView);
}

async function deleteOrder(id) {
  const oid = id || currentOrder?.id;
  if (!oid) return;
  await dbDelete('orders', oid);
  orders = orders.filter(o => o.id !== oid);
  closeDetail();
  closeModal('modal-menu');
  closeModal('modal-confirm');
  showToast('Pedido eliminado');
  showView(currentView);
}

function confirmDelete(id) {
  const oid = id || currentOrder?.id;
  document.getElementById('confirm-delete-btn').onclick = () => deleteOrder(oid);
  closeModal('modal-menu');
  document.getElementById('modal-confirm').classList.add('active');
}

// ─── MODALS ───────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ─── SETTINGS ────────────────────────────────────────
async function exportBackup() {
  const data = { version: 2, exportedAt: new Date().toISOString(), orders, clients };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `almaprint-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Copia exportada ✓');
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data.orders || !Array.isArray(data.orders)) throw new Error('Formato incorrecto');
      await dbClear('orders');
      await dbClear('clients');
      orders = data.orders;
      clients = Array.isArray(data.clients) ? data.clients : [];
      for (const c of clients) await dbPut('clients', c);
      for (const o of orders) {
        await upsertClientFromOrder(o);
        await dbPut('orders', o);
      }
      clients = await dbGetAll('clients');
      refreshClientSelect();
      showToast('Copia importada ✓ — ' + orders.length + ' pedidos');
      showView(currentView);
    } catch {
      showToast('Error: archivo no válido');
    }
  };
  input.click();
}

async function clearAllData() {
  const confirmed = prompt('Escribe BORRAR para confirmar el borrado total:');
  if (confirmed !== 'BORRAR') { showToast('Cancelado'); return; }
  await dbClear('orders');
  await dbClear('clients');
  orders = [];
  clients = [];
  refreshClientSelect();
  showToast('Todos los datos eliminados');
  showView('dashboard');
}

function editWAMessage() {
  const current = getSetting('wa_msg', DEFAULT_WA_MSG);
  document.getElementById('wa-msg-edit').value = current;
  document.getElementById('modal-wa-edit').classList.add('active');
}

function saveWAMessage() {
  const val = document.getElementById('wa-msg-edit').value.trim();
  if (val) setSetting('wa_msg', val);
  closeModal('modal-wa-edit');
  showToast('Mensaje guardado');
}

// ─── HTML HELPERS ─────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── INIT ─────────────────────────────────────────────
async function init() {
  await openDB();

  orders = await dbGetAll('orders');
  clients = await dbGetAll('clients');

  await migrateOrdersToClients();
  refreshClientSelect();
  showView('dashboard');

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Search handler
  document.getElementById('list-search').addEventListener('input', e => {
    listSearch = e.target.value;
    renderList();
  });

  const clientSelect = document.getElementById('f-client-select');
  if (clientSelect) clientSelect.addEventListener('change', syncClientFromSelect);

  const clientSearchInput = document.getElementById('client-search');
  if (clientSearchInput) clientSearchInput.addEventListener('input', e => {
    clientSearch = e.target.value;
    renderClients();
  });
}
document.addEventListener('DOMContentLoaded', init);
