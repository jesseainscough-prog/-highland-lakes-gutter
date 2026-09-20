import {db,isConfigured} from './supabase-client.js';
const $=s=>document.querySelector(s);const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));const quoteId=new URLSearchParams(location.search).get('id');

if(!isConfigured){fail('Online payments are being connected. Please contact Highland Lakes.')}else if(!quoteId){fail('This payment link is incomplete.')}else{load()}

async function load(){
  if(new URLSearchParams(location.search).get('success')==='1'){$('#payment-title').textContent='Deposit received';$('#payment-description').textContent='Thank you. Highland Lakes will confirm your installation schedule shortly.';$('#payment-message').textContent='A Stripe receipt has been sent to the email used at checkout.';return}
  const {data,error}=await db.rpc('public_quote_summary',{quote_id:quoteId});const quote=Array.isArray(data)?data[0]:data;
  if(error||!quote){fail('We could not find an active quote for this payment link.');return}
  $('#payment-title').textContent=quote.deposit_status==='paid'?'Deposit already received':'Reserve your project';$('#payment-description').textContent=`${quote.gutter_size}-inch seamless gutters • ${quote.estimated_feet} estimated feet • ${quote.city}`;$('#payment-amount').textContent=money(quote.deposit_amount);$('#payment-summary').hidden=false;if(quote.deposit_status!=='paid')$('#checkout-button').hidden=false;else $('#payment-message').textContent='No additional deposit is due.';
}
$('#checkout-button').addEventListener('click',async()=>{const button=$('#checkout-button');button.disabled=true;button.textContent='Opening secure checkout…';const {data,error}=await db.functions.invoke('create-checkout-session',{body:{quoteId}});if(error||!data?.url){button.disabled=false;button.textContent='Pay securely with Stripe';fail(error?.message||data?.error||'Checkout is temporarily unavailable.');return}location.assign(data.url)});
function fail(message){$('#payment-title').textContent='Payment unavailable';$('#payment-description').textContent=message;$('#payment-message').textContent='Please contact Highland Lakes for assistance.'}
