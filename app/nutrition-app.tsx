'use client';
import {useState, useEffect, useRef, useMemo, type ReactNode} from 'react';
import {Home, Utensils, Search, CalendarDays, Sparkles, ChartNoAxesCombined, Heart, Settings, Plus, Trash2, RefreshCw, LogOut, X, ArrowUpRight, ShoppingBasket, ShieldCheck, ChevronLeft, UserRound} from 'lucide-react';
import {SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarTrigger, SidebarInset} from '@/components/ui/sidebar';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Switch} from '@/components/ui/switch';
import {AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction} from '@/components/ui/alert-dialog';
import {toast} from 'sonner';
import {ThemeToggle, StudioToaster} from '@/components/nutrition/studio-theme';
import {EnergyTrend, FoodMark, StudioNavButton, AssistantText} from '@/components/nutrition/studio-visuals';
import {foods, keys, sum, searchFoods, groupLabel, GROCERY_GROUPS, initial} from '@/lib/nutrition';
import {view} from '@/lib/view';
import {DAILY_MEALS, type Option} from '@/lib/options';
import {Onboarding} from '@/components/nutrition/onboarding';
import {ProfilePage} from '@/components/nutrition/profile-fields';
import {HomePage} from '@/components/nutrition/home-page';
import {MealLog} from '@/components/nutrition/meal-log';
import {SelectField, TextField} from '@/components/nutrition/fields';
import {BloomMark, BloomWordmark, bloomCopy} from '@/components/nutrition/bloom-brand';
import {CardMotion} from '@/components/nutrition/card-motion';

const STORAGE_KEY = 'daily-bloom-state';
const nav = [['Home', Home], ['Meals', Utensils], ['Food', Search], ['Planner', CalendarDays], ['AI Assistant', Sparkles], ['Progress', ChartNoAxesCombined], ['Wellness', Heart]] as const;
const PAGE_TITLES: Record<string, string> = {Home: 'Today', 'AI Assistant': 'Ask Bloom', Profile: 'Profile & settings'};
const MEAL_OPTIONS: readonly Option[] = DAILY_MEALS.map(meal => [meal, meal] as const);
const RANGE_OPTIONS: readonly Option[] = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']];
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;};
const round = (n: number) => Math.round(n * 10) / 10;
const dateLabel = (value: string) => new Date(value + 'T12:00').toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
const NUTRIENT_LABELS: Record<string, string> = {calories: 'Calories (kcal)', protein: 'Protein (g)', carbs: 'Carbohydrates (g)', fat: 'Fat (g)', fiber: 'Fiber (g)'};
const NUTRIENT_HINTS: Record<string, string> = {calories: 'Energy per serving, from the label or recipe.', protein: 'Grams of protein per serving.', carbs: 'Grams of carbohydrate per serving.', fat: 'Grams of fat per serving.', fiber: 'Grams of fibre per serving.'};

export default function NutritionApp() {
  // Visitor data lives only in this browser (localStorage); the server receives it with each action and returns the updated copy.
  const [state, setState] = useState<any>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [storageError, setStorageError] = useState('');
  const canSave = useRef(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState('Home');
  const [date, setDate] = useState(today);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    // showPicker() opens the native calendar reliably; without it, some browsers only open on a precise click.
    if (typeof input.showPicker === 'function') {try {input.showPicker();} catch {input.focus();}} else input.focus();
  };
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [mealType, setMealType] = useState<string>('Breakfast');
  const [groceryName, setGroceryName] = useState('');
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('');
  const [chatError, setChatError] = useState('');
  const [range, setRange] = useState(7);
  const [newWeight, setNewWeight] = useState('');
  const [c, setC] = useState<any>({enabled: false, start: today(), length: 28, duration: 5});
  const [deleteId, setDeleteId] = useState('');
  const [endGuest, setEndGuest] = useState(false);
  const [customFood, setCustomFood] = useState({name: '', serving: '', calories: '', protein: '', carbs: '', fat: '', fiber: ''});
  const [estimating, setEstimating] = useState(false);
  const foodReturnFocus = useRef<HTMLElement | null>(null), sessionReturnFocus = useRef<HTMLElement | null>(null), deleteReturnFocus = useRef<HTMLElement | null>(null), deleteFallbackFocus = useRef<HTMLElement | null>(null);

  function showEndGuest() {sessionReturnFocus.current = document.activeElement as HTMLElement; setEndGuest(true);}

  const data: any = useMemo(() => (state ? {...view(state, date), aiAvailable} : null), [state, date, aiAvailable]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const next = saved ? {...initial(), ...JSON.parse(saved)} : initial();
      canSave.current = true;
      setState(next);
      setC(next.cycle.start ? next.cycle : {...next.cycle, start: today()});
    } catch {
      // Keep the unreadable copy untouched so nothing is overwritten; the visitor can end the session to start fresh.
      setStorageError('Your saved data could not be read. End the session to start fresh.');
      setState(initial());
    }
    fetch('/api/nutrition').then(r => r.json() as Promise<{aiAvailable?: boolean}>).then(x => setAiAvailable(Boolean(x.aiAvailable))).catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    if (state && canSave.current) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  useEffect(() => {window.scrollTo({top: 0, behavior: 'instant'});}, [page]);

  async function act(action: string, payload: any = {}) {
    if (busy || !state) return null;
    if (storageError) {toast.error(storageError); return null;}
    setBusy(true);
    try {
      const r = await fetch('/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, date, state, ...payload})});
      const x: any = await r.json();
      if (!r.ok) throw Error(x.error);
      setState(x.state);
      if (action === 'conversation') setChatId(x.state.conversations[0].id);
      return x;
    } catch (e: any) {
      if (action === 'chat' || action === 'review') setChatError(e.message);
      else toast.error(e.message);
      return null;
    } finally {setBusy(false);}
  }

  async function sendMessage() {
    if (busy || !message.trim()) return;
    setChatError('');
    const x = await act('chat', {message, conversationId: chatId || data.state.conversations[0]?.id});
    if (x) {setMessage(''); setChatId(x.activeConversationId);}
  }

  // Asks Gemini for a starting nutrition estimate for a typed food name. Fills the form fields; the visitor still reviews and presses Add.
  async function estimateFood(name: string) {
    if (!name.trim() || estimating) return;
    setEstimating(true);
    try {
      const r = await fetch('/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'estimateFood', name: name.trim()})});
      const x: any = await r.json();
      if (!r.ok) throw Error(x.error);
      setCustomFood(prev => ({...prev, serving: x.estimate.serving, calories: String(x.estimate.calories), protein: String(x.estimate.protein), carbs: String(x.estimate.carbs), fat: String(x.estimate.fat), fiber: String(x.estimate.fiber)}));
      toast.success(x.source === 'catalog' ? `Matched “${x.matchedName}” from the food library. Check the serving size.` : 'Ask Bloom filled in an estimate. Review it before adding — AI values are approximate.');
    } catch (e: any) {toast.error(e.message);}
    finally {setEstimating(false);}
  }

  async function saveProfile(profile: any) {
    const x = await act('profile', {profile});
    return Boolean(x);
  }

  async function recommend(refresh: boolean) {
    const x = await act('recommend', {refresh});
    if (x) toast.success(refresh ? 'Your tip has been refreshed.' : 'Your tip for today is ready.');
  }

  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(context.registerTool({name: 'search_nutrition_foods', description: 'Search the visible food reference library; does not log food.', inputSchema: {type: 'object', properties: {query: {type: 'string'}}, required: ['query'], additionalProperties: false}, annotations: {readOnlyHint: true}, execute: (input: any) => {
      if (typeof input?.query !== 'string') throw Error('query must be a string');
      setPage('Food'); setSearch(input.query);
      return searchFoods(input.query).map(f => ({id: f.id, name: f.name, serving: f.serving, calories: f.calories, protein: f.protein}));
    }}, {signal: controller.signal})).catch(() => {});
    return () => controller.abort();
  }, []);

  if (storageError) return <main className="loading"><div className="loading-utilities"><ThemeToggle/></div><div className="brand-home"><BloomWordmark/></div><h1>Let’s reconnect.</h1><p role="alert">{storageError}</p><button onClick={() => {window.localStorage.removeItem(STORAGE_KEY); window.location.reload();}}>Clear saved data and start fresh</button></main>;
  if (!data) return <main className="loading"><div className="loading-utilities"><ThemeToggle/></div><div className="brand-home"><BloomWordmark/></div><div className="loading-orbit" aria-hidden="true"><BloomMark/></div><p role="status">Getting your nutrition ready…</p></main>;

  const s = data.state, t = data.targets, n = data.totals;
  if (!s.profile) return <><Onboarding busy={busy} onSave={saveProfile}/></>;

  const conversation = s.conversations.find((v: any) => v.id === chatId) || s.conversations[0];
  const filtered = searchFoods(search);
  const recentDates = Array.from({length: range}, (_, i) => new Date(Date.parse(date) - (range - 1 - i) * 86400000).toISOString().slice(0, 10));
  const history = recentDates.map(d => ({date: d, ...sum(s.logs.filter((l: any) => l.date === d)), water: s.water[d] || 0, logged: s.logs.some((l: any) => l.date === d)}));
  const logged = history.filter(h => h.logged);
  const groceryOrder = [...GROCERY_GROUPS, 'Extra'];
  const pageTitle = PAGE_TITLES[page] ?? page;

  const openFood = (f: any) => {foodReturnFocus.current = document.activeElement as HTMLElement; setSelected(f); setQuantity(1);};
  const openCustomFood = () => {
    foodReturnFocus.current = document.activeElement as HTMLElement;
    const name = search.trim().slice(0, 80);
    setCustomFood({name, serving: '', calories: '', protein: '', carbs: '', fat: '', fiber: ''});
    setQuantity(1);
    setSelected({customEntry: true});
    if (name && data.aiAvailable) void estimateFood(name);
  };
  const openProfile = () => setPage('Profile');

  const dayLogs = s.logs.filter((l: any) => l.date === date);
  const addMeal = (m: string) => {setMealType(m); setPage('Food');};
  const editEntry = (entry: any, food: any) => {openFood({...food, editId: entry.id}); setQuantity(entry.quantity);};
  const removeEntry = (id: string, target: HTMLElement) => {deleteReturnFocus.current = target; deleteFallbackFocus.current = target.closest('.meal-group')?.querySelector<HTMLButtonElement>('.section-head button') ?? null; setDeleteId(id);};

  const headings: Record<string, string> = {
    Home: 'YOUR EVERYDAY, WELL NOURISHED', Food: 'THE FOOD LIBRARY', Planner: 'MAKE SPACE FOR GOOD FOOD', Wellness: 'IN TUNE WITH YOU',
    'AI Assistant': 'A LITTLE PERSONAL GUIDANCE', Progress: 'YOUR STORY, IN NUMBERS', Profile: 'YOUR DETAILS', Meals: 'THE DAILY TABLE',
  };
  const titles: Record<string, ReactNode> = {
    Home: <>Hello, <em className="greeting-name">{s.profile.name.split(' ')[0]}</em>.</>,
    Food: 'Find your next bite.', Planner: 'Good days start here.',
    'AI Assistant': <><span className="ask-title-ask">Ask</span>{' '}<em className="ask-title-bloom">Bloom</em></>,
    Progress: 'Small steps add up.', Wellness: 'Your rhythm. Your pace.', Profile: 'Your profile.', Meals: 'What’s on your plate?',
  };
  const subtitles: Record<string, string> = {
    Home: 'Recommendations built from your saved preferences. Every nourishing choice counts.',
    Food: 'Explore everyday foods and understand each serving.', Planner: 'Meals that work with your preferences and your day.',
    'AI Assistant': 'Your personalised nutrition companion.', Progress: 'Your real records. Your own pace.', Wellness: 'A calm space for your cycle and the care you need.',
    Profile: 'Review and update the details behind your targets and suggestions.', Meals: 'Log, adjust and enjoy your meals.',
  };

  return <SidebarProvider className="nutrition-shell" style={{'--sidebar-width': '15.5rem'} as any}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Sidebar className="nutrition-sidebar">
      <SidebarHeader><a href="/" className="brand-home"><BloomWordmark/></a><p className="sidebar-tag">NUTRITION & WELLNESS</p></SidebarHeader>
      <SidebarContent>
        <p className="nav-caption">YOUR DAILY SPACE</p>
        <SidebarMenu>{nav.map(([label, Icon]) => <SidebarMenuItem key={label}><StudioNavButton active={page === label} onSelect={() => setPage(label)}><Icon size={19}/><span>{label === 'AI Assistant' ? 'Ask Bloom' : label}</span>{page === label && <span className="nav-active-dot"/>}</StudioNavButton></SidebarMenuItem>)}</SidebarMenu>
        <div className="sidebar-note"><BloomMark/><span>A LITTLE EVERY DAY</span><p>Small choices.<br/><em>Lasting care.</em></p><span className="sidebar-note-line"/></div>
      </SidebarContent>
      <SidebarFooter>
        <StudioNavButton active={page === 'Profile'} onSelect={openProfile}><Settings size={18}/>Profile & settings</StudioNavButton>
        <button className="guest-end" onClick={showEndGuest}><LogOut size={16}/>End session</button>
        <div className="account"><div>{s.profile.name[0]?.toUpperCase()}</div><span><strong>{s.profile.name}</strong><small>{s.profile.diet}</small></span></div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset className="nutrition-main">
      <header className="topbar" id="app-header">
        <div className="header-location">
          <SidebarTrigger aria-label="Show or hide the menu"/>
          <div className="crumbs"><span>The Daily Bloom</span><span className="breadcrumb-divider" aria-hidden="true">/</span><strong>{pageTitle}</strong></div>
        </div>
        <div className="header-utilities">
          <label className="date-button" onClick={openDatePicker}>
            <CalendarDays size={18} aria-hidden="true"/>
            <span>{new Date(date + 'T12:00').toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})}</span>
            <input ref={dateInputRef} type="date" aria-label="Selected date" value={date} onChange={e => e.target.value && setDate(e.target.value)}/>
          </label>
          <ThemeToggle/>
          <button className="profile-access" aria-label="Open profile and settings" title="Profile & settings" onClick={openProfile}>{s.profile.name[0]?.toUpperCase() ?? <UserRound size={18}/>}</button>
        </div>
      </header>

      <main className="content" id="main-content" tabIndex={-1}>
        <CardMotion key={page} page={page}>
          <div className="guest-banner"><span><ShieldCheck size={14} aria-hidden="true"/>Saved only in this browser</span><button className="text-button" onClick={showEndGuest}>End session</button></div>
          {page !== 'Home' && page !== 'Profile' && <div className="page-heading"><div><p className="eyebrow">{headings[page]}</p><h1>{titles[page]}</h1><p className="muted">{subtitles[page]}</p></div></div>}

          {page === 'Home' && <>
            <div className="page-heading"><div><p className="eyebrow">{headings.Home}</p><h1>{titles.Home}</h1><p className="muted">{subtitles.Home}</p></div><button onClick={() => setPage('Food')}><Plus size={18}/>Log a meal</button></div>
            <HomePage data={data} date={date} busy={busy} onRecommend={recommend} onWater={amount => act('water', {amount})} onNavigate={setPage} onAddFood={() => setPage('Food')} onAddMeal={addMeal} onEditEntry={editEntry} onRemoveEntry={removeEntry}/>
          </>}

          {page === 'Profile' && <>
            <div className="page-heading"><div><p className="eyebrow">{headings.Profile}</p><h1>{titles.Profile}</h1><p className="muted">{subtitles.Profile}</p></div></div>
            <ProfilePage profile={s.profile} targets={t} busy={busy} onSave={saveProfile}/>
          </>}

          {page === 'Meals' && <>
            <div className="summary-strip"><span><strong>{Math.round(n.calories)}</strong> kcal</span><span><strong>{n.protein} g</strong> protein</span><span><strong>{n.fiber} g</strong> fiber</span><button onClick={() => setPage('Food')}><Plus size={18}/>Add food</button></div>
            <div className="meal-page panel"><MealLog logs={dayLogs} onAdd={addMeal} onEdit={editEntry} onRemove={removeEntry}/></div>
          </>}

          {page === 'Food' && <>
            <section className="food-editorial"><div><p className="eyebrow">FAMILIAR FOOD. FRESH POSSIBILITIES.</p><h2>Good food starts<br/>with what you enjoy.</h2><p>A considered library of everyday ingredients and favourites.<br/>Explore a serving, then make it part of your day.</p></div><img src="/food.jpg" alt="Colorful vegetables and grains in a nourishing bowl"/></section>
            <div className="food-search"><Search size={22}/><input aria-label="Search foods" placeholder="Search rice, paneer, eggs or a favourite…" value={search} onChange={e => setSearch(e.target.value)}/><span>{filtered.length} foods</span></div>
            <div className="food-search-actions"><span className="muted">Can’t find your food?</span><button className="secondary" onClick={openCustomFood}><Plus size={16}/>Add custom food</button></div>
            <div className="food-grid">{filtered.map(f => <button className="food-card" key={f.id} onClick={() => openFood(f)}>
              <div className="food-card-top"><FoodMark group={f.group}/><span className="pill">{groupLabel(f.group)}</span></div>
              <h2>{f.name}</h2><p>{f.serving}</p>
              <div className="food-card-meta"><strong>{f.calories}<small> kcal</small></strong><span>{f.protein} g protein</span><span className="food-card-add"><Plus size={18}/></span></div>
            </button>)}</div>
            {!filtered.length && <div className="empty"><Search/><h2>No matches yet.</h2><p>{data.aiAvailable ? 'Add it, and Ask Bloom can estimate the nutrition fields for you to review.' : 'Add your food with nutrition values from its label or recipe.'}</p><button onClick={openCustomFood}><Plus size={16}/>Add custom food</button></div>}
            <p className="footnote">Rounded USDA generic-food references and labelled Indian recipe estimates. Values vary by preparation and brand. <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer">FoodData Central</a></p>
          </>}

          {page === 'Planner' && <>
            <div className="planner-actions">
              <div className="inline-actions"><button disabled={busy} onClick={() => act('plan', {days: 1})}>{busy ? 'Working…' : 'Plan today'}</button><button disabled={busy} className="secondary" onClick={() => act('plan', {days: 7})}><CalendarDays size={16}/>Plan my week</button></div>
              <p className="muted">{s.profile.diet} · {s.profile.cuisine} · {s.profile.budget} budget</p>
            </div>
            <p className="footnote">Quick plan: built from the food library only, so it stays within the library’s 24 items. Portions and nutrient totals are estimates, and protein may fall short of your target. Review ingredients for allergies.</p>

            <section className="panel ai-plan-panel">
              <div className="section-head">
                <div><p className="eyebrow">ASK BLOOM PLANNER</p><h2>A wider range of meals, within your targets.</h2></div>
                {data.aiAvailable
                  ? <div className="inline-actions">
                    <button disabled={busy} className="secondary" onClick={() => act('planAI', {days: 1, refresh: Boolean(s.aiPlan?.days?.length)})}><Sparkles size={16}/>{busy ? 'Working…' : s.aiPlan?.days?.length ? 'Regenerate today with AI' : 'Plan today with AI'}</button>
                    <button disabled={busy} className="secondary" onClick={() => act('planAI', {days: 7, refresh: Boolean(s.aiPlan?.days?.length)})}>{s.aiPlan?.days?.length ? 'Regenerate week with AI' : 'Plan my week with AI'}</button>
                  </div>
                  : <span className="pill">Ask Bloom setup needed</span>}
              </div>
              <p className="muted">Asks Ask Bloom for meals near your {t.calories.toLocaleString()} kcal and {t.protein} g protein target, matching your diet, cuisine and budget. Not limited to the food library, so check ingredients before eating.</p>
              {s.aiPlan?.days?.length ? <div className="plan-days">{s.aiPlan.days.map((d: any) => <section className="plan-day panel" key={d.date}>
                <div className="section-head"><h2>{dateLabel(d.date)}</h2><span>{Math.round(d.meals.reduce((a: number, m: any) => a + m.totals.calories, 0))} kcal · {round(d.meals.reduce((a: number, m: any) => a + m.totals.protein, 0))} g protein</span></div>
                <div className="plan-meals">{d.meals.map((m: any) => <article key={m.id}>
                  <span className="eyebrow">{m.type}</span>
                  <h3>{m.name}</h3>
                  {m.description && <p>{m.description}</p>}
                  <div className="section-head"><small>{Math.round(m.totals.calories)} kcal · {m.totals.protein} g protein{m.totalsSource === 'catalog' ? ' · library totals' : ''}</small><button disabled={busy} className="text-button" onClick={() => act('swapAI', {planDate: d.date, id: m.id})}><RefreshCw size={14}/>Swap</button><button disabled={busy} className="text-button" onClick={() => act('groceryAdd', {name: m.name})}><Plus size={14}/>Add to grocery list</button></div>
                </article>)}</div>
              </section>)}</div> : <p className="muted">{data.aiAvailable ? 'No AI plan yet. Choose a button above.' : 'Set up the Gemini connection to use the AI planner.'}</p>}
            </section>

            {!s.plan.length ? <div className="empty"><CalendarDays/><h2>Your week, ready when you are.</h2><p>Generate a plan to see meals and build your grocery list.</p></div> : <>
              <nav className="plan-day-nav" aria-label="Planned days">{s.plan.map((d: any) => <a key={d.date} href={'#plan-' + d.date}><span>{new Date(d.date + 'T12:00').toLocaleDateString(undefined, {weekday: 'short'})}</span><strong>{new Date(d.date + 'T12:00').getDate()}</strong></a>)}</nav>
              <div className="plan-days">{s.plan.map((d: any) => <section className="plan-day panel" id={'plan-' + d.date} key={d.date}>
                <div className="section-head"><h2>{dateLabel(d.date)}</h2><span>{Math.round(d.meals.reduce((a: number, m: any) => a + m.totals.calories, 0))} kcal · {round(d.meals.reduce((a: number, m: any) => a + m.totals.protein, 0))} g protein</span></div>
                <div className="plan-meals">{d.meals.map((m: any) => <article key={m.id}>
                  <span className="eyebrow">{m.type}</span>
                  <h3>{m.entries.map((e: any) => foods.find(f => f.id === e.foodId)?.name).join(' + ')}</h3>
                  <p>{m.entries.map((e: any) => `${e.quantity} × ${foods.find(f => f.id === e.foodId)?.serving}`).join(' · ')}</p>
                  <div className="section-head"><small>{Math.round(m.totals.calories)} kcal · {m.totals.protein} g protein</small><button disabled={busy} className="text-button" onClick={() => act('swap', {planDate: d.date, id: m.id})}><RefreshCw size={14}/>Swap</button></div>
                </article>)}</div>
              </section>)}</div>
              <button disabled={busy} className="secondary" onClick={() => act('groceries')}><ShoppingBasket size={17}/>Build grocery list from plan</button>
            </>}
            <section className="grocery panel">
              <div className="section-head"><h2><ShoppingBasket size={23} strokeWidth={1.5}/>Your grocery list</h2><span>{s.groceries.filter((g: any) => g.checked).length} / {s.groceries.length} checked</span></div>
              <form className="inline-actions" onSubmit={async e => {e.preventDefault(); if (await act('groceryAdd', {name: groceryName})) setGroceryName('');}}>
                <input aria-label="Add grocery item" value={groceryName} onChange={e => setGroceryName(e.target.value)} placeholder="Type an item to add" required maxLength={80}/>
                <button disabled={busy}>Add</button>
              </form>
              {!s.groceries.length && <p className="muted">Build a list from your plan, or add your own items.</p>}
              {groceryOrder.map(group => {const list = s.groceries.filter((g: any) => g.group === group); return list.length > 0 && <div key={group}><h3>{groupLabel(group)}</h3>{list.map((g: any) => <div className="grocery-row" key={g.id}><Checkbox id={'g-' + g.id} checked={g.checked} disabled={busy} onCheckedChange={() => act('groceryToggle', {id: g.id})}/><label htmlFor={'g-' + g.id} className={g.checked ? 'checked' : ''}>{g.name}<small>{round(g.quantity)} × {g.serving}</small></label><button className="icon-button" aria-label={'Remove ' + g.name} onClick={() => act('groceryRemove', {id: g.id})}><Trash2 size={16}/></button></div>)}</div>;})}
            </section>
          </>}

          {page === 'AI Assistant' && <div className="assistant-grid"><section className="chat-panel panel">
            <div className="section-head">
              <details className="bloom-history">
                <summary aria-controls="bloom-recent-conversations" aria-label="Toggle recent conversations" title="Recent conversations"><ChevronLeft size={18} aria-hidden="true"/></summary>
                <aside className="chat-history panel" id="bloom-recent-conversations" aria-label="Recent conversations">
                  <button disabled={busy} className="secondary" onClick={() => act('conversation')}><Plus size={17}/>New conversation</button>
                  <h3>Recent conversations</h3>
                  {s.conversations.map((v: any) => <button className={'history-item ' + (conversation?.id === v.id ? 'active' : '')} key={v.id} onClick={() => {setChatId(v.id); setChatError('');}}>{v.title}</button>)}
                </aside>
              </details>
              <h2><Sparkles size={20}/>Your conversation</h2>
              <span className="pill assistant-status" data-ready={Boolean(data.aiAvailable)}>{data.aiAvailable ? 'Ready' : 'Setup needed'}</span>
            </div>
            {!data.aiAvailable && <div className="assistant-setup"><Sparkles size={16}/><p>Ask Bloom is almost ready. Its connection to Gemini needs to be set up by the site owner before it can answer.</p></div>}
            <div className="messages" aria-live="polite" aria-relevant="additions text">
              {!conversation?.messages.length && <div className="chat-welcome"><span className="assistant-mark"><BloomMark/></span><h2>A little guidance for your next bite.</h2><p>Ask about your meals, protein goal, or a gentle wellness routine.</p><div className="prompts">{['What should I eat for dinner?', 'Help me reach my protein target.', 'I only have eggs and rice.', 'What should I eat during my period?'].map(q => <button className="secondary" key={q} onClick={() => setMessage(q)}>{q}<ArrowUpRight size={15}/></button>)}</div></div>}
              {conversation?.messages.map((m: any, i: number) => <div className={'message ' + m.role} key={i}><span>{m.role === 'user' ? 'You' : 'Ask Bloom'}</span>{m.role === 'assistant' ? <AssistantText text={bloomCopy(m.text)}/> : <p>{m.text}</p>}</div>)}
              {busy && <p className="thinking" role="status">Thinking with your nutrition in mind…</p>}
              {chatError && <div className="error" role="alert"><p>{bloomCopy(chatError)}</p><button className="secondary" disabled={busy || !message.trim()} onClick={sendMessage}>Retry</button></div>}
            </div>
            <div className="bloom-composer" data-processing={busy}>
              <form className="composer" aria-busy={busy} onSubmit={event => {event.preventDefault(); void sendMessage();}}>
                <textarea disabled={busy} aria-label="Message Ask Bloom" placeholder="What’s on your mind (or your plate)?" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={2}/>
                <button disabled={busy || !message.trim()}>{busy ? 'Thinking…' : 'Send'}</button>
              </form>
            </div>
            <p className="footnote">General nutrition guidance. For medical advice, talk with a qualified professional.</p>
          </section></div>}

          {page === 'Progress' && <>
            <div className="section-head"><h2>Your nutrition rhythm</h2><SelectField label="Time range" value={String(range)} options={RANGE_OPTIONS} placeholder="Choose a range" onChange={v => setRange(Number(v))}/></div>
            <div className="summary-strip"><span><strong>{logged.length}</strong> logged days</span><span><strong>{logged.length ? Math.round(logged.reduce((a, h) => a + h.calories, 0) / logged.length) : '—'}</strong> avg kcal</span><span><strong>{logged.length ? round(logged.reduce((a, h) => a + h.protein, 0) / logged.length) : '—'}</strong> avg protein (g)</span><span><strong>{logged.length ? round(logged.reduce((a, h) => a + h.fiber, 0) / logged.length) : '—'}</strong> avg fiber (g)</span><span><strong>{logged.length ? Math.round(logged.reduce((a, h) => a + h.water, 0) / logged.length) : '—'}</strong> avg water (ml)</span></div>
            <section className="panel trend"><div className="section-head"><div><p className="eyebrow">THE BIGGER PICTURE</p><h2>Daily energy.</h2></div><span className="pill">kcal · logged days</span></div>{!logged.length ? <div className="empty"><ChartNoAxesCombined/><p>Log your first meal to start your story.</p></div> : <EnergyTrend key={range + date} history={history} target={t.calories}/>}<p className="footnote">Averages use logged days only; incomplete logs undercount intake. No missing days are estimated.</p></section>
            <div className="progress-bottom">
              <section className="panel"><h2>Your weight check-ins</h2><form className="inline-actions" onSubmit={async e => {e.preventDefault(); if (await act('weight', {weight: newWeight})) setNewWeight('');}}><input aria-label="Weight in kg" placeholder="Your weight today, in kg" type="number" min="35" max="250" step="0.1" required value={newWeight} onChange={e => setNewWeight(e.target.value)}/><button disabled={busy}>Save</button></form>{[...s.weights.filter((w: any) => recentDates.includes(w.date))].sort((a: any, b: any) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map((w: any) => <div className="weight-row" key={w.id}><span>{w.date}</span><strong>{w.weight} kg</strong></div>)}</section>
              <section className="weekly-card"><Sparkles/><h2>A thoughtful weekly review.</h2><p>{data.weekly.loggedDays} of the last 7 days have meals logged. {data.weekly.loggedDays < 3 ? 'Log at least 3 days to get a meaningful review.' : 'Your actual weekly averages will guide the review.'}</p><button disabled={busy || data.weekly.loggedDays < 3} onClick={async () => {setChatError(''); const x = await act('review', {conversationId: conversation?.id}); setPage('AI Assistant'); if (x) setChatId(x.activeConversationId);}}>Get weekly AI review</button></section>
            </div>
          </>}

          {page === 'Wellness' && <>
            <div className="wellness-grid"><section className="panel cycle-card">
              <div className="section-head"><div><p className="eyebrow"><Heart size={15}/> A PRIVATE CHECK-IN</p><h2>Cycle check-in</h2></div><div className="cycle-control"><span id="cycle-tracking-label">Cycle tracking: {c.enabled ? 'On' : 'Off'}</span><Switch className="cycle-switch" thumbClassName="data-[state=checked]:translate-x-0" aria-labelledby="cycle-tracking-label" checked={c.enabled} disabled={busy} onCheckedChange={async v => {if (v) setC({...c, enabled: true}); else if (await act('cycleDisable')) setC({...c, enabled: false});}}/></div></div>
              <p className="muted">Optional. These date-based estimates are not medical or fertility predictions.</p>
              {c.enabled ? <div className="cycle-content">
                <form className="form-grid" onSubmit={async e => {e.preventDefault(); if (await act('cycle', {cycle: c})) toast.success('Cycle preferences saved.');}}>
                  <TextField label="Last period start" hint="Choose the first day of your last period." type="date" required max={date} value={c.start} onChange={(e: any) => setC({...c, start: e.target.value})}/>
                  <TextField label="Average cycle length (days)" hint="Usually 21 to 45 days." type="number" min="21" max="45" required placeholder="Days from one period to the next" value={c.length} onChange={(e: any) => setC({...c, length: e.target.value})}/>
                  <TextField label="Period duration (days)" hint="Usually 2 to 10 days." type="number" min="2" max="10" required placeholder="How many days bleeding usually lasts" value={c.duration} onChange={(e: any) => setC({...c, duration: e.target.value})}/>
                  <button disabled={busy}>Save cycle settings</button>
                </form>
                {data.cycleEstimate && <div className="cycle-estimate"><span>ESTIMATED</span><h2>Day {data.cycleEstimate.day}</h2><p>{data.cycleEstimate.phase} phase</p><p>Next period around {data.cycleEstimate.next}</p></div>}
              </div> : <div className="empty cycle-empty"><Heart/><p>Tracking is off. Turn it on only if it’s useful to you.</p></div>}
            </section></div>
            <section className="wellness-guidance"><h2>On days you need a little more care.</h2><div>
              <article><span className="care-number">01 / REST</span><h3>Warmth & comfort</h3><p>A heat bag, rest and gentle movement may help with everyday period discomfort.</p></article>
              <article><span className="care-number">02 / NOURISH</span><h3>Keep meals gentle</h3><p>Try warm balanced foods, regular fluids, and protein and iron-rich ingredients you tolerate.</p></article>
              <article><span className="care-number">03 / LISTEN</span><h3>Know when to reach out</h3><p>Unusually severe pain, fainting, very heavy bleeding, fever or worsening symptoms need professional medical care.</p></article>
            </div></section>
          </>}
        </CardMotion>
        <footer className="app-footer"><span className="footer-brand"><BloomMark/>The Daily Bloom · Nourish. Grow. Glow.</span><span>Nutrition targets are estimates</span></footer>
      </main>
    </SidebarInset>

    <Dialog open={Boolean(selected)} onOpenChange={open => {if (!open) setSelected(null);}}>
      <DialogContent className="nourish-dialog food-detail" onCloseAutoFocus={event => {event.preventDefault(); foodReturnFocus.current?.focus();}} onEscapeKeyDown={event => {if (event.target instanceof Element && event.target.closest('[role="combobox"][aria-expanded="true"]')) event.preventDefault();}}>
        <DialogHeader><DialogTitle>{selected?.customEntry ? 'Add custom food' : selected?.name}</DialogTitle><DialogDescription>{selected?.customEntry ? 'Enter nutrition for one serving from the food label or your recipe.' : `${selected?.serving} · Nutrition per serving`}</DialogDescription></DialogHeader>
        {selected && <form className="food-log-form" onSubmit={async event => {
          event.preventDefault();
          if (!Number.isFinite(quantity) || quantity < .25 || quantity > 20) return;
          const x = selected.editId ? await act('editLog', {id: selected.editId, quantity})
            : selected.customEntry ? await act('logCustom', {food: {...customFood, ...Object.fromEntries(keys.map(k => [k, Number((customFood as any)[k])]))}, quantity, meal: mealType})
            : await act('log', {foodId: selected.id, quantity, meal: mealType});
          if (x) {setSelected(null); toast.success(selected.editId ? 'Meal updated.' : 'Added to ' + mealType.toLowerCase() + '.');}
        }}>
          {selected.customEntry ? <>
            <div className="custom-food-fields">
              <div className="custom-food-name-row">
                <TextField label="Food name" placeholder="What is it called?" value={customFood.name} onChange={(e: any) => setCustomFood({...customFood, name: e.target.value})} required maxLength={80}/>
                {data.aiAvailable && <button type="button" className="secondary" disabled={estimating || !customFood.name.trim()} onClick={() => estimateFood(customFood.name)}><Sparkles size={15}/>{estimating ? 'Estimating…' : 'Estimate with Ask Bloom'}</button>}
              </div>
              {data.aiAvailable && <p className="muted">Matches the food library when possible; otherwise AI guesses — always check the serving size and label.</p>}
              {!data.aiAvailable && <p className="muted">Ask Bloom needs its connection set up before it can estimate these values; enter them from the label or recipe.</p>}
              <TextField label="One serving" placeholder="Describe one serving, e.g. 1 samosa" hint="Size of the portion these values describe." value={customFood.serving} onChange={(e: any) => setCustomFood({...customFood, serving: e.target.value})} required maxLength={80}/>
              {keys.map(k => <TextField key={k} label={NUTRIENT_LABELS[k]} hint={NUTRIENT_HINTS[k]} type="number" inputMode="decimal" required min="0" max={k === 'calories' ? 10000 : 1000} step="any" placeholder={`${NUTRIENT_LABELS[k].split(' (')[0]} per serving`} value={(customFood as any)[k]} onChange={(e: any) => setCustomFood({...customFood, [k]: e.target.value})}/>)}
            </div>
            <p className="footnote">All values are per serving. Enter 0 only when the amount is zero. These values are saved as user-entered nutrition.</p>
          </> : <div className="detail-nutrients">{keys.map(k => <div key={k}><strong>{quantity >= .25 && quantity <= 20 ? round(selected[k] * quantity) : '—'}</strong><span>{k === 'calories' ? 'kcal' : k + ' (g)'}</span></div>)}</div>}
          <TextField label="Servings" hint="Between 0.25 and 20 servings." error={!Number.isNaN(quantity) && (quantity < .25 || quantity > 20) ? 'Enter between 0.25 and 20 servings.' : undefined} type="number" required min="0.25" max="20" step="any" placeholder="How many servings you ate" value={Number.isNaN(quantity) ? '' : quantity} onChange={(e: any) => setQuantity(e.target.value === '' ? NaN : Number(e.target.value))}/>
          {!selected.editId && <SelectField label="Add to meal" hint="Which meal this belongs to." placeholder="Choose a meal" value={mealType} options={MEAL_OPTIONS} onChange={setMealType}/>}
          {!selected.customEntry && <p className="footnote">{selected.source}. Prepared foods may have different ingredients; verify allergens before eating.</p>}
          <button disabled={busy || !Number.isFinite(quantity) || quantity < .25 || quantity > 20}>{busy ? 'Saving…' : selected.editId ? 'Save servings' : 'Add to meal'}</button>
        </form>}
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(deleteId)} onOpenChange={v => {if (!v) setDeleteId('');}}>
      <AlertDialogContent className="nourish-dialog food-delete-dialog" onCloseAutoFocus={event => {event.preventDefault(); const target = deleteReturnFocus.current?.isConnected ? deleteReturnFocus.current : deleteFallbackFocus.current; target?.focus();}}>
        <button type="button" className="dialog-dismiss" aria-label="Close remove food dialog" onClick={() => setDeleteId('')}><X size={18}/></button>
        <AlertDialogHeader><AlertDialogTitle>Remove this food?</AlertDialogTitle><AlertDialogDescription>Your daily totals will update after removal.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className="secondary">Keep food</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async event => {event.preventDefault(); if (await act('removeLog', {id: deleteId})) setDeleteId('');}}>{busy ? 'Removing…' : 'Remove'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={endGuest} onOpenChange={setEndGuest}>
      <AlertDialogContent className="nourish-dialog session-dialog" onCloseAutoFocus={event => {event.preventDefault(); sessionReturnFocus.current?.focus();}}>
        <button type="button" className="dialog-dismiss" aria-label="Close end session dialog" onClick={() => setEndGuest(false)}><X size={18}/></button>
        <AlertDialogHeader><AlertDialogTitle>End your session?</AlertDialogTitle><AlertDialogDescription>This deletes your profile, meals, plans and history from this browser. Nothing is kept on our servers, so this cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className="secondary">Keep my session</AlertDialogCancel><AlertDialogAction onClick={event => {event.preventDefault(); window.localStorage.removeItem(STORAGE_KEY); canSave.current = true; setStorageError(''); setState(initial()); setChatId(''); setMessage(''); setPage('Home'); setEndGuest(false);}}>End &amp; delete my data</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <StudioToaster/>
  </SidebarProvider>;
}
