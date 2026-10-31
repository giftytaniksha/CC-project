// Motion lifecycle tests use mocked browser APIs; they are not live-browser visual tests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(path.join(root,'package.json'));
const ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
function load(relative,replacements={},globals={}){
 const file=path.resolve(root,relative),module={exports:{}};
 const localRequire=name=>{
  if(Object.hasOwn(replacements,name))return replacements[name];
  if(name.startsWith('.')){const base=path.resolve(path.dirname(file),name);const resolved=['', '.ts','.tsx'].map(ext=>base+ext).find(p=>fs.existsSync(p));return load(resolved,replacements,globals);}
  return req(name);
 };
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{...globals,console})(localRequire,module,module.exports);
 return module.exports;
}
const motion=load('components/nutrition/aurora-motion.ts');
function events(){const handlers=new Map();return {handlers,addEventListener(type,fn){handlers.set(type,fn);},removeEventListener(type,fn){if(handlers.get(type)===fn)handlers.delete(type);},dispatch(type){handlers.get(type)?.({preventDefault(){}});}};}
function environment({width=1440,height=900,reduced=false,context=true,throwPaint=false}={}){
 const media={...events(),matches:reduced};
 const win={...events(),matchMedia:()=>media};
 const doc={...events(),hidden:false,documentElement:{dataset:{theme:'dark'}}};
 const container={clientWidth:width,clientHeight:height,dataset:{animated:'false'}};
 const canvas={...events(),width:0,height:0,getContext:()=>context?{}:null};
 const frames=new Map(),draws=[],observers=[];let next=1,clock=100,effect;
 class Observer{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
 const refs=[container,canvas];let ri=0;
 const module=load('components/nutrition/aurora-background.tsx',{
  react:{...React,useRef:()=>({current:refs[ri++]}),useId:()=>':test:',useEffect:fn=>{effect=fn;}},
  './aurora-motion':{...motion,drawAurora:(ctx,w,h,time,mix)=>{if(throwPaint)throw Error('render unavailable');draws.push({w,h,time,mix});}}
 },{window:win,document:doc,MutationObserver:Observer,ResizeObserver:Observer,requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 const tree=module.AuroraBackground();
 const cleanup=effect();
 const advance=(count=1,ms=1000/60)=>{for(let i=0;i<count;i++){clock+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(clock));}};
 return {tree,win,doc,media,container,canvas,frames,draws,observers,advance,cleanup};
}

test('five fluid ribbons evolve continuously, cross and stay finite at mobile and desktop sizes',()=>{
 let crossings=0;
 for(const [w,h] of [[320,700],[768,1024],[1440,900],[3840,2160]])for(const time of [0,2,6,12,30,120,600]){
  const ribbons=motion.AURORA_BANDS.map(b=>motion.auroraRibbon(b,time,w,h));
  for(const [i,r] of ribbons.entries()){
   const next=motion.auroraRibbon(motion.AURORA_BANDS[i],time+1/30,w,h);
   assert.equal(r.top.length,57);assert(r.top[0].x<0&&r.top.at(-1).x>w);
   for(let j=0;j<r.top.length;j++){
    assert(Number.isFinite(r.top[j].x)&&Number.isFinite(r.top[j].y));
    assert(r.bottom[j].y>r.top[j].y);
    assert(Math.abs(next.top[j].y-r.top[j].y)<h*.003,'no frame jump');
   }
  }
  const a=ribbons[0].top,b=ribbons[1].top;
  for(let i=1;i<a.length;i++)if((a[i].y-b[i].y)*(a[i-1].y-b[i-1].y)<0)crossings++;
 }
 assert(crossings>10);
 for(const band of motion.AURORA_BANDS)assert.notEqual(motion.ribbonSvgPath(band,0),motion.ribbonSvgPath(band,12));
});
test('render resolution is bounded independently of high density or huge desktop displays',()=>{
 for(const [w,h] of [[320,568],[390,844],[768,1024],[1440,900],[1920,1080],[3840,2160],[7680,4320]]){
  const size=motion.auroraResolution(w,h);
  assert(size.width<=w&&size.height<=h);
  assert(size.width*size.height<=(w<768?300000:650000));
  assert.equal(size.fps,w<768?24:30);
 }
});
test('actual drawing commands use bounded soft ribbons with a real palette interpolation',()=>{
 function draw(mix){const colors=[],calls=[];const ctx={clearRect:()=>{},createLinearGradient:()=>({addColorStop:(p,c)=>colors.push([p,c])}),beginPath:()=>calls.push('begin'),moveTo:()=>{},lineTo:(x,y)=>assert(Number.isFinite(x)&&Number.isFinite(y)),closePath:()=>{},fill:()=>calls.push('fill')};motion.drawAurora(ctx,640,400,6,mix);return {ctx,colors,calls};}
 const light=draw(0),dark=draw(1),mid=draw(.5);
 assert.equal(dark.calls.filter(c=>c==='fill').length,5);
 assert.equal(dark.colors.length,25);assert.equal(dark.ctx.filter,'none');
 assert.notDeepEqual(light.colors,dark.colors);assert.notDeepEqual(mid.colors,light.colors);assert.notDeepEqual(mid.colors,dark.colors);
});
test('one animation loop is capped at desktop/mobile rates and cleans up all resources',()=>{
 for(const width of [390,1440]){
  const env=environment({width});
  assert.equal(env.frames.size,1);
  env.advance(120);
  const expected=width<768?48:60;
  assert(Math.abs(env.draws.length-expected)<=3,`${width}: ${env.draws.length} draws`);
  assert.equal(env.frames.size,1);
  env.cleanup();assert.equal(env.frames.size,0);
  assert(env.observers.every(o=>o.disconnected));
  assert.equal(env.win.handlers.size,0);assert.equal(env.doc.handlers.size,0);assert.equal(env.media.handlers.size,0);assert.equal(env.canvas.handlers.size,0);
 }
});
test('hidden tabs pause and resume phase without jumping or starting a second loop',()=>{
 const env=environment();env.advance(90);const previous=env.draws.at(-1).time;
 env.doc.hidden=true;env.doc.dispatch('visibilitychange');assert.equal(env.frames.size,0);
 const count=env.draws.length;env.advance(30,1000);assert.equal(env.draws.length,count);
 env.doc.hidden=false;env.doc.dispatch('visibilitychange');assert.equal(env.frames.size,1);
 env.advance();assert(env.draws.at(-1).time-previous<.05);
 env.cleanup();
});
test('theme changes interpolate the existing scene without resetting its phase',()=>{
 const env=environment();env.advance(90);const before=env.draws.at(-1);
 env.doc.documentElement.dataset.theme='light';env.observers[0].callback();env.advance(30);
 const after=env.draws.at(-1);assert(after.time>before.time);assert(after.mix<.1);assert.equal(env.frames.size,1);
 env.doc.documentElement.dataset.theme='dark';env.observers[0].callback();env.advance(30);assert(env.draws.at(-1).mix>.9);
 env.cleanup();
});
test('reduced motion starts static, cancels a running loop, and resumes only on explicit preference change',()=>{
 const staticEnv=environment({reduced:true});assert.equal(staticEnv.frames.size,0);assert.equal(staticEnv.draws.length,0);assert.equal(staticEnv.container.dataset.animated,'false');staticEnv.cleanup();
 const env=environment();env.advance(20);env.media.matches=true;env.media.dispatch('change');assert.equal(env.frames.size,0);assert.equal(env.container.dataset.animated,'false');
 env.media.matches=false;env.media.dispatch('change');assert.equal(env.frames.size,1);env.advance(5);assert.equal(env.container.dataset.animated,'true');env.cleanup();
});
test('unavailable canvas, drawing failure and context loss leave the SVG fallback active',()=>{
 const missing=environment({context:false});assert.equal(missing.frames.size,0);assert.equal(missing.container.dataset.animated,'false');
 const failed=environment({throwPaint:true});assert.equal(failed.frames.size,0);assert.equal(failed.container.dataset.animated,'false');failed.cleanup();
 const lost=environment();lost.canvas.dispatch('contextlost');assert.equal(lost.frames.size,0);assert.equal(lost.container.dataset.animated,'false');lost.cleanup();
});

test('static fallback has five ribbons and is decorative and noninteractive',()=>{
 const {AuroraBackground}=load('components/nutrition/aurora-background.tsx');
 const html=renderToStaticMarkup(React.createElement(AuroraBackground));
 assert.equal((html.match(/<path /g)||[]).length,5);
 assert(html.includes('aria-hidden="true"'));assert(!html.includes('tabindex'));
 const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
 assert.match(css,/\.aurora-environment\{position:absolute;inset:-24px -16px;z-index:0;pointer-events:none/);
 assert.match(css,/\.aurora-environment \*\{pointer-events:none/);
});

test('intro uses the same six-petal flower as the favicon and can never trap the app permanently',()=>{
 const {BloomMark,BLOOM_PETAL}=load('components/nutrition/bloom-brand.tsx');
 const mark=renderToStaticMarkup(React.createElement(BloomMark));
 assert.equal((mark.match(/class="bloom-petal"/g)||[]).length,6);
 const favicon=fs.readFileSync(path.join(root,'public/favicon.svg'),'utf8');
 assert.equal(favicon.split(BLOOM_PETAL).length-1,6);
 for(const reduced of [false,true]){
  let effect;const changes=[],timeouts=new Map(),media={...events(),matches:reduced},win={...events(),matchMedia:()=>media,setTimeout:(fn,ms)=>{timeouts.set(1,{fn,ms});return 1;},clearTimeout:id=>timeouts.delete(id)};
  const {BloomIntro}=load('components/nutrition/bloom-intro.tsx',{react:{...React,useState:()=>[true,value=>changes.push(value)],useEffect:fn=>{effect=fn;}}},{window:win});
  const tree=BloomIntro(),cleanup=effect();
  if(reduced){assert.deepEqual(changes,[false]);assert.equal(timeouts.size,0);}else{
   assert.equal(timeouts.get(1).ms,2900);timeouts.get(1).fn();assert.equal(changes.at(-1),false);
   const count=changes.length;tree.props.onAnimationEnd({target:{},currentTarget:{},animationName:'petal-assemble'});assert.equal(changes.length,count);
   tree.props.onPointerDown();assert.equal(changes.at(-1),false);win.dispatch('keydown');assert.equal(changes.at(-1),false);
   cleanup();assert.equal(timeouts.size,0);assert.equal(win.handlers.size,0);assert.equal(media.handlers.size,0);
  }
 }
 const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
 assert.match(css,/@keyframes bloom-intro-screen[^\n]+visibility:hidden;pointer-events:none/);
 assert(css.includes('.bloom-intro{display:none!important}'));
});

test('composer foreground stays opaque and distinct from its decorative aura',()=>{
 const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
 assert.match(css,/\.bloom-composer\{position:relative;isolation:isolate/);
 assert.match(css,/\.bloom-composer \.composer\{[^}]+z-index:1[^}]+background:var\(--card\)/);
 assert.match(css,/\.bloom-composer \.composer textarea\{background:var\(--card\)/);
 assert(!css.includes('.aurora-environment{position:fixed'));
});

test('composer motion is 27 percent faster while preserving continuous phase',()=>{
 const env=environment();env.advance(121);
 assert(Math.abs(env.draws.at(-1).time-2*1.27)<.06);
 env.cleanup();
});

test('onboarding transition retains live controlled children and makes the outgoing snapshot inert',()=>{
 const hooks=[],timers=new Map();let cursor=0,effects=[];
 const mockReact={...React,
  useRef(initial){const index=cursor++;return hooks[index]??(hooks[index]={current:initial});},
  useState(initial){const index=cursor++;if(!hooks[index])hooks[index]={value:initial};return [hooks[index].value,value=>{hooks[index].value=value;}];},
  useLayoutEffect(fn,deps){const index=cursor++,old=hooks[index];if(!deps||!old||deps.some((v,i)=>v!==old.deps[i])){effects.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:fn()};});}}
 };
 const win={matchMedia:()=>({matches:false}),setTimeout:fn=>{timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id)};
 const {BloomStep}=load('components/nutrition/bloom-step.tsx',{react:mockReact},{window:win});
 const render=(step,children)=>{cursor=0;effects=[];const tree=BloomStep({step,children});effects.forEach(fn=>fn());return tree;};
 const a=React.createElement('input',{value:'Initial',readOnly:true}),edited=React.createElement('input',{value:'Edited',readOnly:true}),b=React.createElement('input',{value:'Next step',readOnly:true});
 render(0,a);let tree=render(0,edited);assert.equal(tree.props.children[1].props.children,edited);
 render(1,b);tree=render(1,b);
 assert.equal(tree.props.children[0].props.inert,true);assert.equal(tree.props.children[0].props['aria-hidden'],'true');
 assert.equal(tree.props.children[0].props.children,edited);assert.equal(tree.props.children[1].props.children,b);
 timers.get(1)();tree=render(1,b);assert.equal(tree.props.children[0],null);
});
