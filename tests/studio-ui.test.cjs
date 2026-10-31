// Node render and behavior checks. These do not substitute for browser visual QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const req=createRequire(path.join(root,'package.json'));
const ts=req('typescript'),React=req('react');
const {renderToStaticMarkup}=req('react-dom/server');
let overrides={},stateIndex=0;
const cache=new Map();
function load(relative){
  let file=path.resolve(root,relative);
  if(!fs.existsSync(file))file=['.ts','.tsx'].map(x=>file+x).find(x=>fs.existsSync(x));
  if(cache.has(file))return cache.get(file);
  const module={exports:{}};
  cache.set(file,module.exports);
  const localRequire=name=>{
    if(name==='react'&&file.endsWith('/app/nutrition-app.tsx'))return {...React,useState(initial){const index=stateIndex++;return React.useState(Object.hasOwn(overrides,index)?overrides[index]:initial);}};
    if(name.startsWith('@/'))return load(name.slice(2));
    if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(file),name)));
    return req(name);
  };
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(localRequire,module,module.exports);
  return module.exports;
}
const {StudioTheme}=load('components/nutrition/studio-theme.tsx');
const {EnergyRing,EnergyTrend,AssistantText}=load('components/nutrition/studio-visuals.tsx');
const App=load('app/nutrition-app.tsx').default;
const nutrition=load('lib/nutrition.ts');
const profile={name:'Test Person',age:25,sex:'female',height:160,weight:60,activity:'light',goal:'General wellness',diet:'Vegetarian',allergies:'',intolerances:'',dislikes:'',preferred:'',cuisine:'Indian',frequency:4,cooking:'Quick meals',budget:'Moderate'};
const date='2026-10-23';
function fixture(guest=true){
  const state={...nutrition.initial(),profile,logs:[{id:'rice-log',foodId:'rice',quantity:1,meal:'Lunch',date},{id:'dal-log',foodId:'dal',quantity:2,meal:'Dinner',date}],water:{[date]:750},weights:[{id:'weight',date,weight:60}],cycle:{enabled:true,start:'2026-10-21',length:28,duration:5}};
  const targets=nutrition.targets(profile),totals=nutrition.sum(state.logs);
  state.plan=[{date,meals:['Breakfast','Lunch','Snack','Dinner'].map((type,i)=>nutrition.meal(profile,type,i,targets))}];
  return {state,targets,totals,remaining:Object.fromEntries(nutrition.keys.map(k=>[k,Math.max(0,targets[k]-totals[k])])),cycleEstimate:nutrition.cycle(state.cycle,date),weekly:nutrition.stats(state,date),version:0,guest,aiAvailable:false};
}
function render(page,extra={}){
  const data=fixture(extra.guest??true);
  overrides={0:data,3:page,4:date,18:data.state.cycle,...extra.states};stateIndex=0;
  return renderToStaticMarkup(React.createElement(StudioTheme,null,React.createElement(App)));
}

test('pre-paint theme script honors system, explicit choice, and reloads before content',()=>{
  const html=renderToStaticMarkup(React.createElement(StudioTheme,null,React.createElement('main',null,'App content')));
  const script=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  assert(html.indexOf('<script')<html.indexOf('<main'));
  for(const saved of [null,'system','light','dark'])for(const systemDark of [false,true])for(let refresh=0;refresh<2;refresh++){
    const attrs={},style={};
    vm.runInNewContext(script,{document:{documentElement:{setAttribute:(key,value)=>attrs[key]=value,style}},localStorage:{getItem:key=>{assert.equal(key,'nourish-appearance');return saved;}},window:{matchMedia:query=>{assert.equal(query,'(prefers-color-scheme: dark)');return {matches:systemDark};}}});
    const expected=saved==='light'||saved==='dark'?saved:systemDark?'dark':'light';
    assert.equal(attrs['data-theme'],expected);assert.equal(style.colorScheme,expected);
  }
});

test('every page renders for guest and authenticated presentation using real computed fixture data',()=>{
  const pages={Home:'362',Meals:'Cooked rice',Food:'Chicken biryani',Planner:'Your grocery list','AI Assistant':'Setup needed',Progress:'362',Wellness:'Day 3'};
  const errors=[];const original=console.error;console.error=(...args)=>errors.push(args.join(' '));
  try{
    for(const guest of [true,false])for(const [page,label] of Object.entries(pages)){
      const html=render(page,{guest});
      assert(html.includes(label),page+' expected data');
      assert(html.includes('Use light theme')&&html.includes('Use dark theme'),page+' theme controls');
      assert(html.includes('aria-current="page"'),page+' active navigation');
      assert.equal(html.includes('End guest session'),guest);
      assert.equal(html.includes('/signout-with-chatgpt?return_to=%2F'),!guest);
      assert(!html.includes('NaN'),page+' invalid display value');
      if(page==='Wellness')assert(!html.includes('Keep it flowing'));
      if(page==='AI Assistant')assert(html.includes('AI responses will be available'));
    }
  }finally{console.error=original;}
  assert.deepEqual(errors,[]);
});

test('all five profile steps retain entered values and themed navigation',()=>{
  const expected=['Female','General wellness','Vegetarian','Foods you enjoy','Test Person'];
  for(let step=0;step<5;step++){
    const html=render('Home',{states:{9:step,10:profile,11:true}});
    assert(html.includes(expected[step]));
    assert(html.includes(`Profile step ${step+1} of 5`));
    assert(html.includes('Use dark theme'));
    assert(html.includes('Cancel'));
    if(step>0)assert(html.includes('>Back</button>'));
  }
});

test('empty pages, initial loading, reconnect and cycle-off states render without fabricated data',()=>{
  const data=fixture();data.state={...nutrition.initial(),profile};data.totals=nutrition.emptyTotals();data.weekly=nutrition.stats(data.state,date);data.cycleEstimate=null;
  for(const page of ['Home','Meals','Planner','Progress','Wellness']){
    const html=render(page,{states:{0:data,18:data.state.cycle}});
    assert(!html.includes('NaN'));
    if(page==='Progress')assert(html.includes('Log your first meal'));
    if(page==='Wellness')assert(html.includes('Tracking is off'));
  }
  assert(render('Home',{states:{0:null}}).includes('role="status"'));
  assert(render('Home',{states:{1:'Test connection failure'}}).includes('role="alert"'));
});

test('energy ring preserves true values and clamps only visual progress',()=>{
  for(const [value,offset] of [[0,100],[500,75],[2000,0],[3000,0]]){
    const html=renderToStaticMarkup(React.createElement(EnergyRing,{value,target:2000}));
    assert(html.includes(`stroke-dashoffset="${offset}"`));
    assert(html.includes(`${Math.round(value)} of 2000 kcal logged`));
  }
});

test('energy chart exposes real days, missing days, keyboard focus and touch-sized day navigation',()=>{
  for(const range of [7,30,90]){
    const history=Array.from({length:range},(_,i)=>({date:new Date(Date.parse(date)-(range-1-i)*86400000).toISOString().slice(0,10),calories:i===range-1?2300:0,protein:i===range-1?71:0,fiber:0,water:0,logged:i===range-1}));
    const html=renderToStaticMarkup(React.createElement(EnergyTrend,{history,target:1900}));
    assert.equal((html.match(/class="chart-column"/g)||[]).length,range);
    assert.equal((html.match(/tabindex="0"/g)||[]).length,1);
    assert(html.includes('2,300 kcal'));
    assert(html.includes('71 g protein'));
    assert(html.includes('no food logged'));
    assert(html.includes('Target 1,900'));
    assert(html.includes('Previous chart day')&&html.includes('Next chart day'));
    assert(!html.includes('height:115%'));
  }
});

test('assistant presentation supports headings and lists while treating HTML as text',()=>{
  const html=renderToStaticMarkup(React.createElement(AssistantText,{text:'## Dinner ideas\nTry **lentils**.\n- Rice\n- Vegetables\n\n1. Prepare\n2. Enjoy\n<script>alert(1)</script>'}));
  assert(html.includes('<h3>Dinner ideas</h3>'));
  assert(html.includes('<strong>lentils</strong>'));
  assert(html.includes('<ul>')&&html.includes('<ol>'));
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
});

const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
function declarations(block){return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));}
const light=declarations(css.match(/:root\s*\{([^}]+)\}/)[1]);
const entryDark={...light,...declarations(css.match(/:root\[data-theme=dark\]\s*\{([^}]+)\}/)[1])};
const dark=entryDark;
function resolved(theme,key){const value=theme[key];return value.startsWith('var(')?resolved(theme,value.slice(4,-1)):value;}
function luminance(hex){const channels=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('normal text meets 4.5:1 contrast across both theme surface pairs',()=>{
  const pairs=[['button-foreground','button-primary'],['foreground','background'],['foreground','card'],['foreground','elevated'],['muted-foreground','background'],['muted-foreground','card'],['muted-foreground','elevated'],['primary','background'],['primary','card'],['primary-foreground','primary'],['secondary-foreground','secondary'],['accent-foreground','accent'],['sidebar-foreground','sidebar'],['sidebar-accent-foreground','sidebar-accent'],['hero-foreground','hero'],['hero-muted','hero'],['lavender-foreground','lavender'],['water-foreground','water'],['danger','danger-surface']];
  for(const [name,theme] of Object.entries({light,entryDark,dark}))for(const [fg,bg] of pairs){const ratio=contrast(resolved(theme,'--'+fg),resolved(theme,'--'+bg));assert(ratio>=4.5,`${name} ${fg}/${bg}: ${ratio.toFixed(2)}`);}
});
test('input boundaries, focus rings and chart marks stay visible in both themes',()=>{
  for(const [name,theme] of Object.entries({light,entryDark,dark}))for(const fg of ['input','ring','nutrient-protein','nutrient-fat']){const ratio=contrast(resolved(theme,'--'+fg),resolved(theme,'--card'));assert(ratio>=3,`${name} ${fg}: ${ratio.toFixed(2)}`);}
});
test('reduced motion disables all nonessential motion; choice and dialog surfaces remain explicit',()=>{
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/);
  assert.match(css,/\.onboarding-choice \.onboarding-choice-list\{position:static/);
  assert.match(css,/-webkit-text-fill-color:var\(--foreground\)/);
  assert.match(css,/\.nourish-dialog\{[^}]*background:var\(--card\)/);
});
test('cycle thumb override and mathematical containment survive shared switch composition',()=>{
  const {Switch}=load('components/ui/switch.tsx');
  for(const checked of [false,true]){
    const html=renderToStaticMarkup(React.createElement(Switch,{checked,className:'cycle-switch',thumbClassName:'data-[state=checked]:translate-x-0','aria-label':'Cycle tracking'}));
    assert(html.includes(`aria-checked="${checked}"`));
    assert(html.includes('data-[state=checked]:translate-x-0'));
    assert(!html.includes('translate-x-[calc(100%-2px)]'));
    const w=48,d=20,p=3,b=1,travel=w-d-2*p-2*b;
    const left=p+b+(checked?travel:0),right=w-left-d;
    assert.equal(Math.min(left,right),4);assert.equal((28-d)/2,4);
  }
});

function isolated(relative,replacements){
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const localRequire=name=>Object.hasOwn(replacements,name)?replacements[name]:name.startsWith('@/')?load(name.slice(2)):req(name);
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(localRequire,module,module.exports);
  return module.exports;
}
function elements(tree){const result=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.props){result.push(node);visit(node.props.children);}}visit(tree);return result;}
test('theme controls request explicit light and dark preferences without changing any profile state',()=>{
  const changes=[];
  const {ThemeToggle}=isolated('components/nutrition/studio-theme.tsx',{'react':{...React,useState:()=>[true,()=>{}],useEffect:()=>{}},'next-themes':{useTheme:()=>({resolvedTheme:'dark',setTheme:value=>changes.push(value)})}});
  const buttons=elements(ThemeToggle()).filter(node=>node.type==='button');
  assert.equal(buttons[0].props['aria-pressed'],false);
  assert.equal(buttons[1].props['aria-pressed'],true);
  buttons.forEach(button=>button.props.onClick());
  assert.deepEqual(changes,['light','dark']);
});
test('mobile destination selection closes the existing drawer and desktop selection preserves sidebar state',()=>{
  for(const isMobile of [true,false]){
    const events=[];
    const {StudioNavButton}=isolated('components/nutrition/studio-visuals.tsx',{'@/components/ui/sidebar':{SidebarMenuButton:'button',useSidebar:()=>({isMobile,setOpenMobile:open=>events.push(['drawer',open])})}});
    const element=StudioNavButton({active:true,onSelect:()=>events.push(['navigate','Food']),children:'Food'});
    element.props.onClick();
    assert.deepEqual(events,isMobile?[['navigate','Food'],['drawer',false]]:[['navigate','Food']]);
    assert.equal(element.props['aria-current'],'page');
  }
});
test('chart arrow keys, Home/End, focus, click and next/previous day controls select the intended real day',()=>{
  let selected=1;
  const {EnergyTrend}=isolated('components/nutrition/studio-visuals.tsx',{'react':{...React,useState:()=>[selected,value=>{selected=value;}],useId:()=> 'chart-test'}});
  const history=Array.from({length:3},(_,i)=>({date:`2026-10-${20+i}`,calories:100*i,protein:10*i,fiber:2*i,water:0,logged:i>0}));
  let nodes=elements(EnergyTrend({history,target:1900}));
  nodes.find(n=>n.props['aria-label']==='Previous chart day').props.onClick();assert.equal(selected,0);
  nodes=elements(EnergyTrend({history,target:1900}));
  nodes.find(n=>n.props['aria-label']==='Next chart day').props.onClick();assert.equal(selected,1);
  const bars=nodes.filter(n=>n.props.className==='chart-column');
  bars[2].props.onClick();assert.equal(selected,2);
  bars[0].props.onFocus();assert.equal(selected,0);
  bars[1].props.onPointerEnter();assert.equal(selected,1);
  for(const [key,expected] of [['ArrowLeft',0],['ArrowRight',2],['Home',0],['End',2]]){
    let prevented=false,focused=-1;
    bars[1].props.onKeyDown({key,preventDefault(){prevented=true;},currentTarget:{parentElement:{children:[0,1,2].map(i=>({focus(){focused=i;}}))}}});
    assert(prevented);assert.equal(focused,expected);
  }
});

test('cycle knob has at least 3:1 contrast against both track states in both themes',()=>{
  for(const theme of [light,dark])for(const track of ['toggle-on','toggle-off'])assert(contrast(resolved(theme,'--knob'),resolved(theme,'--'+track))>=3);
});

test('Fig & Nectar assigns exact approved surfaces and keeps card progress readable',()=>{
 const tokens=['app-background','surface-background','surface-featured','surface-secondary','surface-highlight','primary-text','primary-accent'];
 for(const [theme,expected] of [[light,['#EFE2D5','#FBF2E9','#EBB590','#D8B8AB','#F0D18D','#30232A','#914859']],[dark,['#171116','#2D2228','#693A4B','#594332','#684A39','#FFF0E5','#F1B58D']]]){
  tokens.forEach((token,i)=>assert.equal(theme['--'+token],expected[i]));
  for(const [fg,bg] of [['hero-foreground','surface-featured'],['hero-muted','surface-featured'],['featured-label','surface-featured'],['statistics-text','surface-secondary'],['statistics-muted','surface-secondary'],['highlight-text','surface-highlight'],['highlight-muted','surface-highlight']])assert(contrast(resolved(theme,'--'+fg),resolved(theme,'--'+bg))>=4.5,fg+'/'+bg);
  assert(contrast(resolved(theme,'--hero-fill'),resolved(theme,'--hero-track'))>=3,'energy ring');
  for(const fill of ['nutrient-protein','nutrient-carbs','nutrient-fat','nutrient-fiber'])for(const bg of ['surface-background','surface-secondary'])assert(contrast(resolved(theme,'--'+fill),resolved(theme,'--'+bg))>=3,fill+'/'+bg);
 }
 assert(css.includes('.nutrition-shell .energy-card{background:var(--surface-featured);color:var(--hero-foreground);border-color:var(--hero-border)}'));
 assert(css.includes('--card:var(--surface-secondary)'));
 assert(css.includes('--card:var(--surface-highlight)'));
});

test('Ask Bloom keeps the composer and branding without mounting the removed aurora',()=>{
 for(const guest of [true,false])for(const page of ['Home','Meals','Food','Planner','AI Assistant','Progress','Wellness']){
  const html=render(page,{guest});
  assert(!html.includes('aurora-environment'));
  assert(html.includes('Ask Bloom'));
  if(page==='AI Assistant')assert(html.includes('Message Ask Bloom'));
  assert(html.includes('The Daily Bloom'));
 }
 for(let step=0;step<5;step++){
  const html=render('Home',{states:{9:step,10:profile,11:true}});
  assert(!html.includes('aurora-environment'));
  assert(html.includes('bloom-wordmark'));
 }
 assert(!render('Home',{states:{0:null}}).includes('aurora-environment'));
 const app=fs.readFileSync(path.join(root,'app/nutrition-app.tsx'),'utf8'),layout=fs.readFileSync(path.join(root,'app/layout.tsx'),'utf8');
 assert(!app.includes('AuroraBackground'));
 assert(!app.includes('<BloomIntro'));
 assert.equal((layout.match(/<BloomIntro\/>/g)||[]).length,1);
});

test('Ask Bloom history is a closed native disclosure with existing conversation controls',()=>{
 const data=fixture();
 data.state.conversations=[{id:'history-check',title:'Dinner ideas',messages:[]}];
 const html=render('AI Assistant',{states:{0:data}});
 assert(html.includes('<details class="bloom-history">'));
 assert(html.includes('aria-label="Toggle recent conversations"'));
 const drawer=html.match(/<details class="bloom-history">([\s\S]*?)<\/details>/)[1];
 assert(drawer.includes('New conversation')&&drawer.includes('Dinner ideas'));
 assert(drawer.includes('id="bloom-recent-conversations"'));
 assert(!html.includes('context-note')&&!html.includes('Your context, thoughtfully used.'));
 assert(html.includes('class="bloom-composer"')&&html.includes('Message Ask Bloom'));
 assert(!render('Home').includes('bloom-history'));
});

test('only Ask Bloom renders an unchecked native header reveal control',()=>{
 const html=render('AI Assistant');
 const control=html.match(/<input[^>]*id="ask-header-reveal"[^>]*>/)[0];
 assert(!control.includes('checked'));
 assert(control.includes('type="checkbox"')&&control.includes('aria-label="Show header controls"'));
 assert(control.includes('aria-controls="app-header"'));
 assert(html.includes('<header class="topbar" id="app-header">'));
 for(const page of ['Home','Meals','Food','Planner','Progress','Wellness'])assert(!render(page).includes('ask-header-rail'));
 const app=fs.readFileSync(path.join(root,'app/nutrition-app.tsx'),'utf8');
 assert(!app.includes('onMouseEnter')&&!app.includes('onMouseLeave'));
});

test('light sidebar selected fill is isolated from dark themes, hover and inactive items',()=>{
 const block=css.slice(css.indexOf('/* Light active navigation needs'),css.indexOf('/* One glass material per navigation panel'));
 const selector='.nutrition-sidebar [data-slot=sidebar-menu-button][data-active=true]';
 assert(block.includes(':root[data-theme=light] '+selector));
 assert(block.includes('@media(prefers-color-scheme:light)'));
 assert(block.includes(':root:not([data-theme]) '+selector));
 assert.equal((block.match(/background:color-mix\(in srgb,#914859 16%,#FBF2E9\)/g)||[]).length,2);
 assert(!block.includes('data-theme=dark')&&!block.includes(':hover')&&!block.includes('--'));
 assert(!/padding:|radius:|transition:|animation:/.test(block));
 assert(contrast('#914859','#ead7d2')>=4.5);
 for(const page of ['Home','Meals','Food','Planner','AI Assistant','Progress','Wellness']){
  const html=render(page);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.equal((html.match(/class="nav-active-dot"/g)||[]).length,1);
 }
});

test('navigation glass affects only panel surfaces with genuine backdrop blur and opaque fallback',()=>{
 const block=css.slice(css.indexOf('/* One glass material per navigation panel'),css.indexOf('/* Reference-inspired soft corners'));
 assert(block.includes('background:var(--card)'));
 assert(block.includes('rgba(251,242,233,.40)')&&block.includes('rgba(45,34,40,.38)'));
 assert(block.includes('rgba(145,72,89,.14)')&&block.includes('rgba(255,240,229,.12)'));
 assert(block.includes('backdrop-filter:blur(20px) saturate(140%)'));
 assert(block.includes('-webkit-backdrop-filter:blur(20px) saturate(140%)'));
 assert(block.includes('@supports((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px)))'));
 assert(block.includes('.nutrition-sidebar [data-slot=sidebar-inner]{background:transparent}'));
 assert(block.includes('.nutrition-sidebar[data-slot=sidebar-container]')&&block.includes('.nutrition-sidebar[data-mobile=true]'));
 assert(!/(?:^|[;{\s])(?:filter|overflow|position|z-index|height|width|padding|transition|animation):/m.test(block));
 assert(!block.includes('sidebar-menu-button')&&!block.includes('pointer-events')&&!block.includes('::'));
 assert(css.includes('position:sticky;top:0;z-index:20'));
});

test('matching sidebar glass preserves control geometry and active-state styling',()=>{
 const block=css.slice(css.indexOf('/* Matching navigation glass:'),css.indexOf('/* Reference-inspired soft corners'));
 assert(block.includes('.nutrition-main>.topbar'));
 assert(block.includes('var(--card) 28%,transparent'));
 assert(block.includes('blur(20px) saturate(150%)'));
 assert(block.includes('.nutrition-sidebar[data-slot=sidebar-container]'));
 assert(block.includes('.nutrition-sidebar[data-mobile=true]'));
 assert(!block.includes('sidebar-menu-button'));
 assert(!/position:|padding:|height:|width:|transition:|animation:|filter:blur\(/.test(block.replaceAll('backdrop-filter:','backdrop:')));
});

test('navigation filters put standard property last to survive production minification',()=>{
 const block=css.slice(css.indexOf('/* One glass material per navigation panel'),css.indexOf('/* Reference-inspired soft corners'));
 for(const saturation of [140,150])assert(block.includes(`-webkit-backdrop-filter:blur(20px) saturate(${saturation}%);backdrop-filter:blur(20px) saturate(${saturation}%);`));
});

test('header theme glass uses existing pressed state, inert decoration and reduced motion',()=>{
 const block=css.slice(css.indexOf('/* Header theme control only:'));
 assert(block.includes('pointer-events:none'));
 assert(block.includes('.theme-dark[aria-pressed=true])::before{transform:translateX(calc(100% + 2px))}'));
 assert(block.includes('@media(prefers-reduced-motion:reduce)'));
 assert(block.includes('-webkit-backdrop-filter:blur(12px) saturate(125%);backdrop-filter:blur(12px) saturate(125%);'));
 assert(!/\.topbar\{|nutrition-sidebar|\.theme-toggle button\{[^}]*\b(?:padding|width|height|min-height):/.test(block));
 assert(block.includes(':root .topbar .theme-toggle button[aria-pressed=true]'));
});
