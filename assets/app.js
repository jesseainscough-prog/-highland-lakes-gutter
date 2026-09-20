import { db, isConfigured } from './supabase-client.js';

const state={step:1,feet:180,size:6,stories:1,guards:false,removal:false,downspouts:4,total:2640,date:null,quoteId:null};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];

function recalc(){
  state.feet=Number($('#feet').value);state.size=Number($('input[name="size"]:checked').value);state.stories=Number($('#stories').value);state.guards=$('#guards').checked;state.removal=$('#removal').checked;state.downspouts=Number($('#downspouts').value);
  const base=state.feet*(state.size===12?12:22);const story=base*(state.stories-1);const guards=state.guards?state.feet*11:0;const removal=state.removal?state.feet*2.5:0;const downs=state.downspouts*120;state.total=Math.round(base+story+guards+removal+downs);
  $('#feet-output').textContent=state.feet+' ft';$('#estimate-total').textContent=money(state.total);$('#final-total').textContent=money(state.total);$('#gutter-cost').textContent=money(base);$('#downspout-cost').textContent=money(downs);$('#estimate-subline').textContent=`${state.feet} ft • ${state.size===12?6:7}-inch seamless • ${state.downspouts} downspouts`;toggleLine('#story-line','#story-cost',story);toggleLine('#guard-line','#guard-cost',guards);toggleLine('#removal-line','#removal-cost',removal);const dep=money(state.total/2);$('#deposit-total').textContent=dep;$('#deposit-button').textContent=dep;$('#modal-deposit').textContent=dep;
}
function toggleLine(line,cost,value){$(line).hidden=value<=0;$(cost).textContent=money(value)}
function renderStep(){ $$('.step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===state.step));$('#step-number').textContent=state.step;$('#progress-fill').style.width=(state.step*25)+'%';$('#back-btn').hidden=state.step===1;$('#next-btn').hidden=state.step===4;const titles=['','Where is the project?','Tell us about the home','Choose your gutter system','Schedule and reserve'];$('#step-title').textContent=titles[state.step];if(state.step===2&&$('input[name="service"]:checked').value==='Replace existing')$('#removal').checked=true;recalc();}

function keepEstimatorInView(){
  const card=$('.estimator-card');
  if(card) card.scrollIntoView({behavior:'smooth',block:'start'});
}

$('#next-btn').addEventListener('click',()=>{if(state.step===1&&(!$('#address').value.trim()||!$('#city').value)){alert('Add the project address and nearest service area to continue.');return}state.step=Math.min(4,state.step+1);renderStep();requestAnimationFrame(keepEstimatorInView)});
$('#back-btn').addEventListener('click',()=>{state.step=Math.max(1,state.step-1);renderStep();requestAnimationFrame(keepEstimatorInView)});
['#feet','#stories','#guards','#removal','#downspouts'].forEach(id=>$(id).addEventListener('input',recalc));$$('input[name="size"]').forEach(x=>x.addEventListener('change',recalc));
$$('input[name="service"]').forEach(x=>x.addEventListener('change',()=>{if(x.checked&&x.value==='Replace existing')$('#removal').checked=true;recalc()}));

const days=[];for(let offset=1;days.length<6;offset++){const date=new Date();date.setDate(date.getDate()+offset);if(date.getDay()!==0&&date.getDay()!==6)days.push(date)}$('#date-grid').innerHTML=days.map((date,i)=>{const day=date.toLocaleDateString('en-US',{weekday:'short'});const rest=date.toLocaleDateString('en-US',{month:'short',day:'numeric'});const value=`${day}, ${rest} • ${i%2?'PM':'AM'}`;return `<button type="button" class="date-btn" data-date="${value}"><b>${day}</b><small>${rest} • ${i%2?'PM':'AM'}</small></button>`}).join('');$$('.date-btn').forEach(btn=>btn.addEventListener('click',()=>{$$('.date-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');state.date=btn.dataset.date}));

$('#reserve-btn').addEventListener('click',async()=>{
  if(!state.date){alert('Choose a measurement visit first.');return}
  if(!$('#customer-name').value.trim()||!$('#phone').value.trim()||!$('#email').value.trim()){alert('Add your name, mobile number, and email address.');return}
  if(!isConfigured){alert('Online booking is being connected. Please call Highland Lakes to reserve your visit.');return}
  const button=$('#reserve-btn');button.disabled=true;button.textContent='Saving your request…';
  const payload={p_customer_name:$('#customer-name').value.trim(),p_email:$('#email').value.trim(),p_phone:$('#phone').value.trim(),p_address:$('#address').value.trim(),p_city:$('#city').value,p_service_type:$('input[name="service"]:checked').value,p_estimated_feet:state.feet,p_gutter_size:state.size===12?6:7,p_story_multiplier:state.stories,p_gutter_guards:state.guards,p_removal:state.removal,p_downspouts:state.downspouts,p_requested_visit:state.date};
  const {data,error}=await db.rpc('submit_quote',payload);const saved=Array.isArray(data)?data[0]:data;
  button.disabled=false;button.innerHTML='Save request & continue to deposit — <span id="deposit-button">'+money(state.total/2)+'</span>';
  if(error){console.error(error);alert('We could not save the request. Please call Highland Lakes or try again.');return}
  state.quoteId=saved.id;$('#modal-deposit').textContent=money(saved.deposit_amount);$('#pay-link').href=`pay.html?id=${encodeURIComponent(saved.id)}`;$('#success-modal').hidden=false;
});

$('#close-modal').addEventListener('click',()=>$('#success-modal').hidden=true);$('#success-modal').addEventListener('click',e=>{if(e.target.id==='success-modal')e.currentTarget.hidden=true});
$$('[data-home-anchor]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();document.getElementById(link.dataset.homeAnchor)?.scrollIntoView({behavior:'smooth'})}));
recalc();renderStep();
