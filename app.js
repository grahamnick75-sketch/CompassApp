/* Compass Test Cottagecore Asset Build - based on stable v6.5.2.2 with asset-folder theme layer */
const STORAGE_KEY = 'compass_v6_state';
const HAD_EXISTING_STATE = !!localStorage.getItem(STORAGE_KEY);
const SCHEMA_VERSION = '6.4.0';
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
const BILL_CATEGORIES = ['housing','utilities','subscriptions','transportation','insurance','debt','medical','childcare','taxes','giving','business','other'];
const BILL_CATEGORY_LABEL = {housing:'Housing',utilities:'Utilities',subscriptions:'Subscriptions',transportation:'Transportation',insurance:'Insurance',debt:'Debt Payments',medical:'Medical / Healthcare',childcare:'Childcare / School',taxes:'Taxes / Government',giving:'Giving / Donations',business:'Business / Work',other:'Other'};
const PAYMENT_TYPES = ['unknown','autopay','manual'];
const PAYMENT_LABEL = { unknown:'Not Set', autopay:'Autopay', manual:'Manual Pay' };
const CALENDAR_COLOR_MODES = ['recordType','owner','paymentType','none'];
const ACCOUNT_TYPES = ['checking','savings','cash','credit-card','investment','401k','hsa','other-asset','loan-debt'];
const ACCOUNT_TYPE_LABEL = { checking:'Checking', savings:'Savings', cash:'Cash', 'credit-card':'Credit Card', investment:'Investment', '401k':'401(k) / Retirement', hsa:'HSA', 'other-asset':'Other Asset', 'loan-debt':'Loan / Debt' };
const ASSET_TYPES = ['checking','savings','cash','investment','401k','hsa','other-asset'];
const DEBT_TYPES = ['credit-card','loan-debt'];
const BUCKET_FREQUENCIES = ['weekly','paycheck','monthly'];
const BUCKET_FREQUENCY_LABEL = { weekly:'Weekly', paycheck:'Per Paycheck Cycle', monthly:'Monthly' };
const PAGE_DESCRIPTIONS = {
  accounts:'Accounts show the money Compass can see in your household plan. Mark only the accounts you want included in day-to-day planning so Available to Plan stays accurate.',
  calendar:'The calendar helps you see when bills, paychecks, goals, and events are coming up. Use it to spot tight weeks before they surprise you.',
  bills:'Bills are the obligations your plan needs to protect first. Use priority levels to tell Compass what matters most: Critical bills are funded first, then Important bills, then Flexible bills.',
  buckets:'Buckets are what you use to budget flexible spending like groceries, gas, baby supplies, pets, and household needs. They help you protect everyday life between paychecks without treating those items like fixed bills.',
  goals:'Savings Goals track money you want to build over time for planned needs, emergencies, or future purchases. Compass can help you decide when there is room to contribute.',
  events:'Events are upcoming moments that may affect your money, like birthdays, travel, holidays, or home projects. Link an event to a savings goal when you want to plan ahead for it.',
  paychecks:'Paychecks show the income Compass expects to help fund your plan. Mark a paycheck received when it arrives, then update your account balance so Compass does not double-count it.',
  assign:'Assign Money turns your available cash into a clear funding plan. Choose whether you are assigning from Available to Plan or from a specific paycheck, then Compass will help prioritize bills, buckets, and goals.',
  fundingHistory:'Funding History shows where assigned money has gone over time. Use it to understand what has already been funded and how each paycheck or planning balance was used.',
  simulator:'Decision Simulator helps you test a possible financial choice before you commit to it. Use it to see how a new bill, paycheck, bucket, goal, or event could affect your plan.',
  insights:'Compass Insights summarizes what your plan is telling you. Use Analyst for a factual overview, Advisor for next funding recommendations, and Simulator for what-if questions.'
};
const COLOR_OPTIONS = { blue:'#2563eb', green:'#15803d', orange:'#ea580c', purple:'#7c3aed', red:'#dc2626', gold:'#ca8a04', teal:'#0f766e', gray:'#64748b' };
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
const nl2br = (s='') => escapeHtml(s).replace(/\n/g,'<br>');
const normalizePaymentType = (v) => PAYMENT_TYPES.includes(String(v||'').toLowerCase()) ? String(v||'').toLowerCase() : 'unknown';
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
      theme:'whimsical', aiMode:'advisor', aiEndpoint:'', showAvailableHeader:true, themePromptSeen:false, insightsLastRefreshed:'', assignSourceMode:'balance',
      fundedRules: { critical:true, important:true, flexible:false, buckets:true, goals:false },
      lookAheadDays: 120,
      calendarColorMode:'recordType',
      calendarColors:{
        recordType:{ bill:'red', paycheck:'green', bucket:'blue', goal:'purple', event:'gold' },
        paymentType:{ autopay:'green', manual:'orange', unknown:'gray' },
        owner:{}
      }
    },
    accounts: [ { id:uid(), name:'Checking', type:'checking', balance:0, includeInPlanning:true, ownerId:OWNER_HOUSEHOLD } ],
    bills: [],
    buckets: [ { id:uid(), name:'Groceries', targetAmount:400, frequency:'weekly', ownerId:OWNER_HOUSEHOLD }, { id:uid(), name:'Gas', targetAmount:125, frequency:'weekly', ownerId:OWNER_HOUSEHOLD } ],
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
function planningBalance(extraState=state){ return extraState.accounts.filter(a=>!a.deleted && a.includeInPlanning).reduce((sum,a)=>sum + Number(a.balance || 0), 0); }
function accountType(v){ const raw=String(v||'').toLowerCase().trim(); const aliases={saving:'savings',retirement:'401k','401(k)':'401k','401k-retirement':'401k','credit card':'credit-card',credit:'credit-card',loan:'loan-debt',debt:'loan-debt',asset:'other-asset'}; const key=aliases[raw] || raw; return ACCOUNT_TYPES.includes(key) ? key : 'checking'; }
function isDebtAccount(a){ return DEBT_TYPES.includes(accountType(a.type)); }
function assetsTotal(){ return state.accounts.filter(a=>!a.deleted && ASSET_TYPES.includes(accountType(a.type))).reduce((sum,a)=>sum+Number(a.balance||0),0); }
function debtsTotal(){ return state.accounts.filter(a=>!a.deleted && isDebtAccount(a)).reduce((sum,a)=>sum+Math.abs(Number(a.balance||0)),0); }
function netPosition(){ return assetsTotal() - debtsTotal(); }
function pageIntro(id){ const text = PAGE_DESCRIPTIONS[id] || ''; return text ? `<p class="page-purpose">${escapeHtml(text)}</p>` : ''; }
const PAGE_ASSET_META = {
  accounts:{asset:'accounts', kicker:'Accounts', title:'Your planning shelves', body:'Track the money Compass can see and decide what belongs in day-to-day planning.'},
  bills:{asset:'bills', kicker:'Bills', title:'Tend to obligations', body:'Organize due dates, priorities, and autopay details so the path ahead feels clear.'},
  buckets:{asset:'buckets', kicker:'Buckets', title:'Budget everyday life', body:'Protect flexible spending like groceries, gas, baby needs, pets, and household spending.'},
  goals:{asset:'savings_goals', kicker:'Savings Goals', title:'Grow what matters', body:'Build emergency reserves, trip funds, and future plans with goal-based saving.'},
  events:{asset:'savings_goals', kicker:'Events', title:'Plan financial dates', body:'Connect upcoming money moments to goals so they are easier to prepare for.'},
  paychecks:{asset:'paychecks', kicker:'Paychecks', title:'Welcome fresh income', body:'Plan recurring and one-time paychecks, then mark them received when they land.'},
  calendar:{asset:'calendar', kicker:'Calendar', title:'See the month at a glance', body:'View bills, paychecks, goals, and events in one calm storybook planner.'},
  assign:{asset:'assign_money', kicker:'Assign Money', title:'Direct your dollars', body:'Fund bills, buckets, and goals while Available to Assign follows your choices.'},
  fundingHistory:{asset:'funding_history', kicker:'Funding History', title:'Follow the trail', body:'Review where assigned money has gone and how each funding session shaped the plan.'},
  insights:{asset:'compass_insights', kicker:'Compass Insights', title:'Read the story in your numbers', body:'Switch between Analyst, Advisor, and Simulator perspectives for grounded guidance.'},
  simulator:{asset:'compass_insights', kicker:'Decision Simulator', title:'Try a what-if safely', body:'Test new bills, goals, buckets, and events before adding them to the plan.'},
  settings:{asset:'settings', kicker:'Settings', title:'Shape your Compass', body:'Adjust appearance, privacy, planning rules, backups, and data safety.'}
};
function pageAssetHero(id){
  const meta = PAGE_ASSET_META[id];
  if(!meta) return '';
  return `<div class="asset-hero ${escapeHtml(id)} ${escapeHtml(meta.asset)}" aria-label="${escapeHtml(meta.kicker)} artwork"><div class="asset-hero-copy"><p class="kicker">${escapeHtml(meta.kicker)}</p><strong>${escapeHtml(meta.title)}</strong><span>${escapeHtml(meta.body)}</span></div></div>`;
}

function updateHeaderBalance(){ const el=document.getElementById('availablePill'); if(!el)return; const show=state.settings.showAvailableHeader!==false; el.innerHTML = `<span>Available to Plan</span><strong>${show ? fmtMoney(planningBalance()) : '••••'}</strong>`; el.title='Available to Plan is the total balance of accounts marked Include in Planning.'; }
function explainAvailableToPlan(){ showInfoModal('Available to Plan', '<p>Available to Plan is the total balance of accounts marked <strong>Include in Planning</strong>. It does not include expected paychecks or accounts excluded from planning.</p>'); }
function bucketFrequency(v){ return BUCKET_FREQUENCIES.includes(String(v||'').toLowerCase()) ? String(v||'').toLowerCase() : 'weekly'; }
function weeksInMonth(date=new Date()){ const y=date.getFullYear(), m=date.getMonth(); return Math.round(new Date(y,m+1,0).getDate()/7); }
function bucketMonthlyAmount(bucket, monthDate=calendarCursor){ const amount=Number(bucket.targetAmount||0); const freq=bucketFrequency(bucket.frequency); if(freq==='monthly') return amount; if(freq==='paycheck') return amount * Math.max(1, expandRecurring(state.paychecks, iso(new Date(monthDate.getFullYear(),monthDate.getMonth(),1)), iso(new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0)), 'nextPayday').length); return amount * weeksInMonth(monthDate); }
function reminderItems(days=7){ const end=iso(addDays(parseDate(todayISO()),days)); return expandRecurring(state.bills,todayISO(),end,'dueDate').map(b=>{ const st=itemFundingStatus('bill',b,b.occurrenceDate); const d=daysBetween(todayISO(), b.occurrenceDate); return {...b, remaining:st.remaining, daysAway:d}; }).filter(b=>b.remaining>0).sort((a,b)=>a.occurrenceDate.localeCompare(b.occurrenceDate)); }
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
  // v6.2: include same-day items by making the range inclusive: today through next paycheck.
  const billOccurrences = expandRecurring(state.bills, today, through, 'dueDate')
    .map(b => ({ type:'bill', id:b.id, name:b.name, ownerId:b.ownerId, amount:Number(b.amount||0), occurrenceDate:b.occurrenceDate, dueDate:b.occurrenceDate, priority:b.priority, paymentType:normalizePaymentType(b.paymentType), label:`${PRIORITY_LABEL[b.priority] || 'Flexible'} bill · ${PAYMENT_LABEL[normalizePaymentType(b.paymentType)]} · due ${b.occurrenceDate}` }));
  const bucketTargets = state.buckets.filter(b=>!b.deleted).map(b => ({ type:'bucket', id:b.id, name:b.name, ownerId:b.ownerId, amount:Number(b.targetAmount||0), occurrenceDate:paycheckOccurrence?.occurrenceDate || today, priority:'bucket', label:'Standard bucket' }));
  const goalTargets = state.goals.filter(g=>!g.deleted).map(g => ({ type:'goal', id:g.id, name:g.name, ownerId:g.ownerId, amount:Number(g.plannedContribution||0), occurrenceDate:paycheckOccurrence?.occurrenceDate || today, priority:'goal', label:'Savings goal contribution' })).filter(g=>g.amount>0);
  return [...billOccurrences, ...bucketTargets, ...goalTargets]
    .map(t => ({ ...t, ...itemFundingStatus(t.type, {id:t.id, amount:t.amount, targetAmount:t.amount, plannedContribution:t.amount}, t.occurrenceDate) }))
    .filter(t => t.remaining > 0)
    .sort((a,b)=> priorityRankForTarget(a)-priorityRankForTarget(b) || (a.dueDate||a.occurrenceDate).localeCompare(b.dueDate||b.occurrenceDate) || a.name.localeCompare(b.name));
}
function paycheckAlreadyInBalance(paycheckOccurrence){
  const base = state.paychecks.find(p=>p.id===paycheckOccurrence?.id) || paycheckOccurrence || {};
  return base.balanceUpdatedOnReceive === true && (!base.receivedOccurrenceDate || base.receivedOccurrenceDate === (paycheckOccurrence?.occurrenceDate || paycheckOccurrence?.nextPayday || ''));
}
function assignPoolForPaycheck(paycheckOccurrence){
  const base = planningBalance();
  const addPaycheck = paycheckOccurrence && !paycheckAlreadyInBalance(paycheckOccurrence);
  return { total:base + (addPaycheck ? Number(paycheckOccurrence.amount||0) : 0), base, paycheckAmount:Number(paycheckOccurrence?.amount||0), addPaycheck, mode:addPaycheck?'balancePlusPaycheck':'updatedBalanceOnly' };
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
function advisorTargets(){
  const today = todayISO();
  const through = nextPaycheck()?.occurrenceDate || iso(addDays(parseDate(today),14));
  const pseudoPaycheck = { occurrenceDate: today, id:'advisor', amount:0 };
  const targets = assignTargetsForPaycheck(pseudoPaycheck).filter(t => !t.dueDate || t.dueDate <= through);
  return targets.sort((a,b)=> priorityRankForTarget(a)-priorityRankForTarget(b) || (a.dueDate||a.occurrenceDate).localeCompare(b.dueDate||b.occurrenceDate));
}
function advisorSummary(){
  const cash = planningBalance();
  const next = nextPaycheck();
  const targets = advisorTargets().slice(0,8);
  let remainingCash = cash;
  const lines = [`Available Planning Cash: ${fmtMoney(cash)}`, next ? `Next Paycheck: ${next.name} · ${formatDate(next.occurrenceDate)} · ${fmtMoney(next.amount)}` : 'Next Paycheck: none entered', '', 'Recommended Allocation Order:'];
  if (!targets.length) {
    lines.push('No upcoming bills, buckets, or savings contributions need funding before the next paycheck.');
  } else {
    targets.forEach((t, idx)=>{
      const suggested = Math.max(0, Math.min(remainingCash, Number(t.remaining||0)));
      remainingCash -= suggested;
      const dateText = t.dueDate ? ` due ${formatDate(t.dueDate)}` : '';
      lines.push(`${idx+1}. ${t.name}${dateText} — ${t.label}; remaining ${fmtMoney(t.remaining)}; suggested ${fmtMoney(suggested)}`);
    });
  }
  return lines.join('\n');
}
function advisorCardsHTML(){
  const cash = planningBalance();
  const next = nextPaycheck();
  const targets = advisorTargets().slice(0,8);
  let remainingCash = cash;
  const actionCards = targets.map((t, idx)=>{
    const suggested = Math.max(0, Math.min(remainingCash, Number(t.remaining||0)));
    remainingCash -= suggested;
    const isBill = t.type === 'bill';
    const payment = isBill ? `<span><b>Payment Type:</b> ${PAYMENT_LABEL[normalizePaymentType(t.paymentType)]}</span>` : '';
    return `<div class="advisor-action"><div class="advisor-rank">${idx+1}</div><div class="advisor-body"><h3>${escapeHtml(t.name)}</h3><div class="advisor-grid"><span><b>Type:</b> ${isBill ? `${PRIORITY_LABEL[t.priority] || 'Flexible'} Bill` : TYPE_LABEL[t.type] || t.type}</span>${t.dueDate?`<span><b>Due:</b> ${formatDate(t.dueDate)}</span>`:''}${payment}<span><b>Remaining:</b> ${fmtMoney(t.remaining)}</span><span><b>Suggested:</b> ${fmtMoney(suggested)}</span></div></div></div>`;
  }).join('');
  return `<div class="advisor-summary-grid">${softBox('Available Planning Cash', `<strong class="big-money">${fmtMoney(cash)}</strong>`, 'Money in accounts marked Include in Planning')}${softBox('Next Paycheck', next ? `<strong>${escapeHtml(next.name)}</strong><br>${formatDate(next.occurrenceDate)} · ${fmtMoney(next.amount)}` : '<span class="muted">No paycheck entered</span>', 'Expected income context')}</div><h3>Recommended Allocation Order</h3>${actionCards || '<p class="muted">No upcoming bills, buckets, or savings contributions need funding before the next paycheck.</p>'}`;
}
function insightSummary(mode='advisor'){
  const funded = calculateFundedThrough({includeExpectedIncome:false});
  const projected = calculateFundedThrough({includeExpectedIncome:true});
  const next = nextPaycheck();
  if (mode === 'analyst') {
    return `Funded Through is ${formatDate(funded.throughDate)} using current planning balances only. Projected Through is ${formatDate(projected.throughDate)} when expected income is included. Planning balance is ${fmtMoney(planningBalance())}. ${next ? `Next paycheck is ${next.name} on ${formatDate(next.occurrenceDate)} for ${fmtMoney(next.amount)}.` : 'No upcoming paycheck is entered.'}`;
  }
  if (mode === 'simulator') {
    return `Ask a what-if question in plain English. Examples: “What happens if I put $100 into savings?” or “What if we finance a new vehicle for $650/month?” Compass will compare your current Funded Through and Projected Through dates against the scenario.`;
  }
  return advisorSummary();
}
function extractScenarioAmount(text){
  const s = String(text || '');
  const moneyMatch = s.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
  const numberMatch = s.match(/\b([0-9][0-9,]*(?:\.\d{1,2})?)\b/);
  const raw = moneyMatch?.[1] || numberMatch?.[1] || '';
  const parsed = parseMoney(raw.replace(/,/g,''));
  return parsed.ok ? parsed.value : 0;
}
function scenarioKind(text){
  const s = normalizeKey(text);
  if (/finance|vehicle|car payment|auto loan|loan|monthly|\/month|per month/.test(s)) return 'monthlyExpense';
  if (/saving|savings|emergency fund|transfer|move.*saving/.test(s)) return 'savingsTransfer';
  if (/income|raise|bonus|extra paycheck|deposit/.test(s)) return 'income';
  return 'oneTimeExpense';
}
function calculateFundedThroughWithMonthly({ includeExpectedIncome=false, extraSpend=0, monthlyExpense=0, extraIncome=0 }={}){
  const days = Number(state.settings.lookAheadDays || 120);
  let balance = planningBalance() - Number(extraSpend || 0) + Number(extraIncome || 0);
  let lastGood = todayISO();
  let nextUnfunded = null;
  const events = buildTimeline({ includeExpectedIncome:!!includeExpectedIncome, extraSpend:0, days });
  if (monthlyExpense > 0) {
    let d = parseDate(todayISO());
    for (let guard=0; guard<12 && d <= addDays(parseDate(todayISO()), days); guard++) {
      events.push({ date:iso(d), amount:-monthlyExpense, label:'Scenario monthly payment', type:'simulator' });
      d = addMonths(d, 1);
    }
  }
  events.sort((a,b)=> a.date.localeCompare(b.date) || (b.amount-a.amount));
  for (const ev of events) {
    if (ev.amount >= 0) { balance += ev.amount; continue; }
    if (balance + ev.amount < -0.005) { nextUnfunded = { ...ev, shortfall: Math.abs(balance + ev.amount) }; break; }
    balance += ev.amount;
    lastGood = ev.date;
  }
  if (!nextUnfunded) lastGood = iso(addDays(parseDate(todayISO()), days));
  return { throughDate:lastGood, nextUnfunded, remaining:Math.max(0,balance), mode:includeExpectedIncome?'Projected':'Current' };
}
function runSimulatorAI(){
  const input = document.getElementById('simulatorAIQuestion');
  const out = document.getElementById('simulatorAIOutput');
  const question = (input?.value || '').trim();
  if (!question) { out.innerHTML = '<div class="field-error">Type a what-if question first.</div>'; return; }
  if (question.length > 500) { out.innerHTML = '<div class="field-error">Please keep the scenario under 500 characters.</div>'; return; }
  const amount = extractScenarioAmount(question);
  if (!amount) { out.innerHTML = '<div class="field-error">Include a dollar amount so Compass can simulate the impact.</div>'; return; }
  const kind = scenarioKind(question);
  const currentFunded = calculateFundedThrough({ includeExpectedIncome:false });
  const currentProjected = calculateFundedThrough({ includeExpectedIncome:true });
  const opts = kind === 'monthlyExpense'
    ? { monthlyExpense:amount }
    : kind === 'income'
      ? { extraIncome:amount }
      : { extraSpend:amount };
  const afterFunded = calculateFundedThroughWithMonthly({ includeExpectedIncome:false, ...opts });
  const afterProjected = calculateFundedThroughWithMonthly({ includeExpectedIncome:true, ...opts });
  const label = kind === 'monthlyExpense' ? `${fmtMoney(amount)} recurring monthly payment` : kind === 'income' ? `${fmtMoney(amount)} additional income/deposit` : kind === 'savingsTransfer' ? `${fmtMoney(amount)} moved out of planning cash into savings` : `${fmtMoney(amount)} one-time spending impact`;
  const risk = afterFunded.nextUnfunded ? `Watch-out: ${afterFunded.nextUnfunded.label} may become short by ${fmtMoney(afterFunded.nextUnfunded.shortfall)} on ${formatDate(afterFunded.nextUnfunded.date)}.` : 'No current-cash shortfall appears inside the planning window.';
  out.innerHTML = `<div class="sim-result"><h3>Simulator AI Result</h3><p><strong>Scenario modeled:</strong> ${escapeHtml(label)}</p><div class="summary-list">
    ${recordRow({title:'Funded Through', meta:'Current planning balances only', amount:`${formatDate(currentFunded.throughDate)} → ${formatDate(afterFunded.throughDate)}`})}
    ${recordRow({title:'Projected Through', meta:'Planning balances plus expected income', amount:`${formatDate(currentProjected.throughDate)} → ${formatDate(afterProjected.throughDate)}`})}
    ${recordRow({title:'Planning Cash Impact', meta:escapeHtml(risk), amount: kind === 'income' ? `+${fmtMoney(amount)}` : `-${fmtMoney(amount)}`})}
  </div><p class="muted">This is a local scenario estimate based on your Compass data and does not change any records. Use Decision Simulator if you want to convert a scenario into a bill, bucket, goal, event, or paycheck.</p></div>`;
}
function formatDate(value){ if (!isRealDate(value)) return '—'; return parseDate(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function render(){
  document.documentElement.dataset.theme = (state.settings.theme === 'whimsical' || state.settings.theme === 'cozy') ? '' : state.settings.theme;
  renderDashboard(); renderAccounts(); renderCalendar(); renderBills(); renderBuckets(); renderGoals(); renderEvents(); renderPaychecks(); renderAssign(); renderFundingHistory(); renderSimulator(); renderInsights(); renderSettings(); updateHeaderBalance(); appendGardenFooters();
}
function appendGardenFooters(){ document.querySelectorAll('.screen').forEach(screen=>{ const existing=screen.querySelector('.garden-footer'); if(existing) existing.remove(); if((state.settings.theme==='whimsical'||state.settings.theme==='cozy'||state.settings.theme==='cottage') && screen.innerHTML.trim()) screen.insertAdjacentHTML('beforeend','<div class="garden-footer" aria-hidden="true"></div>'); }); }
function navigate(id){
  activeScreen = id;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.nav === id));
  closeDrawer();
  window.scrollTo({ top:0, behavior:'smooth' });
  render();
}
function card(title, body, extra='', pageId=''){ return `<div class="card ${extra}">${pageId?pageAssetHero(pageId):''}<div class="section-head"><h2>${title}</h2></div>${pageId?pageIntro(pageId):''}${body}</div>`; }
function softBox(title, body, meta='', cls=''){ return `<div class="soft-box ${cls}"><div><strong>${escapeHtml(title)}</strong>${meta?`<small>${meta}</small>`:''}</div><div>${body}</div></div>`; }
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
  const flow = recentSession ? fundingMap(recentSession) : '';
  const hasCoreData = planningBalance() > 0 || state.bills.some(b=>!b.deleted) || state.paychecks.some(p=>!p.deleted);
  const upcoming = dashboardUpcomingItems();
  document.getElementById('dashboard').innerHTML = `
    <section class="dashboard-shell">
      <div class="dashboard-hero ${hasCoreData ? '' : 'empty'}" role="button" onclick="showFundedDetails(false)">
        <div class="hero-orb">⌖</div>
        <p class="kicker">${hasCoreData ? 'Funded Through' : 'Welcome to Compass'}</p>
        <div class="hero-date">${hasCoreData ? formatShortDate(funded.throughDate) : 'Find your footing'}</div>
        <span class="status-pill ${stat.cls}">${hasCoreData ? `${stat.icon} ${stat.text}` : 'Start with your first account'}</span>
        <p class="hero-copy">${hasCoreData ? 'A current-cash reality check using only accounts included in planning. Tap for details.' : 'Compass is a calm planning dashboard for paychecks, bills, buckets, and goals.'}</p>
      </div>

      ${!hasCoreData ? onboardingHTML() : ''}

      <div class="dashboard-grid">
        <button class="dash-card projected" onclick="showFundedDetails(true)">
          <span>Projected Through</span>
          <strong>${hasCoreData ? formatShortDate(projected.throughDate) : 'Not ready yet'}</strong>
          <small>Includes expected income</small>
        </button>
        <button class="dash-card balance" onclick="navigate('accounts')">
          <span>Available to Plan</span>
          <strong>${fmtMoney(planningBalance())}</strong>
          <small>${planningAccountCount()} account${planningAccountCount()===1?'':'s'} included</small>
        </button>
        <button class="dash-card paycheck" onclick="navigate('paychecks')">
          <span>Next Paycheck</span>
          <strong>${next ? formatShortDate(next.occurrenceDate) : 'Add one'}</strong>
          <small>${next ? `${escapeHtml(next.name)} · ${fmtMoney(next.amount)} · ${daysBetween(todayISO(), next.occurrenceDate)} days` : 'Set up income cadence'}</small>
        </button>
      </div>

      <div class="dashboard-grid mini-dashboard-grid">
        <button class="dash-card wealth" onclick="navigate('accounts')"><span>360 Wealth View</span><strong>${fmtMoney(netPosition())}</strong><small>Assets minus debts</small></button>
        <button class="dash-card reminders" onclick="navigate('calendar')"><span>Due Soon</span><strong>${reminderItems(7).length}</strong><small>Unfunded bills due in 7 days</small></button>
        <button class="dash-card privacy" onclick="navigate('settings')"><span>Header Balance</span><strong>${state.settings.showAvailableHeader!==false?'Shown':'Hidden'}</strong><small>Privacy setting</small></button>
      </div>

      <div class="dashboard-two">
        <div class="polished-card insight-panel">
          <div class="card-title-row">
            <div><p class="kicker">Compass Insight</p><h2>What matters right now</h2></div>
            <button class="mini-btn" onclick="navigate('insights')">Open</button>
          </div>
          <div class="insight-feature advisor-dashboard">${advisorCardsHTML()}</div>
        </div>
        <div class="polished-card next-panel">
          <div class="card-title-row">
            <div><p class="kicker">Coming Up</p><h2>Next few items</h2></div>
            <button class="mini-btn" onclick="navigate('calendar')">Calendar</button>
          </div>
          ${upcoming.length ? upcoming.map(item=>`<div class="mini-row"><span>${escapeHtml(item.label)}</span><strong>${item.amount}</strong><small>${item.date}</small></div>`).join('') : `<div class="empty-mini"><strong>No upcoming items yet</strong><span>Add bills and paychecks from the menu to make Compass useful.</span></div>`}
        </div>
      </div>

      <div class="polished-card funding-panel">
        <div class="card-title-row">
          <div><p class="kicker">Funding Map</p><h2>${recentSession ? 'Last assignment' : 'No assignment yet'}</h2></div>
          <button class="mini-btn" onclick="navigate('assign')">Assign Money</button>
        </div>
        ${recentSession ? `<div class="pretty-flow">${fundingMapHTML(recentSession)}</div>` : emptyFundingMapHTML()}
      </div>
    </section>
  `;
}
function planningAccountCount(){ return state.accounts.filter(a=>!a.deleted && a.includeInPlanning).length; }
function dashboardUpcomingItems(){
  const out=[];
  const bills = expandRecurring(state.bills, todayISO(), iso(addDays(parseDate(todayISO()), 30)), 'dueDate').slice(0,4);
  bills.forEach(b=>out.push({label:b.name, amount:fmtMoney(b.amount), date:formatShortDate(b.occurrenceDate), raw:b.occurrenceDate}));
  const pay = upcomingPaychecks(30).slice(0,2);
  pay.forEach(p=>out.push({label:p.name, amount:`+${fmtMoney(p.amount)}`, date:formatShortDate(p.occurrenceDate), raw:p.occurrenceDate}));
  return out.sort((a,b)=>a.raw.localeCompare(b.raw)).slice(0,5);
}
function onboardingHTML(){
  return `<div class="onboarding-card">
    <div><p class="kicker">Set up in a few minutes</p><h2>Build your planning picture</h2><p class="muted">Start with one planning account, your next paycheck, and your most important bills. You can import a backup from Settings if you already have one.</p></div>
    <div class="onboarding-actions">
      <button class="btn primary" onclick="navigate('accounts')">Add Account</button>
      <button class="btn ghost" onclick="navigate('paychecks')">Add Paycheck</button>
      <button class="btn ghost" onclick="navigate('bills')">Add Bill</button>
      <button class="btn ghost" onclick="navigate('settings')">Import Backup</button>
    </div>
  </div>`;
}
function fundingMapHTML(session){
  return `<div class="flow-source"><span>${escapeHtml(session.paycheckName)}</span><strong>${fmtMoney(session.paycheckAmount)}</strong></div><div class="flow-paths">${session.allocations.map((a,idx)=>`<div class="flow-destination"><span class="flow-line"></span><div><strong>${escapeHtml(a.targetName)}</strong><small>${TYPE_LABEL[a.targetType] || a.targetType}</small></div><b>${fmtMoney(a.amount)}</b></div>`).join('')}</div>`;
}
function emptyFundingMapHTML(){
  return `<div class="empty-flow"><div class="flow-source"><span>Future paycheck</span><strong>$0.00</strong></div><div class="flow-paths ghost-flow"><div class="flow-destination"><span class="flow-line"></span><div><strong>Mortgage</strong><small>Bill</small></div><b>$0</b></div><div class="flow-destination"><span class="flow-line"></span><div><strong>Groceries</strong><small>Bucket</small></div><b>$0</b></div><div class="flow-destination"><span class="flow-line"></span><div><strong>Emergency Fund</strong><small>Goal</small></div><b>$0</b></div></div><p class="muted">After your first paycheck assignment, Compass will show where the money went.</p></div>`;
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
    meta:`Type: ${ACCOUNT_TYPE_LABEL[accountType(a.type)]} · Owner: ${ownerName(a.ownerId)} · ${a.includeInPlanning?'Included in planning':'Excluded from planning'}`,
    amount:fmtMoney(a.balance),
    chips:`<span class="chip ${a.includeInPlanning?'good':'warn'}">${a.includeInPlanning?'Planning':'Not Planning'}</span>`,
    actions:actionButtons('account',a.id)
  })).join('');
  const wealth = `<div class="wealth-grid">
    ${softBox('Available to Plan', `<strong>${fmtMoney(planningBalance())}</strong>`, 'Included planning accounts')}
    ${softBox('Other Assets', `<strong>${fmtMoney(Math.max(0, assetsTotal()-planningBalance()))}</strong>`, 'Excluded assets and long-term accounts')}
    ${softBox('Debts', `<strong>-${fmtMoney(debtsTotal())}</strong>`, 'Credit card and loan/debt accounts')}
    ${softBox('Estimated Net Position', `<strong>${fmtMoney(netPosition())}</strong>`, 'Assets minus debts')}
  </div>`;
  document.getElementById('accounts').innerHTML = card('Accounts', `<div class="button-row"><button class="btn primary" onclick="openRecord('account')">Add Account</button></div><h3>360 Wealth View</h3>${wealth}${rows || emptyState('Your path begins here. Add your first account to start planning.', `<button class="btn primary" onclick="openRecord('account')">Add Account</button>`)}`, '', 'accounts');
}
function renderBills(){
  const rows = state.bills.filter(b=>!b.deleted).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(b=>{
    const occurrenceDate = nextOccurrenceDate(b.dueDate, b.recurrence);
    const st = itemFundingStatus('bill', b, occurrenceDate);
    return recordRow({ title:b.name, meta:`${PRIORITY_LABEL[b.priority]} · ${b.kind === 'fixed'?'Fixed':'Non-fixed'} · Payment Type: ${PAYMENT_LABEL[normalizePaymentType(b.paymentType)]} · Due ${formatDate(b.dueDate)} · ${recurringLabel(b.recurrence)} · Owner: ${ownerName(b.ownerId)}`, amount:fmtMoney(b.amount), chips:`<span class="chip ${st.status==='funded'?'good':st.status==='partial'?'warn':''}">${st.status}</span>`, actions:`<button class="btn ghost" onclick="gotoFunding('bill','${b.id}','${occurrenceDate}')">History</button>${actionButtons('bill',b.id)}`, progress:{pct:st.pct,label:`${fmtMoney(st.funded)} / ${fmtMoney(st.target)} funded`} });
  }).join('');
  document.getElementById('bills').innerHTML = card('Bills', `<div class="button-row"><button class="btn primary" onclick="openRecord('bill')">Add Bill</button></div>${rows || emptyState('No bills mapped yet. Add upcoming obligations so Compass can guide your route.')}`, '', 'bills');
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
    return recordRow({ title:b.name, meta:`Standard bucket · ${BUCKET_FREQUENCY_LABEL[bucketFrequency(b.frequency)]} · Owner: ${ownerName(b.ownerId)}`, amount:fmtMoney(b.targetAmount), actions:`<button class="btn ghost" onclick="gotoFunding('bucket','${b.id}','${date}')">History</button>${actionButtons('bucket',b.id)}`, progress:{pct:st.pct,label:`${fmtMoney(st.funded)} / ${fmtMoney(st.target)} funded for current cycle`} });
  }).join('');
  document.getElementById('buckets').innerHTML = card('Buckets', `<div class="button-row"><button class="btn primary" onclick="openRecord('bucket')">Add Bucket</button></div>${rows || emptyState('No buckets yet.')}`, '', 'buckets');
}
function renderGoals(){
  const rows = state.goals.filter(g=>!g.deleted).map(g=>{
    const date = nextPaycheck()?.occurrenceDate || todayISO();
    const st = itemFundingStatus('goal', g, date);
    const currentPct = Number(g.targetAmount)>0 ? (Number(g.currentAmount||0)/Number(g.targetAmount))*100 : 0;
    return recordRow({ title:g.name, meta:`Due: ${g.dueDate?formatDate(g.dueDate):'Optional'} · Owner: ${ownerName(g.ownerId)} · Contribution: ${fmtMoney(g.plannedContribution)}`, amount:`${fmtMoney(g.currentAmount)} / ${fmtMoney(g.targetAmount)}`, actions:`<button class="btn ghost" onclick="gotoFunding('goal','${g.id}','${date}')">History</button>${actionButtons('goal',g.id)}`, progress:{pct:currentPct,label:`${Math.round(currentPct)}% of goal saved`} });
  }).join('');
  document.getElementById('goals').innerHTML = card('Savings Goals', `<div class="button-row"><button class="btn primary" onclick="openRecord('goal')">Add Savings Goal</button></div>${rows || emptyState('No savings goals yet.')}`, '', 'goals');
}
function renderEvents(){
  const rows = state.events.filter(e=>!e.deleted).sort((a,b)=>a.startDate.localeCompare(b.startDate)).map(e=> recordRow({ title:e.title, meta:`${formatDate(e.startDate)}${e.endDate?`–${formatDate(e.endDate)}`:''} · Owner: ${ownerName(e.ownerId)} ${e.linkedGoalId?`· Linked goal: ${state.goals.find(g=>g.id===e.linkedGoalId)?.name || 'Missing goal'}`:''}`, actions:actionButtons('event',e.id)})).join('');
  document.getElementById('events').innerHTML = card('Events', `<div class="button-row"><button class="btn primary" onclick="openRecord('event')">Add Event</button></div>${rows || emptyState('No events yet.')}`, '', 'events');
}
function renderPaychecks(){
  const rows = state.paychecks.filter(p=>!p.deleted).sort((a,b)=>a.nextPayday.localeCompare(b.nextPayday)).map(p=> recordRow({
    title:p.name,
    meta:`Next payday: ${formatDate(p.nextPayday)} · ${recurringLabel(p.frequency)} · Owner: ${ownerName(p.ownerId)}`,
    amount:fmtMoney(p.amount),
    chips:`<span class="chip ${p.status==='received'?'good':''}">${p.status}</span>`,
    actions:`${p.status==='received'?'':`<button class="btn good" onclick="markPaycheckReceived('${p.id}')">Mark Received</button>`}${actionButtons('paycheck',p.id)}`
  })).join('');
  document.getElementById('paychecks').innerHTML = card('Paychecks', `<div class="button-row"><button class="btn primary" onclick="openRecord('paycheck')">Add Paycheck</button></div>${rows || emptyState('No paychecks on the horizon. Add an expected paycheck to power planning.')}`, '', 'paychecks');
}
function renderCalendar(){
  const y = calendarCursor.getFullYear(), m = calendarCursor.getMonth();
  const first = new Date(y,m,1), last = new Date(y,m+1,0), start = addDays(first, -first.getDay()), end = addDays(last, 6-last.getDay());
  const startIso = iso(start), endIso = iso(end);
  const events = [];
  expandRecurring(state.bills, startIso, endIso, 'dueDate').forEach(b=>events.push({date:b.occurrenceDate, type:'bill', title:b.name, id:b.id, ownerId:b.ownerId, paymentType:normalizePaymentType(b.paymentType)}));
  expandRecurring(state.paychecks, startIso, endIso, 'nextPayday').forEach(p=>events.push({date:p.occurrenceDate, type:'paycheck', title:p.name, id:p.id, ownerId:p.ownerId}));
  state.events.filter(e=>!e.deleted && isRealDate(e.startDate)).forEach(e=>{ if(parseDate(e.startDate)>=start && parseDate(e.startDate)<=end) events.push({date:e.startDate,type:'event',title:e.title,id:e.id, ownerId:e.ownerId}); });
  state.goals.filter(g=>!g.deleted && isRealDate(g.dueDate)).forEach(g=>{ if(parseDate(g.dueDate)>=start && parseDate(g.dueDate)<=end) events.push({date:g.dueDate,type:'goal',title:g.name,id:g.id, ownerId:g.ownerId}); });
  let days = '';
  for(let d=new Date(start); d<=end; d=addDays(d,1)){
    const dayIso = iso(d);
    const items = events.filter(e=>e.date===dayIso);
    days += `<div class="day ${d.getMonth()!==m?'out':''}" ondblclick="openRecord('event','',{startDate:'${dayIso}'})"><div class="day-num">${d.getDate()}</div>${items.map(e=>`<span class="event-pill ${e.type}" ${calendarPillStyle(e)} onclick="openCalendarRecord('${e.type}','${e.id}')" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`).join('')}</div>`;
  }
  const monthName = calendarCursor.toLocaleString(undefined,{month:'long',year:'numeric'});
  document.getElementById('calendar').innerHTML = card('Calendar', `
    <div class="calendar-head"><button class="btn ghost" onclick="moveMonth(-1)">←</button><h2>${monthName}</h2><div class="button-row"><button class="btn ghost" onclick="showMonthlyOutlook()">Monthly Outlook</button><button class="btn ghost" onclick="moveMonth(1)">→</button></div></div>
    <div class="button-row"><button class="btn primary" onclick="openRecord('event')">Add Event</button><button class="btn ghost" onclick="openRecord('bill')">Add Bill</button><button class="btn ghost" onclick="openRecord('paycheck')">Add Paycheck</button></div>
    <div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="day-name">${d}</div>`).join('')}${days}</div>
    <p class="muted small">Double-tap a day to add an event on that date.</p>`, '', 'calendar');
}
function openCalendarRecord(type,id){ if(type==='bill') openRecord('bill',id); else if(type==='paycheck') openRecord('paycheck',id); else if(type==='goal') openRecord('goal',id); else openRecord('event',id); }
function moveMonth(delta){ calendarCursor.setMonth(calendarCursor.getMonth()+delta); renderCalendar(); }

function calendarColorKey(event){
  const mode = state.settings.calendarColorMode || 'recordType';
  if (mode === 'none') return null;
  if (mode === 'owner') return state.settings.calendarColors?.owner?.[event.ownerId] || state.settings.calendarColors?.owner?.[OWNER_HOUSEHOLD] || 'blue';
  if (mode === 'paymentType') {
    if (event.type === 'bill') return state.settings.calendarColors?.paymentType?.[normalizePaymentType(event.paymentType)] || 'gray';
    return state.settings.calendarColors?.recordType?.[event.type] || 'gray';
  }
  return state.settings.calendarColors?.recordType?.[event.type] || 'gray';
}
function calendarPillStyle(event){
  const key = calendarColorKey(event);
  if(!key) return '';
  const color = COLOR_OPTIONS[key] || key;
  return `style="background:${color};color:white;border-left:0"`;
}
function monthlyOutlookData(){
  const y = calendarCursor.getFullYear(), m = calendarCursor.getMonth();
  const start = new Date(y,m,1), end = new Date(y,m+1,0);
  const startIso = iso(start), endIso = iso(end);
  const incomes = expandRecurring(state.paychecks, startIso, endIso, 'nextPayday');
  const incomeTotal = incomes.reduce((sum,p)=>sum+Number(p.amount||0),0);
  const fixedBills = expandRecurring(state.bills, startIso, endIso, 'dueDate').filter(b=>b.kind !== 'non-fixed');
  const fixedTotal = fixedBills.reduce((sum,b)=>sum+Number(b.amount||0),0);
  const bucketTotal = state.buckets.filter(b=>!b.deleted).reduce((sum,b)=>sum+bucketMonthlyAmount(b, calendarCursor),0);
  const goalTotal = state.goals.filter(g=>!g.deleted).reduce((sum,g)=>sum+Number(g.plannedContribution||0),0);
  return { month: calendarCursor.toLocaleString(undefined,{month:'long',year:'numeric'}), incomeTotal, fixedTotal, bucketTotal, goalTotal, net: incomeTotal - fixedTotal - bucketTotal - goalTotal };
}
function showMonthlyOutlook(){
  const o = monthlyOutlookData();
  showInfoModal(`${o.month} Summary`, `
    <div class="summary-list">
      ${recordRow({title:'Expected Income', amount:fmtMoney(o.incomeTotal), meta:'Paycheck occurrences in this month'})}
      ${recordRow({title:'Fixed Bills', amount:fmtMoney(o.fixedTotal), meta:'Fixed bill occurrences due this month'})}
      ${recordRow({title:'Buckets', amount:fmtMoney(o.bucketTotal), meta:'Bucket targets based on each bucket frequency'})}
      ${recordRow({title:'Savings Goals', amount:fmtMoney(o.goalTotal), meta:'Planned contributions for this month'})}
      ${recordRow({title:'Net Outlook', amount:fmtMoney(o.net), meta:'Income minus bills, buckets, and savings goals'})}
    </div>`);
}

function assignTargetsForSource(selected){
  return assignTargetsForPaycheck(selected || { id:'balance-source', occurrenceDate:todayISO(), amount:0 });
}
function assignPoolForSource(selected){
  if ((state.settings.assignSourceMode || 'balance') === 'balance') return { total:planningBalance(), base:planningBalance(), paycheckAmount:0, addPaycheck:false, mode:'availableToPlan' };
  return selected ? assignPoolForPaycheck(selected) : { total:planningBalance(), base:planningBalance(), paycheckAmount:0, addPaycheck:false, mode:'availableToPlan' };
}
function renderAssign(){
  const paychecks = upcomingPaychecks(90);
  const sourceMode = state.settings.assignSourceMode || 'balance';
  const selected = paychecks.find(p=>assignKey(p)===selectedAssignPaycheckId) || paychecks[0];
  if (sourceMode === 'paycheck' && selected && selectedAssignPaycheckId !== assignKey(selected)) selectedAssignPaycheckId = assignKey(selected);
  const targets = assignTargetsForSource(sourceMode === 'paycheck' ? selected : null);
  const pool = assignPoolForSource(sourceMode === 'paycheck' ? selected : null);
  const sourceSelector = `<div class="funding-source"><label><input type="radio" name="assignSource" value="balance" ${sourceMode==='balance'?'checked':''} onchange="setAssignSource('balance')" /> <strong>Available to Plan</strong><span>Use money already in accounts marked Include in Planning.</span></label><label><input type="radio" name="assignSource" value="paycheck" ${sourceMode==='paycheck'?'checked':''} onchange="setAssignSource('paycheck')" /> <strong>Paycheck</strong><span>Use a specific paycheck to fund upcoming items.</span></label></div>`;
  const paycheckSelect = sourceMode === 'paycheck' ? `<div class="form-grid"><label>Selected Paycheck<select id="assignPaycheck" onchange="selectedAssignPaycheckId=this.value; renderAssign()">${paychecks.map(p=>`<option value="${assignKey(p)}" ${assignKey(p)===selectedAssignPaycheckId?'selected':''}>${escapeHtml(p.name)} · ${formatDate(p.occurrenceDate)} · ${fmtMoney(p.amount)}</option>`).join('')}</select></label></div>` : '';
  const help = sourceMode === 'balance' ? 'Using Available to Plan only. No paycheck is required.' : (pool.addPaycheck ? `Available to Plan ${fmtMoney(pool.base)} + Paycheck ${fmtMoney(pool.paycheckAmount)}` : `Using updated planning balance only. Paycheck already reflected in account balance.`);
  document.getElementById('assign').innerHTML = card('Assign Money', `
    ${sourceSelector}${paycheckSelect}
    <p class="muted">Suggested plan sorted by Critical Bills → Important Bills → Buckets → Flexible Bills → Savings Goals. Check items and adjust amounts; remaining funds update immediately.</p>
    <div class="assign-sticky"><div class="kicker">Available to Assign</div><div class="assign-total" id="assignRemaining">${fmtMoney(pool.total)}</div><div class="field-help">${escapeHtml(help)}</div></div>
    <div id="allocationRows">${targets.map((t,i)=>allocationHTML(t,i)).join('') || '<p class="muted">No recommended items to fund before the next paycheck.</p>'}</div>
    <div class="button-row"><button class="btn primary" onclick="saveFundingSession()">Save Funding Session</button></div>`, '', 'assign');
  setTimeout(updateAssignRemaining,0);
}
function setAssignSource(mode){ state.settings.assignSourceMode = mode === 'paycheck' ? 'paycheck' : 'balance'; persist('Funding source updated'); }
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
  let remaining = assignPoolForSource((state.settings.assignSourceMode || 'balance') === 'paycheck' ? selected : null).total;
  document.querySelectorAll('#allocationRows .allocation-row').forEach(row=>{
    const checked = row.querySelector('.assign-check')?.checked;
    const val = parseMoney(row.querySelector('.assign-amount')?.value || '0');
    if (checked && val.ok) remaining -= val.value;
  });
  const el = document.getElementById('assignRemaining'); if(el){ el.textContent = fmtMoney(remaining); el.classList.toggle('danger-text', remaining < 0); }
}
function saveFundingSession(){
  const paychecks = upcomingPaychecks(90); const selected = paychecks.find(p=>assignKey(p)===selectedAssignPaycheckId) || paychecks[0];
  const sourceMode = state.settings.assignSourceMode || 'balance';
  if (sourceMode === 'paycheck' && !selected) return toast('Add a paycheck first or switch funding source to Available to Plan.');
  const allocations = [];
  for (const row of document.querySelectorAll('#allocationRows .allocation-row')) {
    if (!row.querySelector('.assign-check')?.checked) continue;
    const parsed = parseMoney(row.querySelector('.assign-amount')?.value || '0');
    if (!parsed.ok || parsed.value <= 0) return toast('Fix allocation amounts before saving.');
    allocations.push({ targetType:row.dataset.type, targetId:row.dataset.id, occurrenceDate:row.dataset.date, targetName:row.dataset.name, amount:parsed.value });
  }
  if (!allocations.length) return toast('Select at least one item to fund.');
  const sessionId = uid();
  const pool = assignPoolForSource(sourceMode === 'paycheck' ? selected : null);
  const session = { id:sessionId, at:new Date().toISOString(), memberId:OWNER_HOUSEHOLD, paycheckId:sourceMode === 'paycheck' ? selected.id : '', paycheckName:sourceMode === 'paycheck' ? selected.name : 'Available to Plan', paycheckAmount:sourceMode === 'paycheck' ? Number(selected.amount||0) : 0, planningBalance:planningBalance(), poolMode:pool.mode, fundingSource:sourceMode, paycheckIncludedInBalance:sourceMode === 'paycheck' ? !pool.addPaycheck : true, allocations:allocations.map(a=>({...a})) };
  state.fundingSessions.unshift(session);
  allocations.forEach(a=>state.fundingAllocations.push({ id:uid(), sessionId, at:session.at, ...a }));
  logActivity('Funding session saved', `${session.paycheckName} funded ${allocations.length} items`, { sessionId });
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
  document.getElementById('fundingHistory').innerHTML = card('Funding History', `${body || '<p class="muted">Nothing funded yet. Once money is assigned, your funding trail will appear here.</p>'}`, '', 'fundingHistory');
}
function gotoFunding(type,id,date){ navigate('fundingHistory'); setTimeout(()=>toast('Funding history opened.'),0); }
function renderSimulator(){
  document.getElementById('simulator').innerHTML = card('Decision Simulator', `
    <div class="form-grid">
      <label>Name<input id="simName" maxlength="75" value="${escapeHtml(simulatorDraft?.name || '')}" placeholder="Disneyland Trip" /></label>
      <label>Amount<input id="simAmount" inputmode="decimal" maxlength="10" value="${simulatorDraft?.amount || ''}" placeholder="899.00" /></label>
      <label>Date<input id="simDate" type="date" value="${simulatorDraft?.date || todayISO()}" /></label>
    </div>
    <div class="button-row"><button class="btn primary" onclick="runSimulator()">Run Simulation</button><button class="btn ghost" onclick="convertSimulator()">Convert</button></div>
    <div id="simOutput">${simulatorDraft?.output || ''}</div>`, '', 'simulator');
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
function refreshInsights(){ state.settings.insightsLastRefreshed = new Date().toISOString(); persist('Insights refreshed'); }
function lastRefreshedText(){ return state.settings.insightsLastRefreshed ? `Last refreshed: ${new Date(state.settings.insightsLastRefreshed).toLocaleString()}` : 'Last refreshed: Not yet'; }
function renderInsights(){
  const cards = [
    `<div class="insight-card"><p class="kicker">Analyst</p><p>${nl2br(insightSummary('analyst'))}</p><button class="btn ${state.settings.aiMode==='analyst'?'primary':'ghost'}" onclick="state.settings.aiMode='analyst'; persist('AI mode saved')">Set Default</button></div>`,
    `<div class="insight-card advisor-card"><p class="kicker">Advisor</p>${advisorCardsHTML()}<button class="btn ${state.settings.aiMode==='advisor'?'primary':'ghost'}" onclick="state.settings.aiMode='advisor'; persist('AI mode saved')">Set Default</button></div>`,
    `<div class="insight-card simulator-ai-card"><p class="kicker">Simulator</p><p>${nl2br(insightSummary('simulator'))}</p><label>Ask a what-if question<textarea id="simulatorAIQuestion" maxlength="500" placeholder="What happens if I put $100 extra into savings?
What if we finance a new vehicle for $650/month?"></textarea></label><div class="button-row"><button class="btn primary" onclick="runSimulatorAI()">Run What-If</button><button class="btn ${state.settings.aiMode==='simulator'?'primary':'ghost'}" onclick="state.settings.aiMode='simulator'; persist('AI mode saved')">Set Default</button></div><div id="simulatorAIOutput" class="ai-output small"></div></div>`
  ];
  document.getElementById('insights').innerHTML = card('Compass Insights', `
    <div class="button-row"><button class="btn primary" onclick="refreshInsights()">Refresh Insights</button><span class="muted small">${escapeHtml(lastRefreshedText())}</span></div>
    <div class="insight-carousel">${cards.join('')}</div>
    <div class="card"><h3>AI Connection</h3><p class="muted">A secure AI proxy can be connected later. Local summaries and what-if estimates are shown until then.</p><label>AI Proxy Endpoint<input id="aiEndpoint" value="${escapeHtml(state.settings.aiEndpoint || '')}" maxlength="250" /></label><button class="btn primary" onclick="state.settings.aiEndpoint=document.getElementById('aiEndpoint').value.trim(); persist('AI endpoint saved')">Save Endpoint</button></div>
  `, '', 'insights');
}
function renderSettings(){
  const topic = (key,title,summary,status='') => `<button class="settings-topic" onclick="openSettingsTopic('${key}')"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(summary)}</span>${status?`<small>${escapeHtml(status)}</small>`:''}</div><b>Open</b></button>`;
  const themeLabel = state.settings.theme === 'cottage' ? 'Cottagecore Garden' : state.settings.theme === 'dark' ? 'Dark' : state.settings.theme === 'classic' ? 'Classic' : 'Whimsical Compass';
  document.getElementById('settings').innerHTML = card('Settings', `
    <div class="settings-topic-grid">
      ${topic('appearance','Appearance & Theme','Choose Classic, Dark, Whimsical Compass, or Cottagecore Garden.','Current: '+themeLabel)}
      ${topic('privacy','Privacy & Header','Control whether Available to Plan appears in the header.', state.settings.showAvailableHeader!==false?'Header balance: shown':'Header balance: hidden')}
      ${topic('planning','Planning Rules','Choose what Compass includes in Funded Through and recommendations.')}
      ${topic('calendar','Calendar Display','Control calendar color coding by record type, owner, or payment type.', 'Current: '+(state.settings.calendarColorMode||'recordType'))}
      ${topic('household','Household','Manage household name, members, and reset options.')}
      ${topic('backup','Backup & Import','Export everything or import a validated backup with preview.')}
      ${topic('activity','Activity Log','Review recent changes made in Compass.')}
      ${topic('ai','AI Connection','Local summaries now; secure AI proxy later.')}
      ${topic('safety','Data Safety','View schema version, local storage, and import guardrails.')}
    </div>
  `, 'settings-home', 'settings');
}
function checkSetting(key,label,checked){ return `<label class="check-label"><input type="checkbox" id="rule_${key}" ${checked?'checked':''} /> ${label}</label>`; }
function savePlanningRules(opts={}){ ['critical','important','flexible','buckets','goals'].forEach(k=>state.settings.fundedRules[k]=document.getElementById(`rule_${k}`).checked); if(opts.close) closeConfirm(); persist('Planning rules saved'); }
function saveThemePrivacy(){ state.settings.theme=document.getElementById('themeSelect').value; state.settings.showAvailableHeader=document.getElementById('showAvailableHeader').checked; state.settings.themePromptSeen=true; persist('Theme & privacy saved'); }

function settingsModal(title, body){
  showInfoModal(title, body);
  document.getElementById('confirmOk').classList.add('hidden');
}
function openSettingsTopic(topic){
  const r = state.settings.fundedRules;
  if(topic==='appearance') return settingsModal('Appearance & Theme', `<label>Theme<select id="themeSelect"><option value="whimsical" ${(state.settings.theme==='whimsical'||state.settings.theme==='cozy')?'selected':''}>Whimsical Compass</option><option value="cottage" ${state.settings.theme==='cottage'?'selected':''}>Cottagecore Garden</option><option value="classic" ${state.settings.theme==='classic'?'selected':''}>Classic</option><option value="dark" ${state.settings.theme==='dark'?'selected':''}>Dark</option></select></label><p class="muted">Cottagecore Garden adds playful adult-friendly garden animations, softer leaves, and a little more cozy energy while keeping finance labels clear.</p><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Cancel</button><button class="btn primary" onclick="saveThemePrivacyFromModal()">Save Appearance</button></div>`);
  if(topic==='privacy') return settingsModal('Privacy & Header', `<label class="check-label"><input type="checkbox" id="showAvailableHeader" ${state.settings.showAvailableHeader!==false?'checked':''} /> Show Available to Plan in header</label><p class="muted">Available to Plan only includes accounts marked Include in Planning.</p><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Cancel</button><button class="btn primary" onclick="saveThemePrivacyFromModal()">Save Privacy</button></div>`);
  if(topic==='planning') return settingsModal('Planning Rules', `<p class="muted">Configure what counts toward Funded Through and Projected Through.</p><div class="form-grid">${checkSetting('critical','Include Critical Bills',r.critical)}${checkSetting('important','Include Important Bills',r.important)}${checkSetting('flexible','Include Flexible Bills',r.flexible)}${checkSetting('buckets','Include Buckets',r.buckets)}${checkSetting('goals','Include Savings Goals',r.goals)}</div><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Cancel</button><button class="btn primary" onclick="savePlanningRulesFromModal()">Save Planning Rules</button></div>`);
  if(topic==='calendar') return settingsModal('Calendar Display', calendarDisplaySettingsBody() + `<div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Cancel</button><button class="btn primary" onclick="saveCalendarDisplaySettingsFromModal()">Save Calendar Display</button></div>`);
  if(topic==='household') return settingsModal('Household', householdSettingsBody());
  if(topic==='backup') return settingsModal('Backup & Import', `<p class="muted">Export everything. Imports are validated, migrated, and previewed before changing live data.</p><div class="button-row"><button class="btn primary" onclick="exportBackup()">Export Everything</button><label class="btn ghost">Choose Backup<input type="file" accept="application/json" class="hidden" onchange="previewImport(event)" /></label></div><div id="importPreview"></div><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Close</button></div>`);
  if(topic==='activity') return settingsModal('Activity Log', (state.activityLog.slice(0,25).map(a=>recordRow({title:a.action, meta:`${new Date(a.at).toLocaleString()} · ${ownerName(a.memberId)} · ${escapeHtml(a.detail)}`})).join('') || '<p class="muted">No activity yet.</p>') + `<div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Close</button></div>`);
  if(topic==='ai') return settingsModal('AI Connection', `<p class="muted">Compass v6.4 uses local summaries and what-if estimates in the browser. A secure AI proxy can be connected later.</p><p class="field-help">Do not place OpenAI or other API keys directly in a public browser app.</p><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Close</button></div>`);
  if(topic==='safety') return settingsModal('Data Safety', `<div class="summary-list">${recordRow({title:'App Version', meta:'Current Compass release installed on this device.', amount:'6.5.2'})}${recordRow({title:'Data Format', meta:'Your backup and local data format are up to date.', amount:'Current'})}${recordRow({title:'Storage Mode', meta:'This version stores data locally in your browser.', amount:'Local'})}${recordRow({title:'Import Guardrails', meta:'Size limits, schema migration, date validation, amount validation, and preview before commit.', amount:'On'})}</div><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Close</button></div>`);
}
function saveThemePrivacyFromModal(){
  const themeSelect = document.getElementById('themeSelect');
  if(themeSelect) state.settings.theme = themeSelect.value;
  const showHeader = document.getElementById('showAvailableHeader');
  if(showHeader) state.settings.showAvailableHeader = showHeader.checked;
  state.settings.themePromptSeen = true;
  closeConfirm(); persist('Settings saved');
}
function savePlanningRulesFromModal(){ savePlanningRules({close:true}); }
function saveCalendarDisplaySettingsFromModal(){ saveCalendarDisplaySettings({close:true}); }
function householdSettingsBody(){
  const members = state.members.filter(m=>!m.system).map(m=>recordRow({title:m.name, meta:'Household member', actions:`<button class="btn danger" onclick="closeConfirm(); deleteMember('${m.id}')">Remove</button>`})).join('');
  return `<label>Household Name<input id="householdName" maxlength="60" value="${escapeHtml(state.household.name)}" /></label><div class="button-row"><button class="btn primary" onclick="saveHouseholdNameFromModal()">Save Household</button></div><h3>Members</h3><div class="form-grid"><label>Add Member<input id="newMemberName" maxlength="40" placeholder="Member name" /></label><button class="btn primary" onclick="addMemberFromModal()">Add Member</button></div>${members || '<p class="muted">No household members yet.</p>'}<div class="card danger-zone"><h3>Delete Household</h3><p class="muted">This resets all Compass data. Export a backup first.</p><button class="btn danger" onclick="closeConfirm(); deleteHousehold()">Delete Household / Reset Data</button></div><div class="button-row right"><button class="btn ghost" onclick="closeConfirm()">Close</button></div>`;
}
function saveHouseholdNameFromModal(){ saveHouseholdName(); }
function addMemberFromModal(){ addMember(); }


function colorSelect(id, current){
  return `<select id="${id}">${Object.keys(COLOR_OPTIONS).map(k=>`<option value="${k}" ${current===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select>`;
}
function calendarDisplaySettingsBody(){
  const settings = state.settings.calendarColors || defaultState().settings.calendarColors;
  const ownerRows = state.members.map(m=>`<label>${escapeHtml(m.name)}${colorSelect(`ownerColor_${m.id}`, settings.owner?.[m.id] || (m.id===OWNER_HOUSEHOLD?'blue':'green'))}</label>`).join('');
  return `<p class="muted">Choose how calendar items are color-coded.</p><label>Color Code Calendar<select id="calendarColorMode"><option value="recordType" ${state.settings.calendarColorMode==='recordType'?'selected':''}>Record Type</option><option value="owner" ${state.settings.calendarColorMode==='owner'?'selected':''}>Owner</option><option value="paymentType" ${state.settings.calendarColorMode==='paymentType'?'selected':''}>Bill Pay Type</option><option value="none" ${state.settings.calendarColorMode==='none'?'selected':''}>None</option></select></label><h3>Record Type Colors</h3><div class="form-grid">${['bill','paycheck','bucket','goal','event'].map(k=>`<label>${TYPE_LABEL[k]||k}${colorSelect(`recordColor_${k}`, settings.recordType?.[k] || 'gray')}</label>`).join('')}</div><h3>Bill Pay Type Colors</h3><div class="form-grid">${PAYMENT_TYPES.map(k=>`<label>${PAYMENT_LABEL[k]}${colorSelect(`paymentColor_${k}`, settings.paymentType?.[k] || 'gray')}</label>`).join('')}</div><h3>Owner Colors</h3><div class="form-grid">${ownerRows}</div>`;
}
function calendarDisplaySettingsCard(){ return card('Calendar Display', calendarDisplaySettingsBody() + `<button class="btn primary" onclick="saveCalendarDisplaySettings()">Save Calendar Display</button>`); }
function saveCalendarDisplaySettings(opts={}){
  state.settings.calendarColorMode = document.getElementById('calendarColorMode').value;
  state.settings.calendarColors = state.settings.calendarColors || defaultState().settings.calendarColors;
  state.settings.calendarColors.recordType = state.settings.calendarColors.recordType || {};
  state.settings.calendarColors.paymentType = state.settings.calendarColors.paymentType || {};
  state.settings.calendarColors.owner = state.settings.calendarColors.owner || {};
  ['bill','paycheck','bucket','goal','event'].forEach(k=>state.settings.calendarColors.recordType[k]=document.getElementById(`recordColor_${k}`).value);
  PAYMENT_TYPES.forEach(k=>state.settings.calendarColors.paymentType[k]=document.getElementById(`paymentColor_${k}`).value);
  state.members.forEach(m=>state.settings.calendarColors.owner[m.id]=document.getElementById(`ownerColor_${m.id}`).value);
  if(opts.close) closeConfirm();
  persist('Calendar display saved');
}

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
    <div class="form-grid"><label>Account Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Account Type<select name="type" required>${ACCOUNT_TYPES.map(t=>`<option value="${t}" ${accountType(item.type)===t?'selected':''}>${ACCOUNT_TYPE_LABEL[t]}</option>`).join('')}</select></label><label>Balance<input name="balance" inputmode="decimal" maxlength="10" required value="${escapeHtml(item.balance ?? amountVal ?? '0')}" /></label><label>Include in Planning<select name="includeInPlanning"><option value="true" ${item.includeInPlanning!==false?'selected':''}>Yes</option><option value="false" ${item.includeInPlanning===false?'selected':''}>No</option></select></label>${commonOwner}</div>`);
  if (type === 'bill') return formWrap(`
    <div class="form-grid"><label>Bill Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Amount<input name="amount" inputmode="decimal" maxlength="10" required value="${escapeHtml(amountVal || '')}" /></label><label>Due Date<input name="dueDate" type="date" required value="${escapeHtml(item.dueDate || item.date || todayISO())}" /></label><label>Fixed / Non-fixed<select name="kind" required><option value="fixed" ${item.kind!=='non-fixed'?'selected':''}>Fixed</option><option value="non-fixed" ${item.kind==='non-fixed'?'selected':''}>Non-fixed</option></select></label><label>Recurring<select name="recurrence" required>${RECURRENCE.map(r=>`<option value="${r}" ${(item.recurrence||'one-time')===r?'selected':''}>${recurringLabel(r)}</option>`).join('')}</select></label><label>Category<select name="category" required>${BILL_CATEGORIES.map(c=>`<option value="${c}" ${(item.category||'other')===c?'selected':''}>${BILL_CATEGORY_LABEL[c]}</option>`).join('')}</select></label><label>Priority<select name="priority" required>${PRIORITIES.map(p=>`<option value="${p}" ${(item.priority||'important')===p?'selected':''}>${PRIORITY_LABEL[p]}</option>`).join('')}</select></label><label>Payment Type<select name="paymentType" required>${PAYMENT_TYPES.map(pt=>`<option value="${pt}" ${normalizePaymentType(item.paymentType)===pt?'selected':''}>${PAYMENT_LABEL[pt]}</option>`).join('')}</select></label>${commonOwner}</div>`);
  if (type === 'bucket') return formWrap(`<div class="form-grid"><label>Bucket Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Target Amount<input name="targetAmount" inputmode="decimal" maxlength="10" required value="${escapeHtml(item.targetAmount ?? item.amount ?? '')}" /></label><label>Bucket Frequency<select name="frequency" required>${BUCKET_FREQUENCIES.map(f=>`<option value="${f}" ${bucketFrequency(item.frequency)===f?'selected':''}>${BUCKET_FREQUENCY_LABEL[f]}</option>`).join('')}</select></label>${commonOwner}</div>`);
  if (type === 'goal') return formWrap(`<div class="form-grid"><label>Goal Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Target Amount<input name="targetAmount" inputmode="decimal" maxlength="10" required value="${escapeHtml(item.targetAmount ?? item.amount ?? '')}" /></label><label>Current Amount<input name="currentAmount" inputmode="decimal" maxlength="10" value="${escapeHtml(item.currentAmount ?? 0)}" /></label><label>Planned Contribution<input name="plannedContribution" inputmode="decimal" maxlength="10" value="${escapeHtml(item.plannedContribution ?? 0)}" /></label><label>Optional Due Date<input name="dueDate" type="date" value="${escapeHtml(item.dueDate || item.date || '')}" /></label>${commonOwner}</div>`);
  if (type === 'event') return formWrap(`<div class="form-grid"><label>Event Title<input name="title" maxlength="75" required value="${escapeHtml(item.title || item.name || '')}" /></label><label>Start Date<input name="startDate" type="date" required value="${escapeHtml(item.startDate || item.date || todayISO())}" /></label><label>End Date<input name="endDate" type="date" value="${escapeHtml(item.endDate || '')}" /></label>${commonOwner}<label>Savings Goal Link<select name="goalAction" id="goalActionSelect" onchange="toggleGoalActionFields()"><option value="create" ${!item.linkedGoalId?'selected':''}>Create new savings goal</option><option value="link" ${item.linkedGoalId?'selected':''}>Link existing savings goal</option></select></label><div id="linkGoalWrap" style="display:${item.linkedGoalId?'block':'none'}"><label>Existing Savings Goal<select name="linkedGoalId"><option value="">Select a goal</option>${state.goals.filter(g=>!g.deleted).map(g=>`<option value="${g.id}" ${item.linkedGoalId===g.id?'selected':''}>${escapeHtml(g.name)}</option>`).join('')}</select></label></div><div id="createGoalWrap"><label>New Savings Goal Name<input name="newGoalName" maxlength="75" value="${escapeHtml(item.title || item.name || '')}" /></label><label>Target Amount<input name="newGoalTarget" inputmode="decimal" maxlength="10" value="${escapeHtml(item.newGoalTarget ?? '')}" /></label></div></div>`);
  if (type === 'paycheck') return formWrap(`<div class="form-grid"><label>Paycheck Name<input name="name" maxlength="60" required value="${nameVal}" /></label><label>Amount<input name="amount" inputmode="decimal" maxlength="10" required value="${escapeHtml(amountVal || '')}" /></label><label>Next Payday<input name="nextPayday" type="date" required value="${escapeHtml(item.nextPayday || item.date || todayISO())}" /></label><label>Frequency<select name="frequency" required>${RECURRENCE.map(r=>`<option value="${r}" ${(item.frequency||'biweekly')===r?'selected':''}>${recurringLabel(r)}</option>`).join('')}</select></label><label>Status<select name="status"><option value="expected" ${(item.status||'expected')==='expected'?'selected':''}>Expected</option><option value="received" ${item.status==='received'?'selected':''}>Received</option></select></label>${commonOwner}</div>`);
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
    const wasEvent = type === 'event' && !dialogContext.id;
    logActivity(`${idx>=0?'Updated':'Created'} ${TYPE_LABEL[type]}`, result.record.name || result.record.title);
    closeDialog(); persist(`${TYPE_LABEL[type]} saved`);
    if (wasEvent) promptLinkedGoal(result.record);
  };
  if (duplicate) { const noun = TYPE_LABEL[type] || 'record'; const article = /^[aeiou]/i.test(noun) ? 'an' : 'a'; confirmAction('Possible Duplicate', `You already have ${article} ${noun.toLowerCase()} with this name. Continue?`, finish, 'Continue'); } else finish();
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
  if (type==='account') record = { ...record, name:requireText(d.name,'Account name'), type:accountType(d.type), balance:requireMoney(d.balance,'Balance'), includeInPlanning:d.includeInPlanning === 'true' };
  if (type==='bill') record = { ...record, name:requireText(d.name,'Bill name'), amount:requireMoney(d.amount,'Amount'), dueDate:requireDate(d.dueDate,'Due date'), kind:['fixed','non-fixed'].includes(d.kind)?d.kind:'fixed', recurrence:RECURRENCE.includes(d.recurrence)?d.recurrence:'one-time', category:BILL_CATEGORIES.includes(d.category)?d.category:'other', priority:PRIORITIES.includes(d.priority)?d.priority:'important', paymentType:normalizePaymentType(d.paymentType) };
  if (type==='bucket') record = { ...record, name:requireText(d.name,'Bucket name'), targetAmount:requireMoney(d.targetAmount,'Target amount'), frequency:bucketFrequency(d.frequency) };
  if (type==='goal') record = { ...record, name:requireText(d.name,'Goal name'), targetAmount:requireMoney(d.targetAmount,'Target amount'), currentAmount:optionalMoney(d.currentAmount,'Current amount'), plannedContribution:optionalMoney(d.plannedContribution,'Planned contribution'), dueDate:optionalDate(d.dueDate,'Due date'), linkedEventId:d.linkedGoalId||'' };
  if (type==='event') { const start = requireDate(d.startDate,'Start date'); const end = optionalDate(d.endDate,'End date'); if(start && end && parseDate(end)<parseDate(start)) errors.push('End date cannot be before start date.'); if(d.goalAction==='link' && !d.linkedGoalId) errors.push('Select an existing savings goal.'); if(d.goalAction!=='link' && !requireText(d.newGoalName,'New savings goal name',LIMITS.title)){} if(d.goalAction!=='link' && !String(d.newGoalTarget||'').trim()) errors.push('New savings goal target amount is required.'); record = { ...record, title:requireText(d.title,'Event title',LIMITS.title), startDate:start, endDate:end, linkedGoalId:d.linkedGoalId || '', goalAction:d.goalAction||'create', newGoalName:d.newGoalName||'', newGoalTarget:d.newGoalTarget||'' }; }
  if (type==='paycheck') record = { ...record, name:requireText(d.name,'Paycheck name'), amount:requireMoney(d.amount,'Amount'), nextPayday:requireDate(d.nextPayday,'Next payday'), frequency:RECURRENCE.includes(d.frequency)?d.frequency:'biweekly', status:['expected','received'].includes(d.status)?d.status:'expected' };
  return errors.length ? {ok:false, errors} : {ok:true, record};
}
function promptLinkedGoal(eventRecord){
  if(eventRecord.goalAction==='link') return;
  const goal={ id:uid(), name:truncate(eventRecord.newGoalName || eventRecord.title, LIMITS.title), targetAmount:parseMoney(eventRecord.newGoalTarget||'0').value||0, currentAmount:0, plannedContribution:0, dueDate:eventRecord.startDate, linkedEventId:eventRecord.id, ownerId:eventRecord.ownerId||OWNER_HOUSEHOLD, deleted:false, createdAt:new Date().toISOString() };
  state.goals.push(goal);
  eventRecord.linkedGoalId = goal.id;
  const idx = state.events.findIndex(e=>e.id===eventRecord.id); if(idx>=0) state.events[idx].linkedGoalId = goal.id;
  persist('Event and savings goal saved');
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
  p.status='received';
  p.receivedAt = new Date().toISOString();
  p.balanceUpdatedOnReceive = false;
  p.receivedOccurrenceDate = p.nextPayday;
  logActivity('Paycheck received', p.name, {paycheckId:id});
  persist('Paycheck marked received');
  showPaycheckBalancePrompt(id);
}
function showPaycheckBalancePrompt(id){
  const p = state.paychecks.find(x=>x.id===id); if(!p)return;
  const accounts = state.accounts.filter(a=>!a.deleted && a.includeInPlanning);
  const first = accounts[0];
  const options = accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} · ${fmtMoney(a.balance)}</option>`).join('');
  showInfoModal('Paycheck Received', `
    <p><strong>${escapeHtml(p.name)}</strong> was marked received.</p>
    <label>Actual Received Amount<input id="receivedActualAmount" inputmode="decimal" maxlength="10" value="${Number(p.actualReceivedAmount||p.amount||0).toFixed(2)}" oninput="previewReceivedBalance('${id}')" /></label>
    <p class="muted">Use the actual received amount for this paycheck only. Update the account balance first if the paycheck has already hit your bank. Compass will then avoid adding this paycheck a second time in Assign Money.</p>
    ${accounts.length ? `<label>Account<select id="receivedAccountId" onchange="previewReceivedBalance('${id}')">${options}</select></label><label>New Account Balance<input id="receivedNewBalance" inputmode="decimal" maxlength="10" value="${first ? (Number(first.balance||0)+Number(p.actualReceivedAmount||p.amount||0)).toFixed(2) : '0.00'}" /></label><div id="receivedBalanceHelp" class="field-help">Current balance ${first ? fmtMoney(first.balance) : fmtMoney(0)} + paycheck ${fmtMoney(Number(p.actualReceivedAmount||p.amount||0))}</div><div class="button-row"><button class="btn primary" onclick="finishPaycheckReceivedFlow('${id}', true)">Update Balance & Assign Money</button><button class="btn ghost" onclick="finishPaycheckReceivedFlow('${id}', false)">Skip Balance Update & Assign Money</button></div>` : `<p class="field-error">Add a planning account before updating balances.</p><div class="button-row"><button class="btn ghost" onclick="finishPaycheckReceivedFlow('${id}', false)">Open Assign Money Anyway</button></div>`}
  `);
}
function previewReceivedBalance(id){
  const p = state.paychecks.find(x=>x.id===id);
  const a = state.accounts.find(x=>x.id===document.getElementById('receivedAccountId')?.value);
  if(!p || !a)return;
  const input = document.getElementById('receivedNewBalance');
  const actual = parseMoney(document.getElementById('receivedActualAmount')?.value || String(p.amount||0)); const amt = actual.ok ? actual.value : Number(p.amount||0); input.value = (Number(a.balance||0)+amt).toFixed(2);
  document.getElementById('receivedBalanceHelp').textContent = `Current balance ${fmtMoney(a.balance)} + paycheck ${fmtMoney(amt)}`;
}
function finishPaycheckReceivedFlow(id, updateBalance){
  const p = state.paychecks.find(x=>x.id===id); if(!p)return;
  const actualParsed = parseMoney(document.getElementById('receivedActualAmount')?.value || String(p.amount||0));
  if(!actualParsed.ok) return toast('Enter a valid received amount.');
  p.actualReceivedAmount = actualParsed.value;
  if(updateBalance){
    const account = state.accounts.find(x=>x.id===document.getElementById('receivedAccountId')?.value);
    const parsed = parseMoney(document.getElementById('receivedNewBalance')?.value || '0');
    if(!account || !parsed.ok) return toast('Select an account and enter a valid balance.');
    account.balance = parsed.value;
    account.updatedAt = new Date().toISOString();
    p.balanceUpdatedOnReceive = true;
    p.receivedAccountId = account.id;
    logActivity('Account balance updated after paycheck', `${account.name} updated after ${p.name}`, {paycheckId:id, accountId:account.id});
  } else {
    p.balanceUpdatedOnReceive = false;
  }
  closeConfirm();
  p.amountForThisReceipt = p.actualReceivedAmount || p.amount;
  selectedAssignPaycheckId=`${id}|${p.nextPayday}`;
  persist(updateBalance ? 'Balance updated; Assign Money will not add this paycheck again.' : 'Opening Assign Money with balance + paycheck.');
  navigate('assign');
}
function showInfoModal(title, body){
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').innerHTML = body;
  document.getElementById('confirmOk').className='btn primary';
  document.getElementById('confirmOk').classList.remove('hidden');
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
  st.accounts = arr(src.accounts).map(a=>({ id:a.id||uid(), name:a.name||'Account', type:accountType(a.type), balance:a.balance ?? a.amount ?? 0, includeInPlanning:a.includeInPlanning ?? (!['investment','401k','hsa','other-asset','credit-card','loan-debt'].includes(accountType(a.type))), ownerId:a.ownerId||OWNER_HOUSEHOLD }));
  st.bills = arr(src.bills).map(b=>({ id:b.id||uid(), name:b.name||'Bill', amount:b.amount||0, dueDate:b.dueDate||b.date||todayISO(), kind:b.kind || (b.category==='variable'?'non-fixed':'fixed'), recurrence: normalizeRecurrence(b.recurrence || b.recurring || 'one-time'), priority: normalizePriority(b.priority || (b.category==='fixed'?'important':'flexible')), paymentType:normalizePaymentType(b.paymentType || b.payType || b.billPayType || 'unknown'), ownerId:b.ownerId||OWNER_HOUSEHOLD }));
  st.buckets = arr(src.buckets).map(b=>({ id:b.id||uid(), name:b.name||'Bucket', targetAmount:b.targetAmount ?? b.amount ?? 0, frequency:bucketFrequency(b.frequency), ownerId:b.ownerId||OWNER_HOUSEHOLD }));
  st.goals = arr(src.goals).map(g=>({ id:g.id||uid(), name:g.name||'Savings Goal', targetAmount:g.targetAmount ?? g.target ?? g.amount ?? 0, currentAmount:g.currentAmount ?? g.current ?? 0, plannedContribution:g.plannedContribution ?? g.contribution ?? 0, dueDate:g.dueDate||g.targetDate||'', linkedEventId:g.linkedEventId||'', ownerId:g.ownerId||OWNER_HOUSEHOLD }));
  st.events = arr(src.events).map(e=>({ id:e.id||uid(), title:e.title||e.name||'Event', startDate:e.startDate||e.date||todayISO(), endDate:e.endDate||'', linkedGoalId:e.linkedGoalId||'', ownerId:e.ownerId||OWNER_HOUSEHOLD }));
  st.paychecks = arr(src.paychecks).map(p=>({ id:p.id||uid(), name:p.name || p.person || 'Paycheck', amount:p.amount||0, nextPayday:p.nextPayday||p.nextDate||p.date||todayISO(), frequency: normalizeRecurrence(p.frequency || p.recurrence || p.recurring || 'biweekly'), status:p.status||'expected', balanceUpdatedOnReceive:p.balanceUpdatedOnReceive===true, receivedAccountId:p.receivedAccountId||'', receivedOccurrenceDate:p.receivedOccurrenceDate||p.nextPayday||'', actualReceivedAmount:p.actualReceivedAmount||'', ownerId:p.ownerId||OWNER_HOUSEHOLD }));
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
  st.accounts = st.accounts.map(a=>({ id:a.id||uid(), name:truncate(a.name||'Account',LIMITS.name), type:accountType(a.type), balance:num(a.balance,'Account balance'), includeInPlanning:a.includeInPlanning!==false, ownerId:validOwner(a.ownerId) }));
  st.bills = st.bills.map(b=>({ id:b.id||uid(), name:truncate(b.name||'Bill',LIMITS.name), amount:num(b.amount,'Bill amount'), dueDate:date(b.dueDate,'Bill due date'), kind:b.kind==='non-fixed'?'non-fixed':'fixed', recurrence:normalizeRecurrence(b.recurrence), priority:normalizePriority(b.priority), paymentType:normalizePaymentType(b.paymentType), ownerId:validOwner(b.ownerId) }));
  st.buckets = st.buckets.map(b=>({ id:b.id||uid(), name:truncate(b.name||'Bucket',LIMITS.name), targetAmount:num(b.targetAmount,'Bucket amount'), frequency:bucketFrequency(b.frequency), ownerId:validOwner(b.ownerId) }));
  st.goals = st.goals.map(g=>({ id:g.id||uid(), name:truncate(g.name||'Savings Goal',LIMITS.name), targetAmount:num(g.targetAmount,'Goal target'), currentAmount:num(g.currentAmount,'Goal current'), plannedContribution:num(g.plannedContribution,'Goal contribution'), dueDate:g.dueDate?date(g.dueDate,'Goal due date',false):'', linkedEventId:g.linkedEventId||'', ownerId:validOwner(g.ownerId) }));
  st.events = st.events.map(e=>({ id:e.id||uid(), title:truncate(e.title||'Event',LIMITS.title), startDate:date(e.startDate,'Event start date'), endDate:e.endDate?date(e.endDate,'Event end date',false):'', linkedGoalId:e.linkedGoalId||'', ownerId:validOwner(e.ownerId) }));
  st.paychecks = st.paychecks.map(p=>({ id:p.id||uid(), name:truncate(p.name||'Paycheck',LIMITS.name), amount:num(p.amount,'Paycheck amount'), nextPayday:date(p.nextPayday,'Paycheck date'), frequency:RECURRENCE.includes(p.frequency)?p.frequency:'biweekly', status:p.status==='received'?'received':'expected', balanceUpdatedOnReceive:p.balanceUpdatedOnReceive===true, receivedAccountId:p.receivedAccountId||'', receivedOccurrenceDate:p.receivedOccurrenceDate||p.nextPayday||'', actualReceivedAmount:p.actualReceivedAmount||'', ownerId:validOwner(p.ownerId) }));
  st.settings = { ...defaultState().settings, ...(st.settings||{}) };
  st.settings.fundedRules = { ...defaultState().settings.fundedRules, ...(st.settings.fundedRules||{}) };
  if (st.settings.theme === 'cozy') st.settings.theme = 'whimsical';
  st.settings.showAvailableHeader = st.settings.showAvailableHeader !== false;
  st.settings.themePromptSeen = st.settings.themePromptSeen === true;
  st.settings.assignSourceMode = st.settings.assignSourceMode === 'paycheck' ? 'paycheck' : 'balance';
  st.settings.calendarColorMode = CALENDAR_COLOR_MODES.includes(st.settings.calendarColorMode) ? st.settings.calendarColorMode : 'recordType';
  st.settings.calendarColors = { ...defaultState().settings.calendarColors, ...(st.settings.calendarColors||{}) };
  st.settings.calendarColors.recordType = { ...defaultState().settings.calendarColors.recordType, ...(st.settings.calendarColors.recordType||{}) };
  st.settings.calendarColors.paymentType = { ...defaultState().settings.calendarColors.paymentType, ...(st.settings.calendarColors.paymentType||{}) };
  st.settings.calendarColors.owner = { ...(st.settings.calendarColors.owner||{}) };
  st.schemaVersion = SCHEMA_VERSION;
  return { ok:errors.length===0, errors, warnings, state:st };
}
function showLinkedImportWarning(){ }
function maybeShowThemePrompt(){
  if (HAD_EXISTING_STATE || state.settings.themePromptSeen) return;
  showInfoModal('Try Compass in Dark Mode', `<p>Many people prefer the dark layout for a calmer, softer planning experience. You can switch themes anytime in Settings.</p><div class="button-row right"><button class="btn primary" onclick="openThemeSettingsFromPrompt()">Go to Settings</button><button class="btn ghost" onclick="dismissThemePrompt()">Not now</button></div>`);
}
function dismissThemePrompt(){ state.settings.themePromptSeen = true; closeConfirm(); persist('Theme prompt dismissed'); }
function openThemeSettingsFromPrompt(){ state.settings.themePromptSeen = true; closeConfirm(); persist('Opening Settings'); navigate('settings'); }

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

function toggleGoalActionFields(){ const sel=document.getElementById('goalActionSelect'); const link=document.getElementById('linkGoalWrap'); const create=document.getElementById('createGoalWrap'); if(!sel||!link||!create) return; const isLink = sel.value==='link'; link.style.display=isLink?'block':'none'; create.style.display=isLink?'none':'block'; }
window.openRecord = openRecord; window.deleteRecord = deleteRecord; window.undoDelete = undoDelete; window.markPaycheckReceived = markPaycheckReceived; window.previewReceivedBalance = previewReceivedBalance; window.finishPaycheckReceivedFlow = finishPaycheckReceivedFlow;
window.navigate = navigate; window.moveMonth = moveMonth; window.showMonthlyOutlook = showMonthlyOutlook; window.openCalendarRecord = openCalendarRecord; window.showFundedDetails = showFundedDetails;
window.toggleAllocation = toggleAllocation; window.updateAssignRemaining = updateAssignRemaining; window.saveFundingSession = saveFundingSession; window.gotoFunding = gotoFunding;
window.runSimulator = runSimulator; window.setAssignSource = setAssignSource; window.refreshInsights = refreshInsights; window.saveThemePrivacy = saveThemePrivacy; window.explainAvailableToPlan = explainAvailableToPlan; window.dismissThemePrompt = dismissThemePrompt; window.openThemeSettingsFromPrompt = openThemeSettingsFromPrompt; window.convertSimulator = convertSimulator; window.continueConvertSimulator = continueConvertSimulator; window.runSimulatorAI = runSimulatorAI;
window.savePlanningRules = savePlanningRules; window.saveCalendarDisplaySettings = saveCalendarDisplaySettings; window.openSettingsTopic = openSettingsTopic; window.saveThemePrivacyFromModal = saveThemePrivacyFromModal; window.savePlanningRulesFromModal = savePlanningRulesFromModal; window.saveCalendarDisplaySettingsFromModal = saveCalendarDisplaySettingsFromModal; window.saveHouseholdNameFromModal = saveHouseholdNameFromModal; window.addMemberFromModal = addMemberFromModal; window.saveHouseholdName = saveHouseholdName; window.addMember = addMember; window.deleteMember = deleteMember; window.deleteHousehold = deleteHousehold;
window.exportBackup = exportBackup; window.previewImport = previewImport; window.commitImport = commitImport; window.closeDialog = closeDialog; window.closeConfirm = closeConfirm; window.persist = persist;
setupEvents();
render();
setTimeout(maybeShowThemePrompt, 250);
