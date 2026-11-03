export const keys=['calories','protein','carbs','fat','fiber'] as const;
export type Nutrients=Record<typeof keys[number],number>;
export type Food=Nutrients&{id:string;name:string;serving:string;tags:string[];group:string;source:string;quick:boolean;cost:number;cuisine:string};

// [id, name, serving, calories, protein, carbs, fat, fiber, tags, group]
const rows:any[]=[
['rice','Cooked rice','100 g',130,2.7,28.2,.3,.4,[], 'Grains'],
['roti','Whole wheat roti','1 medium · 40 g',120,3.6,22,2.5,3,['wheat','gluten'],'Grains'],
['oats','Rolled oats','40 g dry',152,5.3,27.1,2.6,4,['oats'],'Grains'],
['egg','Boiled egg','1 large · 50 g',78,6.3,.6,5.3,0,['egg'],'Protein'],
['milk','Whole milk','250 ml',153,7.9,12,8.1,0,['milk','dairy','lactose'],'Dairy'],
['paneer','Paneer','100 g',265,18.3,1.2,20.8,0,['milk','dairy','lactose'],'Dairy'],
['curd','Plain curd','100 g',61,3.5,4.7,3.3,0,['milk','dairy','lactose'],'Dairy'],
['dal','Cooked lentils','100 g',116,9,20.1,.4,7.9,['lentils','dal'],'Protein'],
['chicken','Cooked chicken breast','100 g',165,31,0,3.6,0,['meat','chicken'],'Protein'],
['fish','Cooked salmon','100 g',206,22.1,0,12.4,0,['fish','meat'],'Protein'],
['tofu','Firm tofu','100 g',144,17.3,2.8,8.7,2.3,['soy'],'Protein'],
['chickpeas','Cooked chickpeas','100 g',164,8.9,27.4,2.6,7.6,['chickpeas','grams'],'Protein'],
['spinach','Cooked spinach','100 g',23,3,3.8,.3,2.4,[],'Produce'],
['carrot','Carrot','100 g',41,.9,9.6,.2,2.8,[],'Produce'],
['apple','Apple','1 medium · 182 g',95,.5,25.1,.3,4.4,[],'Produce'],
['banana','Banana','1 medium · 118 g',105,1.3,27,.4,3.1,[],'Produce'],
['orange','Orange','1 medium · 131 g',62,1.2,15.4,.2,3.1,[],'Produce'],
['almonds','Almonds','28 g',164,6,6.1,14.2,3.5,['nuts','tree nuts','almond'],'Pantry'],
['peanuts','Peanuts','28 g',161,7.3,4.6,14,2.4,['peanut','nuts'],'Pantry'],
['idli','Plain idli','2 medium · 100 g',146,4.5,30,.5,1,['rice','lentils','dal'],'Grains'],
['dosa','Plain dosa','1 medium · 100 g',168,3.9,29,4,1,['rice','lentils','dal'],'Grains'],
['poha','Vegetable poha','150 g',220,4,40,5,3,['rice'],'Grains'],
['biryani','Chicken biryani','250 g',440,20,55,15,3,['chicken','meat','milk','dairy'],'Other'],
['oil','Olive oil','1 tsp · 4.5 g',40,0,0,4.5,0,[],'Pantry']];

// Display names for food groups (stored ids stay the same).
export const GROUP_LABELS:Record<string,string>={Grains:'Grains & breads',Protein:'Protein foods',Dairy:'Dairy',Produce:'Fruits & vegetables',Pantry:'Nuts, seeds & oils',Other:'Mixed dishes',Extra:'Extra items'};
export const groupLabel=(group:string)=>GROUP_LABELS[group]||group;
export const GROCERY_GROUPS=['Produce','Protein','Grains','Dairy','Pantry','Other'];

export const foods:Food[]=rows.map((r)=>({id:r[0],name:r[1],serving:r[2],calories:r[3],protein:r[4],carbs:r[5],fat:r[6],fiber:r[7],tags:r[8],group:r[9],source:['roti','paneer','idli','dosa','poha','biryani'].includes(r[0])?'Recipe estimate; preparation varies':'Rounded USDA generic-food reference estimate',quick:!['chicken','fish','dal','chickpeas','spinach','biryani'].includes(r[0]),cost:['chicken','fish','paneer','almonds'].includes(r[0])?3:1,cuisine:r[0]==='idli'||r[0]==='dosa'?'South Indian':r[0]==='roti'||r[0]==='paneer'?'North Indian':['poha','biryani','dal','rice'].includes(r[0])?'Indian':'Any'}));
export const emptyTotals=():Nutrients=>({calories:0,protein:0,carbs:0,fat:0,fiber:0});
export type CustomFood=Nutrients&{name:string;serving:string;source:string};
// Custom entries carry their own validated per-serving snapshot; catalog values stay authoritative.
export function loggedFood(entry:{foodId?:string;customFood?:CustomFood}):Food|CustomFood|undefined {return foods.find(f=>f.id===entry.foodId)||entry.customFood;}
export function sum(entries:any[]):Nutrients {const n=emptyTotals();for(const e of entries){const f=loggedFood(e);if(f)for(const k of keys)n[k]+=f[k]*e.quantity;}for(const k of keys)n[k]=Math.round(n[k]*10)/10;return n;}
const searchAliases:Record<string,string>={biriyani:'biryani',briyani:'biryani',biriani:'biryani',eggs:'egg',chapati:'roti',chapatis:'roti',yogurt:'curd',yoghurt:'curd',dahl:'dal',idly:'idli',idlis:'idli',idli:'idli'};
const searchWords=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).map(word=>searchAliases[word]||word);
export function searchFoods(query:string):Food[]{const words=searchWords(query);return foods.filter(food=>{const text=searchWords([food.name,food.id,...food.tags].join(' ')).join(' ');return words.every(word=>text.includes(word));});}

// Best library match for a typed name — used before AI estimates so calories match the catalog when possible.
export function catalogMatch(query:string):Food|undefined{
  const words=searchWords(query);
  if(!words.length)return undefined;
  const exact=foods.find(f=>f.id===words.join('')||searchWords(f.name).join(' ')===words.join(' '));
  if(exact)return exact;
  const matches=searchFoods(query);
  if(matches.length===1)return matches[0];
  if(matches.length>1&&words.length===1)return matches.find(f=>f.id===words[0])||matches[0];
  return undefined;
}
export function foodEstimatePayload(f:Food){return {serving:f.serving,calories:f.calories,protein:f.protein,carbs:f.carbs,fat:f.fat,fiber:f.fiber};}

const mealNameSplit=(name:string)=>name.split(/\s+(?:with|and|,|\+)\s+/i).map(p=>p.trim()).filter(Boolean);
// When an AI meal name lists catalog foods (“poha with egg”), use library per-serving numbers instead of model guesses.
export function catalogTotalsForMealName(name:string):Nutrients|null{
  const parts=mealNameSplit(name);
  if(!parts.length)return null;
  const n=emptyTotals();
  for(const part of parts){
    const f=catalogMatch(part);
    if(!f)return null;
    for(const k of keys)n[k]+=f[k];
  }
  for(const k of keys)n[k]=Math.round(n[k]*10)/10;
  return n;
}
export function libraryMealName(entries:{foodId:string;quantity:number}[]){
  return entries.map(e=>foods.find(f=>f.id===e.foodId)?.name).filter(Boolean).join(' with ');
}

/** Interpret what food the visitor is asking about in chat (catalog + profile aware). */
export function analyzeChatFoodRequest(message:string,p:any){
  const trimmed=message.trim();
  if(!trimmed)return {status:'general' as const};
  const pantry=trimmed.match(/only have\s+([^.?!]+)/i);
  if(pantry){
    const parts=pantry[1].split(/\s+and\s+|,/i).map(s=>s.trim()).filter(Boolean);
    const resolved=parts.map(part=>catalogMatch(part)).filter((f):f is Food=>Boolean(f&&allowed(f,p)));
    if(resolved.length)return {status:'pantryOnly' as const,foods:resolved.map(f=>f.name),ids:resolved.map(f=>f.id)};
  }
  const want=trimmed.match(/(?:want to eat|want|eat|have|craving|like)\s+(?:a |an |some |to eat )?(.+?)(?:\?|\.|$)/i);
  const query=(want?.[1]||trimmed).replace(/\b(today|tonight|now|please)\b/gi,'').trim().slice(0,80);
  const match=catalogMatch(query);
  if(match){
    if(allowed(match,p))return {status:'inList' as const,food:match.name,id:match.id};
    return {status:'restrictedByProfile' as const,food:match.name,diet:p?.diet||''};
  }
  const loose=searchFoods(query.split(/\s+/).slice(0,4).join(' '));
  if(loose.length===1&&allowed(loose[0],p))return {status:'inList' as const,food:loose[0].name,id:loose[0].id};
  if(/pizza|pastry|cake|burger|avocado|avacado|tikka|fry|chocolate/i.test(query))return {status:'notInApp' as const,query:query.slice(0,60)};
  if(loose.length&&!allowed(loose[0],p))return {status:'restrictedByProfile' as const,food:loose[0].name,diet:p?.diet||''};
  return {status:'general' as const,query:query.slice(0,60)};
}

export function targets(p:any){const bmi=p.weight/(p.height/100)**2;const bmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:p.sex==='female'?-161:-78);const factor=({sedentary:1.2,light:1.375,moderate:1.55,active:1.725} as any)[p.activity];const delta=p.goal==='Weight management'&&bmi>=18.5?-250:['Weight gain','Muscle gain'].includes(p.goal)?250:0;const calories=Math.max(p.sex==='male'?1800:1500,Math.round((bmr*factor+delta)/10)*10);const protein=Math.round(p.weight*(p.goal==='Muscle gain'?1.6:1.2));const fat=Math.round(calories*.3/9);return {bmi:Math.round(bmi*10)/10,category:bmi<18.5?'Underweight':bmi<25?'Healthy range':bmi<30?'Overweight':'Obesity range',calories,protein,fat,carbs:Math.round((calories-protein*4-fat*9)/4),fiber:Math.round(calories/1000*14),water:Math.round(p.weight*30/100)*100};}

// Diet rules. Fish is tagged as both fish and meat, so it is checked first.
// Words the visitor typed under allergies, intolerances and dislikes. Shared by food filtering and by the check on AI text.
export const exclusionTerms=(p:any):string[]=>[p?.allergies,p?.intolerances,p?.dislikes].filter(Boolean).join(',').toLowerCase().split(/[,;\n]/).map(x=>x.trim()).filter(x=>x&&x!=='none');
const DAIRY_HINTS=['milk','paneer','curd','yogurt','yoghurt','cheese','ghee','butter','cream','whey'];
function termsForTextCheck(p:any):string[]{
  const base=exclusionTerms(p);
  const out=new Set(base);
  for(const t of base){
    if(/lactose|dairy|milk/.test(t))for(const w of DAIRY_HINTS)out.add(w);
  }
  return [...out];
}
const escapeRegex=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Returns the excluded words that appear in a piece of text (singular or plural, whole-word start).
export function mentionsExcluded(text:string,p:any):string[]{
  return termsForTextCheck(p).filter(term=>{
    if(term.length<3)return false;
    const stem=term.length>3&&term.endsWith('s')?term.slice(0,-1):term;
    return new RegExp('\\b'+escapeRegex(stem)).test(text.toLowerCase());
  });
}
export function allowed(f:Food,p:any){
  const fish=f.tags.includes('fish');
  const meat=f.tags.includes('meat')&&!fish;
  const egg=f.tags.includes('egg');
  if(p.diet==='Vegetarian'&&(meat||fish||egg))return false;
  if(p.diet==='Eggetarian'&&(meat||fish))return false;
  if(p.diet==='Pescatarian'&&meat)return false;
  if(p.diet==='Vegan'&&f.tags.some(t=>['meat','fish','egg','dairy','milk'].includes(t)))return false;
  // Allergies and intolerances are both avoided: substring match on name and tags.
  const exclusions=exclusionTerms(p);
  return !exclusions.some(x=>(f.name+' '+f.tags.join(' ')).toLowerCase().includes(x)||f.tags.some(t=>x.includes(t)));
}

export const QUICK_COOKING=['No cooking','Quick meals'];
export const mealTypesFor=(p:any):string[]=>{
  const n=Number(p?.frequency);
  if(n===3)return ['Breakfast','Lunch','Dinner'];
  if(n===5)return ['Breakfast','Morning snack','Lunch','Evening snack','Dinner'];
  return ['Breakfast','Lunch','Snack','Dinner'];
};

export function meal(p:any,type:string,seed:number,t:any){
  let pool=foods.filter(f=>allowed(f,p)&&f.id!=='oil');
  if(QUICK_COOKING.includes(p.cooking))pool=pool.filter(f=>f.quick);
  if(p.budget==='Budget')pool=pool.filter(f=>f.cost<3);
  const pick=(list:Food[],offset=0)=>list.length?list[(seed+offset)%list.length]:undefined;
  // Exact regional match ranks first, "Indian" accepts any Indian regional dish, and general Indian dishes come next.
  // The catalog only has Indian dishes tagged by region, so a non-Indian cuisine choice is left neutral rather than defaulting back to Indian food.
  const indianFamily=['Indian','North Indian','South Indian'];
  const cuisineRank=(f:Food)=>{const wanted=p.cuisine;if(!wanted||wanted==='Any'||!indianFamily.includes(wanted))return 0;if(f.cuisine===wanted||(wanted==='Indian'&&f.cuisine.endsWith('Indian')))return 2;return f.cuisine==='Indian'?1:0;};
  const likes=(f:Food)=>(p.preferred||'').toLowerCase().includes(f.id);
  const preferred=(list:Food[])=>[...list].sort((a,b)=>Number(likes(b))-Number(likes(a))||cuisineRank(b)-cuisineRank(a));
  const grain=pick(preferred(pool.filter(f=>f.group==='Grains')));
  const protein=pick(preferred(pool.filter(f=>f.protein>=6&&f.id!=='oats')),1);
  const produce=pick(pool.filter(f=>f.group==='Produce'),2);
  const snackish=/snack/i.test(type);
  const chosen=(snackish?[produce,protein]:[grain,protein,produce]).filter(Boolean) as Food[];
  if(!chosen.length)throw Error('No meals match these restrictions. Update your preferences.');
  const share:Record<string,number>=Number(p.frequency)===3
    ?{Breakfast:.25,Lunch:.35,Dinner:.4}
    :Number(p.frequency)===5
      ?{Breakfast:.2,'Morning snack':.12,Lunch:.28,'Evening snack':.12,Dinner:.28}
      :{Breakfast:.25,Snack:.15,Lunch:.3,Dinner:.3};
  const fraction=share[type]??.3;
  const base=chosen.reduce((a,f)=>a+f.calories,0);
  const scale=Math.min(3,Math.max(.5,t.calories*fraction/base));
  const entries=chosen.map(f=>({foodId:f.id,quantity:Math.round(scale*4)/4}));
  return {id:crypto.randomUUID(),type,entries,totals:sum(entries)};
}

// Deterministic recommendations for the Home page: the same profile and date always give the same meals.
export function suggestions(p:any,t:any,seed:number){
  const reasons=[`Fits your ${p.diet} diet`,p.cooking?`Matches your cooking time: ${p.cooking.toLowerCase()}`:null,p.budget&&p.budget!=='Flexible'?`Works with your ${p.budget.toLowerCase()} budget`:null].filter(Boolean) as string[];
  return ['Breakfast','Lunch','Dinner'].flatMap((type,i)=>{
    try{
      const m=meal(p,type,seed+i,t);
      return [{type,meals:m.entries.map(e=>{const f=foods.find(x=>x.id===e.foodId)!;return {name:f.name,serving:f.serving,quantity:e.quantity};}),totals:m.totals,reasons}];
    }catch{return [];}
  });
}

export function cycle(c:any,date:string){if(!c?.enabled||!c.start)return null;const elapsed=Math.floor((Date.parse(date)-Date.parse(c.start))/86400000);if(elapsed<0)return null;const day=elapsed%c.length+1;return {day,phase:day<=c.duration?'Menstrual':day<c.length-15?'Follicular':day<=c.length-12?'Around ovulation':'Luteal',next:new Date(Date.parse(c.start)+(Math.floor(elapsed/c.length)+1)*c.length*86400000).toISOString().slice(0,10)};}
export function stats(s:any,end:string,range=7){const dates=Array.from({length:range},(_,i)=>new Date(Date.parse(end)-(range-1-i)*86400000).toISOString().slice(0,10));const days=dates.map(date=>({date,...sum(s.logs.filter((l:any)=>l.date===date)),water:s.water[date]||0,meals:new Set(s.logs.filter((l:any)=>l.date===date).map((l:any)=>l.meal)).size}));const logged=days.filter(d=>d.meals>0);const avg:any={};for(const k of [...keys,'water'])avg[k]=logged.length?Math.round(logged.reduce((a,d)=>a+(d as any)[k],0)/logged.length*10)/10:0;const weights=s.weights.filter((w:any)=>dates.includes(w.date)).sort((a:any,b:any)=>a.date.localeCompare(b.date));return {days,loggedDays:logged.length,consistency:Math.round(logged.length/range*100),averages:avg,weightTrend:weights.length>=2?Math.round((weights.at(-1).weight-weights[0].weight)*10)/10:null,weights};}
export function initial(){return {profile:null,logs:[],water:{},plan:[],groceries:[],weights:[],conversations:[],cycle:{enabled:false,start:'',length:28,duration:5},recommendation:null,aiPlan:null};}
