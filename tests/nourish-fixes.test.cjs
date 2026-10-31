// Run with: node --test tests/nourish-fixes.test.cjs
// Executes the real request handlers with an in-memory D1 adapter; no live user data.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const React = req('react');
const {renderToStaticMarkup} = req('react-dom/server');
const rows = new Map();
const runtimeEnv = {};
let openaiFetch = async()=>{throw Error('Unexpected external request in test');};
const database = () => ({prepare(sql) {return {bind(...args) {return {
  async first() {return rows.get(args[0]) || null;},
  async run() {
    if (sql.startsWith('INSERT')) {if (!rows.has(args[0])) rows.set(args[0], {data:args[1],version:0});}
    else if (sql.startsWith('DELETE')) {return {meta:{changes:Number(rows.delete(args[0]))}};}
    else if (sql.startsWith('UPDATE')) {
      const row = rows.get(args[1]);
      if (!row || row.version !== args[2]) return {meta:{changes:0}};
      rows.set(args[1], {data:args[0],version:row.version+1});
    } else throw Error('Unexpected SQL: '+sql);
    return {meta:{changes:1}};
  }
};}};}});
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const module = {exports:{}};
  cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const localRequire = name => {
    if (name === 'cloudflare:workers') return {env:runtimeEnv};
    if (name === '@/lib/database') return {database};
    if (name === '@/app/chatgpt-auth') return {getChatGPTUser:async()=>null};
    if (name.startsWith('@/')) return load(name.slice(2)+'.ts');
    return req(name);
  };
  vm.runInThisContext('(function(require,module,exports,fetch){'+code+'\n})', {filename:file})(localRequire,module,module.exports,(...args)=>openaiFetch(...args));
  return module.exports;
}
const nutrition = load('lib/nutrition.ts');
const route = load('app/api/nutrition/route.ts');
const session = load('app/api/guest-session/route.ts');
const date = '2026-10-22';
const tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64);
const headers = token => ({cookie:'nourish_guest='+token,origin:'https://nourish.test','Content-Type':'application/json'});
const get = async(token=tokenA) => (await route.GET(new Request('https://nourish.test/api/nutrition?date='+date,{headers:headers(token)}))).json();
async function post(action,payload={},token=tokenA) {
  const current=await get(token);
  const response=await route.POST(new Request('https://nourish.test/api/nutrition',{method:'POST',headers:headers(token),body:JSON.stringify({action,date,version:current.version,...payload})}));
  return {status:response.status,data:await response.json()};
}
const food={name:'Test samosa',serving:'1 piece · 80 g',calories:240,protein:5,carbs:30,fat:11,fiber:3};

test('catalog stays intact; names, tags, case, whitespace and spelling aliases work',()=>{
  assert.equal(nutrition.foods.length,24);
  for(const query of ['biryani','biriyani','briyani','  CHICKEN   BIRIYANI  ']) assert(nutrition.searchFoods(query).some(f=>f.id==='biryani'));
  assert(nutrition.searchFoods('rice').some(f=>f.id==='rice'));
  assert(nutrition.searchFoods('dal').some(f=>f.id==='dal'));
  assert(nutrition.searchFoods('eggs').some(f=>f.id==='egg'));
  assert.equal(nutrition.searchFoods('samosa').length,0);
  assert.equal(nutrition.searchFoods('   ').length,24);
});
test('existing catalog totals remain unchanged',()=>{
  assert.deepEqual(nutrition.sum([{foodId:'rice',quantity:2},{foodId:'egg',quantity:1}]),{calories:338,protein:11.7,carbs:57,fat:5.9,fiber:.8});
});
test('custom and catalog food log, reload, edit, totals and removal use the existing save path',async()=>{
  rows.clear();
  const created=await post('logCustom',{food:{...food,source:'untrusted source override'},meal:'Snack',quantity:2});
  assert.equal(created.status,200);
  const entry=created.data.state.logs[0];
  assert.equal(entry.customFood.name,food.name);
  assert.equal(entry.customFood.source,'User-entered nutrition');
  assert.equal(created.data.totals.calories,480);
  assert.equal(created.data.weekly.averages.protein,10);
  const loaded=await get();
  assert.deepEqual(loaded.state.logs[0],entry);
  assert.equal((await get(tokenB)).state.logs.length,0);
  for(const meal of ['Breakfast','Lunch','Snack','Dinner']) {
    const result=await post('log',{foodId:'rice',quantity:.5,meal});
    assert.equal(result.status,200);
    assert.equal(result.data.state.logs.at(-1).meal,meal);
  }
  const edited=await post('editLog',{id:entry.id,quantity:1.5});
  assert.equal(edited.status,200);
  assert.equal(edited.data.totals.calories,620);
  assert.equal(edited.data.totals.protein,12.9);
  assert.equal(nutrition.loggedFood(edited.data.state.logs[0]).name,food.name);
  const removed=await post('removeLog',{id:entry.id});
  assert.equal(removed.data.state.logs.length,4);
  assert.equal(removed.data.totals.calories,260);
});
test('manual nutrition validation rejects missing, blank, negative or excessive values without writing',async()=>{
  const before=await get();
  for(const patch of [{name:''},{name:'  '},{serving:''},{calories:''},{protein:null},{fiber:undefined},{fat:-1},{calories:10001},{carbs:1001}]) {
    const result=await post('logCustom',{food:{...food,...patch},meal:'Lunch',quantity:1});
    assert.equal(result.status,400,JSON.stringify(patch));
  }
  for(const patch of [{meal:'Invalid'},{quantity:0},{quantity:21}]) assert.equal((await post('logCustom',{food,meal:'Lunch',quantity:1,...patch})).status,400);
  assert.equal((await get()).version,before.version);
  assert.deepEqual((await get()).state.logs,before.state.logs);
});
test('cycle settings save and disable correctly; disabling keeps settings',async()=>{
  const cycle={enabled:true,start:'2026-10-20',length:28,duration:5};
  const saved=await post('cycle',{cycle});
  assert.equal(saved.status,200);
  assert.equal(saved.data.cycleEstimate.day,3);
  const off=await post('cycleDisable');
  assert.equal(off.data.cycleEstimate,null);
  assert.deepEqual(off.data.state.cycle,{...cycle,enabled:false});
});
test('end session deletes only the current guest, expires the cookie and preserves origin checks',async()=>{
  await post('logCustom',{food,meal:'Dinner',quantity:1},tokenB);
  const blocked=await session.DELETE(new Request('https://nourish.test/api/guest-session',{method:'DELETE',headers:{...headers(tokenA),origin:'https://another.test'}}));
  assert.equal(blocked.status,400);
  assert((await get()).state.logs.length>0);
  const result=await session.DELETE(new Request('https://nourish.test/api/guest-session',{method:'DELETE',headers:headers(tokenA)}));
  assert.equal(result.status,200);
  assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await get()).state.logs.length,0);
  assert.equal((await get(tokenB)).state.logs.length,1);
});
test('every meal and onboarding option renders its controlled label',()=>{
  const {OnboardingChoice}=load('components/nutrition/onboarding-choice.tsx');
  const source=fs.readFileSync(path.join(root,'app/nutrition-app.tsx'),'utf8');
  const tree=ts.createSourceFile('app.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const choices=[];
  function visit(node){
    if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==='OnboardingChoice') {
      const attr=name=>node.attributes.properties.find(a=>a.name?.getText(tree)===name).initializer;
      const expression=attr('options').expression.getText(tree);
      choices.push({label:attr('label').text,options:expression==='dailyMeals'?['Breakfast','Lunch','Snack','Dinner']:vm.runInNewContext('('+expression+')')});
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
  assert.equal(choices.length,8);
  let count=0;
  for(const choice of choices)for(const option of choice.options) {
    const [value,label]=Array.isArray(option)?option:[option,option];
    for(const v of choice.label==='Preferred meal frequency'?[value,Number(value)]:[value]) {
      const html=renderToStaticMarkup(React.createElement(OnboardingChoice,{...choice,value:v,onChange:()=>{}}));
      assert(html.includes('>'+label+'</span>'));
      assert(html.includes('role="combobox"'));
      assert(html.includes('aria-expanded="false"'));
    }
    count++;
  }
  assert.equal(count,28);
});

const profile={name:'Private Test Name',age:25,sex:'female',height:160,weight:60,activity:'light',goal:'General wellness',diet:'Vegetarian',allergies:'peanuts',intolerances:'',dislikes:'',preferred:'rice',cuisine:'Indian',frequency:4,cooking:'Quick meals',budget:'Moderate'};
const successResponse=()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Mock provider reply for the integration test.'}]}]});

test('missing or blank AI key is graceful and leaves food tools working',async()=>{
  await post('profile',{profile});
  let calls=0;
  openaiFetch=async()=>{calls++;return successResponse();};
  for(const value of [undefined,'','   ']) {
    runtimeEnv.OPENAI_API_KEY=value;
    assert.equal((await get()).aiAvailable,false);
    const before=await get();
    const result=await post('chat',{message:'What could I eat for dinner?'});
    assert.equal(result.status,503);
    assert.equal(result.data.code,'AI_NOT_CONFIGURED');
    assert.equal((await get()).version,before.version);
  }
  assert.equal(calls,0);
  assert.equal((await post('log',{foodId:'rice',meal:'Dinner',quantity:1})).status,200);
});
test('AI requests use server-only bearer credentials and authoritative personal context',async()=>{
  runtimeEnv.OPENAI_API_KEY='test-only-credential-not-valid';
  runtimeEnv.OPENAI_MODEL='test-model';
  const before=await get();
  let request;
  openaiFetch=async(url,options)=>{request={url,options};return successResponse();};
  const result=await post('chat',{message:'Help me reach my protein target.'});
  assert.equal(result.status,200);
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization,'Bearer '+runtimeEnv.OPENAI_API_KEY);
  assert(request.options.signal instanceof AbortSignal);
  const body=JSON.parse(request.options.body);
  assert.equal(body.model,'test-model');
  assert.equal(body.store,false);
  assert.equal(body.input.at(-1).content,'Help me reach my protein target.');
  const context=JSON.parse(body.instructions.split('Context: ')[1]);
  assert.equal(context.profile.name,undefined);
  assert.equal(context.profile.allergies,'peanuts');
  assert.deepEqual(context.targets,before.targets);
  assert.deepEqual(context.today.totals,before.totals);
  assert(!context.eligibleFoods.some(f=>f.id==='peanuts'));
  assert(!request.options.body.includes(runtimeEnv.OPENAI_API_KEY));
  assert(!JSON.stringify(result.data).includes(runtimeEnv.OPENAI_API_KEY));
  const conversation=result.data.state.conversations.find(c=>c.id===result.data.activeConversationId);
  assert.equal(conversation.messages.at(-1).text,'Mock provider reply for the integration test.');
  const second=await post('chat',{message:'And for breakfast?',conversationId:conversation.id});
  assert.equal(second.data.activeConversationId,conversation.id);
  assert.equal(JSON.parse(request.options.body).input.length,3);
  assert.deepEqual((await get()).state.conversations,second.data.state.conversations);
});
test('AI provider failures are sanitized, do not save fake replies, and can be retried',async()=>{
  const before=await get();
  for(const [status,expected,code] of [[401,503,'AI_CONFIGURATION_ERROR'],[403,503,'AI_CONFIGURATION_ERROR'],[429,429,'AI_RATE_LIMITED'],[500,502,'AI_PROVIDER_ERROR']]) {
    openaiFetch=async()=>Response.json({error:'Private provider detail '+runtimeEnv.OPENAI_API_KEY},{status});
    const result=await post('chat',{message:'Dinner ideas?'});
    assert.equal(result.status,expected);
    assert.equal(result.data.code,code);
    assert(!JSON.stringify(result.data).includes(runtimeEnv.OPENAI_API_KEY));
  }
  for(const [response,code] of [[new Response('not JSON'),'AI_INVALID_RESPONSE'],[Response.json({status:'completed',output:[]}),'AI_EMPTY_RESPONSE'],[Response.json({status:'incomplete',output:[]}),'AI_INCOMPLETE_RESPONSE']]) {
    openaiFetch=async()=>response;
    assert.equal((await post('chat',{message:'Dinner ideas?'})).data.code,code);
  }
  openaiFetch=async()=>{throw Error('Simulated timeout');};
  assert.equal((await post('chat',{message:'Dinner ideas?'})).status,504);
  assert.equal((await get()).version,before.version);
  assert.deepEqual((await get()).state.conversations,before.state.conversations);
  openaiFetch=async()=>successResponse();
  assert.equal((await post('chat',{message:'Dinner ideas?'})).status,200);
  delete runtimeEnv.OPENAI_API_KEY;
  delete runtimeEnv.OPENAI_MODEL;
});

// These exercise the actual client handlers without pretending to run a browser.
const clientSource=fs.readFileSync(path.join(root,'app/nutrition-app.tsx'),'utf8');
const clientTree=ts.createSourceFile('app.tsx',clientSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function clientFunction(name,bindings) {
  let found;
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,visit);}
  visit(clientTree);
  assert(found,'Client function exists: '+name);
  const code=ts.transpileModule(found.getText(clientTree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return new Function(...Object.keys(bindings),code+'\nreturn '+name)(...Object.values(bindings));
}
test('frontend chat request uses its own backend and exposes loading/error states',async()=>{
  const loading=[],errors=[],saved=[];
  let finish,request;
  const act=clientFunction('act',{busy:false,date,data:{version:3},setBusy:v=>loading.push(v),setData:v=>saved.push(v),setChatId:()=>{},setChatError:v=>errors.push(v),load:async()=>{},toast:{error:()=>{}},fetch:async(url,options)=>{request={url,options};return new Promise(resolve=>{finish=resolve;});}});
  const pending=act('chat',{message:'What should I eat?',conversationId:'existing-chat'});
  assert.deepEqual(loading,[true]);
  assert.equal(request.url,'/api/nutrition');
  assert.deepEqual(request.options.headers,{'Content-Type':'application/json'});
  assert.equal(JSON.parse(request.options.body).action,'chat');
  finish(Response.json({error:'AI is temporarily unavailable.'},{status:503}));
  assert.equal(await pending,null);
  assert.deepEqual(loading,[true,false]);
  assert.deepEqual(errors,['AI is temporarily unavailable.']);
  assert.equal(saved.length,0);
});
test('frontend submit and retry display the returned conversation and keep the draft on failure',async()=>{
  for(const ok of [false,true]) {
    const messages=[],ids=[],errors=[];
    const send=clientFunction('sendMessage',{busy:false,message:'Dinner ideas?',chatId:'older-chat',data:{state:{conversations:[]}},setMessage:v=>messages.push(v),setChatId:v=>ids.push(v),setChatError:v=>errors.push(v),act:async(action,payload)=>{assert.equal(action,'chat');assert.equal(payload.conversationId,'older-chat');return ok?{activeConversationId:'returned-chat'}:null;}});
    await send();
    assert.deepEqual(messages,ok?['']:[]);
    assert.deepEqual(ids,ok?['returned-chat']:[]);
    assert.deepEqual(errors,['']);
  }
});
test('delete dialog handlers dismiss, await removal, and restore a surviving focus target',async()=>{
  let dialog;
  const attr=(node,name)=>node.openingElement.attributes.properties.find(a=>a.name?.getText(clientTree)===name)?.initializer;
  function find(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(clientTree)==='AlertDialog'&&attr(node,'open')?.expression?.getText(clientTree)==='Boolean(deleteId)')dialog=node;ts.forEachChild(node,find);}
  find(clientTree);
  assert(dialog);
  function child(tag){let found;function visit(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(clientTree)===tag)found=node;ts.forEachChild(node,visit);}visit(dialog);return found;}
  function handler(node,name,bindings){const expression=attr(node,name).expression.getText(clientTree);const code=ts.transpileModule('const handler = '+expression,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(bindings),code+';return handler;')(...Object.values(bindings));}
  for(const success of [false,true]) {
    const closed=[];
    let finish,prevented=false;
    const remove=handler(child('AlertDialogAction'),'onClick',{deleteId:'entry-to-remove',setDeleteId:v=>closed.push(v),act:async(action,payload)=>{assert.equal(action,'removeLog');assert.equal(payload.id,'entry-to-remove');return new Promise(resolve=>{finish=resolve;});}});
    const pending=remove({preventDefault(){prevented=true;}});
    assert(prevented);
    assert.deepEqual(closed,[]);
    finish(success?{}:null);
    await pending;
    assert.deepEqual(closed,success?['']:[]);
  }
  const closed=[];
  handler(child('button'),'onClick',{setDeleteId:v=>closed.push(v)})();
  handler(dialog,'onOpenChange',{setDeleteId:v=>closed.push(v)})(false);
  assert.deepEqual(closed,['','']);
  for(const connected of [true,false]) {
    const focus=[];
    handler(child('AlertDialogContent'),'onCloseAutoFocus',{deleteReturnFocus:{current:{isConnected:connected,focus(){focus.push('original');}}},deleteFallbackFocus:{current:{focus(){focus.push('meal-add');}}}})({preventDefault(){}});
    assert.deepEqual(focus,[connected?'original':'meal-add']);
  }
});

test('planner generation, swapping and grocery actions retain authoritative nutrition and saved values',async()=>{
  rows.clear();
  await post('profile',{profile});
  for(const days of [1,7]) {
    const planned=await post('plan',{days});
    assert.equal(planned.status,200);
    assert.equal(planned.data.state.plan.length,days);
    for(const day of planned.data.state.plan) {
      assert.deepEqual(day.meals.map(m=>m.type),['Breakfast','Lunch','Snack','Dinner']);
      for(const meal of day.meals) {
        assert.deepEqual(meal.totals,nutrition.sum(meal.entries));
        assert(meal.entries.every(e=>nutrition.allowed(nutrition.foods.find(f=>f.id===e.foodId),profile)));
      }
    }
  }
  const before=await get(),day=before.state.plan[0],meal=day.meals[0];
  const swapped=await post('swap',{planDate:day.date,id:meal.id});
  assert.equal(swapped.status,200);
  assert.equal(swapped.data.state.plan[0].meals[0].type,meal.type);
  assert.deepEqual(swapped.data.state.plan[0].meals[0].totals,nutrition.sum(swapped.data.state.plan[0].meals[0].entries));
  const groceries=await post('groceries');
  assert(groceries.data.state.groceries.length>0);
  const expected={};
  for(const day of groceries.data.state.plan)for(const meal of day.meals)for(const entry of meal.entries)expected[entry.foodId]=(expected[entry.foodId]||0)+entry.quantity;
  for(const item of groceries.data.state.groceries)assert.equal(item.quantity,expected[item.id]);
  const first=groceries.data.state.groceries[0];
  assert.equal((await post('groceryToggle',{id:first.id})).data.state.groceries.find(g=>g.id===first.id).checked,true);
  const added=await post('groceryAdd',{name:'Fresh herbs'});
  const extra=added.data.state.groceries.find(g=>g.name==='Fresh herbs');
  assert(extra);
  await post('groceryRemove',{id:extra.id});
  assert(!(await get()).state.groceries.some(g=>g.id===extra.id));
  assert.deepEqual((await get()).state.plan,groceries.data.state.plan);
});
test('profile updates, hydration, weight history and progress averages continue using saved real values',async()=>{
  rows.clear();
  await post('profile',{profile});
  const updated={...profile,diet:'Vegan',goal:'Maintenance',weight:62};
  const saved=await post('profile',{profile:updated});
  assert.deepEqual(saved.data.state.profile,updated);
  assert.deepEqual(saved.data.targets,nutrition.targets(updated));
  assert.equal((await post('water',{amount:250})).data.state.water[date],250);
  assert.equal((await post('water',{amount:-250})).data.state.water[date],0);
  await post('water',{amount:750});
  assert.equal((await post('weight',{weight:'61.5'})).data.state.weights.at(-1).weight,61.5);
  await post('log',{foodId:'rice',meal:'Lunch',quantity:2});
  const loaded=await get();
  assert.equal(loaded.weekly.loggedDays,1);
  assert.equal(loaded.weekly.averages.calories,260);
  assert.equal(loaded.weekly.averages.water,750);
  assert.deepEqual(loaded.state.profile,updated);
  const invalid=await post('profile',{profile:{...updated,age:10}});
  assert.equal(invalid.status,400);
  assert.deepEqual((await get()).state.profile,updated);
});
