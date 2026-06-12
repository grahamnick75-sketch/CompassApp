/* Compass v6 - static GitHub Pages app */
const STORAGE_KEY = 'compass_v6_state';
const SCHEMA_VERSION = '6.0.0';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const LIMITS = {
  name: 60, title: 75, notes: 500, householdName: 60, memberName: 40,
  amount: 9999999.99, recordCounts: { accounts: 100, bills: 1000, buckets: 1000, goals: 1000, events: 5000, paychecks: 500, members: 100, fundingSessions: 5000, allocations: 25000 }
};
const MONEY_RE = /^-?\d{1,7}(\.\d{0,2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RECURRENCE = ['one-time','weekly','biweekly','monthly'];
const PRIORITIES = ['critical','important','flexible'];
const PRIORITY_LABEL = { critical:'Critical', important:'Important', flexible:'Flexible' };
const OWNER_HOUSEHOLD = 'household';
const TYPE_LABEL = { bill:'Bill', bucket:'Bucket', goal:'Savings Goal', event:'Event', paycheck:'Paycheck', account:'Account', member:'Member' };
const uid = () => crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
const todayISO = () => new Date().toISOString().slice(0,10);
const parseDate = (iso) => new Date(`${iso}T12:00:00`);
const fmtMoney = (n) => {
  const val = Number(n);
  if (!Number.isFinite(val)) return '$0.00';
  return val.toLocaleString(undefined, { style:'currency', currency:'USD', maximumFractionDigits:2 });
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const truncate = (s, max=60) => { s = String(s ?? '').trim(); return s.length > max ? s.slice(0, max).trim() : s; };
const normalizeKey = (s) => String(s ?? '').trim().toLowerCase();
function addDays(date, days){ const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function addMonths(date, months){ const d = new Date(date); d.setMonth(d.getMonth()+months); return d; }
function iso(d){ return d.toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.ceil((parseDate(b)-parseDate(a))/(1000*60*60*24)); }
function isRealDate(value){ if (!DATE_RE.test(value || '')) return false; const d = parseDate(value); return !Number.isNaN(d) && iso(d) === value; }
function parseMoney(value){
  const raw = String(value ?? '').trim();
  if (!MONEY_RE.test(raw)) return { ok:false, value:0, error:'Enter a normal dollar amount under 9,999,999.99. Scientific notation is not allowed.' };
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > LIMITS.amount) return { ok:false, value:0, error:'Amount is outside the supported range.' };
  return { ok:true, value:Math.round(n*100)/100 };
}
function defaultState(){
  const householdId = uid(); const nickId = uid(); const danielleId = uid();
  return {
    schemaVersion: SCHEMA_VERSION,
    appName: 'Compass',
    activeHouseholdId: householdId,
    household: { id: householdId, name:'My Household', createdAt:new Date().toISOString() },
    members: [ { id: OWNER_HOUSEHOLD, name:'Household', system:true }, { id:nickId, name:'Nick' }, { id:danielleId, name:'Danielle' } ],
    settings: {
      theme:'cozy', aiMode:'advisor', aiEndpoint:'',
      fundedRules: { critical:true, important:true, flexible:false, buckets:true, goals:false },
      lookAheadDays: 120
    },
    accounts: [ { id:uid(), name:'Checking', balance:0, includeInPlanning:true, ownerId:OWNER_HOUSEHOLD } ],
    bills: [],
    buckets: [ { id:uid(), name:'Groceries', targetAmount:400, ownerId:OWNER_HOUSEHOLD }, { id:uid(), name:'Gas', targetAmount:125, ownerId:OWNER_HOUSEHOLD } ],
    goals: [ { id:uid(), name:'Emergency Fund', targetAmount:10000, currentAmount:0, plannedContribution:100, dueDate:'', ownerId:OWNER_HOUSEHOLD, linkedEventId:'' } ],
    events: [],
    paychecks: [],
    fundingSessions: [],
    fundingAllocations: [],
    activityLog: []
  };
}
let state = loadState();
let activeScreen = 'dashboard';
let calendarCursor = new Date();
let dialogContext = null;
let pendingImport = null;
let simulatorDraft = null;
let selectedAssignPaycheckId = '';
function assignKey(p){ return `${p.id}|${p.occurrenceDate || p.nextPayday || ''}`; }

function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const migrated = migrateBackup(parsed).state;
    return cleanState(migrated).state;
  } catch (err) {
    console.error('Load failed', err);
    return defaultState();
  }
}
function persist(message='Saved'){
  state.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  toast(message);
}
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1800); }
function logActivity(action, detail, meta={}){
  state.activityLog.unshift({ id:uid(), at:new Date().toISOString(), memberId: meta.memberId || OWNER_HOUSEHOLD, action, detail:truncate(detail,160), meta });
  state.activityLog = state.activityLog.slice(0,500);
}
function ownerName(id){ return state.members.find(m=>m.id===id)?.name || 'Household'; }
function planningBalance(extraState=state){ return extraState.accounts.filter(a=>a.includeInPlanning).reduce((sum,a)=>sum + Number(a.balance || 0), 0); }
function nextDateForRecurrence(d, rec){ if (rec === 'weekly') return addDays(d,7); if (rec === 'biweekly') return addDays(d,14); if (rec === 'monthly') return addMonths(d,1); return addDays(d,36500); }
function expandRecurring(items, startIso, endIso, dateKey){
  const start = parseDate(startIso), end = parseDate(endIso), out = [];
  for (const item of items.filter(x=>!x.deleted)) {
    const first = item[dateKey];
    if (!isRealDate(first)) continue;
    let d = parseDate(first);
    const rec = item.recurrence || item.frequency || 'one-time';
    if (rec === 'one-time') { if (d >= start && d <= end) out.push({ ...item, occurrenceDate:iso(d) }); continue; }
    let guard = 0;
    while (d < start && guard++ < 500) d = nextDateForRecurrence(d, rec);
    while (d <= end && guard++ < 1000) { out.push({ ...item, occurrenceDate:iso(d) }); d = nextDateForRecurrence(d, rec); }
  }
  return out.sort((a,b)=>(a.occurrenceDate||'').localeCompare(b.occurrenceDate||''));
}
function upcomingPaychecks(days=120, from=todayISO()){
  const end = iso(addDays(parseDate(from), days));
  return expandRecurring(state.paychecks, from, end, 'nextPayday').sort((a,b)=>a.occurrenceDate.localeCompare(b.occurrenceDate));
}
function nextPaycheck(){ return upcomingPaychecks(180)[0] || null; }
function nextPaycheckAfter(dateIso, fallbackDays=14){
  const pays = upcomingPaychecks(180, dateIso).filter(p=>p.occurrenceDate > dateIso);
  return pays[0]?.occurrenceDate || iso(addDays(parseDate(dateIso), fallbackDays));
}
function fundedAmount(targetType, targetId, occurrenceDate=''){
  return state.fundingAllocations
    .filter(a => a.targetType === targetType && a.targetId === targetId && (a.occurrenceDate || '') === (occurrenceDate || ''))
    .reduce((sum,a)=>sum+Number(a.amount||0),0);
}
function targetAmountFor(type, item){
  if (type === 'bill') return Number(item.amount || 0);
  if (type === 'bucket') return Number(item.targetAmount || item.amount || 0);
  if (type === 'goal') return Number(item.plannedContribution || item.amount || 0);
  return Number(item.amount || 0);
}
function itemFundingStatus(type, item, occurrenceDate=''){
  const target = targetAmountFor(type, item);
  const funded = fundedAmount(type, item.id, occurrenceDate);
  const pct = target > 0 ? clamp((funded/target)*100,0,100) : 0;
  return { target, funded, remaining: Math.max(0, target-funded), pct, status: funded >= target && target > 0 ? 'funded' : funded > 0 ? 'partial' : 'planned' };
}
function recurringLabel(v){ return ({'one-time':'One-time',weekly:'Weekly',biweekly:'Biweekly',monthly:'Monthly'})[v] || 'One-time'; }
function priorityRankForTarget(t){
  if (t.type === 'bill') return { critical:1, important:2, flexible:4 }[t.priority] || 4;
  if (t.type === 'bucket') return 3;
  if (t.type === 'goal') return 5;
  return 9;
}
function assignTargetsForPaycheck(paycheckOccurrence){
  const today = todayISO();
  const through = nextPaycheckAfter(paycheckOccurrence?.occurrenceDate || today);
  const billOccurrences = expandRecurring(state.bills, today, through, 'dueDate')
    .map(b => ({ type:'bill', id:b.id, name:b.name, ownerId:b.ownerId, amount:Number(b.amount||0), occurrenceDate:b.occurrenceDate, dueDate:b.occurrenceDate, priority:b.priority, label:`${PRIORITY_LABEL[b.priority] || 'Flexible'} bill · due ${b.occurrenceDate}` }));
  const bucketTargets = state.buckets.filter(b=>!b.deleted).map(b => ({ type:'bucket', id:b.id, name:b.name, ownerId:b.ownerId, amount:Number(b.targetAmount||0), occurrenceDate:paycheckOccurrence?.occurrenceDate || today, priority:'bucket', label:'Standard bucket' }));
  const goalTargets = state.goals.filter(g=>!g.deleted).map(g => ({ type:'goal', id:g.id, name:g.name, ownerId:g.ownerId, amount:Number(g.plannedContribution||0), occurrenceDate:paycheckOccurrence?.occurrenceDate || today, priority:'goal', label:'Savings goal contribution' })).filter(g=>g.amount>0);
  return [...billOccurrences, ...bucketTargets, ...goalTargets]
    .map(t => ({ ...t, ...itemFundingStatus(t.type, {id:t.id, amount:t.amount, targetAmount:t.amount, plannedContribution:t.amount}, t.occurrenceDate) }))
    .filter(t => t.remaining > 0)
    .sort((a,b)=> priorityRankForTarget(a)-priorityRankForTarget(b) || (a.dueDate||a.occurrenceDate).localeCompare(b.dueDate||b.occurrenceDate) || a.name.localeCompare(b.name));
}
function shouldIncludeBill(b, rules=state.settings.fundedRules){ return !!rules[b.priority]; }
function buildTimeline({ includeExpectedIncome=false, extraSpend=0, days=120 }={}){
  const start = todayISO(); const end = iso(addDays(parseDate(start), days));
  const events = [];
  if (includeExpectedIncome) upcomingPaychecks(days).forEach(p => events.push({ date:p.occurrenceDate, amount:Number(p.amount||0), label:`${p.name} paycheck`, type:'income' }));
  expandRecurring(state.bills, start, end, 'dueDate').filter(b=>shouldIncludeBill(b)).forEach(b => {
    const status = itemFundingStatus('bill', b, b.occurrenceDate);
    const remaining = Math.max(0, Number(b.amount||0) - status.funded);
    if (remaining > 0) events.push({ date:b.occurrenceDate, amount:-remaining, label:b.name, type:'bill', priority:b.priority });
  });
  const payDates = [start, ...upcomingPaychecks(days).map(p=>p.occurrenceDate)].filter((v,i,a)=>a.indexOf(v)===i).sort();
  if (state.settings.fundedRules.buckets) {
    for (const date of payDates) state.buckets.filter(b=>!b.deleted).forEach(b=>{
      const status = itemFundingStatus('bucket', b, date);
      const remaining = Math.max(0, Number(b.targetAmount||0) - status.funded);
      if (remaining > 0) events.push({ date, amount:-remaining, label:b.name, type:'bucket' });
    });
  }
  if (state.settings.fundedRules.goals) {
    for (const date of payDates) state.goals.filter(g=>!g.deleted && Number(g.plannedContribution||0)>0).forEach(g=>{
      const status = itemFundingStatus('goal', g, date);
      const remaining = Math.max(0, Number(g.plannedContribution||0) - status.funded);
      if (remaining > 0) events.push({ date, amount:-remaining, label:g.name, type:'goal' });
    });
  }
  if (extraSpend > 0) events.push({ date:start, amount:-extraSpend, label:'Simulator expense', type:'simulator' });
  return events.sort((a,b)=> a.date.localeCompare(b.date) || (b.amount-a.amount));
}
function calculateFundedThrough(opts={}){
  const days = Number(state.settings.lookAheadDays || 120);
  let balance = planningBalance() - Number(opts.extraSpend || 0);
  let lastGood = todayISO();
  let nextUnfunded = null;
  const events = buildTimeline({ includeExpectedIncome:!!opts.includeExpectedIncome, extraSpend:0, days });
  for (const ev of events) {
    if (ev.amount >= 0) { balance += ev.amount; continue; }
    if (balance + ev.amount < -0.005) { nextUnfunded = { ...ev, shortfall: Math.abs(balance + ev.amount) }; break; }
    balance += ev.amount;
    lastGood = ev.date;
  }
  if (!nextUnfunded) lastGood = iso(addDays(parseDate(todayISO()), days));
  return { throughDate:lastGood, nextUnfunded, remaining:Math.max(0,balance), mode:opts.includeExpectedIncome?'Projected':'Current' };
}
function statusForThrough(result){
  if (!result.nextUnfunded) return { text:'On Track', cls:'good', icon:'✓' };
  const days = daysBetween(todayISO(), result.throughDate);
  if (days <= 3) return { text:'Needs Attention', cls:'danger', icon:'!' };
  return { text:'Tight', cls:'warn', icon:'⚠' };
}
function insightSummary(mode='advisor'){
  const funded = calculateFundedThrough({includeExpectedIncome:false});
  const projected = calculateFundedThrough({includeExpectedIncome:true});
  const next = nextPaycheck();
  if (mode === 'analyst') {
    return `Funded Through is ${formatDate(funded.throughDate)} using current planning balances only. Projected Through is ${formatDate(projected.throughDate)} when expected income is included. Planning balance is ${fmtMoney(planningBalance())}. ${next ? `Next paycheck is ${next.name} on ${formatDate(next.occurrenceDate)} for ${fmtMoney(next.amount)}.` : 'No upcoming paycheck is entered.'}`;
  }
  if (mode === 'simulator') {
    return `Use the Decision Simulator to test a purchase or event. Compass will show how it changes Funded Through and Projected Through, then let you convert the simulation into a bill, bucket, savings goal, event, or paycheck.`;
  }
  if (funded.nextUnfunded) return `Fund ${funded.nextUnfunded.label} next. It is the first item creating a ${fmtMoney(funded.nextUnfunded.shortfall)} gap before your current-cash runway can continue.`;
  return `You are funded through ${formatDate(funded.throughDate)} on current cash. Consider using Assign Money to fund the next highest-priority item after your next paycheck arrives.`;
}
function formatDate(value){ if (!isRealDate(value)) return '—'; return parseDate(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function render(){
  document.documentElement.dataset.theme = state.settings.theme === 'cozy' ? '' : state.settings.theme;
  renderDashboard(); renderAccounts(); renderCalendar(); renderBills(); renderBuckets(); renderGoals(); renderEvents(); renderPaychecks(); renderAssign(); renderFundingHistory(); renderSimulator(); renderInsights(); renderSettings();
}
function navigate(id){
  activeScreen = id;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.nav === id));
  closeDrawer();
  window.scrollTo({ top:0, behavior:'smooth' });
  render();
}
function card(title, body, extra=''){ return `<div class="card ${extra}"><div class="section-head"><h2>${title}</h2></div>${body}</div>`; }
function emptyState(text, action=''){ return `<p class="muted">${escapeHtml(text)}</p>${action}`; }
function recordRow({title, meta, amount, chips='', actions='', progress=null}){
  return `<div class="row"><div class="row-main"><div class="row-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div><div class="row-meta">${meta || ''}</div>${chips}${progress?progressBar(progress.pct, progress.label):''}</div><div><strong>${amount || ''}</strong><div class="row-actions">${actions || ''}</div></div></div>`;
}
function progressBar(pct, label='') { return `<div class="progress-wrap" title="${escapeHtml(label)}"><div class="progress-bar" style="width:${clamp(pct,0,100)}%"></div></div><div class="field-help">${escapeHtml(label)}</div>`; }
function actionButtons(type,id){ return `<button class="btn ghost" onclick="openRecord('${type}','${id}')">Edit</button><button class="btn danger" onclick="deleteRecord('${type}','${id}')">Delete</button>`; }
function renderDashboard(){
  const funded = calculateFundedThrough({includeExpectedIncome:false});
  const projected = calculateFundedThrough({includeExpectedIncome:true});
  const stat = statusForThrough(funded);
  const next = nextPaycheck();
  const recentSession = state.fundingSessions[0];
  const flow = recentSession ? fundingMap(recentSession) : 'No funding session yet. Mark a paycheck received or use Assign Money to create one.';
  document.getElementById('dashboard').innerHTML = `
    <div class="hero-card card" role="button" onclick="showFundedDetails(false)">
      <p class="kicker">Funded Through</p>
      <div class="hero-date">${formatShortDate(funded.throughDate)}</div>
      <span class="status-pill ${stat.cls}">${stat.icon} ${stat.text}</span>
      <p class="muted">Current planning balances only. Tap for details.</p>
    </div>
    <div class="grid">
      <div class="metric span-4"><span>Projected Through</span><strong>${formatShortDate(projected.throughDate)}</strong><div class="field-help">Includes expected income</div></div>
      <div class="metric span-4"><span>Planning Balance</span><strong>${fmtMoney(planningBalance())}</strong><div class="field-help">Accounts marked “Include in Planning”</div></div>
      <div class="metric span-4"><span>Next Paycheck</span><strong>${next?formatShortDate(next.occurrenceDate):'—'}</strong><div class="field-help">${next?`${escapeHtml(next.name)} · ${fmtMoney(next.amount)} · ${daysBetween(todayISO(), next.occurrenceDate)} days away`:'Add a paycheck'}</div></div>
    </div>
    ${card('Compass Insight', `<div class="insight-carousel">${['analyst','advisor','simulator'].map(m=>`<div class="insight-card"><p class="kicker">${m}</p><p>${escapeHtml(insightSummary(m))}</p></div>`).join('')}</div>`)}
    ${card('Funding Map', `<div class="flow-map">${escapeHtml(flow)}</div>`)}
  `;
}
function formatShortDate(value){ if (!isRealDate(value)) return '—'; return parseDate(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function showFundedDetails(projected=false){
  const result = calculateFundedThrough({includeExpectedIncome:projected});
  const events = buildTimeline({includeExpectedIncome:projected, days:45}).slice(0,12);
  showInfoModal(`${projected?'Projected':'Funded'} Through Details`, `
    <p><strong>${formatDate(result.throughDate)}</strong></p>
    ${result.nextUnfunded ? `<p class="status-pill danger">Next unfunded: ${escapeHtml(result.nextUnfunded.label)} · short ${fmtMoney(result.nextUnfunded.shortfall)}</p>` : `<p class="status-pill good">All included items covered in the planning window.</p>`}
    <h3>Upcoming items included</h3>
    ${events.map(e=>recordRow({title:e.label, meta:`${formatDate(e.date)} · ${e.type}`, amount:e.amount>=0?`+${fmtMoney(e.amount)}`:fmtMoney(Math.abs(e.amount))})).join('') || '<p class="muted">No included items found.</p>'}
  `);
}
function renderAccounts(){
  const rows = state.accounts.filter(a=>!a.deleted).map(a => recordRow({
    title:a.name,
    meta:`Owner: ${ownerName(a.ownerId)} · ${a.includeInPlanning?'Included in planning':'Excluded from planning'}`,
    amount:fmtMoney(a.balance),
    chips:`<span class="chip ${a.includeInPlanning?'good':'warn'}">${a.includeInPlanning?'Planning':'Not Planning'}</span>`,
    actions:actionButtons('account',a.id)
  })).join('');
  document.getElementById('accounts').innerHTML = card('Accounts', `<div class="button-row"><button class="btn primary" onclick="openRecord('account')">Add Account</button></div>${rows || emptyState('No accounts yet.', `<button class="btn primary" onclick="openRecord('account')">Add Account</button>`)}`);
}
function renderBills(){
  const rows = state.bills.filter(b=>!b.deleted).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(b=>{
    const occurrenceDate = nextOccurrenceDate(b.dueDate, b.recurrence);
    const st = itemFundingStatus('bill', b, occurrenceDate);
    return recordRow({ title:b.name, meta:`${PRIORITY_LABEL[b.priority]} · ${b.kind === 'fixed'?'Fixed':'Non-fixed'} · Due ${formatDate(b.dueDate)} · ${recurringLabel(b.recurrence)} · Owner: ${ownerName(b.ownerId)}`, amount:fmtMoney(b.amount), chips:`<span class="chip ${st.status==='funded'?'good':st.status==='partial'?'warn':''}">${st.status}</span>`, actions:`<button class="btn ghost" onclick="gotoFunding('bill','${b.id}','${occurrenceDate}')">History</button>${actionButtons('bill',b.id)}`, progress:{pct:st.pct,label:`${fmtMoney(st.funded)} / ${fmtMoney(st.target)} funded`} });
  }).join('');
  document.getElementById('bills').innerHTML = card('Bills', `<div class="button-row"><button class="btn primary" onclick="openRecord('bill')">Add Bill</button></div>${rows || emptyState('No bills yet.')}`);
}
function nextOccurrenceDate(firstDate, rec){
  if (!isRealDate(firstDate)) return todayISO();
  let d = parseDate(firstDate); const today = parseDate(todayISO()); let guard=0;
  if (rec === 'one-time') return iso(d);
  while (d < today && guard++ < 500) d = nextDateForRecurrence(d, rec);
  return iso(d);
}
function renderBuckets(){
  const rows = state.buckets.filter(b=>!b.deleted).map(b=>{
    const date = nextPaycheck()?.occurrenceDate || todayISO();
    const st = itemFundingStatus('bucket', b, date);
    return recordRow({ title:b.name, meta:`Standard bucket · Owner: ${ownerName(b.ownerId)}`, amount:fmtMoney(b.targetAmount), actions:`<button class="btn ghost" onclick="gotoFunding('bucket','${b.id}','${date}')">History</button>${actionButtons('bucket',b.id)}`, progress:{pct:st.pct,label:`${fmtMoney(st.funded)} / ${fmtMoney(st.target)} funded for current cycle`} });
  }).join('');
  document.getElementById('buckets').innerHTML = card('Buckets', `<p class="muted">Buckets are short-term spending allocations like groceries, gas, baby, pets, and household supplies.</p><div class="button-row"><button class="btn primary" onclick="openRecord('bucket')">Add Bucket</button></div>${rows || emptyState('No buckets yet.')}`);
}
function renderGoals(){
  const rows = state.goals.filter(g=>!g.deleted).map(g=>{
    const date = nextPaycheck()?.occurrenceDate || todayISO();
    const st = itemFundingStatus('goal', g, date);
    const currentPct = Number(g.targetAmount)>0 ? (Number(g.currentAmount||0)/Number(g.targetAmount))*100 : 0;
    return recordRow({ title:g.name, meta:`Due: ${g.dueDate?formatDate(g.dueDate):'Optional'} · Owner: ${ownerName(g.ownerId)} · Contribution: ${fmtMoney(g.plannedContribution)}`, amount:`${fmtMoney(g.currentAmount)} / ${fmtMoney(g.targetAmount)}`, actions:`<button class="btn ghost" onclick="gotoFunding('goal','${g.id}','${date}')">History</button>${actionButtons('goal',g.id)}`, progress:{pct:currentPct,label:`${Math.round(currentPct)}% of goal saved`} });
  }).join('');
  document.getElementById('goals').innerHTML = card('Savings Goals', `<p class="muted">Savings Goals replace cumulative buckets. Use them for vacation, emergency fund, holidays, repairs, or anything that accumulates over time.</p><div class="button-row"><button class="btn primary" onclick="openRecord('goal')">Add Savings Goal</button></div>${rows || emptyState('No savings goals yet.')}`);
}
function renderEvents(){
  const rows = state.events.filter(e=>!e.deleted).sort((a,b)=>a.startDate.localeCompare(b.startDate)).map(e=> recordRow({ title:e.title, meta:`${formatDate(e.startDate)}${e.endDate?`–${formatDate(e.endDate)}`:''} · Owner: ${ownerName(e.ownerId)} ${e.linkedGoalId?`· Linked goal: ${state.goals.find(g=>g.id===e.linkedGoalId)?.name || 'Missing goal'}`:''}`, actions:actionButtons('event',e.id)})).join('');
  document.getElementById('events').innerHTML = card('Events', `<div class="button-row"><button class="btn primary" onclick="openRecord('event')">Add Event</button></div>${rows || emptyState('No events yet.')}`);
}
function renderPaychecks(){
  const rows = state.paychecks.filter(p=>!p.deleted).sort((a,b)=>a.nextPayday.localeCompare(b.nextPayday)).map(p=> recordRow({
    title:p.name,
    meta:`Next payday: ${formatDate(p.nextPayday)} · ${recurringLabel(p.frequency)} · Owner: ${ownerName(p.ownerId)}`,
    amount:fmtMoney(p.amount),
    chips:`<span class="chip ${p.status==='received'?'good':''}">${p.status}</span>`,
    actions:`${p.status==='received'?'':`<button class="btn good" onclick="markPaycheckReceived('${p.id}')">Mark Received</button>`}${actionButtons('paycheck',p.id)}`
  })).join('');
  document.getElementById('paychecks').innerHTML = card('Paychecks', `<div class="button-row"><button class="btn primary" onclick="openRecord('paycheck')">Add Paycheck</button></div>${rows || emptyState('No paychecks yet.')}`);
}
function renderCalendar(){
  const y = calendarCursor.getFullYear(), m = calendarCursor.getMonth();
  const first = new Date(y,m,1), last = new Date(y,m+1,0), start = addDays(first, -first.getDay()), end = addDays(last, 6-last.getDay());
  const startIso = iso(start), endIso = iso(end);
  const events = [];
  expandRecurring(state.bills, startIso, endIso, 'dueDate').forEach(b=>events.push({date:b.occurrenceDate, type:'bill', title:b.name, id:b.id}));
  expandRecurring(state.paychecks, startIso, endIso, 'nextPayday').forEach(p=>events.push({date:p.occurrenceDate, type:'paycheck', title:p.name, id:p.id}));
  state.events.filter(e=>!e.deleted && isRealDate(e.startDate)).forEach(e=>{ if(parseDate(e.startDate)>=start && parseDate(e.startDate)<=end) events.push({date:e.startDate,type:'event',title:e.title,id:e.id}); });
  state.goals.filter(g=>!g.deleted && isRealDate(g.dueDate)).forEach(g=>{ if(parseDate(g.dueDate)>=start && parseDate(g.dueDate)<=end) events.push({date:g.dueDate,type:'goal',title:g.name,id:g.id}); });
  let days = '';
  for(let d=new Date(start); d<=end; d=addDays(d,1)){
    const dayIso = iso(d);
    const items = events.filter(e=>e.date===dayIso);
    days += `<div class="day ${d.getMonth()!==m?'out':''}" ondblclick="openRecord('event','',{startDate:'${dayIso}'})"><div class="day-num">${d.getDate()}</div>${items.map(e=>`<span class="event-pill ${e.type}" onclick="openCalendarRecord('${e.type}','${e.id}')" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`).join('')}</div>`;
  }
  document.getElementById('calendar').innerHTML = card('Calendar', `
    <div class="calendar-head"><button class="btn ghost" onclick="moveMonth(-1)">←</button><h2>${calendarCursor.toLocaleString(undefined,{month:'long',year:'numeric'})}</h2><button class="btn ghost" onclick="moveMonth(1)">→</button></div>
    <div class="button-row"><button class="btn primary" onclick="openRecord('event')">Add Event</button><button class="btn ghost" onclick="openRecord('bill')">Add Bill</button><button class="btn ghost" onclick="openRecord('paycheck')">Add Paycheck</button></div>
    <div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="day-name">${d}</div>`).join('')}${days}</div>
    <p class="muted small">Double-tap a day to add an event on that date.</p>`);
}
function openCalendarRecord(type,id){ if(type==='bill') openRecord('bill',id); else if(type==='paycheck') openRecord('paycheck',id); else if(type==='goal') openRecord('goal',id); else openRecord('event',id); }
function moveMonth(delta){ calendarCursor.setMonth(calendarCursor.getMonth()+delta); renderCalendar(); }
function renderAssign(){
  const paychecks = upcomingPaychecks(90);
  const selected = paychecks.find(p=>assignKey(p)===selectedAssignPaycheckId) || paychecks[0];
  if (selected && selectedAssignPaycheckId !== assignKey(selected)) selectedAssignPaycheckId = assignKey(selected);
  const targets = selected ? assignTargetsForPaycheck(selected) : [];
  const totalPool = planningBalance() + Number(selected?.amount || 0);
  document.getElementById('assign').innerHTML = card('Assign Money', `
    <p class="muted">Suggested plan sorted by Critical Bills → Important Bills → Buckets → Flexible Bills → Savings Goals. Check items and adjust amounts; remaining funds update immediately.</p>
    <div class="form-grid"><label>Selected Paycheck<select id="assignPaycheck" onchange="selectedAssignPaycheckId=this.value; renderAssign()">${paychecks.map(p=>`<option value="${assignKey(p)}" ${assignKey(p)===selectedAssignPaycheckId?'selected':''}>${escapeHtml(p.name)} · ${formatDate(p.occurrenceDate)} · ${fmtMoney(p.amount)}</option>`).join('')}</select></label></div>
    ${selected ? `<div class="assign-sticky"><div class="kicker">Available to Assign</div><div class="assign-total" id="assignRemaining">${fmtMoney(totalPool)}</div><div class="field-help">Planning Balance ${fmtMoney(planningBalance())} + Paycheck ${fmtMoney(selected.amount)}</div></div>` : '<p class="muted">Add a paycheck first.</p>'}
    <div id="allocationRows">${targets.map((t,i)=>allocationHTML(t,i)).join('') || '<p class="muted">No recommended items to fund before the next paycheck.</p>'}</div>
    <div class="button-row"><button class="btn primary" onclick="saveFundingSession()">Save Funding Session</button></div>`);
  setTimeout(updateAssignRemaining,0);
}
function allocationHTML(t,i){
  return `<div class="row allocation-row" data-amount="${t.remaining}" data-type="${t.type}" data-id="${t.id}" data-date="${t.occurrenceDate}" data-name="${escapeHtml(t.name)}">
    <input type="checkbox" class="assign-check" onchange="toggleAllocation(${i})" id="assignCheck${i}" />
    <div class="row-main"><label for="assignCheck${i}" class="row-title">${escapeHtml(t.name)}</label><div class="row-meta">${escapeHtml(t.label)} · remaining ${fmtMoney(t.remaining)}</div>${progressBar(t.pct,`${fmtMoney(t.funded)} / ${fmtMoney(t.target)} funded`)}</div>
    <div class="allocation-amount"><input class="money-input assign-amount" inputmode="decimal" maxlength="10" value="${Number(t.remaining||0).toFixed(2)}" oninput="updateAssignRemaining()" /></div>
  </div>`;
}
function toggleAllocation(){ updateAssignRemaining(); }
function updateAssignRemaining(){
  const paychecks = upcomingPaychecks(90); const selected = paychecks.find(p=>assignKey(p)===selectedAssignPaycheckId) || paychecks[0];
  let remaining = planningBalance() + Number(selected?.amount || 0);
  document.querySelectorAll('#allocationRows .allocation-row').forEach(row=>{
    const checked = row.querySelector('.assign-check')?.checked;
    const val = parseMoney(row.querySelector('.assign-amount')?.value || '0');
    if (checked && val.ok) remaining -= val.value;
  });
  const el = document.getElementById('assignRemaining'); if(el){ el.textContent = fmtMoney(remaining); el.classList.toggle('danger-text', remaining < 0); }
}
function saveFundingSession(){
  const paychecks = upcomingPaychecks(90); const selected = paychecks.find(p=>assignKey(p)===selectedAssignPaycheckId) || paychecks[0];
  if (!selected) return toast('Add a paycheck first.');
  const allocations = [];
  for (const row of document.querySelectorAll('#allocationRows .allocation-row')) {
    if (!row.querySelector('.assign-check')?.checked) continue;
    const parsed = parseMoney(row.querySelector('.assign-amount')?.value || '0');
    if (!parsed.ok || parsed.value <= 0) return toast('Fix allocation amounts before saving.');
    allocations.push({ targetType:row.dataset.type, targetId:row.dataset.id, occurrenceDate:row.dataset.date, targetName:row.dataset.name, amount:parsed.value });
  }
  if (!allocations.length) return toast('Select at least one item to fund.');
  const sessionId = uid();
  const session = { id:sessionId, at:new Date().toISOString(), memberId:OWNER_HOUSEHOLD, paycheckId:selected.id, paycheckName:selected.name, paycheckAmount:Number(selected.amount||0), planningBalance:planningBalance(), allocations:allocations.map(a=>({...a})) };
  state.fundingSessions.unshift(session);
  allocations.forEach(a=>state.fundingAllocations.push({ id:uid(), sessionId, at:session.at, ...a }));
  logActivity('Funding session saved', `${selected.name} funded ${allocations.length} items`, { sessionId });
  persist('Funding session saved');
  navigate('fundingHistory');
}
function fundingMap(session){
  if (!session) return 'No funding session yet.';
  const lines = [`${session.paycheckName}`, `${fmtMoney(session.paycheckAmount)}`, ''];
  session.allocations.forEach((a,idx)=>lines.push(`${idx===session.allocations.length-1?'└':'├'}─ ${a.targetName} ${fmtMoney(a.amount)}`));
  return lines.join('\n');
}
function renderFundingHistory(filter=null){
  const sessions = state.fundingSessions;
  const body = sessions.map(s=>card(`${escapeHtml(s.paycheckName)} · ${new Date(s.at).toLocaleString()}`, `
    <p class="muted">Planning balance: ${fmtMoney(s.planningBalance)} · Paycheck: ${fmtMoney(s.paycheckAmount)}</p>
    <div class="flow-map">${escapeHtml(fundingMap(s))}</div>
    ${s.allocations.map(a=>recordRow({title:a.targetName, meta:`${TYPE_LABEL[a.targetType] || a.targetType} · ${a.occurrenceDate ? formatDate(a.occurrenceDate) : 'No date'}`, amount:fmtMoney(a.amount)})).join('')}
  `)).join('');
  document.getElementById('fundingHistory').innerHTML = card('Funding History', `<p class="muted">Funding sessions show what was assigned, when, and from which paycheck.</p>${body || '<p class="muted">No funding history yet.</p>'}`);
}
function gotoFunding(type,id,date){ navigate('fundingHistory'); setTimeout(()=>toast('Funding history opened.'),0); }
function renderSimulator(){
  document.getElementById('simulator').innerHTML = card('Decision Simulator', `
    <p class="muted">Test a purchase or future plan, then convert it into a bill, bucket, savings goal, event, or paycheck.</p>
    <div class="form-grid">
      <label>Name<input id="simName" maxlength="75" value="${escapeHtml(simulatorDraft?.name || '')}" placeholder="Disneyland Trip" /></label>
      <label>Amount<input id="simAmount" inputmode="decimal" maxlength="10" value="${simulatorDraft?.amount || ''}" placeholder="899.00" /></label>
      <label>Date<input id="simDate" type="date" value="${simulatorDraft?.date || todayISO()}" /></label>
    </div>
    <div class="button-row"><button class="btn primary" onclick="runSimulator()">Run Simulation</button><button class="btn ghost" onclick="convertSimulator()">Convert</button></div>
    <div id="simOutput">${simulatorDraft?.output || ''}</div>`);
}
function runSimulator(){
  const name = truncate(document.getElementById('simName').value, LIMITS.title);
  const amountParsed = parseMoney(document.getElementById('simAmount').value);
  const date = document.getElementById('simDate').value;
  if (!name) return toast('Enter a name.');
  if (!amountParsed.ok || amountParsed.value <= 0) return toast(amountParsed.error);
  if (!isRealDate(date)) return toast('Enter a real date.');
  const before = calculateFundedThrough({includeExpectedIncome:false});
  const after = calculateFundedThrough({includeExpectedIncome:false, extraSpend:amountParsed.value});
  const beforeProj = calculateFundedThrough({includeExpectedIncome:true});
  const afterProj = calculateFundedThrough({includeExpectedIncome:true, extraSpend:amountParsed.value});
  simulatorDraft = { name, amount:amountParsed.value, date, output:`<div class="sim-result"><strong>${escapeHtml(name)}</strong><p>Amount: ${fmtMoney(amountParsed.value)}</p><p>Funded Through: ${formatDate(before.throughDate)} → ${formatDate(after.throughDate)}</p><p>Projected Through: ${formatDate(beforeProj.throughDate)} → ${formatDate(afterProj.throughDate)}</p><p class="muted">${after.nextUnfunded ? `Risk: ${escapeHtml(after.nextUnfunded.label)} would be short by ${fmtMoney(after.nextUnfunded.shortfall)}.` : 'No funded-through shortfall found in the planning window.'}</p></div>` };
  renderSimulator();
}
function convertSimulator(){
  if (!simulatorDraft) return toast('Run a simulation first.');
  showInfoModal('Convert Simulation', `
    <p>Convert <strong>${escapeHtml(simulatorDraft.name)}</strong> into:</p>
    <div class="form-grid"><label>Record type<select id="convertType"><option value="bill">Bill</option><option value="bucket">Bucket</option><option value="goal">Savings Goal</option><option value="event">Event</option><option value="paycheck">Paycheck</option></select></label></div>
    <div class="button-row right"><button class="btn primary" onclick="continueConvertSimulator()">Next</button></div>`);
}
function continueConvertSimulator(){ const type = document.getElementById('convertType').value; closeConfirm(); openRecord(type,'', simulatorDraft); }
function renderInsights(){
  document.getElementById('insights').innerHTML = card('Compass Insights', `
    <p class="muted">Swipe through Analyst, Advisor, and Simulator summaries. Advisor replaces the old Financial Inbox concept.</p>
    <div class="insight-carousel">${['analyst','advisor','simulator'].map(m=>`<div class="insight-card"><p class="kicker">${m}</p><p>${escapeHtml(insightSummary(m))}</p><button class="btn ${state.settings.aiMode===m?'primary':'ghost'}" onclick="state.settings.aiMode='${m}'; persist('AI mode saved')">Set Default</button></div>`).join('')}</div>
    <div class="card"><h3>AI Connection</h3><p class="muted">A secure AI proxy can be connected later. Local summaries are shown until then.</p><label>AI Proxy Endpoint<input id="aiEndpoint" value="${escapeHtml(state.settings.aiEndpoint || '')}" maxlength="250" /></label><button class="btn primary" onclick="state.settings.aiEndpoint=document.getElementById('aiEndpoint').value.trim(); persist('AI endpoint saved')">Save Endpoint</button></div>
  `);
}
function renderSettings(){
  const r = state.settings.fundedRules;
  const members = state.members.filter(m=>!m.system).map(m=>recordRow({title:m.name, meta:'Household member', actions:`<button class="btn danger" onclick="deleteMember('${m.id}')">Remove</button>`})).join('');
  document.getElementById('settings').innerHTML = `
    ${card('Planning Rules', `<p class="muted">Configure what counts toward Funded Through and Projected Through.</p><div class="form-grid">
      ${checkSetting('critical','Include Critical Bills',r.critical)}${checkSetting('important','Include Important Bills',r.important)}${checkSetting('flexible','Include Flexible Bills',r.flexible)}${checkSetting('buckets','Include Buckets',r.buckets)}${checkSetting('goals','Include Savings Goals',r.goals)}
    </div><div class="button-row"><button class="btn primary" onclick="savePlanningRules()">Save Planning Rules</button></div>`)}
    ${card('Theme', `<label>Theme<select id="themeSelect"><option value="cozy" ${state.settings.theme==='cozy'?'selected':''}>Compass</option><option value="classic" ${state.settings.theme==='classic'?'selected':''}>Classic</option><option value="dark" ${state.settings.theme==='dark'?'selected':''}>Dark</option></select></label><button class="btn primary" onclick="state.settings.theme=document.getElementById('themeSelect').value; persist('Theme saved')">Save Theme</button>`)}
    ${card('Household', `<label>Household Name<input id="householdName" maxlength="60" value="${escapeHtml(state.household.name)}" /></label><button class="btn primary" onclick="saveHouseholdName()">Save Household</button><h3>Members</h3><div class="form-grid"><label>Add Member<input id="newMemberName" maxlength="40" placeholder="Member name" /></label><button class="btn primary" onclick="addMember()">Add Member</button></div>${members || '<p class="muted">No household members yet.</p>'}<div class="card danger-zone"><h3>Delete Household</h3><p class="muted">This resets all Compass data. Export a backup first.</p><button class="btn danger" onclick="deleteHousehold()">Delete Household / Reset Data</button></div>`)}
    ${card('Backup', `<p class="muted">Export everything. Imports are validated, migrated, and previewed before changing live data.</p><div class="button-row"><button class="btn primary" onclick="exportBackup()">Export Everything</button><label class="btn ghost">Choose Backup<input type="file" accept="application/json" class="hidden" onchange="previewImport(event)" /></label></div><div id="importPreview"></div>`)}
    ${card('Activity Log', state.activityLog.slice(0,25).map(a=>recordRow({title:a.action, meta:`${new Date(a.at).toLocaleString()} · ${ownerName(a.memberId)} · ${escapeHtml(a.detail)}`})).join('') || '<p class="muted">No activity yet.</p>')}
  `;
}
function checkSetting(key,label,checked){ return `<label class="check-label"><input type="checkbox" id="rule_${key}" ${checked?'checked':''} /> ${label}</label>`; }
function savePlanningRules(){ ['critical','important','flexible','buckets','goals'].forEach(k=>state.settings.fundedRules[k]=document.getElementById(`rule_${k}`).checked); persist('Planning rules saved'); }
function saveHouseholdName(){ const name = truncate(document.getElementById('householdName').value, LIMITS.householdName); if(!name) return toast('Household name is required.'); state.household.name = name; logActivity('Household renamed', name); persist('Household saved'); }
function addMember(){ const name = truncate(document.getElementById('newMemberName').value, LIMITS.memberName); if(!name) return toast('Member name is required.'); if (state.members.some(m=>normalizeKey(m.name)===normalizeKey(name))) return toast('A member with that name already exists.'); state.members.push({id:uid(),name}); logActivity('Member added', name); persist('Member added'); }
function deleteMember(id){
  const member = state.members.find(m=>m.id===id); if(!member) return;
  confirmAction('Remove Member', `Remove ${member.name}? Records owned by this member will be reassigned to Household for now. In cloud-sync v7, paycheck removal prompts will be added.`, ()=>{
    for (const arrName of ['accounts','bills','buckets','goals','events','paychecks']) state[arrName].forEach(r=>{ if(r.ownerId===id) r.ownerId=OWNER_HOUSEHOLD; });
    state.members = state.members.filter(m=>m.id!==id);
    logActivity('Member removed', member.name);
    persist('Member removed');
  });
}
function deleteHousehold(){ confirmAction('Delete Household', 'This will remove all Compass data and reset the app. Export a backup first. Continue?', ()=>{ state = defaultState(); persist('Household reset'); }); }
function memberOptions(selected){ return state.members.map(m=>`<option value="${m.id}" ${selected===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join(''); }
function openRecord(type, id='', prefill={}){
  const item = id ? getCollection(type).find(x=>x.id===id) : null;
  dialogContext = { type, id, item, prefill };
  document.getElementById('dialogTitle').textContent = `${id?'Edit':'Add'} ${TYPE_LABEL[type]}`;
  document.getElementById('recordForm').innerHTML = buildForm(type, item || prefill || {});
  document.getElementById('recordDialog').showModal();
}
function getCollection(type){ return ({account:state.accounts,bill:state.bills,bucket:state.buckets,goal:state.goals,event:state.events,paycheck:state.paychecks})[type] || []; }
function buildForm(type, item){
  const commonOwner = `<label>Owner<select name="ownerId" required>${memberOptions(item.ownerId || OWNER_HOUSEHOLD)}</select></label>`;
  const nameVal = escapeHtml(item.name || item.title || '');
  const amountVal = item.amount ?? item.targetAmount ?? '';
  if (type === 'account') return formWrap(`
    <div class="form-grid"><label>Account Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Balance<input name="balance" inputmode="decimal" maxlength="10" required value="${escapeHtml(item.balance ?? amountVal ?? '0')}" /></label><label>Include in Planning<select name="includeInPlanning"><option value="true" ${item.includeInPlanning!==false?'selected':''}>Yes</option><option value="false" ${item.includeInPlanning===false?'selected':''}>No</option></select></label>${commonOwner}</div>`);
  if (type === 'bill') return formWrap(`
    <div class="form-grid"><label>Bill Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Amount<input name="amount" inputmode="decimal" maxlength="10" required value="${escapeHtml(amountVal || '')}" /></label><label>Due Date<input name="dueDate" type="date" required value="${escapeHtml(item.dueDate || item.date || todayISO())}" /></label><label>Fixed / Non-fixed<select name="kind" required><option value="fixed" ${item.kind!=='non-fixed'?'selected':''}>Fixed</option><option value="non-fixed" ${item.kind==='non-fixed'?'selected':''}>Non-fixed</option></select></label><label>Recurring<select name="recurrence" required>${RECURRENCE.map(r=>`<option value="${r}" ${(item.recurrence||'one-time')===r?'selected':''}>${recurringLabel(r)}</option>`).join('')}</select></label><label>Priority<select name="priority" required>${PRIORITIES.map(p=>`<option value="${p}" ${(item.priority||'important')===p?'selected':''}>${PRIORITY_LABEL[p]}</option>`).join('')}</select></label>${commonOwner}</div>`);
  if (type === 'bucket') return formWrap(`<div class="form-grid"><label>Bucket Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Target Amount<input name="targetAmount" inputmode="decimal" maxlength="10" required value="${escapeHtml(item.targetAmount ?? item.amount ?? '')}" /></label>${commonOwner}</div>`);
  if (type === 'goal') return formWrap(`<div class="form-grid"><label>Goal Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Target Amount<input name="targetAmount" inputmode="decimal" maxlength="10" required value="${escapeHtml(item.targetAmount ?? item.amount ?? '')}" /></label><label>Current Amount<input name="currentAmount" inputmode="decimal" maxlength="10" value="${escapeHtml(item.currentAmount ?? 0)}" /></label><label>Planned Contribution<input name="plannedContribution" inputmode="decimal" maxlength="10" value="${escapeHtml(item.plannedContribution ?? 0)}" /></label><label>Optional Due Date<input name="dueDate" type="date" value="${escapeHtml(item.dueDate || item.date || '')}" /></label>${commonOwner}</div>`);
  if (type === 'event') return formWrap(`<div class="form-grid"><label>Event Title<input name="title" maxlength="75" required value="${escapeHtml(item.title || item.name || '')}" /></label><label>Start Date<input name="startDate" type="date" required value="${escapeHtml(item.startDate || item.date || todayISO())}" /></label><label>End Date<input name="endDate" type="date" value="${escapeHtml(item.endDate || '')}" /></label>${commonOwner}<label>Linked Savings Goal<select name="linkedGoalId"><option value="">None</option>${state.goals.filter(g=>!g.deleted).map(g=>`<option value="${g.id}" ${item.linkedGoalId===g.id?'selected':''}>${escapeHtml(g.name)}</option>`).join('')}</select></label></div>`);
  if (type === 'paycheck') return formWrap(`<div class="form-grid"><label>Paycheck Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Amount<input name="amount" inputmode="decimal" maxlength="10" required value="${escapeHtml(amountVal || '')}" /></label><label>Next Payday<input name="nextPayday" type="date" required value="${escapeHtml(item.nextPayday || item.date || todayISO())}" /></label><label>Frequency<select name="frequency" required>${RECURRENCE.filter(r=>r!=='one-time').map(r=>`<option value="${r}" ${(item.frequency||'biweekly')===r?'selected':''}>${recurringLabel(r)}</option>`).join('')}</select></label><label>Status<select name="status"><option value="expected" ${(item.status||'expected')==='expected'?'selected':''}>Expected</option><option value="received" ${item.status==='received'?'selected':''}>Received</option></select></label>${commonOwner}</div>`);
  return '';
}
function formWrap(fields){ return `${fields}<div id="formErrors"></div><div class="button-row right"><button class="btn ghost" type="button" onclick="closeDialog()">Cancel</button><button class="btn primary" type="button" onclick="saveRecord()">Save</button></div>`; }
function closeDialog(){ document.getElementById('recordDialog').close(); dialogContext = null; }
function saveRecord(){
  const form = document.getElementById('recordForm'); const data = Object.fromEntries(new FormData(form));
  const type = dialogContext.type; const result = validateAndBuildRecord(type, data, dialogContext.id || uid());
  if (!result.ok) return showFormErrors(result.errors);
  const collection = getCollection(type); const idx = collection.findIndex(x=>x.id===dialogContext.id);
  const duplicate = !dialogContext.id && (type !== 'account' || true) && collection.some(x=>!x.deleted && normalizeKey(x.name || x.title) === normalizeKey(result.record.name || result.record.title));
  const finish = () => {
    if (idx >= 0) collection[idx] = { ...collection[idx], ...result.record, updatedAt:new Date().toISOString() };
    else collection.push({ ...result.record, createdAt:new Date().toISOString() });
    const wasEvent = type === 'event' && !dialogContext.id && !result.record.linkedGoalId;
    logActivity(`${idx>=0?'Updated':'Created'} ${TYPE_LABEL[type]}`, result.record.name || result.record.title);
    closeDialog(); persist(`${TYPE_LABEL[type]} saved`);
    if (wasEvent) promptLinkedGoal(result.record);
  };
  if (duplicate) confirmAction('Possible Duplicate', `A ${TYPE_LABEL[type]} with this name already exists. Continue?`, finish, 'Continue'); else finish();
}
function showFormErrors(errors){ document.getElementById('formErrors').innerHTML = `<div class="field-error">${errors.map(escapeHtml).join('<br>')}</div>`; }
function validateAndBuildRecord(type, d, id){
  const errors=[]; const ownerId = d.ownerId || OWNER_HOUSEHOLD;
  const requireText = (val, label, max=LIMITS.name) => { const v=truncate(val,max); if(!v) errors.push(`${label} is required.`); return v; };
  const requireMoney = (val, label) => { const p=parseMoney(val); if(!p.ok) errors.push(`${label}: ${p.error}`); return p.value; };
  const optionalMoney = (val, label) => { if(String(val??'').trim()==='') return 0; const p=parseMoney(val); if(!p.ok) errors.push(`${label}: ${p.error}`); return p.value; };
  const requireDate = (val, label) => { if(!isRealDate(val)) errors.push(`${label} must be a real calendar date.`); return val; };
  const optionalDate = (val, label) => { if(!val) return ''; if(!isRealDate(val)) errors.push(`${label} must be a real calendar date.`); return val; };
  let record={id, ownerId, deleted:false};
  if (type==='account') record = { ...record, name:requireText(d.name,'Account name'), balance:requireMoney(d.balance,'Balance'), includeInPlanning:d.includeInPlanning === 'true' };
  if (type==='bill') record = { ...record, name:requireText(d.name,'Bill name'), amount:requireMoney(d.amount,'Amount'), dueDate:requireDate(d.dueDate,'Due date'), kind:['fixed','non-fixed'].includes(d.kind)?d.kind:'fixed', recurrence:RECURRENCE.includes(d.recurrence)?d.recurrence:'one-time', priority:PRIORITIES.includes(d.priority)?d.priority:'important' };
  if (type==='bucket') record = { ...record, name:requireText(d.name,'Bucket name'), targetAmount:requireMoney(d.targetAmount,'Target amount') };
  if (type==='goal') record = { ...record, name:requireText(d.name,'Goal name'), targetAmount:requireMoney(d.targetAmount,'Target amount'), currentAmount:optionalMoney(d.currentAmount,'Current amount'), plannedContribution:optionalMoney(d.plannedContribution,'Planned contribution'), dueDate:optionalDate(d.dueDate,'Due date'), linkedEventId:d.linkedGoalId||'' };
  if (type==='event') { const start = requireDate(d.startDate,'Start date'); const end = optionalDate(d.endDate,'End date'); if(start && end && parseDate(end)<parseDate(start)) errors.push('End date cannot be before start date.'); record = { ...record, title:requireText(d.title,'Event title',LIMITS.title), startDate:start, endDate:end, linkedGoalId:d.linkedGoalId || '' }; }
  if (type==='paycheck') record = { ...record, name:requireText(d.name,'Paycheck name'), amount:requireMoney(d.amount,'Amount'), nextPayday:requireDate(d.nextPayday,'Next payday'), frequency:['weekly','biweekly','monthly'].includes(d.frequency)?d.frequency:'biweekly', status:['expected','received'].includes(d.status)?d.status:'expected' };
  return errors.length ? {ok:false, errors} : {ok:true, record};
}
function promptLinkedGoal(eventRecord){
  confirmAction('Create Linked Savings Goal?', `Would you like to create a savings goal for ${eventRecord.title}?`, ()=>openRecord('goal','',{name:eventRecord.title, dueDate:eventRecord.startDate, linkedEventId:eventRecord.id, ownerId:eventRecord.ownerId}), 'Create Goal');
}
function deleteRecord(type,id){
  const collection = getCollection(type); const rec = collection.find(x=>x.id===id); if(!rec)return;
  confirmAction(`Delete ${TYPE_LABEL[type]}`, `Delete “${rec.name || rec.title}”? This cannot be undone.`, ()=>{
    const snapshot = JSON.stringify(rec);
    const idx = collection.findIndex(x=>x.id===id); collection.splice(idx,1);
    logActivity(`Deleted ${TYPE_LABEL[type]}`, rec.name || rec.title);
    localStorage.setItem('compass_last_deleted', JSON.stringify({type,idx,snapshot}));
    persist(`${TYPE_LABEL[type]} deleted. Use Undo Delete if needed.`);
  });
}
function undoDelete(){
  try{ const item = JSON.parse(localStorage.getItem('compass_last_deleted')||'null'); if(!item)return toast('Nothing to undo.'); const collection=getCollection(item.type); collection.splice(item.idx,0,JSON.parse(item.snapshot)); localStorage.removeItem('compass_last_deleted'); persist('Delete undone'); }catch{ toast('Could not undo delete.'); }
}
function markPaycheckReceived(id){
  const p = state.paychecks.find(x=>x.id===id); if(!p)return;
  p.status='received'; logActivity('Paycheck received', p.name, {paycheckId:id}); persist('Paycheck marked received');
  confirmAction('Open Assign Money?', `${p.name} was marked received. Open Assign Money with this paycheck selected?`, ()=>{ selectedAssignPaycheckId=`${id}|${p.nextPayday}`; navigate('assign'); }, 'Open Assign Money');
}
function showInfoModal(title, body){
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').innerHTML = body;
  document.getElementById('confirmOk').className='btn primary';
  document.getElementById('confirmOk').textContent='Close';
  document.getElementById('confirmCancel').classList.add('hidden');
  document.getElementById('confirmOk').onclick=closeConfirm;
  document.getElementById('confirmDialog').showModal();
}
function confirmAction(title, body, onOk, okText='Continue'){
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  document.getElementById('confirmCancel').classList.remove('hidden');
  document.getElementById('confirmOk').className='btn danger';
  document.getElementById('confirmOk').textContent=okText;
  document.getElementById('confirmOk').onclick=()=>{ closeConfirm(); onOk(); };
  document.getElementById('confirmDialog').showModal();
}
function closeConfirm(){ document.getElementById('confirmDialog').close(); document.getElementById('confirmCancel').classList.remove('hidden'); }
function exportBackup(){
  const exportState = { ...state, schemaVersion:SCHEMA_VERSION, exportedAt:new Date().toISOString() };
  const blob = new Blob([JSON.stringify(exportState,null,2)], { type:'application/json' });
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`compass-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup exported');
}
function previewImport(ev){
  const file = ev.target.files?.[0]; if(!file)return;
  if(file.size > MAX_FILE_BYTES){ document.getElementById('importPreview').innerHTML='<div class="field-error">Backup too large. Limit is 5 MB.</div>'; return; }
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      const migrated = migrateBackup(parsed);
      const cleaned = cleanState(migrated.state);
      if(!cleaned.ok) throw new Error(cleaned.errors.join('\n'));
      pendingImport = cleaned.state;
      const s = pendingImport;
      document.getElementById('importPreview').innerHTML = `<div class="import-preview"><strong>Import Preview</strong><p>Schema: ${escapeHtml(parsed.schemaVersion || 'legacy')} → ${SCHEMA_VERSION}</p><p>Accounts: ${s.accounts.length} · Bills: ${s.bills.length} · Buckets: ${s.buckets.length} · Goals: ${s.goals.length} · Events: ${s.events.length} · Paychecks: ${s.paychecks.length}</p><p class="muted">${migrated.warnings.concat(cleaned.warnings).map(escapeHtml).join('<br>') || 'No warnings.'}</p><button class="btn primary" onclick="commitImport()">Import Backup</button></div>`;
    }catch(err){ pendingImport=null; document.getElementById('importPreview').innerHTML = `<div class="field-error">Import failed validation: ${escapeHtml(err.message)}</div>`; }
  };
  reader.readAsText(file);
}
function commitImport(){ if(!pendingImport)return toast('No valid import is ready.'); state = pendingImport; logActivity('Backup imported', `Imported backup into ${state.household.name}`); persist('Backup imported'); pendingImport=null; }
function migrateBackup(input){
  const warnings=[]; const base = defaultState();
  const src = input && typeof input==='object' ? input : {};
  const st = { ...base, ...src };
  st.schemaVersion = SCHEMA_VERSION;
  st.household = src.household || { id:src.activeHouseholdId || base.household.id, name:src.householdName || 'My Household', createdAt:src.createdAt || new Date().toISOString() };
  st.members = Array.isArray(src.members) && src.members.length ? src.members : base.members;
  if(!st.members.some(m=>m.id===OWNER_HOUSEHOLD)) st.members.unshift({id:OWNER_HOUSEHOLD,name:'Household',system:true});
  st.settings = { ...base.settings, ...(src.settings || {}), theme: src.theme || src.settings?.theme || base.settings.theme, aiEndpoint:src.aiEndpoint || src.settings?.aiEndpoint || '' };
  st.settings.fundedRules = { ...base.settings.fundedRules, ...(src.settings?.fundedRules || {}) };
  st.accounts = arr(src.accounts).map(a=>({ id:a.id||uid(), name:a.name||'Account', balance:a.balance ?? a.amount ?? 0, includeInPlanning:a.includeInPlanning ?? (String(a.type||'').toLowerCase().includes('saving') ? false : true), ownerId:a.ownerId||OWNER_HOUSEHOLD }));
  st.bills = arr(src.bills).map(b=>({ id:b.id||uid(), name:b.name||'Bill', amount:b.amount||0, dueDate:b.dueDate||b.date||todayISO(), kind:b.kind || (b.category==='variable'?'non-fixed':'fixed'), recurrence: normalizeRecurrence(b.recurrence || b.recurring || 'one-time'), priority: normalizePriority(b.priority || (b.category==='fixed'?'important':'flexible')), ownerId:b.ownerId||OWNER_HOUSEHOLD }));
  st.buckets = arr(src.buckets).map(b=>({ id:b.id||uid(), name:b.name||'Bucket', targetAmount:b.targetAmount ?? b.amount ?? 0, ownerId:b.ownerId||OWNER_HOUSEHOLD }));
  st.goals = arr(src.goals).map(g=>({ id:g.id||uid(), name:g.name||'Savings Goal', targetAmount:g.targetAmount ?? g.target ?? g.amount ?? 0, currentAmount:g.currentAmount ?? g.current ?? 0, plannedContribution:g.plannedContribution ?? g.contribution ?? 0, dueDate:g.dueDate||g.targetDate||'', linkedEventId:g.linkedEventId||'', ownerId:g.ownerId||OWNER_HOUSEHOLD }));
  st.events = arr(src.events).map(e=>({ id:e.id||uid(), title:e.title||e.name||'Event', startDate:e.startDate||e.date||todayISO(), endDate:e.endDate||'', linkedGoalId:e.linkedGoalId||'', ownerId:e.ownerId||OWNER_HOUSEHOLD }));
  st.paychecks = arr(src.paychecks).map(p=>({ id:p.id||uid(), name:p.name || p.person || 'Paycheck', amount:p.amount||0, nextPayday:p.nextPayday||p.nextDate||p.date||todayISO(), frequency: normalizeRecurrence(p.frequency || p.recurrence || p.recurring || 'biweekly') === 'one-time' ? 'biweekly' : normalizeRecurrence(p.frequency || p.recurrence || p.recurring || 'biweekly'), status:p.status||'expected', ownerId:p.ownerId||OWNER_HOUSEHOLD }));
  st.fundingSessions = arr(src.fundingSessions);
  st.fundingAllocations = arr(src.fundingAllocations);
  st.activityLog = arr(src.activityLog);
  if(src.safeToSpend !== undefined || src.plan) warnings.push('Legacy plan/safe-to-spend fields were ignored because Compass v6 recalculates planning results.');
  return { state:st, warnings };
}
function arr(v){ return Array.isArray(v) ? v : []; }
function normalizeRecurrence(v){ v=String(v||'').toLowerCase(); if(['weekly','biweekly','monthly'].includes(v)) return v; return 'one-time'; }
function normalizePriority(v){ v=String(v||'').toLowerCase(); if(PRIORITIES.includes(v)) return v; return 'important'; }
function cleanState(input){
  const errors=[], warnings=[]; const st = { ...defaultState(), ...input };
  const checkCount=(name)=>{ if(!Array.isArray(st[name])) { st[name]=[]; warnings.push(`${name} was not an array and was reset.`); } if(st[name].length > LIMITS.recordCounts[name]) errors.push(`${name} exceeds the supported record count.`); };
  ['members','accounts','bills','buckets','goals','events','paychecks','fundingSessions','fundingAllocations'].forEach(checkCount);
  st.household = { id:truncate(st.household?.id || uid(),80), name:truncate(st.household?.name || 'My Household',LIMITS.householdName), createdAt:st.household?.createdAt || new Date().toISOString() };
  st.members = st.members.map(m=>({ id:truncate(m.id||uid(),80), name:truncate(m.name||'Member',LIMITS.memberName), system:m.id===OWNER_HOUSEHOLD || m.system===true })).filter(m=>m.name);
  if(!st.members.some(m=>m.id===OWNER_HOUSEHOLD)) st.members.unshift({id:OWNER_HOUSEHOLD,name:'Household',system:true});
  const validOwner=(id)=>st.members.some(m=>m.id===id)?id:OWNER_HOUSEHOLD;
  const num=(v,label)=>{ const p=parseMoney(String(v??0)); if(!p.ok){ warnings.push(`${label} had an invalid amount and was set to 0.`); return 0;} return p.value; };
  const date=(v,label,required=true)=>{ if(!v&&!required)return ''; if(!isRealDate(v)){ warnings.push(`${label} had an invalid date and was set to today.`); return todayISO(); } return v; };
  st.accounts = st.accounts.map(a=>({ id:a.id||uid(), name:truncate(a.name||'Account',LIMITS.name), balance:num(a.balance,'Account balance'), includeInPlanning:a.includeInPlanning!==false, ownerId:validOwner(a.ownerId) }));
  st.bills = st.bills.map(b=>({ id:b.id||uid(), name:truncate(b.name||'Bill',LIMITS.name), amount:num(b.amount,'Bill amount'), dueDate:date(b.dueDate,'Bill due date'), kind:b.kind==='non-fixed'?'non-fixed':'fixed', recurrence:normalizeRecurrence(b.recurrence), priority:normalizePriority(b.priority), ownerId:validOwner(b.ownerId) }));
  st.buckets = st.buckets.map(b=>({ id:b.id||uid(), name:truncate(b.name||'Bucket',LIMITS.name), targetAmount:num(b.targetAmount,'Bucket amount'), ownerId:validOwner(b.ownerId) }));
  st.goals = st.goals.map(g=>({ id:g.id||uid(), name:truncate(g.name||'Savings Goal',LIMITS.name), targetAmount:num(g.targetAmount,'Goal target'), currentAmount:num(g.currentAmount,'Goal current'), plannedContribution:num(g.plannedContribution,'Goal contribution'), dueDate:g.dueDate?date(g.dueDate,'Goal due date',false):'', linkedEventId:g.linkedEventId||'', ownerId:validOwner(g.ownerId) }));
  st.events = st.events.map(e=>({ id:e.id||uid(), title:truncate(e.title||'Event',LIMITS.title), startDate:date(e.startDate,'Event start date'), endDate:e.endDate?date(e.endDate,'Event end date',false):'', linkedGoalId:e.linkedGoalId||'', ownerId:validOwner(e.ownerId) }));
  st.paychecks = st.paychecks.map(p=>({ id:p.id||uid(), name:truncate(p.name||'Paycheck',LIMITS.name), amount:num(p.amount,'Paycheck amount'), nextPayday:date(p.nextPayday,'Paycheck date'), frequency:['weekly','biweekly','monthly'].includes(p.frequency)?p.frequency:'biweekly', status:p.status==='received'?'received':'expected', ownerId:validOwner(p.ownerId) }));
  st.settings = { ...defaultState().settings, ...(st.settings||{}) };
  st.settings.fundedRules = { ...defaultState().settings.fundedRules, ...(st.settings.fundedRules||{}) };
  st.schemaVersion = SCHEMA_VERSION;
  return { ok:errors.length===0, errors, warnings, state:st };
}
function showLinkedImportWarning(){ }
function setupEvents(){
  document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',e=>navigate(e.currentTarget.dataset.nav)));
  document.getElementById('moreBtn').addEventListener('click', openDrawer);
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
  document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);
  document.getElementById('dialogClose').addEventListener('click', closeDialog);
  document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeDrawer(); } });
}
function openDrawer(){ document.getElementById('sideDrawer').classList.add('open'); document.getElementById('drawerBackdrop').classList.add('open'); }
function closeDrawer(){ document.getElementById('sideDrawer').classList.remove('open'); document.getElementById('drawerBackdrop').classList.remove('open'); }
window.openRecord = openRecord; window.deleteRecord = deleteRecord; window.undoDelete = undoDelete; window.markPaycheckReceived = markPaycheckReceived;
window.navigate = navigate; window.moveMonth = moveMonth; window.openCalendarRecord = openCalendarRecord; window.showFundedDetails = showFundedDetails;
window.toggleAllocation = toggleAllocation; window.updateAssignRemaining = updateAssignRemaining; window.saveFundingSession = saveFundingSession; window.gotoFunding = gotoFunding;
window.runSimulator = runSimulator; window.convertSimulator = convertSimulator; window.continueConvertSimulator = continueConvertSimulator;
window.savePlanningRules = savePlanningRules; window.saveHouseholdName = saveHouseholdName; window.addMember = addMember; window.deleteMember = deleteMember; window.deleteHousehold = deleteHousehold;
window.exportBackup = exportBackup; window.previewImport = previewImport; window.commitImport = commitImport; window.closeDialog = closeDialog; window.closeConfirm = closeConfirm; window.persist = persist;
setupEvents();
render();
