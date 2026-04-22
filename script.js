/* ══════════════════════════════════════════════════════════════════════════
   Flash Sale Order Queue Management System – script.js
   ══════════════════════════════════════════════════════════════════════════ */

const API = '';  // Same origin – Flask serves everything

// ── DOM References ──────────────────────────────────────────────────────────
const $orderId       = document.getElementById('orderId');
const $customerName  = document.getElementById('customerName');
const $orderType     = document.getElementById('orderType');

const $normalList    = document.getElementById('normalList');
const $vipList       = document.getElementById('vipList');
const $stackList     = document.getElementById('stackList');
const $normalCount   = document.getElementById('normalCount');
const $vipCount      = document.getElementById('vipCount');
const $stackCount    = document.getElementById('stackCount');

const $lookupInput   = document.getElementById('lookupInput');
const $lookupResult  = document.getElementById('lookupResult');
const $logList       = document.getElementById('logList');
const $toast         = document.getElementById('toast');

let toastTimer = null;

// ── Toast Notification ──────────────────────────────────────────────────────
function showToast(message, dsUsed, color = 'blue') {
  clearTimeout(toastTimer);
  $toast.className = `toast toast-${color} show`;
  $toast.innerHTML = `${message}${dsUsed ? `<span class="ds-tag">📦 ${dsUsed}</span>` : ''}`;
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 3500);
}

function showError(msg) { showToast(msg, null, 'error'); }

// ── Highlight active card briefly ───────────────────────────────────────────
function highlightCard(cardClass) {
  const card = document.querySelector(`.ds-card.${cardClass}`);
  if (!card) return;
  card.classList.add('active-op');
  setTimeout(() => card.classList.remove('active-op'), 1200);
}

// ── Render helpers ──────────────────────────────────────────────────────────
function renderList(ul, items, emptyText) {
  if (!items || items.length === 0) {
    ul.innerHTML = `<li class="empty-msg">${emptyText}</li>`;
    return;
  }
  ul.innerHTML = items.map((o, i) => `
    <li class="highlight-add" style="animation-delay:${i * .04}s">
      <span>
        <span class="order-id">#${o.id}</span>
        <span class="customer"> – ${o.customer}</span>
      </span>
      <span class="customer">${o.type.toUpperCase()}</span>
    </li>
  `).join('');
}

function renderStack(ul, items) {
  if (!items || items.length === 0) {
    ul.innerHTML = `<li class="empty-msg">No processed orders yet</li>`;
    return;
  }
  // Show most recent on top
  const reversed = [...items].reverse();
  ul.innerHTML = reversed.map((o, i) => `
    <li class="highlight-add" style="animation-delay:${i * .04}s">
      <span>
        <span class="order-id">#${o.id}</span>
        <span class="customer"> – ${o.customer}</span>
      </span>
      <span class="customer">${o.type.toUpperCase()}</span>
    </li>
  `).join('');
}

function updateUI(data) {
  if (!data) return;

  renderList($normalList, data.normalQueue, 'Queue is empty');
  renderList($vipList,    data.vipQueue,    'No VIP orders');
  renderStack($stackList, data.historyStack);

  $normalCount.textContent = data.normalQueue  ? data.normalQueue.length  : 0;
  $vipCount.textContent    = data.vipQueue     ? data.vipQueue.length     : 0;
  $stackCount.textContent  = data.historyStack ? data.historyStack.length : 0;

  // Update log
  if (data.log) {
    $logList.innerHTML = [...data.log].reverse().map(entry =>
      `<div class="log-entry">${entry}</div>`
    ).join('');
    $logList.scrollTop = 0;
  }
}

// ── API Calls ───────────────────────────────────────────────────────────────
async function addOrder() {
  const orderId      = $orderId.value.trim();
  const customerName = $customerName.value.trim();
  const type         = $orderType.value;

  if (!orderId)      return showError('Please enter an Order ID');
  if (!customerName) return showError('Please enter a Customer Name');

  try {
    const res = await fetch(`${API}/add_order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, customerName, type }),
    });
    const data = await res.json();

    if (!res.ok) return showError(data.error || 'Failed to add order');

    updateUI(data);

    const color = type === 'vip' ? 'red' : 'blue';
    showToast(data.message, data.dsUsed, color);
    highlightCard(type === 'vip' ? 'priority' : 'queue');

    $orderId.value = '';
    $customerName.value = '';
    $orderId.focus();
  } catch (err) {
    showError('Network error – is the server running?');
  }
}

async function addVipOrder() {
  $orderType.value = 'vip';
  await addOrder();
}

async function processOrder() {
  try {
    const res  = await fetch(`${API}/process_order`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) return showError(data.error || 'Nothing to process');

    updateUI(data);
    showToast(`Processed #${data.processed.id}`, data.dsUsed, 'green');
    highlightCard('stack');
  } catch (err) {
    showError('Network error');
  }
}

async function undoOrder() {
  try {
    const res  = await fetch(`${API}/undo`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) return showError(data.error || 'Nothing to undo');

    updateUI(data);
    showToast(data.message, data.dsUsed, 'yellow');
    highlightCard('stack');
  } catch (err) {
    showError('Network error');
  }
}

async function lookupOrder() {
  const id = $lookupInput.value.trim();
  if (!id) return showError('Enter an Order ID to search');

  try {
    const res  = await fetch(`${API}/lookup/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!res.ok) {
      $lookupResult.classList.add('visible');
      $lookupResult.innerHTML = `<span style="color:var(--red);">⚠ ${data.error}</span>`;
      highlightCard('hash');
      return;
    }

    const o = data.order;
    $lookupResult.classList.add('visible');
    $lookupResult.innerHTML = `
      <div><span class="label">Order ID:</span> <span class="value">#${o.id}</span></div>
      <div><span class="label">Customer:</span> <span class="value">${o.customer}</span></div>
      <div><span class="label">Type:</span> <span class="value">${o.type.toUpperCase()}</span></div>
      <div><span class="label">Status:</span> <span class="status-badge ${o.status}">${o.status}</span></div>
      <div><span class="label">Added at:</span> <span class="value">${o.timestamp}</span></div>
      <div style="margin-top:6px;font-size:.72rem;color:var(--text-dim);">📦 ${data.dsUsed}</div>
    `;

    highlightCard('hash');
    showToast(`Found Order #${o.id}`, data.dsUsed, 'yellow');
  } catch (err) {
    showError('Network error');
  }
}

// ── Enter-key shortcuts ─────────────────────────────────────────────────────
$orderId.addEventListener('keydown', e => { if (e.key === 'Enter') addOrder(); });
$customerName.addEventListener('keydown', e => { if (e.key === 'Enter') addOrder(); });
$lookupInput.addEventListener('keydown', e => { if (e.key === 'Enter') lookupOrder(); });

// ── Initial state from server ───────────────────────────────────────────────
(async function init() {
  try {
    const res  = await fetch(`${API}/status`);
    const data = await res.json();
    updateUI(data);
  } catch (_) { /* server not ready yet */ }
})();