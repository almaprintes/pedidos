/* ===================================================
   AlmaPrint Pedidos — app.js
   IndexedDB + vanilla JS SPA
   =================================================== */

// ─── DB ──────────────────────────────────────────────
const DB_NAME = 'almaprint_db';
const DB_VER  = 7;
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
      if (!d.objectStoreNames.contains('products')) {
        const productStore = d.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('normalizedName', 'normalizedName', { unique: true });
        productStore.createIndex('name', 'name');
      }
      if (!d.objectStoreNames.contains('providers')) {
        const providerStore = d.createObjectStore('providers', { keyPath: 'id' });
        providerStore.createIndex('normalizedName', 'normalizedName', { unique: true });
        providerStore.createIndex('name', 'name');
      }
      if (!d.objectStoreNames.contains('expenses')) {
        const expenseStore = d.createObjectStore('expenses', { keyPath: 'id' });
        expenseStore.createIndex('date', 'date');
        expenseStore.createIndex('providerId', 'providerId');
        expenseStore.createIndex('category', 'category');
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

const DEFAULT_PRODUCTS = [
  { name: 'Taza personalizada', description: 'Taza sublimada personalizada', price: '' },
  { name: 'Camiseta DTF', description: 'Camiseta personalizada con DTF', price: '' },
  { name: 'Azulejo 15x15', description: 'Azulejo personalizado 15x15 cm', price: '' },
  { name: 'Aluminio A4', description: 'Aluminio sublimado tamaño A4', price: '' },
  { name: 'Imán de nevera', description: 'Imán personalizado', price: '' },
  { name: 'Pegatina', description: 'Pegatina personalizada', price: '' },
  { name: 'Tarjeta de visita', description: 'Tarjeta de visita personalizada', price: '' },
  { name: 'Gorra sublimada', description: 'Gorra sublimada personalizada', price: '' },
  { name: 'Pack personalizado', description: 'Pack personalizado AlmaPrint', price: '' },
  { name: 'Otro', description: 'Producto personalizado', price: '' }
];

const PRODUCTS = DEFAULT_PRODUCTS.map(p => p.name);

const EXPENSE_CATEGORIES = [
  'Materiales',
  'Herramientas',
  'Transporte',
  'Marketing',
  'Software',
  'Servicios',
  'Suministros',
  'Maquinaria',
  'Otros'
];


const DEFAULT_TASKS = [
  'Recibir fotos','Crear diseño','Enviar diseño','Aprobar diseño',
  'Imprimir','Sublimar / estampar','Cobrar','Entregar'
];

const DEFAULT_WA_MESSAGES = {
  idea: 'Hola {cliente}, soy Juan de AlmaPrint. Te escribo porque hablamos sobre {producto}. Cuando quieras lo retomamos. ¡Gracias!',
  pendiente: 'Hola {cliente}, tengo anotado tu pedido de {producto}. Cuando quieras seguimos adelante.',
  diseño: 'Hola {cliente}, estoy trabajando en el diseño de {producto}. Te lo enviaré en cuanto esté listo.',
  aprobacion: 'Hola {cliente}, ya tengo preparado el diseño de {producto}. Cuando puedas, dime si te parece correcto para continuar.',
  produccion: 'Hola {cliente}, tu pedido de {producto} ya está en producción. Te avisaré en cuanto esté terminado.',
  listo: 'Hola {cliente}, tu pedido de {producto} ya está listo para recoger o entregar. ¡Gracias por confiar en AlmaPrint!',
  entregado: 'Hola {cliente}, espero que disfrutes de tu {producto}. Gracias por confiar en AlmaPrint.',
  seguimiento: 'Hola {cliente}, soy Juan de AlmaPrint. Te escribo para hacer seguimiento de {producto}. Cuando quieras lo retomamos.'
};

// ─── STATE ───────────────────────────────────────────
let orders = [];
let clients = [];
let products = [];
let providers = [];
let expenses = [];
let businessTab = 'resumen';
let currentClient = null;
let currentProduct = null;
let detailReturnTarget = null;
let editingClientId = null;
let editingProductId = null;
let clientSearch = '';
let productSearch = '';
let statsRange = 'all';
let orderFormReturnAfterClient = false;
let orderFormReturnAfterProduct = false;
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
  if (viewId === 'products') renderProducts();
  if (viewId === 'stats') renderStats();
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
  if (!currentClient) {
    showToast('Cliente no encontrado');
    return;
  }

  const detailView = document.getElementById('detail-view');
  if (detailView) detailView.classList.remove('active');

  renderClientDetail();
  document.getElementById('client-detail-view').classList.add('active');
}

function closeClientDetail() {
  const view = document.getElementById('client-detail-view');
  if (view) view.classList.remove('active');
}

function openOrderFromClient(orderId, clientId) {
  detailReturnTarget = { type: 'client', id: clientId };
  closeClientDetail();
  openDetail(orderId);
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
${clientOrders.length ? clientOrders.map(o => `
<div class="list-card ${getPrioCss(o.priority)}" onclick="openOrderFromClient('${o.id}', '${c.id}')">
    <div class="list-card-body">
      <div class="list-card-top">
        <span class="list-card-name">${escHtml(o.product || 'Producto sin nombre')}</span>
        ${getPrioBadge(o.priority || 'Normal')}
      </div>
      <div class="list-card-product">${escHtml(o.description || '')}</div>
      <div class="list-card-meta">
        <span class="status-pill ${getStatus(o.status).css}">${getStatus(o.status).short}</span>
        ${o.deliveryDate ? `<span class="list-card-date">📅 ${fmtDate(o.deliveryDate)}</span>` : '<span class="list-card-date">Sin fecha</span>'}
      </div>
    </div>
  </div>
`).join('') : '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Sin pedidos</div></div>'}
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
  if (!c) {
    showToast('Cliente no encontrado');
    return;
  }

  editingClientId = c.id;
  currentClient = c;
  orderFormReturnAfterClient = false;

  const form = document.getElementById('client-form-view');
  if (!form) {
    showToast('Formulario de cliente no encontrado');
    return;
  }

  document.getElementById('client-form-title').textContent = 'Editar cliente';
  document.getElementById('cf-name').value = c.name || '';
  document.getElementById('cf-phone').value = c.phone || '';
  document.getElementById('cf-notes').value = c.notes || '';

  form.classList.add('active');
  form.scrollTop = 0;
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

function normalizeProductName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function findProductByName(name) {
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) return null;
  return products.find(p => p.normalizedName === normalizedName) || null;
}

async function seedDefaultProducts() {
  if (products.length) return;
  const now = Date.now();
  for (const item of DEFAULT_PRODUCTS) {
    const product = {
      id: uid(),
      name: item.name,
      normalizedName: normalizeProductName(item.name),
      description: item.description || '',
      price: item.price || '',
      notes: '',
      createdAt: now,
      updatedAt: now
    };
    await dbPut('products', product);
    products.push(product);
  }
}

async function upsertProductFromOrder(order) {
  const normalizedName = normalizeProductName(order.product);
  if (!normalizedName) return order;

  let product = findProductByName(order.product);
  const now = Date.now();

  if (product) {
    product.lastOrderAt = now;
    product.updatedAt = now;
    await dbPut('products', product);
    products = products.map(p => p.id === product.id ? product : p);
    order.productId = product.id;
    order.product = product.name;
    return order;
  }

  product = {
    id: uid(),
    name: order.product,
    normalizedName,
    description: order.description || '',
    price: order.price || '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    lastOrderAt: now
  };

  await dbPut('products', product);
  products.push(product);
  order.productId = product.id;
  return order;
}

function refreshProductSelect(selectedId = '') {
  const select = document.getElementById('f-product-select');
  if (!select) return;

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  select.innerHTML = '<option value="">— Selecciona producto —</option>' + sorted.map(p => {
    const price = p.price ? ' · ' + String(p.price).replace('.', ',') + ' €' : '';
    return `<option value="${escHtml(p.id)}">${escHtml(p.name)}${price}</option>`;
  }).join('');

  if (selectedId) select.value = selectedId;
}

function syncProductFromSelect() {
  const select = document.getElementById('f-product-select');
  const priceInput = document.getElementById('f-price');
  const descInput = document.getElementById('f-description');
  if (!select) return null;

  const product = products.find(p => p.id === select.value) || null;
  if (product) {
    if (priceInput && product.price && !priceInput.value) priceInput.value = product.price;
    if (descInput && product.description && !descInput.value.trim()) descInput.value = product.description;
  }
  return product;
}

function renderProducts() {
  const input = document.getElementById('product-search');
  const list = document.getElementById('product-list');
  const countEl = document.getElementById('product-count');
  if (!list) return;

  const q = normalizeProductName(productSearch);
  let filtered = [...products];
  if (q) {
    filtered = filtered.filter(p =>
      p.normalizedName.includes(q) ||
      normalizeProductName(p.description).includes(q)
    );
  }

  filtered.sort((a, b) => (b.lastOrderAt || b.updatedAt || 0) - (a.lastOrderAt || a.updatedAt || 0));
  if (countEl) countEl.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`;
  if (input && input.value !== productSearch) input.value = productSearch;

  list.innerHTML = filtered.length
    ? filtered.map(productListCard).join('')
    : '<div class="empty-state"><div class="empty-icon">🏷️</div><div class="empty-title">Sin productos</div><div class="empty-desc">Crea tu primer producto para usarlo en pedidos</div></div>';
}

function productListCard(p) {
  const productOrders = orders.filter(o => o.productId === p.id || normalizeProductName(o.product) === p.normalizedName);
  const total = productOrders.reduce((sum, o) => sum + toNumber(o.paid || o.price), 0);
  const price = p.price ? `${String(p.price).replace('.', ',')} €` : 'Sin precio';
  return `<div class="client-card" onclick="openProductDetail('${p.id}')">
    <div class="client-avatar">🏷️</div>
    <div class="client-card-body">
      <div class="client-card-name">${escHtml(p.name)}</div>
      <div class="client-card-phone">${escHtml(price)}</div>
      <div class="client-card-meta">${productOrders.length} pedido${productOrders.length !== 1 ? 's' : ''} · ${total.toFixed(2).replace('.', ',')} €</div>
    </div>
    <span class="settings-item-arrow">›</span>
  </div>`;
}

function openProductDetail(id) {
  currentProduct = products.find(p => p.id === id);
  if (!currentProduct) return;
  renderProductDetail();
  document.getElementById('product-detail-view').classList.add('active');
}

function closeProductDetail() {
  document.getElementById('product-detail-view').classList.remove('active');
}

function renderProductDetail() {
  const p = currentProduct;
  const body = document.getElementById('product-detail-body');
  const title = document.getElementById('product-detail-title');
  if (!p || !body || !title) return;
  title.textContent = p.name;
  const productOrders = orders
    .filter(o => o.productId === p.id || normalizeProductName(o.product) === p.normalizedName)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const total = productOrders.reduce((sum, o) => sum + toNumber(o.paid || o.price), 0);
  body.innerHTML = `
    <div class="client-summary-card">
      <div class="client-summary-name">${escHtml(p.name)}</div>
      <div class="client-summary-phone">${p.price ? '💶 ' + escHtml(String(p.price).replace('.', ',')) + ' €' : 'Sin precio'}</div>
      ${p.description ? `<div class="client-summary-notes">${escHtml(p.description)}</div>` : ''}
      ${p.notes ? `<div class="client-summary-notes">${escHtml(p.notes)}</div>` : ''}
      <div class="client-summary-stats">
        <div><strong>${productOrders.length}</strong><span>Pedidos</span></div>
        <div><strong>${total.toFixed(2).replace('.', ',')} €</strong><span>Total</span></div>
      </div>
      <div class="client-summary-actions">
        <button class="modal-btn modal-btn-secondary" onclick="openEditProductForm('${p.id}')">Editar</button>
      </div>
    </div>
    <div class="section-title">Pedidos con este producto</div>
    <div class="order-list">
      ${productOrders.length ? productOrders.map(orderListCard).join('') : '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Sin pedidos</div></div>'}
    </div>`;
}

function openNewProductForm(returnToOrderForm = false) {
  editingProductId = null;
  orderFormReturnAfterProduct = !!returnToOrderForm;
  document.getElementById('product-form-title').textContent = 'Nuevo producto';
  document.getElementById('pf-name').value = '';
  document.getElementById('pf-description').value = '';
  document.getElementById('pf-price').value = '';
  document.getElementById('pf-notes').value = '';
  document.getElementById('product-form-view').classList.add('active');
}

function openEditProductForm(id) {
  const p = products.find(x => x.id === id) || currentProduct;
  if (!p) return;
  editingProductId = p.id;
  orderFormReturnAfterProduct = false;
  document.getElementById('product-form-title').textContent = 'Editar producto';
  document.getElementById('pf-name').value = p.name || '';
  document.getElementById('pf-description').value = p.description || '';
  document.getElementById('pf-price').value = p.price || '';
  document.getElementById('pf-notes').value = p.notes || '';
  document.getElementById('product-form-view').classList.add('active');
}

function closeProductForm() {
  document.getElementById('product-form-view').classList.remove('active');
}

async function saveProductForm() {
  const name = document.getElementById('pf-name').value.trim();
  const description = document.getElementById('pf-description').value.trim();
  const price = document.getElementById('pf-price').value || '';
  const notes = document.getElementById('pf-notes').value.trim();
  if (!name) { showToast('Escribe el nombre del producto'); return; }

  const normalizedName = normalizeProductName(name);
  const now = Date.now();
  let existing = products.find(p => p.normalizedName === normalizedName && p.id !== editingProductId);

  if (existing) {
    existing.description = description || existing.description || '';
    existing.price = price || existing.price || '';
    existing.notes = notes || existing.notes || '';
    existing.updatedAt = now;
    await dbPut('products', existing);
    products = products.map(p => p.id === existing.id ? existing : p);
    refreshProductSelect(existing.id);
    showToast('Producto ya existía, actualizado');
    if (orderFormReturnAfterProduct) syncProductFromSelect();
    closeProductForm();
    renderProducts();
    return;
  }

  let product = editingProductId ? products.find(p => p.id === editingProductId) : null;
  if (product) {
    product.name = name;
    product.normalizedName = normalizedName;
    product.description = description;
    product.price = price;
    product.notes = notes;
    product.updatedAt = now;
  } else {
    product = { id: uid(), name, normalizedName, description, price, notes, createdAt: now, updatedAt: now, lastOrderAt: null };
  }

  await dbPut('products', product);
  if (editingProductId) products = products.map(p => p.id === product.id ? product : p);
  else products.push(product);

  refreshProductSelect(product.id);
  if (orderFormReturnAfterProduct) syncProductFromSelect();
  closeProductForm();
  showToast(editingProductId ? 'Producto actualizado' : 'Producto creado ✓');
  renderProducts();
  if (currentProduct?.id === product.id) { currentProduct = product; renderProductDetail(); }
}

async function migrateOrdersToProducts() {
  await seedDefaultProducts();
  for (const order of orders) {
    if (order.productId && products.some(p => p.id === order.productId)) continue;
    await upsertProductFromOrder(order);
    await dbPut('orders', order);
  }
  products = await dbGetAll('products');
  providers = await dbGetAll('providers');
  expenses = await dbGetAll('expenses');
}


// ─── RENDER STATS ────────────────────────────────────
function getSalesOrders() {
  return orders.filter(o => o.status !== 'idea' && o.status !== 'seguimiento');
}

function getOrderDateValue(order) {
  return order.createdAt || Date.parse(order.deliveryDate || '') || 0;
}

function isOrderInStatsRange(order) {
  if (statsRange === 'all') return true;
  const t = getOrderDateValue(order);
  if (!t) return false;
  const d = new Date(t);
  const now = new Date();

  if (statsRange === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  if (statsRange === 'year') {
    return d.getFullYear() === now.getFullYear();
  }

  if (statsRange === '30') {
    const limit = new Date();
    limit.setDate(limit.getDate() - 30);
    return d >= limit;
  }

  return true;
}

function formatMoney(value) {
  return `${toNumber(value).toFixed(2).replace('.', ',')} €`;
}

function getClientNameById(id, fallback = '') {
  return clients.find(c => c.id === id)?.name || fallback || 'Sin cliente';
}

function getProductNameById(id, fallback = '') {
  return products.find(p => p.id === id)?.name || fallback || 'Sin producto';
}

function buildRanking(filteredOrders, type = 'client') {
  const map = new Map();

  filteredOrders.forEach(o => {
    const id = type === 'client' ? (o.clientId || normalizeClientName(o.client)) : (o.productId || normalizeProductName(o.product));
    const name = type === 'client' ? getClientNameById(o.clientId, o.client) : getProductNameById(o.productId, o.product);
    if (!id) return;

    if (!map.has(id)) {
      map.set(id, { id, name, count: 0, invoiced: 0, paid: 0, pending: 0 });
    }

    const row = map.get(id);
    const price = toNumber(o.price);
    const paid = toNumber(o.paid);
    row.count += 1;
    row.invoiced += price;
    row.paid += paid;
    row.pending += Math.max(price - paid, 0);
  });

  return [...map.values()];
}

function rankingRow(row, type = 'client', mode = 'invoiced') {
  const amount = mode === 'count' ? `${row.count} pedido${row.count !== 1 ? 's' : ''}` : formatMoney(row.invoiced);
  const sub = mode === 'count' ? formatMoney(row.invoiced) : `${row.count} pedido${row.count !== 1 ? 's' : ''}`;
  const click = type === 'client' && clients.some(c => c.id === row.id)
    ? `onclick="openClientDetail('${row.id}')"`
    : type === 'product' && products.some(p => p.id === row.id)
      ? `onclick="openProductDetail('${row.id}')"`
      : '';

  return `<div class="stats-ranking-row" ${click}>
    <div class="stats-ranking-main">
      <div class="stats-ranking-name">${escHtml(row.name)}</div>
      <div class="stats-ranking-sub">${sub} · Cobrado ${formatMoney(row.paid)}</div>
    </div>
    <div class="stats-ranking-value">${amount}</div>
  </div>`;
}

function renderMonthlyEvolution(filteredOrders) {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('es-ES', { month: 'short' }), total: 0 });
  }

  filteredOrders.forEach(o => {
    const t = getOrderDateValue(o);
    if (!t) return;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const row = months.find(m => m.key === key);
    if (row) row.total += toNumber(o.price);
  });

  const max = Math.max(...months.map(m => m.total), 1);
  return months.map(m => {
    const w = Math.max(4, Math.round((m.total / max) * 100));
    return `<div class="stats-month-row">
      <div class="stats-month-label">${escHtml(m.label)}</div>
      <div class="stats-month-bar-wrap"><div class="stats-month-bar" style="width:${w}%"></div></div>
      <div class="stats-month-value">${formatMoney(m.total)}</div>
    </div>`;
  }).join('');
}

function renderPendingPayments(filteredOrders) {
  const pending = filteredOrders
    .map(o => ({ ...o, pendingAmount: Math.max(toNumber(o.price) - toNumber(o.paid), 0) }))
    .filter(o => o.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 10);

  if (!pending.length) {
    return '<div class="empty-state compact"><div class="empty-icon">✅</div><div class="empty-title">Sin cobros pendientes</div></div>';
  }

  return pending.map(o => `<div class="stats-ranking-row" onclick="openDetail('${o.id}')">
    <div class="stats-ranking-main">
      <div class="stats-ranking-name">${escHtml(o.client)}</div>
      <div class="stats-ranking-sub">${escHtml(o.product)} · Cobrado ${formatMoney(o.paid)}</div>
    </div>
    <div class="stats-ranking-value danger">${formatMoney(o.pendingAmount)}</div>
  </div>`).join('');
}

function setStatsRange(range) {
  statsRange = range;
  document.querySelectorAll('.stats-chip').forEach(c => c.classList.toggle('active', c.dataset.range === range));
  renderStats();
}

function getProviderName(id, fallback = '') {
  return providers.find(p => p.id === id)?.name || fallback || 'Sin proveedor';
}

function normalizeProviderName(name) {
  return normalizeClientName(name);
}

function findProviderByName(name) {
  const normalizedName = normalizeProviderName(name);
  if (!normalizedName) return null;
  return providers.find(p => p.normalizedName === normalizedName) || null;
}

async function saveProviderFromForm() {
  const id = document.getElementById('provider-id')?.value || '';
  const name = document.getElementById('provider-name')?.value.trim();
  if (!name) { showToast('Escribe el nombre del proveedor'); return; }

  const normalizedName = normalizeProviderName(name);
  const duplicate = providers.find(p => p.normalizedName === normalizedName && p.id !== id);
  if (duplicate) { showToast('Ese proveedor ya existe'); return; }

  const now = Date.now();
  const provider = {
    id: id || uid(),
    name,
    normalizedName,
    phone: document.getElementById('provider-phone')?.value.trim() || '',
    email: document.getElementById('provider-email')?.value.trim() || '',
    web: document.getElementById('provider-web')?.value.trim() || '',
    notes: document.getElementById('provider-notes')?.value.trim() || '',
    createdAt: providers.find(p => p.id === id)?.createdAt || now,
    updatedAt: now
  };

  await dbPut('providers', provider);
  providers = id ? providers.map(p => p.id === id ? provider : p) : [...providers, provider];
  showToast(id ? 'Proveedor actualizado' : 'Proveedor creado ✓');
  renderStats();
}

function providerOptionList(selectedId = '') {
  const opts = providers
    .slice()
    .sort((a,b) => a.name.localeCompare(b.name, 'es'))
    .map(p => `<option value="${escHtml(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${escHtml(p.name)}</option>`)
    .join('');
  return `<option value="">— Sin proveedor —</option>${opts}`;
}

function categoryOptionList(selected = '') {
  return EXPENSE_CATEGORIES.map(c => `<option value="${escHtml(c)}" ${c === selected ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
}

function normalizeInvoiceImportNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const clean = String(value).replace('€', '').replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

function pick(obj, keys, fallback = '') {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return fallback;
}

function normalizeInvoiceLine(line = {}) {
  const quantity = normalizeInvoiceImportNumber(pick(line, ['cantidad', 'qty', 'unidades', 'units'], 1)) || 0;
  const freeUnits = normalizeInvoiceImportNumber(pick(line, ['unidades_regaladas', 'regaladas', 'freeUnits', 'free_units', 'gratis'], 0));
  const unitPrice = normalizeInvoiceImportNumber(pick(line, ['precio_unitario', 'unitPrice', 'unit_price', 'precio', 'price'], 0));
  const discountPercent = normalizeInvoiceImportNumber(pick(line, ['descuento_porcentaje', 'discountPercent', 'discount_percent', 'dto_porcentaje'], 0));
  const discountAmount = normalizeInvoiceImportNumber(pick(line, ['descuento_importe', 'discountAmount', 'discount_amount', 'dto_importe'], 0));
  const subtotal = normalizeInvoiceImportNumber(pick(line, ['base_linea', 'subtotal', 'base', 'importe_base'], 0));
  const taxPercent = normalizeInvoiceImportNumber(pick(line, ['iva_porcentaje', 'taxPercent', 'tax_percent', 'iva'], 0));
  const taxAmount = normalizeInvoiceImportNumber(pick(line, ['iva_importe', 'taxAmount', 'tax_amount'], 0));
  const totalLine = normalizeInvoiceImportNumber(pick(line, ['total_linea', 'totalLine', 'total_line', 'importe', 'total'], 0));

  return {
    description: String(pick(line, ['descripcion', 'description', 'concepto', 'articulo', 'producto', 'name'], '')).trim(),
    reference: String(pick(line, ['referencia', 'reference', 'ref', 'sku', 'codigo'], '')).trim(),
    quantity,
    freeUnits,
    unitPrice,
    discountPercent,
    discountAmount,
    subtotal,
    taxPercent,
    taxAmount,
    totalLine,
    notes: String(pick(line, ['notas', 'notes', 'observaciones'], '')).trim()
  };
}

function normalizeInvoiceImportData(data = {}) {
  const linesSource = pick(data, ['lineas', 'lines', 'items', 'productos', 'articulos'], []);
  const invoiceLines = Array.isArray(linesSource) ? linesSource.map(normalizeInvoiceLine) : [];
  const lineTotal = invoiceLines.reduce((sum, line) => sum + normalizeInvoiceImportNumber(line.totalLine), 0);
  const amount = normalizeInvoiceImportNumber(pick(data, ['total', 'importe_total', 'amount', 'importe', 'total_factura'], lineTotal));

  return {
    providerName: String(pick(data, ['proveedor', 'provider', 'supplier', 'empresa'], '')).trim(),
    date: String(pick(data, ['fecha', 'date', 'fecha_factura'], today())).slice(0, 10),
    invoiceNumber: String(pick(data, ['numero_factura', 'factura', 'invoiceNumber', 'invoice_number', 'number', 'numero'], '')).trim(),
    category: String(pick(data, ['categoria', 'category'], 'Materiales')).trim() || 'Materiales',
    amount,
    subtotal: normalizeInvoiceImportNumber(pick(data, ['base_imponible', 'subtotal', 'base'], 0)),
    tax: normalizeInvoiceImportNumber(pick(data, ['iva', 'tax', 'impuestos'], 0)),
    discountTotal: normalizeInvoiceImportNumber(pick(data, ['descuento_total', 'discountTotal', 'discount_total'], 0)),
    notes: String(pick(data, ['notas', 'notes', 'observaciones'], '')).trim(),
    invoiceLines,
    rawImport: data
  };
}

async function upsertProviderFromName(name) {
  const providerName = String(name || '').trim();
  if (!providerName) return null;

  const normalizedName = normalizeProviderName(providerName);
  let provider = providers.find(p => p.normalizedName === normalizedName);
  if (provider) return provider;

  const now = Date.now();
  provider = {
    id: uid(),
    name: providerName,
    normalizedName,
    phone: '',
    email: '',
    web: '',
    notes: 'Creado automáticamente al importar factura',
    createdAt: now,
    updatedAt: now
  };

  await dbPut('providers', provider);
  providers = [...providers, provider];
  return provider;
}

function renderInvoiceLinesPreview(lines = []) {
  if (!Array.isArray(lines) || !lines.length) return '';
  return `<div class="invoice-lines-preview">
    <div class="section-title">Líneas de factura <span>${lines.length}</span></div>
    ${lines.map(line => `<div class="invoice-line-row">
      <div class="invoice-line-main">
        <div class="invoice-line-title">${escHtml(line.description || 'Artículo sin descripción')}</div>
        <div class="invoice-line-meta">
          ${line.reference ? `Ref. ${escHtml(line.reference)} · ` : ''}${line.quantity || 0} uds${line.freeUnits ? ` · ${line.freeUnits} regaladas` : ''}${line.discountPercent ? ` · dto ${line.discountPercent}%` : ''}${line.discountAmount ? ` · dto ${formatMoney(line.discountAmount)}` : ''}
        </div>
        ${line.notes ? `<div class="invoice-line-notes">${escHtml(line.notes)}</div>` : ''}
      </div>
      <div class="invoice-line-total">${formatMoney(line.totalLine)}</div>
    </div>`).join('')}
  </div>`;
}

function renderInvoiceImportForm() {
  const target = document.getElementById('business-extra-form');
  if (!target) return;
  target.innerHTML = `<div class="business-form-card">
    <div class="section-title">Importar factura desde ChatGPT</div>
    <div class="settings-warning" style="margin-bottom:12px">
      <span>💡</span>
      <span>Pega aquí el JSON que te devuelva ChatGPT al leer la foto de la factura. Se guardarán el proveedor, la factura/gasto y todas las líneas.</span>
    </div>
    <div class="form-field">
      <label class="form-label">JSON de factura</label>
      <textarea class="form-textarea invoice-json-textarea" id="invoice-import-json" placeholder='{"proveedor":"Brildor","fecha":"2026-06-04","numero_factura":"...","categoria":"Materiales","total":61.20,"lineas":[...]}'></textarea>
    </div>
    <button class="btn-full" onclick="importInvoiceJsonFromTextarea()">Importar factura</button>
  </div>`;
}

async function importInvoiceJsonFromTextarea() {
  const textarea = document.getElementById('invoice-import-json');
  const raw = textarea?.value.trim();
  if (!raw) { showToast('Pega el JSON de la factura'); return; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showToast('JSON no válido');
    return;
  }

  try {
    const data = normalizeInvoiceImportData(parsed);
    if (!data.providerName) { showToast('Falta proveedor'); return; }
    if (data.amount <= 0) { showToast('Falta importe total'); return; }

    const provider = await upsertProviderFromName(data.providerName);
    const now = Date.now();
    const expense = {
      id: uid(),
      providerId: provider?.id || '',
      providerName: provider?.name || data.providerName,
      date: data.date || today(),
      invoiceNumber: data.invoiceNumber,
      category: EXPENSE_CATEGORIES.includes(data.category) ? data.category : 'Materiales',
      amount: data.amount,
      subtotal: data.subtotal,
      tax: data.tax,
      discountTotal: data.discountTotal,
      notes: data.notes,
      photo: '',
      invoiceLines: data.invoiceLines,
      rawImport: data.rawImport,
      importedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await dbPut('expenses', expense);
    expenses = [...expenses, expense];
    showToast(`Factura importada ✓ · ${data.invoiceLines.length} líneas`);
    businessTab = 'gastos';
    renderStats();
  } catch (e) {
    console.error('Error importando factura:', e);
    showToast(e.message || 'No se pudo importar la factura');
  }
}

function renderProviderForm(provider = null) {
  return `<div class="business-form-card">
    <input type="hidden" id="provider-id" value="${escHtml(provider?.id || '')}">
    <div class="section-title">${provider ? 'Editar proveedor' : 'Nuevo proveedor'}</div>
    <div class="form-field"><label class="form-label">Nombre *</label><input class="form-input" id="provider-name" value="${escHtml(provider?.name || '')}" placeholder="Ej: Brildor"></div>
    <div class="form-row">
      <div class="form-field"><label class="form-label">Teléfono</label><input class="form-input" id="provider-phone" value="${escHtml(provider?.phone || '')}" type="tel"></div>
      <div class="form-field"><label class="form-label">Email</label><input class="form-input" id="provider-email" value="${escHtml(provider?.email || '')}" type="email"></div>
    </div>
    <div class="form-field"><label class="form-label">Web</label><input class="form-input" id="provider-web" value="${escHtml(provider?.web || '')}" placeholder="https://..."></div>
    <div class="form-field"><label class="form-label">Notas</label><textarea class="form-textarea" id="provider-notes">${escHtml(provider?.notes || '')}</textarea></div>
    <button class="btn-full" onclick="saveProviderFromForm()">Guardar proveedor</button>
  </div>`;
}

async function saveExpenseFromForm() {
  const amount = toNumber(document.getElementById('expense-amount')?.value);
  const date = document.getElementById('expense-date')?.value || today();
  const category = document.getElementById('expense-category')?.value || 'Otros';
  if (amount <= 0) { showToast('Introduce un importe'); return; }

  const fileInput = document.getElementById('expense-photo');
  let photo = '';
  const existingId = document.getElementById('expense-id')?.value || '';
  const existing = existingId ? expenses.find(e => e.id === existingId) : null;
  if (fileInput?.files?.[0]) {
    photo = await fileToDataUrl(fileInput.files[0]);
  } else {
    photo = existing?.photo || '';
  }

  const now = Date.now();
  let invoiceLines = existing?.invoiceLines || [];
  const linesRaw = document.getElementById('expense-lines-json')?.value.trim() || '';
  if (linesRaw) {
    try {
      const parsedLines = JSON.parse(linesRaw);
      if (Array.isArray(parsedLines)) invoiceLines = parsedLines.map(normalizeInvoiceLine);
    } catch (e) {
      showToast('Líneas JSON no válidas');
      return;
    }
  }

  const expense = {
    id: existingId || uid(),
    providerId: document.getElementById('expense-provider')?.value || '',
    providerName: getProviderName(document.getElementById('expense-provider')?.value || ''),
    date,
    invoiceNumber: document.getElementById('expense-invoice')?.value.trim() || '',
    category,
    amount,
    subtotal: toNumber(document.getElementById('expense-subtotal')?.value),
    tax: toNumber(document.getElementById('expense-tax')?.value),
    discountTotal: toNumber(document.getElementById('expense-discount')?.value),
    notes: document.getElementById('expense-notes')?.value.trim() || '',
    photo,
    invoiceLines,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  await dbPut('expenses', expense);
  expenses = existingId ? expenses.map(e => e.id === existingId ? expense : e) : [...expenses, expense];
  showToast(existingId ? 'Gasto actualizado' : 'Gasto registrado ✓');
  renderStats();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function deleteExpense(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await dbDelete('expenses', id);
  expenses = expenses.filter(e => e.id !== id);
  showToast('Gasto eliminado');
  renderStats();
}

async function deleteProvider(id) {
  if (expenses.some(e => e.providerId === id)) { showToast('Tiene gastos asociados'); return; }
  if (!confirm('¿Eliminar proveedor?')) return;
  await dbDelete('providers', id);
  providers = providers.filter(p => p.id !== id);
  showToast('Proveedor eliminado');
  renderStats();
}

function editProvider(id) {
  businessTab = 'proveedores';
  renderStats();
  setTimeout(() => {
    const p = providers.find(x => x.id === id);
    const target = document.getElementById('business-extra-form');
    if (target) target.innerHTML = renderProviderForm(p);
  }, 0);
}

function editExpense(id) {
  businessTab = 'gastos';
  renderStats();
  setTimeout(() => {
    const e = expenses.find(x => x.id === id);
    if (e) renderExpenseForm(e);
  }, 0);
}

function renderExpenseForm(expense = null) {
  const target = document.getElementById('business-extra-form');
  if (!target) return;
  target.innerHTML = `<div class="business-form-card">
    <input type="hidden" id="expense-id" value="${escHtml(expense?.id || '')}">
    <div class="section-title">${expense ? 'Editar gasto / factura' : 'Nuevo gasto / factura'}</div>
    <div class="form-row">
      <div class="form-field"><label class="form-label">Fecha</label><input class="form-input" id="expense-date" type="date" value="${escHtml(expense?.date || today())}"></div>
      <div class="form-field"><label class="form-label">Importe (€) *</label><input class="form-input" id="expense-amount" type="number" step="0.01" value="${escHtml(expense?.amount || '')}" placeholder="0.00"></div>
    </div>
    <div class="form-field"><label class="form-label">Proveedor</label><select class="form-select" id="expense-provider">${providerOptionList(expense?.providerId || '')}</select></div>
    <div class="form-row">
      <div class="form-field"><label class="form-label">Categoría</label><select class="form-select" id="expense-category">${categoryOptionList(expense?.category || 'Materiales')}</select></div>
      <div class="form-field"><label class="form-label">Nº factura</label><input class="form-input" id="expense-invoice" value="${escHtml(expense?.invoiceNumber || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label class="form-label">Base imponible</label><input class="form-input" id="expense-subtotal" type="number" step="0.01" value="${escHtml(expense?.subtotal || '')}" placeholder="0.00"></div>
      <div class="form-field"><label class="form-label">IVA</label><input class="form-input" id="expense-tax" type="number" step="0.01" value="${escHtml(expense?.tax || '')}" placeholder="0.00"></div>
    </div>
    <div class="form-field"><label class="form-label">Descuento total</label><input class="form-input" id="expense-discount" type="number" step="0.01" value="${escHtml(expense?.discountTotal || '')}" placeholder="0.00"></div>
    <div class="form-field"><label class="form-label">Foto factura</label><input class="form-input" id="expense-photo" type="file" accept="image/*"></div>
    ${expense?.photo ? `<div class="expense-photo-preview"><img src="${expense.photo}" onclick="viewPhoto('${expense.photo}')"></div>` : ''}
    ${renderInvoiceLinesPreview(expense?.invoiceLines || [])}
    <div class="form-field"><label class="form-label">Líneas de factura en JSON</label><textarea class="form-textarea invoice-lines-json" id="expense-lines-json" placeholder="Opcional. Pega aquí un array JSON de líneas si quieres editarlas.">${expense?.invoiceLines?.length ? escHtml(JSON.stringify(expense.invoiceLines, null, 2)) : ''}</textarea></div>
    <div class="form-field"><label class="form-label">Notas</label><textarea class="form-textarea" id="expense-notes">${escHtml(expense?.notes || '')}</textarea></div>
    <button class="btn-full" onclick="saveExpenseFromForm()">Guardar gasto</button>
  </div>`;
}

function setBusinessTab(tab) {
  businessTab = tab;
  renderStats();
}

function getBusinessOrders() {
  return getSalesOrders();
}

function isDateInCurrentMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function renderProviderRows() {
  if (!providers.length) return '<div class="empty-state compact"><div class="empty-title">Sin proveedores todavía</div></div>';
  return providers.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p => {
    const provExpenses = expenses.filter(e => e.providerId === p.id);
    const total = provExpenses.reduce((s,e)=>s+toNumber(e.amount),0);
    const last = provExpenses.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0]?.date;
    return `<div class="stats-ranking-row">
      <div class="stats-ranking-main">
        <div class="stats-ranking-name">${escHtml(p.name)}</div>
        <div class="stats-ranking-sub">${provExpenses.length} facturas · Última ${fmtDate(last)}</div>
      </div>
      <div class="stats-ranking-actions">
        <div class="stats-ranking-value">${formatMoney(total)}</div>
        <button class="mini-btn" onclick="editProvider('${p.id}')">Editar</button>
        <button class="mini-btn danger" onclick="deleteProvider('${p.id}')">Borrar</button>
      </div>
    </div>`;
  }).join('');
}

function renderExpenseRows(list = expenses) {
  const sorted = list.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!sorted.length) return '<div class="empty-state compact"><div class="empty-title">Sin gastos todavía</div></div>';
  return sorted.map(e => `<div class="stats-ranking-row">
    <div class="stats-ranking-main">
      <div class="stats-ranking-name">${escHtml(e.providerName || getProviderName(e.providerId))}</div>
      <div class="stats-ranking-sub">${fmtDate(e.date)} · ${escHtml(e.category || 'Otros')}${e.invoiceNumber ? ' · Fact. ' + escHtml(e.invoiceNumber) : ''}${e.invoiceLines?.length ? ' · ' + e.invoiceLines.length + ' líneas' : ''}${e.discountTotal ? ' · dto ' + formatMoney(e.discountTotal) : ''}</div>
    </div>
    <div class="stats-ranking-actions">
      ${e.photo ? `<button class="mini-btn" onclick="viewPhoto('${e.photo}')">Foto</button>` : ''}
      ${e.invoiceLines?.length ? `<button class="mini-btn" onclick="editExpense('${e.id}')">Líneas</button>` : ''}
      <div class="stats-ranking-value danger">${formatMoney(e.amount)}</div>
      <button class="mini-btn" onclick="editExpense('${e.id}')">Editar</button>
      <button class="mini-btn danger" onclick="deleteExpense('${e.id}')">Borrar</button>
    </div>
  </div>`).join('');
}

function renderCategorySummary(list = expenses) {
  const groups = {};
  list.forEach(e => {
    const k = e.category || 'Otros';
    groups[k] = (groups[k] || 0) + toNumber(e.amount);
  });
  const rows = Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  if (!rows.length) return '<div class="empty-state compact"><div class="empty-title">Sin categorías todavía</div></div>';
  return rows.map(([cat,total]) => `<div class="stats-month-row"><div class="stats-month-label">${escHtml(cat)}</div><div class="stats-month-bar-wrap"><div class="stats-month-bar expense" style="width:100%"></div></div><div class="stats-month-value">${formatMoney(total)}</div></div>`).join('');
}

function renderBusinessContent(filteredOrders, filteredExpenses) {
  const invoiced = filteredOrders.reduce((sum, o) => sum + toNumber(o.price), 0);
  const paid = filteredOrders.reduce((sum, o) => sum + toNumber(o.paid), 0);
  const pending = filteredOrders.reduce((sum, o) => sum + Math.max(toNumber(o.price) - toNumber(o.paid), 0), 0);
  const expenseTotal = filteredExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const profit = paid - expenseTotal;
  const monthOrders = getBusinessOrders().filter(o => isDateInCurrentMonth(o.createdAt));
  const monthExpenses = expenses.filter(e => isDateInCurrentMonth(e.date));
  const monthPaid = monthOrders.reduce((s,o)=>s+toNumber(o.paid),0);
  const monthInvoiced = monthOrders.reduce((s,o)=>s+toNumber(o.price),0);
  const monthPending = monthOrders.reduce((s,o)=>s+Math.max(toNumber(o.price)-toNumber(o.paid),0),0);
  const monthExpenseTotal = monthExpenses.reduce((s,e)=>s+toNumber(e.amount),0);

  if (businessTab === 'proveedores') {
    return `<div id="business-extra-form">${renderProviderForm()}</div><div class="section-title">Proveedores</div><div class="stats-card">${renderProviderRows()}</div>`;
  }

  if (businessTab === 'gastos') {
    return `<div id="business-extra-form"></div>
      <button class="btn-full" onclick="renderInvoiceImportForm()">🤖 Importar factura JSON</button>
      <button class="btn-full secondary" onclick="renderExpenseForm()">+ Añadir gasto / factura manual</button>
      <div class="section-title">Gastos y facturas</div><div class="stats-card">${renderExpenseRows()}</div>`;
  }

  return `
    <div class="stats-grid">
      <div class="stat-card accent-pink"><div class="stat-label">Facturado</div><div class="stat-number small">${formatMoney(invoiced)}</div></div>
      <div class="stat-card accent-teal"><div class="stat-label">Cobrado</div><div class="stat-number small">${formatMoney(paid)}</div></div>
      <div class="stat-card accent-amber"><div class="stat-label">Pendiente</div><div class="stat-number small">${formatMoney(pending)}</div></div>
      <div class="stat-card accent-purple"><div class="stat-label">Gastos</div><div class="stat-number small">${formatMoney(expenseTotal)}</div></div>
      <div class="stat-card accent-teal full-width"><div class="stat-label">Beneficio caja</div><div class="stat-number small">${formatMoney(profit)}</div><div class="stat-link">Cobrado menos gastos</div></div>
    </div>

    <div class="stats-card">
      <div class="section-title">Caja AlmaPrint · Este mes</div>
      <div class="business-cash-grid">
        <div><span>Facturado</span><strong>${formatMoney(monthInvoiced)}</strong></div>
        <div><span>Cobrado</span><strong>${formatMoney(monthPaid)}</strong></div>
        <div><span>Pendiente</span><strong>${formatMoney(monthPending)}</strong></div>
        <div><span>Gastos</span><strong>${formatMoney(monthExpenseTotal)}</strong></div>
        <div class="profit"><span>Beneficio caja</span><strong>${formatMoney(monthPaid - monthExpenseTotal)}</strong></div>
      </div>
    </div>

    <div class="section-title">Gastos por categoría</div>
    <div class="stats-card">${renderCategorySummary(filteredExpenses)}</div>

    <div class="section-title">Últimos gastos</div>
    <div class="stats-card">${renderExpenseRows(filteredExpenses.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8))}</div>
  `;
}

function renderStats() {
  const root = document.getElementById('stats-content');
  if (!root) return;

  const filtered = getSalesOrders().filter(isOrderInStatsRange);
  const filteredExpenses = expenses.filter(e => isOrderInStatsRange({ createdAt: e.date }));
  const invoiced = filtered.reduce((sum, o) => sum + toNumber(o.price), 0);
  const paid = filtered.reduce((sum, o) => sum + toNumber(o.paid), 0);
  const pending = filtered.reduce((sum, o) => sum + Math.max(toNumber(o.price) - toNumber(o.paid), 0), 0);
  const expenseTotal = filteredExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const avgTicket = filtered.length ? invoiced / filtered.length : 0;
  const delivered = filtered.filter(o => o.status === 'entregado').length;
  const paidPct = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0;

  const clientsByMoney = buildRanking(filtered, 'client').sort((a,b) => b.invoiced - a.invoiced).slice(0, 10);
  const clientsByCount = buildRanking(filtered, 'client').sort((a,b) => b.count - a.count || b.invoiced - a.invoiced).slice(0, 10);
  const productsByMoney = buildRanking(filtered, 'product').sort((a,b) => b.invoiced - a.invoiced).slice(0, 10);
  const productsByCount = buildRanking(filtered, 'product').sort((a,b) => b.count - a.count || b.invoiced - a.invoiced).slice(0, 10);

  const topClient = clientsByMoney[0]?.name || 'Todavía no hay datos';
  const topProduct = productsByCount[0]?.name || 'Todavía no hay datos';

  root.innerHTML = `
    <div class="stats-filter-scroll">
      <button class="stats-chip ${statsRange === 'all' ? 'active' : ''}" data-range="all" onclick="setStatsRange('all')">Todo</button>
      <button class="stats-chip ${statsRange === 'month' ? 'active' : ''}" data-range="month" onclick="setStatsRange('month')">Este mes</button>
      <button class="stats-chip ${statsRange === '30' ? 'active' : ''}" data-range="30" onclick="setStatsRange('30')">Últimos 30 días</button>
      <button class="stats-chip ${statsRange === 'year' ? 'active' : ''}" data-range="year" onclick="setStatsRange('year')">Este año</button>
    </div>

    <div class="business-tabs">
      <button class="business-tab ${businessTab === 'resumen' ? 'active' : ''}" onclick="setBusinessTab('resumen')">Resumen</button>
      <button class="business-tab ${businessTab === 'ventas' ? 'active' : ''}" onclick="setBusinessTab('ventas')">Ventas</button>
      <button class="business-tab ${businessTab === 'proveedores' ? 'active' : ''}" onclick="setBusinessTab('proveedores')">Proveedores</button>
      <button class="business-tab ${businessTab === 'gastos' ? 'active' : ''}" onclick="setBusinessTab('gastos')">Gastos</button>
    </div>

    ${businessTab === 'ventas' ? `
      <div class="stats-grid">
        <div class="stat-card accent-pink"><div class="stat-label">Facturado</div><div class="stat-number small">${formatMoney(invoiced)}</div></div>
        <div class="stat-card accent-teal"><div class="stat-label">Cobrado</div><div class="stat-number small">${formatMoney(paid)}</div></div>
        <div class="stat-card accent-amber"><div class="stat-label">Pendiente</div><div class="stat-number small">${formatMoney(pending)}</div></div>
        <div class="stat-card accent-purple"><div class="stat-label">Ticket medio</div><div class="stat-number small">${formatMoney(avgTicket)}</div></div>
      </div>

      <div class="stats-insights">
        <div><strong>${filtered.length}</strong><span>Pedidos</span></div>
        <div><strong>${delivered}</strong><span>Entregados</span></div>
        <div><strong>${paidPct}%</strong><span>Cobrado</span></div>
      </div>

      <div class="stats-card">
        <div class="section-title">AlmaPrint Insights</div>
        <div class="insight-line">🏆 Mejor cliente: <strong>${escHtml(topClient)}</strong></div>
        <div class="insight-line">📦 Producto más vendido: <strong>${escHtml(topProduct)}</strong></div>
        <div class="insight-line">💰 Pendiente de cobro: <strong>${formatMoney(pending)}</strong></div>
      </div>

      <div class="section-title">Top clientes por facturación</div>
      <div class="stats-card">${clientsByMoney.length ? clientsByMoney.map(r => rankingRow(r, 'client', 'invoiced')).join('') : '<div class="empty-state compact"><div class="empty-title">Sin clientes todavía</div></div>'}</div>
      <div class="section-title">Top clientes por pedidos</div>
      <div class="stats-card">${clientsByCount.length ? clientsByCount.map(r => rankingRow(r, 'client', 'count')).join('') : '<div class="empty-state compact"><div class="empty-title">Sin clientes todavía</div></div>'}</div>
      <div class="section-title">Productos más vendidos</div>
      <div class="stats-card">${productsByCount.length ? productsByCount.map(r => rankingRow(r, 'product', 'count')).join('') : '<div class="empty-state compact"><div class="empty-title">Sin productos todavía</div></div>'}</div>
      <div class="section-title">Productos por facturación</div>
      <div class="stats-card">${productsByMoney.length ? productsByMoney.map(r => rankingRow(r, 'product', 'invoiced')).join('') : '<div class="empty-state compact"><div class="empty-title">Sin productos todavía</div></div>'}</div>
      <div class="section-title">Pendiente de cobro</div>
      <div class="stats-card">${renderPendingPayments(filtered)}</div>
      <div class="section-title">Evolución mensual</div>
      <div class="stats-card">${renderMonthlyEvolution(getSalesOrders())}</div>
    ` : renderBusinessContent(filtered, filteredExpenses)}

    <div style="height:16px"></div>
  `;
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
  const detailView = document.getElementById('detail-view');
  if (detailView) detailView.classList.remove('active');

  const target = detailReturnTarget;
  detailReturnTarget = null;

  if (target?.type === 'client') {
    openClientDetail(target.id);
    return;
  }

  if (target?.type === 'product') {
    openProductDetail(target.id);
  }
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

  if (currentView === 'kanban') {
    renderKanban();
  }

  if (currentView === 'list') {
    renderList();
  }

  if (currentView === 'dashboard') {
    renderDashboard();
  }

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
function getWhatsAppMessages() {
  const saved = localStorage.getItem('ap_wa_messages');

  if (!saved) {
    return { ...DEFAULT_WA_MESSAGES };
  }

  try {
    return { ...DEFAULT_WA_MESSAGES, ...JSON.parse(saved) };
  } catch {
    return { ...DEFAULT_WA_MESSAGES };
  }
}

function saveWhatsAppMessages(messages) {
  localStorage.setItem('ap_wa_messages', JSON.stringify(messages));
}
function sendWhatsApp(id) {
  const o = orders.find(x => x.id === id) || currentOrder;
  if (!o || !o.phone) { showToast('Sin teléfono'); return; }

const templates = getWhatsAppMessages();

  const stateKey = (o.status || 'seguimiento')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let tpl = templates[stateKey] || templates.seguimiento;

  const msg = tpl
    .replaceAll('{cliente}', o.client || '')
    .replaceAll('{producto}', o.product || '')
    .replaceAll('{estado}', o.status || '')
    .replaceAll('{fecha}', new Date().toLocaleDateString());

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
  refreshProductSelect(o.productId || findProductByName(o.product)?.id || '');
  syncProductFromSelect();
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
  ['f-phone','f-description',
   'f-delivery','f-followup','f-price','f-paid','f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-status').value = 'idea';
  document.getElementById('f-priority').value = 'Normal';
  document.getElementById('f-payment').value = 'no';
  const clientSelect = document.getElementById('f-client-select');
  if (clientSelect) clientSelect.value = '';
  const productSelect = document.getElementById('f-product-select');
  if (productSelect) productSelect.value = '';
  renderFormPhotos();
}

async function saveForm() {
  const selectedClientId = document.getElementById('f-client-select').value;
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const client = selectedClient?.name || '';
  const selectedProductId = document.getElementById('f-product-select').value;
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const product = selectedProduct?.name || '';

  if (!selectedClient) { showToast('Selecciona o crea un cliente'); return; }
  if (!selectedProduct) { showToast('Selecciona o crea un producto'); return; }

  const now = Date.now();
  const isEdit = !!editingOrderId;
  const existing = isEdit ? orders.find(o => o.id === editingOrderId) : null;

  const order = {
    id: isEdit ? editingOrderId : uid(),
    clientId: selectedClient.id,
    client: selectedClient.name,
    phone: selectedClient.phone || document.getElementById('f-phone').value.trim(),
    productId: selectedProduct.id,
    product: selectedProduct.name,
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
await upsertProductFromOrder(order);

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
  const data = { version: 7, appVersion: '1.5.4', exportedAt: new Date().toISOString(), orders, clients, products, providers, expenses };
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
      await dbClear('products');
      await dbClear('providers');
      await dbClear('expenses');
      orders = data.orders;
      clients = Array.isArray(data.clients) ? data.clients : [];
      products = Array.isArray(data.products) ? data.products : [];
      providers = Array.isArray(data.providers) ? data.providers : [];
      expenses = Array.isArray(data.expenses) ? data.expenses : [];
      for (const c of clients) await dbPut('clients', c);
      for (const p of products) await dbPut('products', p);
      for (const p of providers) await dbPut('providers', p);
      for (const e of expenses) await dbPut('expenses', e);
      for (const o of orders) {
        await upsertClientFromOrder(o);
        await upsertProductFromOrder(o);
        await dbPut('orders', o);
      }
      clients = await dbGetAll('clients');
      products = await dbGetAll('products');
      providers = await dbGetAll('providers');
      expenses = await dbGetAll('expenses');
  providers = await dbGetAll('providers');
  expenses = await dbGetAll('expenses');
      refreshClientSelect();
      refreshProductSelect();
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
  await dbClear('products');
  await dbClear('providers');
  await dbClear('expenses');
  orders = [];
  clients = [];
  products = [];
  providers = [];
  expenses = [];
  refreshClientSelect();
  refreshProductSelect();
  showToast('Todos los datos eliminados');
  showView('dashboard');
}

function editWAMessage() {
  const messages = getWhatsAppMessages();
  const labels = {
    idea: 'Idea / Cliente potencial',
    pendiente: 'Pedido pendiente',
    diseño: 'Diseño',
    aprobacion: 'Esperando aprobación',
    produccion: 'Producción',
    listo: 'Listo para entregar',
    entregado: 'Entregado',
    seguimiento: 'Seguimiento'
  };

  document.getElementById('wa-msg-edit').value = Object.keys(labels)
    .map(key => `### ${key} | ${labels[key]}\n${messages[key] || ''}`)
    .join('\n\n');

  document.getElementById('modal-wa-edit').classList.add('active');
}

function saveWAMessage() {
  const raw = document.getElementById('wa-msg-edit').value;
  const messages = { ...DEFAULT_WA_MESSAGES };

  const blocks = raw.split(/\n(?=### )/g);

  blocks.forEach(block => {
    const lines = block.trim().split('\n');
    const header = lines.shift() || '';
    const match = header.match(/^###\s*([^|]+)\|?/);
    if (!match) return;

    const key = match[1].trim();
    if (!messages[key]) return;

    messages[key] = lines.join('\n').trim();
  });

  saveWhatsAppMessages(messages);
  closeModal('modal-wa-edit');
  showToast('Mensajes WhatsApp guardados');
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
  products = await dbGetAll('products');
  providers = await dbGetAll('providers');
  expenses = await dbGetAll('expenses');

  await migrateOrdersToClients();
  await migrateOrdersToProducts();
  refreshClientSelect();
  refreshProductSelect();
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

  const productSelect = document.getElementById('f-product-select');
  if (productSelect) productSelect.addEventListener('change', syncProductFromSelect);

  const clientSearchInput = document.getElementById('client-search');
  if (clientSearchInput) clientSearchInput.addEventListener('input', e => {
    clientSearch = e.target.value;
    renderClients();
  });

  const productSearchInput = document.getElementById('product-search');
  if (productSearchInput) productSearchInput.addEventListener('input', e => {
    productSearch = e.target.value;
    renderProducts();
  });
}
document.addEventListener('DOMContentLoaded', init);
