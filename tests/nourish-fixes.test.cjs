// Run with: node --test tests/nourish-fixes.test.cjs
// Executes the real request handlers with mocked Gemini responses. Visitor data lives in the browser, so these tests pass the saved state into each call and keep the returned copy, the same way the page does.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const runtimeEnv = {};
let geminiFetch = async () => {throw Error('Unexpected external request in test');};
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const module = {exports: {}};
  cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const localRequire = name => {
    if (name === 'cloudflare:workers') return {env: runtimeEnv};
    if (name.startsWith('@/')) return load(name.slice(2) + (fs.existsSync(path.resolve(root, name.slice(2) + '.ts')) ? '.ts' : '.tsx'));
    return req(name);
  };
  vm.runInThisContext('(function(require,module,exports,fetch){' + code + '\n})', {filename: file})(localRequire, module, module.exports, (...args) => geminiFetch(...args));
  return module.exports;
}
const nutrition = load('lib/nutrition.ts');
const options = load('lib/options.ts');
const {view} = load('lib/view.ts');
const route = load('app/api/nutrition/route.ts');
const date = '2026-10-22';
// The browser's saved copy of the visitor's data. Each successful action replaces it, as the page does.
let state = nutrition.initial();
const reset = () => {state = nutrition.initial();};
const get = async () => ({...view(state, date), state});
const aiStatus = async () => (await route.GET()).json();
async function post(action, payload = {}) {
  const response = await route.POST(new Request('https://nourish.test/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json', origin: 'https://nourish.test'}, body: JSON.stringify({action, date, state, ...payload})}));
  const data = await response.json();
  if (response.ok) state = data.state;
  return {status: response.status, data};
}
const food = {name: 'Test samosa', serving: '1 piece · 80 g', calories: 240, protein: 5, carbs: 30, fat: 11, fiber: 3};
const geminiReply = text => Response.json({candidates: [{content: {role: 'model', parts: [{text}]}, finishReason: 'STOP'}]});
const tipReply = fields => geminiReply(JSON.stringify({breakfast: 'Oats with fruit', lunch: 'Dal and rice', dinner: 'Seasonal vegetable curry', tip: 'Sip water through the day.', ...fields}));
const chatReply = reply => geminiReply(JSON.stringify({reply}));

test('catalog stays intact; names, tags, case, whitespace and spelling aliases work', () => {
  assert.equal(nutrition.foods.length, 24);
  for (const query of ['biryani', 'biriyani', 'briyani', '  CHICKEN   BIRIYANI  ']) assert(nutrition.searchFoods(query).some(f => f.id === 'biryani'));
  assert(nutrition.searchFoods('rice').some(f => f.id === 'rice'));
  assert(nutrition.searchFoods('dal').some(f => f.id === 'dal'));
  assert(nutrition.searchFoods('eggs').some(f => f.id === 'egg'));
  assert.equal(nutrition.searchFoods('samosa').length, 0);
  assert.equal(nutrition.searchFoods('   ').length, 24);
});
test('existing catalog totals remain unchanged', () => {
  assert.deepEqual(nutrition.sum([{foodId: 'rice', quantity: 2}, {foodId: 'egg', quantity: 1}]), {calories: 338, protein: 11.7, carbs: 57, fat: 5.9, fiber: .8});
});
test('custom and catalog food log, reload, edit, totals and removal use the saved state', async () => {
  reset();
  const created = await post('logCustom', {food: {...food, source: 'untrusted source override'}, meal: 'Snack', quantity: 2});
  assert.equal(created.status, 200);
  const entry = created.data.state.logs[0];
  assert.equal(entry.customFood.name, food.name);
  assert.equal(entry.customFood.source, 'User-entered nutrition');
  assert.equal(created.data.totals.calories, 480);
  assert.equal(created.data.weekly.averages.protein, 10);
  const loaded = await get();
  assert.deepEqual(loaded.state.logs[0], entry);
  for (const meal of ['Breakfast', 'Lunch', 'Snack', 'Dinner']) {
    const result = await post('log', {foodId: 'rice', quantity: .5, meal});
    assert.equal(result.status, 200);
    assert.equal(result.data.state.logs.at(-1).meal, meal);
  }
  const edited = await post('editLog', {id: entry.id, quantity: 1.5});
  assert.equal(edited.status, 200);
  assert.equal(edited.data.totals.calories, 620);
  assert.equal(edited.data.totals.protein, 12.9);
  assert.equal(nutrition.loggedFood(edited.data.state.logs[0]).name, food.name);
  const removed = await post('removeLog', {id: entry.id});
  assert.equal(removed.data.state.logs.length, 4);
  assert.equal(removed.data.totals.calories, 260);
});
test('manual nutrition validation rejects missing, blank, negative or excessive values without changing saved data', async () => {
  reset();
  const before = await get();
  for (const patch of [{name: ''}, {name: '  '}, {serving: ''}, {calories: ''}, {protein: null}, {fiber: undefined}, {fat: -1}, {calories: 10001}, {carbs: 1001}]) {
    const result = await post('logCustom', {food: {...food, ...patch}, meal: 'Lunch', quantity: 1});
    assert.equal(result.status, 400, JSON.stringify(patch));
  }
  for (const patch of [{meal: 'Invalid'}, {quantity: 0}, {quantity: 21}]) assert.equal((await post('logCustom', {food, meal: 'Lunch', quantity: 1, ...patch})).status, 400);
  assert.deepEqual((await get()).state.logs, before.state.logs);
});
test('cycle settings save and disable correctly; disabling keeps settings', async () => {
  reset();
  const cycle = {enabled: true, start: '2026-10-20', length: 28, duration: 5};
  const saved = await post('cycle', {cycle});
  assert.equal(saved.status, 200);
  assert.equal(saved.data.cycleEstimate.day, 3);
  const off = await post('cycleDisable');
  assert.equal(off.data.cycleEstimate, null);
  assert.deepEqual(off.data.state.cycle, {...cycle, enabled: false});
});
test('the server keeps no visitor data: no database, no cookies, and cross-site posts are refused', async () => {
  const source = fs.readFileSync(path.join(root, 'app/api/nutrition/route.ts'), 'utf8');
  assert(!/Set-Cookie|prepare\(|nutrition_accounts|@\/lib\/visitor|@\/lib\/database/.test(source));
  assert.equal(fs.existsSync(path.join(root, 'app/api/guest-session/route.ts')), false);
  reset();
  const blocked = await route.POST(new Request('https://nourish.test/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json', origin: 'https://another.test'}, body: JSON.stringify({action: 'water', date, state, amount: 100})}));
  assert.equal(blocked.status, 400);
  assert.equal(state.water[date], undefined);
});
test('saved data that cannot be read is rejected rather than silently replaced', async () => {
  reset();
  const response = await route.POST(new Request('https://nourish.test/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json', origin: 'https://nourish.test'}, body: JSON.stringify({action: 'water', date, state: {logs: 'not a list'}, amount: 100})}));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /could not be read/);
});

// ── Option lists: every choice the form shows must be a value the server accepts ──
test('each profile option has a unique value and a readable label', () => {
  for (const [name, list] of Object.entries({SEX: options.SEX_OPTIONS, ACTIVITY: options.ACTIVITY_OPTIONS, GOAL: options.GOAL_OPTIONS, DIET: options.DIET_OPTIONS, CUISINE: options.CUISINE_OPTIONS, FREQUENCY: options.FREQUENCY_OPTIONS, COOKING: options.COOKING_OPTIONS, BUDGET: options.BUDGET_OPTIONS})) {
    const values = list.map(([value]) => value);
    assert.equal(new Set(values).size, values.length, name + ' values are unique');
    for (const [, label] of list) {
      assert(label.length >= 4 && label.length <= 60, name + ' label length: ' + label);
      assert(!/^[a-z]/.test(label), name + ' label starts with a capital: ' + label);
    }
    assert(list.length >= 3, name + ' offers more than two or three choices');
  }
});
test('the server accepts every option value and rejects unknown ones', async () => {
  reset();
  const base = {name: 'Option Check', age: 30, sex: 'female', height: 165, weight: 60, activity: 'light', goal: 'General wellness', diet: 'Vegetarian', allergies: '', intolerances: '', dislikes: '', preferred: '', cuisine: 'Indian', frequency: 4, cooking: 'Quick meals', budget: 'Moderate'};
  const sets = {sex: options.SEX_OPTIONS, activity: options.ACTIVITY_OPTIONS, goal: options.GOAL_OPTIONS, diet: options.DIET_OPTIONS, cuisine: options.CUISINE_OPTIONS, frequency: options.FREQUENCY_OPTIONS, cooking: options.COOKING_OPTIONS, budget: options.BUDGET_OPTIONS};
  for (const [key, list] of Object.entries(sets)) for (const [value] of list) {
    const result = await post('profile', {profile: {...base, [key]: value}});
    assert.equal(result.status, 200, key + '=' + value);
  }
  assert.equal((await post('profile', {profile: {...base, diet: 'Keto'}})).status, 400);
  assert.equal((await post('profile', {profile: {...base, cooking: 'Whenever'}})).status, 400);
  assert.equal((await post('profile', {profile: {...base, frequency: 2}})).status, 400);
});

test('cuisine offers more than just Indian regions', () => {
  const values = options.CUISINE_OPTIONS.map(([v]) => v);
  assert(values.length >= 8, 'at least 8 cuisine choices');
  for (const v of ['Mediterranean', 'Italian', 'Mexican', 'Chinese', 'Continental', 'East Indian', 'West Indian']) assert(values.includes(v), v);
});

// ── Diet rules ──
const item = id => nutrition.foods.find(f => f.id === id);
test('diet rules: fish is not meat; each diet keeps the right foods', () => {
  const profileFor = diet => ({diet, allergies: '', intolerances: '', dislikes: ''});
  assert.equal(nutrition.allowed(item('fish'), profileFor('Pescatarian')), true);
  assert.equal(nutrition.allowed(item('chicken'), profileFor('Pescatarian')), false);
  assert.equal(nutrition.allowed(item('fish'), profileFor('Vegetarian')), false);
  assert.equal(nutrition.allowed(item('egg'), profileFor('Vegetarian')), false);
  assert.equal(nutrition.allowed(item('egg'), profileFor('Eggetarian')), true);
  assert.equal(nutrition.allowed(item('fish'), profileFor('Eggetarian')), false);
  assert.equal(nutrition.allowed(item('paneer'), profileFor('Vegan')), false);
  assert.equal(nutrition.allowed(item('rice'), profileFor('Vegan')), true);
  assert.equal(nutrition.allowed(item('chicken'), profileFor('Non-vegetarian')), true);
});
test('paneer, milk and curd are flagged as lactose so lactose intolerance excludes them', () => {
  const p = {diet: 'Non-vegetarian', allergies: '', intolerances: 'lactose', dislikes: ''};
  for (const id of ['paneer', 'milk', 'curd']) assert.equal(nutrition.allowed(item(id), p), false, id);
  assert.equal(nutrition.allowed(item('rice'), p), true);
});

// ── Planner and suggestions follow the saved profile ──
test('meal slots follow the chosen meals per day', () => {
  assert.deepEqual(nutrition.mealTypesFor({frequency: 3}), ['Breakfast', 'Lunch', 'Dinner']);
  assert.deepEqual(nutrition.mealTypesFor({frequency: 4}), ['Breakfast', 'Lunch', 'Snack', 'Dinner']);
  assert.deepEqual(nutrition.mealTypesFor({frequency: 5}), ['Breakfast', 'Morning snack', 'Lunch', 'Evening snack', 'Dinner']);
});
test('suggestions are deterministic per day, respect the diet and the budget', () => {
  const profile = {name: 'x', age: 30, sex: 'female', height: 165, weight: 60, activity: 'light', goal: 'General wellness', diet: 'Vegan', allergies: '', intolerances: '', dislikes: '', preferred: '', cuisine: 'Indian', frequency: 4, cooking: 'No cooking', budget: 'Budget'};
  const t = nutrition.targets(profile);
  const first = nutrition.suggestions(profile, t, 5), again = nutrition.suggestions(profile, t, 5);
  assert.deepEqual(first, again);
  assert(first.length > 0);
  for (const plan of first) {
    assert(plan.reasons.some(r => r.includes('Vegan')));
    for (const m of plan.meals) {
      const f = nutrition.foods.find(x => x.name === m.name);
      assert(nutrition.allowed(f, profile));
      assert(f.quick, 'quick cooking only: ' + m.name);
      assert(f.cost < 3, 'budget only: ' + m.name);
    }
  }
});
test('a restrictive profile with nothing to suggest returns an empty list instead of failing', () => {
  const profile = {diet: 'Vegan', allergies: 'rice, roti, oats, almonds, peanuts, poha, idli, dosa, orange, banana, apple, carrot, spinach, tofu, dal, chickpeas, chicken, fish, egg, milk, curd, paneer', intolerances: '', dislikes: '', preferred: '', cuisine: 'Any', cooking: 'Flexible', budget: 'Flexible', frequency: 4};
  assert.deepEqual(nutrition.suggestions(profile, nutrition.targets({...profile, name: 'x', age: 30, sex: 'female', height: 165, weight: 60, activity: 'light', goal: 'General wellness'}), 1), []);
});

// ── AI food estimate ──
test('estimating a custom food fills in reasonable values without saving any data', async () => {
  reset();
  const before = await get();
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  let called = false;
  geminiFetch = async () => {called = true; throw Error('should not call Gemini');};
  const catalog = await route.POST(new Request('https://nourish.test/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json', origin: 'https://nourish.test'}, body: JSON.stringify({action: 'estimateFood', name: 'Cooked rice'})}));
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).source, 'catalog');
  assert.equal(called, false);
  geminiFetch = async (url, options) => {
    assert.match(url, /generateContent$/);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({serving: '1 bowl, 200 g', calories: 310, protein: 9, carbs: 40, fat: 11, fiber: 5})}]}, finishReason: 'STOP'}]});
  };
  const response = await route.POST(new Request('https://nourish.test/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json', origin: 'https://nourish.test'}, body: JSON.stringify({action: 'estimateFood', name: 'Vegetable khichdi'})}));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.estimate.calories, 310);
  assert.equal(data.estimate.serving, '1 bowl, 200 g');
  assert.deepEqual((await get()).state, before.state);
  delete runtimeEnv.GEMINI_API_KEY;
});
test('estimating a food is refused without a Gemini key, same as other AI features', async () => {
  const response = await route.POST(new Request('https://nourish.test/api/nutrition', {method: 'POST', headers: {'Content-Type': 'application/json', origin: 'https://nourish.test'}, body: JSON.stringify({action: 'estimateFood', name: 'Something new'})}));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'AI_NOT_CONFIGURED');
});

// ── AI planner ──
test('the AI planner returns days near the calorie and protein target and never a saved exclusion', async () => {
  reset();
  await post('profile', {profile});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  const t = nutrition.targets(profile);
  const dayMeals = [
    {type: 'Breakfast', name: 'Vegetable upma', description: 'Semolina with vegetables', calories: Math.round(t.calories * .25), protein: Math.round(t.protein * .25), carbs: 30, fat: 5, fiber: 3},
    {type: 'Lunch', name: 'Rajma and rice', description: 'Kidney beans curry with rice', calories: Math.round(t.calories * .35), protein: Math.round(t.protein * .35), carbs: 60, fat: 8, fiber: 6},
    {type: 'Snack', name: 'Roasted chana', description: '', calories: Math.round(t.calories * .15), protein: Math.round(t.protein * .15), carbs: 15, fat: 3, fiber: 4},
    {type: 'Dinner', name: 'Vegetable pulao', description: 'Rice with mixed vegetables', calories: Math.round(t.calories * .25), protein: Math.round(t.protein * .25), carbs: 45, fat: 6, fiber: 4},
  ];
  const aiPlan = {days: [{date, meals: dayMeals}]};
  geminiFetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify(aiPlan)}]}, finishReason: 'STOP'}]});
  const planned = await post('planAI', {days: 1});
  assert.equal(planned.status, 200);
  const day = planned.data.state.aiPlan.days[0];
  assert.equal(day.date, date);
  const totalCalories = day.meals.reduce((a, m) => a + m.totals.calories, 0);
  assert(Math.abs(totalCalories - t.calories) < t.calories * .15, 'close to the calorie target');
  for (const m of day.meals) assert.equal(nutrition.mentionsExcluded(m.name + ' ' + m.description, profile).length, 0);
  delete runtimeEnv.GEMINI_API_KEY;
});
test('an AI plan mentioning an excluded food is rejected and not saved', async () => {
  reset();
  await post('profile', {profile: {...profile, allergies: 'paneer'}});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  const excludedPlan = {days: [{date, meals: [{type: 'Dinner', name: 'Paneer curry', calories: 400, protein: 20, carbs: 20, fat: 15, fiber: 2}]}]};
  geminiFetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify(excludedPlan)}]}, finishReason: 'STOP'}]});
  const blocked = await post('planAI', {days: 1});
  assert.equal(blocked.status, 502);
  assert.equal(blocked.data.code, 'AI_EXCLUDED_FOOD');
  assert.equal((await get()).state.aiPlan, null);
  delete runtimeEnv.GEMINI_API_KEY;
});
test('every meal added from the AI planner can be added to the grocery list by name', async () => {
  reset();
  await post('profile', {profile});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  const groceryPlan = {days: [{date, meals: [{type: 'Lunch', name: 'Chana masala with rice', calories: 500, protein: 20, carbs: 70, fat: 10, fiber: 8}]}]};
  geminiFetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify(groceryPlan)}]}, finishReason: 'STOP'}]});
  await post('planAI', {days: 1});
  const added = await post('groceryAdd', {name: 'Chana masala with rice'});
  assert(added.data.state.groceries.some(g => g.name === 'Chana masala with rice'));
  delete runtimeEnv.GEMINI_API_KEY;
});

// ── Gemini connection ──
const profile = {name: 'Private Test Name', age: 25, sex: 'female', height: 160, weight: 60, activity: 'light', goal: 'General wellness', diet: 'Vegetarian', allergies: 'peanuts', intolerances: 'lactose', dislikes: '', preferred: 'rice', cuisine: 'Indian', frequency: 4, cooking: 'Quick meals', budget: 'Moderate'};

test('an allergy typed in the profile is never shown in the recommended meals, on any day', () => {
  const base = {name: 'x', age: 30, sex: 'female', height: 165, weight: 60, activity: 'light', goal: 'General wellness', diet: 'Vegetarian', intolerances: '', dislikes: '', preferred: '', cuisine: 'North Indian', cooking: 'Flexible', budget: 'Flexible', frequency: 4, allergies: 'paneer'};
  const t = nutrition.targets(base);
  for (let seed = 0; seed < 60; seed++) for (const plan of nutrition.suggestions(base, t, seed)) for (const m of plan.meals) assert.notEqual(m.name, 'Paneer', 'seed ' + seed);
});
test('regional cuisine choices bring their own dishes to the front', () => {
  const base = {name: 'x', age: 30, sex: 'female', height: 165, weight: 60, activity: 'light', goal: 'General wellness', diet: 'Vegetarian', allergies: '', intolerances: '', dislikes: '', preferred: '', cooking: 'Flexible', budget: 'Flexible', frequency: 4};
  const t = nutrition.targets({...base, name: 'x', age: 30, sex: 'female', height: 165, weight: 60, activity: 'light'});
  assert(['idli', 'dosa'].includes(nutrition.meal({...base, cuisine: 'South Indian'}, 'Breakfast', 0, t).entries[0].foodId), 'South Indian breakfast');
  assert.equal(nutrition.meal({...base, cuisine: 'North Indian'}, 'Breakfast', 0, t).entries[0].foodId, 'roti');
});
test('lactose intolerance blocks dairy words in AI text checks', () => {
  const p = {allergies: '', intolerances: 'lactose', dislikes: ''};
  assert.deepEqual(nutrition.mentionsExcluded('Paneer curry with rice.', p), ['paneer']);
  assert.equal(nutrition.mentionsExcluded('Dal and rice with vegetables.', p).length, 0);
});
test('chat food request detects idly spelling and pantry-only messages', () => {
  const profile = {diet: 'Eggetarian', allergies: '', intolerances: '', dislikes: ''};
  assert.equal(nutrition.analyzeChatFoodRequest('i want to eat idly', {diet: 'Vegetarian', allergies: '', intolerances: '', dislikes: ''}).status, 'inList');
  assert.equal(nutrition.analyzeChatFoodRequest('i want to eat idly', {diet: 'Vegetarian', allergies: '', intolerances: '', dislikes: ''}).food, 'Plain idli');
  const pantry = nutrition.analyzeChatFoodRequest('I only have eggs and rice.', profile);
  assert.equal(pantry.status, 'pantryOnly');
  assert.deepEqual(pantry.ids, ['egg', 'rice']);
  assert.equal(nutrition.analyzeChatFoodRequest('i want to eat pizza', profile).status, 'notInApp');
});
test('chat retries when the first reply mentions an excluded food', async () => {
  reset();
  await post('profile', {profile: {...profile, intolerances: 'lactose'}});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  let calls = 0;
  geminiFetch = async () => {
    calls++;
    return chatReply(calls === 1 ? 'Try vegetable poha with paneer and milk.' : 'Try vegetable poha with sambar and coconut chutney.');
  };
  const result = await post('chat', {message: 'Dinner ideas?'});
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.match(result.data.state.conversations[0].messages.at(-1).text, /poha|sambar/i);
});
test('an Ask Bloom tip that names an excluded food is not saved', async () => {
  reset();
  await post('profile', {profile: {...profile, allergies: 'paneer'}});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  geminiFetch = async () => tipReply({dinner: 'Paneer curry with rice.'});
  const blocked = await post('recommend', {});
  assert.equal(blocked.status, 502);
  assert.equal(blocked.data.code, 'AI_EXCLUDED_FOOD');
  assert.equal((await get()).recommendation, null);
  geminiFetch = async () => tipReply({dinner: 'Dal and rice with vegetables.'});
  assert.equal((await post('recommend', {})).status, 200);
  delete runtimeEnv.GEMINI_API_KEY;
});
test('missing or blank Gemini key is graceful and leaves food tools working', async () => {
  reset();
  await post('profile', {profile});
  let calls = 0;
  geminiFetch = async () => {calls++; return geminiReply('unused');};
  for (const value of [undefined, '', '   ']) {
    runtimeEnv.GEMINI_API_KEY = value;
    assert.equal((await aiStatus()).aiAvailable, false);
    const before = await get();
    const result = await post('chat', {message: 'What could I eat for dinner?'});
    assert.equal(result.status, 503);
    assert.equal(result.data.code, 'AI_NOT_CONFIGURED');
    assert.deepEqual((await get()).state, before.state);
  }
  assert.equal(calls, 0);
  assert.equal((await post('log', {foodId: 'rice', meal: 'Dinner', quantity: 1})).status, 200);
});
test('Gemini requests use a header-only key, the free model and authoritative personal context', async () => {
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  runtimeEnv.GEMINI_MODEL = 'gemini-3.8-flash';
  const before = await get();
  let request;
  geminiFetch = async (url, options) => {request = {url, options}; return chatReply('Mock provider reply for the integration test.');};
  const result = await post('chat', {message: 'Help me reach my protein target.'});
  assert.equal(result.status, 200);
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(request.options.headers['x-goog-api-key'], runtimeEnv.GEMINI_API_KEY);
  assert.equal(request.options.headers.Authorization, undefined);
  assert(request.options.signal instanceof AbortSignal);
  const body = JSON.parse(request.options.body);
  assert.equal(body.contents.at(-1).parts[0].text, 'Help me reach my protein target.');
  assert.equal(body.contents.at(-1).role, 'user');
  assert.equal(body.generationConfig.thinkingConfig?.thinkingBudget, 0, 'thinking disabled for gemini-3.x flash');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  const instruction = body.systemInstruction.parts[0].text;
  const context = JSON.parse(instruction.match(/Context: (\{[\s\S]*\})\./)[1]);
  assert.equal(context.avoid.includes('peanuts'), true);
  assert.equal(context.targets.calories, before.targets.calories);
  assert.equal(context.targets.protein, before.targets.protein);
  assert.equal(context.profilePreferences.diet, 'Vegetarian');
  assert(!context.allowedFoods.includes('Peanuts'));
  assert(!context.allowedFoods.includes('Paneer'), 'lactose intolerance excludes paneer');
  assert(!request.options.body.includes(runtimeEnv.GEMINI_API_KEY));
  assert(!JSON.stringify(result.data).includes(runtimeEnv.GEMINI_API_KEY));
  const conversation = result.data.state.conversations.find(c => c.id === result.data.activeConversationId);
  assert.equal(conversation.messages.at(-1).text, 'Mock provider reply for the integration test.');
  const second = await post('chat', {message: 'And for breakfast?', conversationId: conversation.id});
  assert.equal(second.data.activeConversationId, conversation.id);
  const followUp = JSON.parse(request.options.body);
  assert.equal(followUp.contents.length, 3);
  assert.deepEqual(followUp.contents.map(c => c.role), ['user', 'model', 'user']);
  assert.deepEqual((await get()).state.conversations, second.data.state.conversations);
});
test('a Gemini key rejected by Google is reported as a site configuration issue', async () => {
  geminiFetch = async () => Response.json({error: {message: 'API key not valid. Please pass a valid API key.'}}, {status: 400});
  const result = await post('chat', {message: 'Dinner ideas?'});
  assert.equal(result.status, 503);
  assert.equal(result.data.code, 'AI_CONFIGURATION_ERROR');
  assert(!JSON.stringify(result.data).includes('valid API key'));
});
test('Google model overload (503 high demand) returns a clear retry message', async () => {
  reset();
  await post('profile', {profile});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  geminiFetch = async () => Response.json({error: {code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE'}}, {status: 503});
  const result = await post('chat', {message: 'Dinner ideas?'});
  assert.equal(result.status, 503);
  assert.equal(result.data.code, 'AI_OVERLOADED');
  delete runtimeEnv.GEMINI_API_KEY;
});
test('Gemini provider failures are sanitized, do not save fake replies, and can be retried', async () => {
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  const before = await get();
  for (const [status, expected, code] of [[401, 503, 'AI_CONFIGURATION_ERROR'], [403, 503, 'AI_CONFIGURATION_ERROR'], [429, 429, 'AI_RATE_LIMITED'], [500, 502, 'AI_PROVIDER_ERROR']]) {
    geminiFetch = async () => Response.json({error: {message: 'Private provider detail ' + runtimeEnv.GEMINI_API_KEY}}, {status});
    const result = await post('chat', {message: 'Dinner ideas?'});
    assert.equal(result.status, expected);
    assert.equal(result.data.code, code);
    assert(!JSON.stringify(result.data).includes(runtimeEnv.GEMINI_API_KEY));
  }
  for (const [response, code] of [
    [new Response('not JSON'), 'AI_INVALID_RESPONSE'],
    [Response.json({candidates: []}), 'AI_EMPTY_RESPONSE'],
    [Response.json({candidates: [{finishReason: 'MAX_TOKENS', content: {parts: []}}]}), 'AI_EMPTY_RESPONSE'],
    [Response.json({promptFeedback: {blockReason: 'SAFETY'}}), 'AI_BLOCKED'],
  ]) {
    geminiFetch = async () => response;
    assert.equal((await post('chat', {message: 'Dinner ideas?'})).data.code, code);
  }
  geminiFetch = async () => {throw Error('Simulated timeout');};
  assert.equal((await post('chat', {message: 'Dinner ideas?'})).status, 504);
  assert.deepEqual((await get()).state.conversations, before.state.conversations);
  geminiFetch = async () => chatReply('Recovered reply.');
  assert.equal((await post('chat', {message: 'Dinner ideas?'})).status, 200);
  delete runtimeEnv.GEMINI_API_KEY;
  delete runtimeEnv.GEMINI_MODEL;
});
test('the daily tip is generated once per day and is then served from saved state', async () => {
  reset();
  await post('profile', {profile});
  let calls = 0;
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  geminiFetch = async () => {
    calls++;
    return tipReply(calls <= 1 ? {} : {breakfast: 'Vegetable upma', lunch: 'Rajma with rice', dinner: 'Chapati with sabzi'});
  };
  const first = await post('recommend', {});
  assert.equal(first.status, 200);
  assert.equal(first.data.recommendation.text.startsWith('Breakfast'), true);
  const again = await post('recommend', {});
  assert.equal(again.status, 200);
  assert.equal(calls, 1, 'second request served from saved tip');
  const refreshed = await post('recommend', {refresh: true});
  assert.equal(refreshed.status, 200);
  assert.equal(calls, 2);
  delete runtimeEnv.GEMINI_API_KEY;
});
test('profile edits clear the saved tip so it is regenerated from the new details', async () => {
  reset();
  await post('profile', {profile});
  runtimeEnv.GEMINI_API_KEY = 'test-only-credential-not-valid';
  geminiFetch = async () => tipReply();
  await post('recommend', {});
  assert((await get()).recommendation);
  const saved = await post('profile', {profile: {...profile, diet: 'Non-vegetarian'}});
  assert.equal(saved.data.recommendation, null);
  delete runtimeEnv.GEMINI_API_KEY;
});

test('planner generation, swapping and grocery actions retain authoritative nutrition and saved values', async () => {
  reset();
  await post('profile', {profile});
  for (const days of [1, 7]) {
    const planned = await post('plan', {days});
    assert.equal(planned.status, 200);
    assert.equal(planned.data.state.plan.length, days);
    for (const day of planned.data.state.plan) {
      assert.deepEqual(day.meals.map(m => m.type), ['Breakfast', 'Lunch', 'Snack', 'Dinner']);
      for (const meal of day.meals) {
        assert.deepEqual(meal.totals, nutrition.sum(meal.entries));
        assert(meal.entries.every(e => nutrition.allowed(nutrition.foods.find(f => f.id === e.foodId), profile)));
      }
    }
  }
  const before = await get(), day = before.state.plan[0], meal = day.meals[0];
  const swapped = await post('swap', {planDate: day.date, id: meal.id});
  assert.equal(swapped.status, 200);
  assert.equal(swapped.data.state.plan[0].meals[0].type, meal.type);
  assert.deepEqual(swapped.data.state.plan[0].meals[0].totals, nutrition.sum(swapped.data.state.plan[0].meals[0].entries));
  const groceries = await post('groceries');
  assert(groceries.data.state.groceries.length > 0);
  const expected = {};
  for (const day of groceries.data.state.plan) for (const meal of day.meals) for (const entry of meal.entries) expected[entry.foodId] = (expected[entry.foodId] || 0) + entry.quantity;
  for (const item of groceries.data.state.groceries) assert.equal(item.quantity, expected[item.id]);
  const first = groceries.data.state.groceries[0];
  assert.equal((await post('groceryToggle', {id: first.id})).data.state.groceries.find(g => g.id === first.id).checked, true);
  const added = await post('groceryAdd', {name: 'Fresh herbs'});
  const extra = added.data.state.groceries.find(g => g.name === 'Fresh herbs');
  assert(extra);
  assert.equal(extra.group, 'Extra');
  await post('groceryRemove', {id: extra.id});
  assert(!(await get()).state.groceries.some(g => g.id === extra.id));
  assert.deepEqual((await get()).state.plan, groceries.data.state.plan);
});
test('profile updates, hydration, weight history and progress averages continue using saved real values', async () => {
  reset();
  await post('profile', {profile});
  const updated = {...profile, diet: 'Vegan', goal: 'Maintenance', weight: 62};
  const saved = await post('profile', {profile: updated});
  assert.deepEqual(saved.data.state.profile, updated);
  assert.deepEqual(saved.data.targets, nutrition.targets(updated));
  assert.equal((await post('water', {amount: 250})).data.state.water[date], 250);
  assert.equal((await post('water', {amount: -250})).data.state.water[date], 0);
  await post('water', {amount: 750});
  assert.equal((await post('weight', {weight: '61.5'})).data.state.weights.at(-1).weight, 61.5);
  const sameDay = await post('weight', {weight: '62'});
  assert.equal(sameDay.data.state.weights.filter(w => w.date === date).length, 1);
  assert.equal(sameDay.data.state.weights.find(w => w.date === date).weight, 62);
  await post('log', {foodId: 'rice', meal: 'Lunch', quantity: 2});
  const loaded = await get();
  assert.equal(loaded.weekly.loggedDays, 1);
  assert.equal(loaded.weekly.averages.calories, 260);
  assert.equal(loaded.weekly.averages.water, 750);
  assert.deepEqual(loaded.state.profile, updated);
  const invalid = await post('profile', {profile: {...updated, age: 10}});
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.error, /age/);
  assert.deepEqual((await get()).state.profile, updated);
});

// ── Frontend handlers, extracted from the real component source ──
const clientSource = fs.readFileSync(path.join(root, 'app/nutrition-app.tsx'), 'utf8');
const clientTree = ts.createSourceFile('app.tsx', clientSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function clientFunction(name, bindings) {
  let found;
  function visit(node) {if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; ts.forEachChild(node, visit);}
  visit(clientTree);
  assert(found, 'Client function exists: ' + name);
  const code = ts.transpileModule(found.getText(clientTree), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  return new Function(...Object.keys(bindings), code + '\nreturn ' + name)(...Object.values(bindings));
}
test('frontend chat request uses its own backend and exposes loading/error states', async () => {
  const loading = [], errors = [], saved = [];
  let finish, request;
  const act = clientFunction('act', {busy: false, state: {conversations: []}, storageError: '', date, setBusy: v => loading.push(v), setState: v => saved.push(v), setChatId: () => {}, setChatError: v => errors.push(v), toast: {error: () => {}}, fetch: async (url, options) => {request = {url, options}; return new Promise(resolve => {finish = resolve;});}});
  const pending = act('chat', {message: 'What should I eat?', conversationId: 'existing-chat'});
  assert.deepEqual(loading, [true]);
  assert.equal(request.url, '/api/nutrition');
  assert.deepEqual(request.options.headers, {'Content-Type': 'application/json'});
  assert.equal(JSON.parse(request.options.body).action, 'chat');
  finish(Response.json({error: 'Ask Bloom is temporarily unavailable.'}, {status: 503}));
  assert.equal(await pending, null);
  assert.deepEqual(loading, [true, false]);
  assert.deepEqual(errors, ['Ask Bloom is temporarily unavailable.']);
  assert.equal(saved.length, 0);
});
test('frontend submit and retry display the returned conversation and keep the draft on failure', async () => {
  for (const ok of [false, true]) {
    const messages = [], ids = [], errors = [];
    const send = clientFunction('sendMessage', {busy: false, message: 'Dinner ideas?', chatId: 'older-chat', data: {state: {conversations: []}}, setMessage: v => messages.push(v), setChatId: v => ids.push(v), setChatError: v => errors.push(v), act: async (action, payload) => {assert.equal(action, 'chat'); assert.equal(payload.conversationId, 'older-chat'); return ok ? {activeConversationId: 'returned-chat'} : null;}});
    await send();
    assert.deepEqual(messages, ok ? [''] : []);
    assert.deepEqual(ids, ok ? ['returned-chat'] : []);
    assert.deepEqual(errors, ['']);
  }
});
test('delete dialog handlers dismiss, await removal, and restore a surviving focus target', async () => {
  let dialog;
  const attr = (node, name) => node.openingElement.attributes.properties.find(a => a.name?.getText(clientTree) === name)?.initializer;
  function find(node) {if (ts.isJsxElement(node) && node.openingElement.tagName.getText(clientTree) === 'AlertDialog' && attr(node, 'open')?.expression?.getText(clientTree) === 'Boolean(deleteId)') dialog = node; ts.forEachChild(node, find);}
  find(clientTree);
  assert(dialog);
  function child(tag) {let found; function visit(node) {if (ts.isJsxElement(node) && node.openingElement.tagName.getText(clientTree) === tag) found = node; ts.forEachChild(node, visit);} visit(dialog); return found;}
  function handler(node, name, bindings) {const expression = attr(node, name).expression.getText(clientTree); const code = ts.transpileModule('const handler = ' + expression, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText; return new Function(...Object.keys(bindings), code + ';return handler;')(...Object.values(bindings));}
  for (const success of [false, true]) {
    const closed = [];
    let finish, prevented = false;
    const remove = handler(child('AlertDialogAction'), 'onClick', {deleteId: 'entry-to-remove', setDeleteId: v => closed.push(v), act: async (action, payload) => {assert.equal(action, 'removeLog'); assert.equal(payload.id, 'entry-to-remove'); return new Promise(resolve => {finish = resolve;});}});
    const pending = remove({preventDefault() {prevented = true;}});
    assert(prevented);
    assert.deepEqual(closed, []);
    finish(success ? {} : null);
    await pending;
    assert.deepEqual(closed, success ? [''] : []);
  }
  const closed = [];
  handler(child('button'), 'onClick', {setDeleteId: v => closed.push(v)})();
  handler(dialog, 'onOpenChange', {setDeleteId: v => closed.push(v)})(false);
  assert.deepEqual(closed, ['', '']);
  for (const connected of [true, false]) {
    const focus = [];
    handler(child('AlertDialogContent'), 'onCloseAutoFocus', {deleteReturnFocus: {current: {isConnected: connected, focus() {focus.push('original');}}}, deleteFallbackFocus: {current: {focus() {focus.push('meal-add');}}}})({preventDefault() {}});
    assert.deepEqual(focus, [connected ? 'original' : 'meal-add']);
  }
});
test('the client never sends the Gemini key or calls Google directly', () => {
  for (const file of ['app/nutrition-app.tsx', 'components/nutrition/home-page.tsx', 'components/nutrition/onboarding.tsx', 'components/nutrition/profile-fields.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert(!/generativelanguage|GEMINI|x-goog-api-key|NEXT_PUBLIC_|VITE_/.test(source), file);
  }
});
