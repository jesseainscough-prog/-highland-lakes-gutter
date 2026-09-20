import { db, isConfigured } from './supabase-client.js?v=3';

const $=s=>document.querySelector(s);const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let quotes=[];let selectedId=null;

$('#setup-panel').hidden=true;start();

async function start(){
  db.auth.onAuthStateChange(async(event,newSession)=>{if(event==='PASSWORD_RECOVERY'){showRecovery();return}if(!newSession)showLogin()});
  const {data:{session}}=await db.auth.getSession();
  if(location.hash.includes('type=recovery'))showRecovery();else if(session) await enterPortal(session); else $('#login-panel').hidden=false;
}

$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-message').textContent='';const {data,error}=await db.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});button.disabled=false;if(error){$('#login-message').textContent=error.message;return}await enterPortal(data.session)});
$('#reset-password').addEventListener('click',async()=>{const email=$('#login-email').value.trim();if(!email){$('#login-message').textContent='Enter the owner email first.';return}const redirectTo=new URL('owner.html',location.href).href;const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});$('#login-message').textContent=error?error.message:'Check that email for a password reset link.'});
$('#recovery-form').addEventListener('submit',async e=>{e.preventDefault();const password=$('#new-password').value;if(password!==$('#confirm-password').value){$('#recovery-message').textContent='The passwords do not match.';return}const {data,error}=await db.auth.updateUser({password});if(error){$('#recovery-message').textContent=error.message;return}history.replaceState(null,'',location.pathname);$('#recovery-panel').hidden=true;await enterPortal(data.user?{user:data.user}:(await db.auth.getSession()).data.session)});
$('#sign-out').addEventListener('click',()=>db.auth.signOut());$('#refresh').addEventListener('click',loadQuotes);$('#status-filter').addEventListener('change',renderList);

async function enterPortal(session){
  const {data:profile,error}=await db.from('profiles').select('role,display_name').eq('id',session.user.id).single();
  if(error||profile?.role!=='owner'){await db.auth.signOut();$('#login-message').textContent='This account is not approved for owner access.';showLogin();return}
  $('#login-panel').hidden=true;$('#portal').hidden=false;$('#sign-out').hidden=false;$('#owner-email').textContent=profile.display_name||session.user.email;await loadQuotes();
}
function showLogin(){$('#portal').hidden=true;$('#recovery-panel').hidden=true;$('#sign-out').hidden=true;$('#owner-email').textContent='';$('#login-panel').hidden=false}
function showRecovery(){$('#login-panel').hidden=true;$('#portal').hidden=true;$('#recovery-panel').hidden=false}

async function loadQuotes(){
  $('#job-list').innerHTML='<p class="empty-state">Loading…</p>';
  const {data,error}=await db.from('quotes').select('*').order('created_at',{ascending:false});
  if(error){$('#job-list').innerHTML='<p class="empty-state">Unable to load records.</p>';console.error(error);return}
  quotes=data||[];renderMetrics();renderList();if(selectedId){const current=quotes.find(q=>q.id===selectedId);if(current)renderDetail(current)}
}
function renderMetrics(){const active=quotes.filter(q=>!['completed','cancelled'].includes(q.status));const paid=quotes.filter(q=>q.deposit_status==='paid');$('#metric-open').textContent=active.filter(q=>['new','quoted','deposit_pending'].includes(q.status)).length;$('#metric-deposits').textContent=money(paid.reduce((s,q)=>s+Number(q.deposit_amount||0),0));$('#metric-feet').textContent=active.filter(q=>q.status==='scheduled').reduce((s,q)=>s+Number(q.estimated_feet||0),0)+' ft';$('#metric-jobs').textContent=paid.length}
function renderList(){const filter=$('#status-filter').value;const visible=filter==='all'?quotes:quotes.filter(q=>q.status===filter);if(!visible.length){$('#job-list').innerHTML='<p class="empty-state">No records in this view.</p>';return}$('#job-list').innerHTML=visible.map(q=>{const d=new Date(q.created_at);const badge=q.deposit_status==='paid'?'Deposit paid':statusLabel(q.status);return `<button class="owner-job ${q.id===selectedId?'selected':''}" data-id="${q.id}"><span class="job-date">${d.toLocaleString('en-US',{month:'short'}).toUpperCase()}<br><b>${d.getDate()}</b></span><span class="job-main"><b>${esc(q.customer_name)}</b><small>${esc(q.city)} • ${q.estimated_feet} ft • ${q.gutter_size}-inch</small></span><span class="job-meta"><b>${money(q.final_total||q.estimated_total)}</b><em class="${q.deposit_status==='paid'?'paid':q.status==='deposit_pending'?'pending':''}">${esc(badge)}</em></span></button>`}).join('');document.querySelectorAll('.owner-job').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.id;renderList();renderDetail(quotes.find(q=>q.id===selectedId));if(innerWidth<850)$('#detail-panel').scrollIntoView({behavior:'smooth'})}))}
function statusLabel(s){return({new:'New request',quoted:'Quoted',deposit_pending:'Deposit pending',scheduled:'Scheduled',completed:'Completed',cancelled:'Cancelled'})[s]||s}

function renderDetail(q){
  $('#detail-panel').innerHTML=`<p class="eyebrow">${esc(statusLabel(q.status))}</p><h2>${esc(q.customer_name)}</h2><p class="detail-contact"><a href="tel:${esc(q.phone)}">${esc(q.phone)}</a> • <a href="mailto:${esc(q.email)}">${esc(q.email)}</a><br>${esc(q.address)}, ${esc(q.city)}</p><div class="detail-summary"><div><span>System</span><b>${q.gutter_size}-inch • ${q.estimated_feet} ft</b></div><div><span>Estimate</span><b>${money(q.estimated_total)}</b></div><div><span>Deposit</span><b>${money(q.deposit_amount)} • ${esc(q.deposit_status)}</b></div><div><span>Requested visit</span><b>${esc(q.requested_visit||'Not selected')}</b></div></div><form id="edit-quote" class="edit-form"><label>Status<select id="edit-status">${['new','quoted','deposit_pending','scheduled','completed','cancelled'].map(s=>`<option value="${s}" ${q.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></label><label>Final project total<input id="edit-total" type="number" min="0" step="0.01" value="${q.final_total??q.estimated_total}"></label><label>Installation date<input id="edit-date" type="date" value="${q.scheduled_date||''}"></label><label>Crew plan<select id="edit-crew"><option value="2 owners" ${q.crew_plan==='2 owners'?'selected':''}>2 owners</option><option value="2 owners + 1 day labor" ${q.crew_plan==='2 owners + 1 day labor'?'selected':''}>2 owners + 1 day labor</option><option value="2 owners + 2 day labor" ${q.crew_plan==='2 owners + 2 day labor'?'selected':''}>2 owners + 2 day labor</option></select></label><label>Owner notes<textarea id="edit-notes">${esc(q.notes||'')}</textarea></label><div class="detail-actions"><button type="submit" class="primary">Save changes</button><button type="button" id="copy-payment" class="secondary">Copy deposit link</button><button type="button" id="open-payment" class="secondary full-row">Open customer payment page</button></div><p id="save-message" class="form-message"></p></form>`;
  $('#edit-quote').addEventListener('submit',e=>saveQuote(e,q.id));$('#copy-payment').addEventListener('click',()=>copyPayment(q.id));$('#open-payment').addEventListener('click',()=>window.open(new URL(`pay.html?id=${q.id}`,location.href),'_blank'));
}
async function saveQuote(e,id){e.preventDefault();const values={status:$('#edit-status').value,final_total:Number($('#edit-total').value),scheduled_date:$('#edit-date').value||null,crew_plan:$('#edit-crew').value,notes:$('#edit-notes').value.trim()};const {error}=await db.from('quotes').update(values).eq('id',id);$('#save-message').textContent=error?error.message:'Saved.';if(!error){toast('Quote updated');await loadQuotes()}}
async function copyPayment(id){const url=new URL(`pay.html?id=${id}`,location.href).href;await navigator.clipboard.writeText(url);toast('Deposit link copied')}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2200)}
