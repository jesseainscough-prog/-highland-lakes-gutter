import { db } from './supabase-client.js?v=3';

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value || 0));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
})[character]);

let quotes = [];
let selectedId = null;

$('#setup-panel').hidden = true;
start();

async function start() {
  db.auth.onAuthStateChange(async (event, newSession) => {
    if (event === 'PASSWORD_RECOVERY') {
      showRecovery();
      return;
    }
    if (!newSession) showLogin();
  });

  const { data: { session } } = await db.auth.getSession();
  if (location.hash.includes('type=recovery')) showRecovery();
  else if (session) await enterPortal(session);
  else $('#login-panel').hidden = false;
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $('#login-message').textContent = '';
  const { data, error } = await db.auth.signInWithPassword({
    email: $('#login-email').value.trim(),
    password: $('#login-password').value
  });
  button.disabled = false;
  if (error) {
    $('#login-message').textContent = error.message;
    return;
  }
  await enterPortal(data.session);
});

$('#reset-password').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  if (!email) {
    $('#login-message').textContent = 'Enter the owner email first.';
    return;
  }
  const redirectTo = new URL('owner.html', location.href).href;
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  $('#login-message').textContent = error ? error.message : 'Check that email for a password reset link.';
});

$('#recovery-form').addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('#new-password').value;
  if (password !== $('#confirm-password').value) {
    $('#recovery-message').textContent = 'The passwords do not match.';
    return;
  }
  const { data, error } = await db.auth.updateUser({ password });
  if (error) {
    $('#recovery-message').textContent = error.message;
    return;
  }
  history.replaceState(null, '', location.pathname);
  $('#recovery-panel').hidden = true;
  await enterPortal(data.user ? { user: data.user } : (await db.auth.getSession()).data.session);
});

$('#sign-out').addEventListener('click', () => db.auth.signOut());
$('#refresh').addEventListener('click', loadQuotes);
$('#status-filter').addEventListener('change', renderList);
$('#owner-modal').addEventListener('click', event => {
  if (event.target.id === 'owner-modal' || event.target.closest('[data-close-modal]')) closeModal();
});

async function enterPortal(session) {
  const { data: profile, error } = await db
    .from('profiles')
    .select('role,display_name')
    .eq('id', session.user.id)
    .single();

  if (error || profile?.role !== 'owner') {
    await db.auth.signOut();
    $('#login-message').textContent = 'This account is not approved for owner access.';
    showLogin();
    return;
  }

  $('#login-panel').hidden = true;
  $('#portal').hidden = false;
  $('#sign-out').hidden = false;
  $('#owner-email').textContent = profile.display_name || session.user.email;
  await loadQuotes();
}

function showLogin() {
  $('#portal').hidden = true;
  $('#recovery-panel').hidden = true;
  $('#sign-out').hidden = true;
  $('#owner-email').textContent = '';
  $('#login-panel').hidden = false;
}

function showRecovery() {
  $('#login-panel').hidden = true;
  $('#portal').hidden = true;
  $('#recovery-panel').hidden = false;
}

async function loadQuotes() {
  $('#job-list').innerHTML = '<p class="empty-state">Loading…</p>';
  const { data, error } = await db.from('quotes').select('*').order('created_at', { ascending: false });
  if (error) {
    $('#job-list').innerHTML = '<p class="empty-state">Unable to load records.</p>';
    console.error(error);
    return;
  }
  quotes = data || [];
  renderMetrics();
  renderList();
  if (selectedId) {
    const current = quotes.find(quote => quote.id === selectedId);
    if (current) renderDetail(current);
  }
}

function projectTotal(quote) {
  return Number(quote.final_total ?? quote.estimated_total ?? 0);
}

function amountPaid(quote) {
  const recorded = Number(quote.amount_paid || 0);
  const confirmedDeposit = quote.deposit_status === 'paid' ? Number(quote.deposit_amount || 0) : 0;
  return Math.max(recorded, confirmedDeposit);
}

function renderMetrics() {
  const active = quotes.filter(quote => !['completed', 'cancelled'].includes(quote.status));
  const paid = quotes.filter(quote => quote.deposit_status === 'paid');
  $('#metric-open').textContent = active.filter(quote => ['new', 'quoted', 'deposit_pending'].includes(quote.status)).length;
  $('#metric-deposits').textContent = money(quotes.reduce((sum, quote) => sum + amountPaid(quote), 0));
  $('#metric-feet').textContent = `${active.filter(quote => quote.status === 'scheduled').reduce((sum, quote) => sum + Number(quote.estimated_feet || 0), 0)} ft`;
  $('#metric-jobs').textContent = paid.length;
}

function renderList() {
  const filter = $('#status-filter').value;
  const visible = filter === 'all' ? quotes : quotes.filter(quote => quote.status === filter);
  if (!visible.length) {
    $('#job-list').innerHTML = '<p class="empty-state">No records in this view.</p>';
    return;
  }

  $('#job-list').innerHTML = visible.map(quote => {
    const date = new Date(quote.created_at);
    const badge = quote.deposit_status === 'paid' ? 'Deposit paid' : statusLabel(quote.status);
    return `<button class="owner-job ${quote.id === selectedId ? 'selected' : ''}" data-id="${quote.id}">
      <span class="job-date">${date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}<br><b>${date.getDate()}</b></span>
      <span class="job-main"><b>${esc(quote.customer_name)}</b><small>${esc(quote.city)} • ${quote.estimated_feet} ft • ${quote.gutter_size}-inch</small></span>
      <span class="job-meta"><b>${money(projectTotal(quote))}</b><em class="${quote.deposit_status === 'paid' ? 'paid' : quote.status === 'deposit_pending' ? 'pending' : ''}">${esc(badge)}</em></span>
    </button>`;
  }).join('');

  document.querySelectorAll('.owner-job').forEach(button => button.addEventListener('click', () => {
    selectedId = button.dataset.id;
    renderList();
    renderDetail(quotes.find(quote => quote.id === selectedId));
    if (innerWidth < 850) $('#detail-panel').scrollIntoView({ behavior: 'smooth' });
  }));
}

function statusLabel(status) {
  return ({
    new: 'New request',
    quoted: 'Quoted',
    deposit_pending: 'Deposit pending',
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled'
  })[status] || status;
}

function renderDetail(quote) {
  const paid = amountPaid(quote);
  const balance = Math.max(projectTotal(quote) - paid, 0);
  $('#detail-panel').innerHTML = `
    <p class="eyebrow">${esc(statusLabel(quote.status))}</p>
    <h2>${esc(quote.customer_name)}</h2>
    <p class="detail-contact"><a href="tel:${esc(quote.phone)}">${esc(quote.phone)}</a> • <a href="mailto:${esc(quote.email)}">${esc(quote.email)}</a><br>${esc(quote.address)}, ${esc(quote.city)}</p>
    <div class="detail-summary">
      <div><span>System</span><b>${quote.gutter_size}-inch • ${quote.estimated_feet} ft</b></div>
      <div><span>Project total</span><b>${money(projectTotal(quote))}</b></div>
      <div><span>Paid</span><b>${money(paid)} • ${esc(quote.last_payment_method || quote.deposit_status)}</b></div>
      <div><span>Balance</span><b>${money(balance)}</b></div>
      <div><span>Deposit due</span><b>${money(quote.deposit_amount)} • ${esc(quote.deposit_status)}</b></div>
      <div><span>Requested visit</span><b>${esc(quote.requested_visit || 'Not selected')}</b></div>
    </div>
    <div class="payment-actions">
      <button type="button" id="send-payment" class="primary">Send payment link</button>
      <button type="button" id="record-payment" class="secondary">Record cash/check</button>
      <button type="button" id="open-payment" class="text-btn">Open secure card page</button>
    </div>
    <form id="edit-quote" class="edit-form">
      <label>Status<select id="edit-status">${['new', 'quoted', 'deposit_pending', 'scheduled', 'completed', 'cancelled'].map(status => `<option value="${status}" ${quote.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label>
      <label>Final project total<input id="edit-total" type="number" min="0" step="0.01" value="${projectTotal(quote)}"></label>
      <label>Installation date<input id="edit-date" type="date" value="${quote.scheduled_date || ''}"></label>
      <label>Crew plan<select id="edit-crew"><option value="2 owners" ${quote.crew_plan === '2 owners' ? 'selected' : ''}>2 owners</option><option value="2 owners + 1 day labor" ${quote.crew_plan === '2 owners + 1 day labor' ? 'selected' : ''}>2 owners + 1 day labor</option><option value="2 owners + 2 day labor" ${quote.crew_plan === '2 owners + 2 day labor' ? 'selected' : ''}>2 owners + 2 day labor</option></select></label>
      <label>Owner notes<textarea id="edit-notes">${esc(quote.notes || '')}</textarea></label>
      <div class="detail-actions"><button type="submit" class="primary full-row">Save changes</button></div>
      <p id="save-message" class="form-message"></p>
    </form>`;

  $('#edit-quote').addEventListener('submit', event => saveQuote(event, quote.id));
  $('#send-payment').addEventListener('click', () => showSendPayment(quote));
  $('#record-payment').addEventListener('click', () => showRecordPayment(quote));
  $('#open-payment').addEventListener('click', () => window.open(paymentUrl(quote.id), '_blank'));
}

async function saveQuote(event, id) {
  event.preventDefault();
  const values = {
    status: $('#edit-status').value,
    final_total: Number($('#edit-total').value),
    scheduled_date: $('#edit-date').value || null,
    crew_plan: $('#edit-crew').value,
    notes: $('#edit-notes').value.trim()
  };
  const { error } = await db.from('quotes').update(values).eq('id', id);
  $('#save-message').textContent = error ? error.message : 'Saved.';
  if (!error) {
    toast('Quote updated');
    await loadQuotes();
  }
}

function paymentUrl(id) {
  return new URL(`pay.html?id=${id}`, location.href).href;
}

function showSendPayment(quote) {
  const url = paymentUrl(quote.id);
  const firstName = String(quote.customer_name || '').trim().split(/\s+/)[0] || 'there';
  const message = `Hi ${firstName}, here is your secure Highland Lakes Seamless Rain Gutter payment link: ${url}`;
  openModal(`
    <p class="eyebrow">Customer payment</p>
    <h2 id="owner-modal-title">Send payment link</h2>
    <p>Choose how to send the secure deposit page to ${esc(quote.customer_name)}.</p>
    <div class="send-choice">
      <button type="button" id="send-text" class="primary">Text ${esc(quote.phone)}</button>
      <button type="button" id="send-email" class="secondary">Email ${esc(quote.email)}</button>
      <button type="button" id="copy-payment" class="text-btn">Copy link instead</button>
    </div>`);

  $('#send-text').addEventListener('click', () => {
    const phone = String(quote.phone || '').replace(/[^\d+]/g, '');
    location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
  });
  $('#send-email').addEventListener('click', () => {
    const subject = 'Your Highland Lakes gutter payment link';
    location.href = `mailto:${quote.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  });
  $('#copy-payment').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Payment link copied');
      closeModal();
    } catch {
      $('#owner-modal-message').textContent = 'Your browser could not copy the link. Use Text or Email instead.';
    }
  });
}

function showRecordPayment(quote) {
  const paid = amountPaid(quote);
  const depositRemaining = Math.max(Number(quote.deposit_amount || 0) - paid, 0);
  const fullRemaining = Math.max(projectTotal(quote) - paid, 0);
  const defaultScope = depositRemaining > 0 ? 'deposit' : 'full';
  const defaultAmount = defaultScope === 'deposit' ? depositRemaining : fullRemaining;

  openModal(`
    <p class="eyebrow">Offline payment</p>
    <h2 id="owner-modal-title">Record cash or check</h2>
    <p>Use this after payment is in hand. A full payment closes the job when the entire balance is recorded.</p>
    <form id="record-payment-form" class="modal-form">
      <label>Payment applies to<select id="payment-scope"><option value="deposit" ${defaultScope === 'deposit' ? 'selected' : ''}>Deposit</option><option value="full" ${defaultScope === 'full' ? 'selected' : ''}>Remaining balance / close job</option></select></label>
      <label>Payment method<select id="payment-method"><option value="cash">Cash</option><option value="check">Check</option></select></label>
      <label>Amount received<input id="payment-amount" type="number" min="0.01" step="0.01" value="${defaultAmount.toFixed(2)}" required></label>
      <label>Check number or reference <span class="optional">(optional)</span><input id="payment-reference" type="text" maxlength="100"></label>
      <label>Payment note <span class="optional">(optional)</span><textarea id="payment-note" maxlength="500"></textarea></label>
      <button type="submit" class="primary full">Record payment</button>
    </form>`);

  $('#payment-scope').addEventListener('change', event => {
    $('#payment-amount').value = (event.target.value === 'deposit' ? depositRemaining : fullRemaining).toFixed(2);
  });
  $('#record-payment-form').addEventListener('submit', event => recordPayment(event, quote.id));
}

async function recordPayment(event, quoteId) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  button.textContent = 'Recording…';
  $('#owner-modal-message').textContent = '';

  const { error } = await db.rpc('record_manual_payment', {
    p_quote_id: quoteId,
    p_amount: Number($('#payment-amount').value),
    p_method: $('#payment-method').value,
    p_reference: $('#payment-reference').value.trim() || null,
    p_notes: $('#payment-note').value.trim() || null,
    p_payment_scope: $('#payment-scope').value
  });

  if (error) {
    button.disabled = false;
    button.textContent = 'Record payment';
    $('#owner-modal-message').textContent = error.message.includes('record_manual_payment')
      ? 'The payment database upgrade still needs to be run in Supabase.'
      : error.message;
    return;
  }

  closeModal();
  toast('Payment recorded');
  await loadQuotes();
}

function openModal(content) {
  $('#owner-modal-content').innerHTML = content;
  $('#owner-modal-message').textContent = '';
  $('#owner-modal').hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal() {
  $('#owner-modal').hidden = true;
  $('#owner-modal-content').innerHTML = '';
  document.body.classList.remove('modal-open');
}

function toast(message) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.appendChild(element);
  setTimeout(() => element.remove(), 2200);
}
