// Deterministic presentation tests, not live-browser or device verification.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(path.join(root,'package.json'));
const ts=req('typescript'),React=req('react');
function events(){const handlers=new Map();return {handlers,addEventListener(k,f){handlers.set(k,f);},removeEventListener(k){handlers.delete(k);}};}
function environment({reduced=false,fine=true,intersection=true,animate=true}={}){
  const preferences=[{...events(),matches:reduced},{...events(),matches:fine}];
  const draws=[],observers=[];
  class Node {
    constructor(card=true){Object.assign(this,events());this.card=card;this.children=[];}
    matches(){return this.card;}
    querySelectorAll(){return this.children;}
    contains(node){return node===this||this.children.some(child=>child.contains(node));}
    animate(frames,options){const item={card:this,frames,options,cancelled:false,finished:new Promise(()=>{}),cancel(){this.cancelled=true;}};draws.push(item);return item;}
  }
  const element=new Node(false),a=new Node(),b=new Node();element.children=[a,b];
  if(!animate){a.animate=undefined;b.animate=undefined;}
  class Observer {
    constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();this.disconnected=false;observers.push(this);}
    observe(node){this.targets.add(node);}
    unobserve(node){this.targets.delete(node);}
    disconnect(){this.disconnected=true;this.targets.clear();}
  }
  let effect;
  const doc={activeElement:null},module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.join(root,'components/nutrition/card-motion.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext('(function(require,module,exports){'+source+'\n})',{
    Element:Node,document:doc,window:{matchMedia:query=>query.includes('reduced')?preferences[0]:preferences[1]},
    IntersectionObserver:intersection?Observer:undefined,MutationObserver:Observer
  })(name=>name==='react'?{...React,useRef:()=>({current:element}),useEffect:fn=>{effect=fn;}}:req(name),module,module.exports);
  const child=React.createElement('button',{onClick:()=>42},'Real action');
  const tree=module.exports.CardMotion({page:'Food',children:child});
  const cleanup=effect();
  return {element,a,b,Node,draws,observers,preferences,doc,tree,child,cleanup};
}

test('viewport reveals preserve children and settle once with no scroll handlers or hidden content',()=>{
  const env=environment(),observer=env.observers[0];
  assert.equal(env.tree.props.children,env.child);assert.equal(env.child.props.onClick(),42);
  assert.equal(observer.targets.size,2);
  observer.callback([{target:env.a,isIntersecting:false}]);assert.equal(env.draws.length,0);
  observer.callback([{target:env.a,isIntersecting:true}]);
  assert.equal(env.draws.length,1);assert.equal(observer.targets.has(env.a),false);
  const draw=env.draws[0];assert.equal(draw.options.fill,'none');assert.equal(draw.options.duration,480);
  assert.equal(draw.frames[0].opacity,.72);assert.equal(draw.frames[1].transform,'translateY(0)');
  observer.callback([{target:env.a,isIntersecting:true}]);assert.equal(env.draws.length,1);
  assert.deepEqual([...env.element.handlers.keys()],['focusin']);
  env.cleanup();assert(draw.cancelled);
});
test('touch and reduced-motion users get immediately visible stationary cards',()=>{
  for(const options of [{reduced:true},{fine:false}]){
    const env=environment(options);assert.equal(env.observers[0].targets.size,0);assert.equal(env.draws.length,0);
    assert.equal(env.tree.props.style,undefined);env.cleanup();
  }
});
test('keyboard focus cancels active movement and focused controls never enter in motion',()=>{
  const env=environment();env.doc.activeElement=env.a;
  env.observers[0].callback([{target:env.a,isIntersecting:true}]);assert.equal(env.draws.length,0);
  env.observers[0].callback([{target:env.b,isIntersecting:true}]);assert.equal(env.draws.length,1);
  env.element.handlers.get('focusin')({target:env.b});assert(env.draws[0].cancelled);env.cleanup();
});
test('newly rendered cards join once and removed cards release observers and animations',()=>{
  const env=environment(),observer=env.observers[0],mutations=env.observers[1],c=new env.Node();
  env.element.children.push(c);mutations.callback([{addedNodes:[c]}]);assert(observer.targets.has(c));
  observer.callback([{target:c,isIntersecting:true}]);assert.equal(env.draws.length,1);
  env.element.children=env.element.children.filter(x=>x!==c&&x!==env.a);mutations.callback([{addedNodes:[]}]);
  assert(env.draws[0].cancelled);assert(!observer.targets.has(env.a));env.cleanup();
});
test('preference changes and unmount clean up observers, animations and listeners',()=>{
  const env=environment();env.observers[0].callback([{target:env.a,isIntersecting:true}]);
  env.preferences[0].matches=true;env.preferences[0].handlers.get('change')();
  assert(env.draws[0].cancelled);assert.equal(env.observers[0].targets.size,0);
  env.cleanup();assert(env.observers.every(o=>o.disconnected));
  assert(env.preferences.every(p=>p.handlers.size===0));assert.equal(env.element.handlers.size,0);
});
test('missing browser animation capabilities leave ordinary functional content visible',()=>{
  const missing=environment({intersection:false});assert.equal(missing.observers.length,0);assert.equal(missing.tree.props.children,missing.child);
  const unsupported=environment({animate:false});unsupported.observers[0].callback([{target:unsupported.a,isIntersecting:true}]);assert.equal(unsupported.draws.length,0);unsupported.cleanup();
});
test('sticky glass keeps native scrolling and opaque fallback; lift is pointer and motion gated',()=>{
  const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
  assert(css.includes('position:sticky;top:0;z-index:20'));
  assert(css.includes('.nutrition-main>.topbar{background:var(--card)'));
  assert(css.includes('backdrop-filter:blur(16px) saturate(115%)'));
  assert(css.includes('@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)'));
  assert(!css.includes('animation-timeline:view()'));
  assert(!css.includes('cursor:none'));
  assert(!css.includes('scroll-snap-type'));
});
