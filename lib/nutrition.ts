export const keys=['calories','protein','carbs','fat','fiber'] as const;
export type Nutrients=Record<typeof keys[number],number>;
export type Food=Nutrients&{id:string;name:string;serving:string;tags:string[];group:string;source:string;quick:boolean;cost:number;cuisine:string};
const rows:any[]=[
['rice','Cooked rice','100 g',130,2.7,28.2,.3,.4,[], 'Grains'],
['roti','Whole wheat roti','1 medium · 40 g',120,3.6,22,2.5,3,['wheat','gluten'],'Grains'],
['oats','Rolled oats','40 g dry',152,5.3,27.1,2.6,4,['oats'],'Grains'],
['egg','Boiled egg','1 large · 50 g',78,6.3,.6,5.3,0,['egg'],'Protein'],
['milk','Whole milk','250 ml',153,7.9,12,8.1,0,['milk','dairy','lactose'],'Dairy'],
['paneer','Paneer','100 g',265,18.3,1.2,20.8,0,['milk','dairy'],'Dairy'],
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
export const foods:Food[]=rows.map((r)=>({id:r[0],name:r[1],serving:r[2],calories:r[3],protein:r[4],carbs:r[5],fat:r[6],fiber:r[7],tags:r[8],group:r[9],source:['roti','paneer','idli','dosa','poha','biryani'].includes(r[0])?'Recipe estimate; preparation varies':'Rounded USDA generic-food reference estimate',quick:!['chicken','fish','dal','chickpeas','spinach','biryani'].includes(r[0]),cost:['chicken','fish','paneer','almonds'].includes(r[0])?3:1,cuisine:['roti','paneer','idli','dosa','poha','biryani','dal','rice'].includes(r[0])?'Indian':'Any'}));
export const emptyTotals=():Nutrients=>({calories:0,protein:0,carbs:0,fat:0,fiber:0});
export type CustomFood=Nutrients&{name:string;serving:string;source:string};
// Custom entries carry their own validated per-serving snapshot; catalog values stay authoritative.
export function loggedFood(entry:{foodId?:string;customFood?:CustomFood}):Food|CustomFood|undefined {return foods.find(f=>f.id===entry.foodId)||entry.customFood;}
export function sum(entries:any[]):Nutrients {const n=emptyTotals();for(const e of entries){const f=loggedFood(e);if(f)for(const k of keys)n[k]+=f[k]*e.quantity;}for(const k of keys)n[k]=Math.round(n[k]*10)/10;return n;}
const searchAliases:Record<string,string>={biriyani:'biryani',briyani:'biryani',biriani:'biryani',eggs:'egg',chapati:'roti',chapatis:'roti',yogurt:'curd',yoghurt:'curd',dahl:'dal'};
const searchWords=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).map(word=>searchAliases[word]||word);
export function searchFoods(query:string):Food[]{const words=searchWords(query);return foods.filter(food=>{const text=searchWords([food.name,food.id,...food.tags].join(' ')).join(' ');return words.every(word=>text.includes(word));});}
export function targets(p:any){const bmi=p.weight/(p.height/100)**2;const bmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:p.sex==='female'?-161:-78);const factor=({sedentary:1.2,light:1.375,moderate:1.55,active:1.725} as any)[p.activity];const delta=p.goal==='Weight management'&&bmi>=18.5?-250:['Weight gain','Muscle gain'].includes(p.goal)?250:0;const calories=Math.max(p.sex==='male'?1800:1500,Math.round((bmr*factor+delta)/10)*10);const protein=Math.round(p.weight*(p.goal==='Muscle gain'?1.6:1.2));const fat=Math.round(calories*.3/9);return {bmi:Math.round(bmi*10)/10,category:bmi<18.5?'Underweight':bmi<25?'Healthy range':bmi<30?'Overweight':'Obesity range',calories,protein,fat,carbs:Math.round((calories-protein*4-fat*9)/4),fiber:Math.round(calories/1000*14),water:Math.round(p.weight*30/100)*100};}
export function allowed(f:Food,p:any){if(p.diet==='Vegetarian'&&(f.tags.includes('meat')||f.tags.includes('egg')))return false;if(p.diet==='Eggetarian'&&f.tags.includes('meat'))return false;if(p.diet==='Vegan'&&f.tags.some(t=>['meat','egg','dairy','milk'].includes(t)))return false;const exclusions=[p.allergies,p.intolerances,p.dislikes].filter(Boolean).join(',').toLowerCase().split(/[,;\n]/).map(x=>x.trim()).filter(x=>x&&x!=='none');return !exclusions.some(x=>(f.name+' '+f.tags.join(' ')).toLowerCase().includes(x)||f.tags.some(t=>x.includes(t)));}
export function meal(p:any,type:string,seed:number,t:any){let pool=foods.filter(f=>allowed(f,p)&&f.id!=='oil');if(p.cooking==='No cooking')pool=pool.filter(f=>f.quick);if(p.budget==='Budget')pool=pool.filter(f=>f.cost<3);const pick=(list:Food[],offset=0)=>list.length?list[(seed+offset)%list.length]:undefined;const preferred=(list:Food[])=>[...list].sort((a,b)=>Number((p.preferred||'').toLowerCase().includes(b.id))-Number((p.preferred||'').toLowerCase().includes(a.id))||Number(b.cuisine===p.cuisine)-Number(a.cuisine===p.cuisine));const grain=pick(preferred(pool.filter(f=>f.group==='Grains')));const protein=pick(preferred(pool.filter(f=>f.protein>=6&&f.id!=='oats')),1);const produce=pick(pool.filter(f=>f.group==='Produce'),2);const chosen=(type==='Snack'?[produce,protein]:[grain,protein,produce]).filter(Boolean) as Food[];if(!chosen.length)throw Error('No meals match these restrictions. Update your preferences.');const fraction=type==='Breakfast'?.25:type==='Snack'?.15:.3;const base=chosen.reduce((a,f)=>a+f.calories,0);const scale=Math.min(3,Math.max(.5,t.calories*fraction/base));const entries=chosen.map(f=>({foodId:f.id,quantity:Math.round(scale*4)/4}));return {id:crypto.randomUUID(),type,entries,totals:sum(entries)};}
export function cycle(c:any,date:string){if(!c?.enabled||!c.start)return null;const elapsed=Math.floor((Date.parse(date)-Date.parse(c.start))/86400000);if(elapsed<0)return null;const day=elapsed%c.length+1;return {day,phase:day<=c.duration?'Menstrual':day<c.length-15?'Follicular':day<=c.length-12?'Around ovulation':'Luteal',next:new Date(Date.parse(c.start)+(Math.floor(elapsed/c.length)+1)*c.length*86400000).toISOString().slice(0,10)};}
export function stats(s:any,end:string,range=7){const dates=Array.from({length:range},(_,i)=>new Date(Date.parse(end)-(range-1-i)*86400000).toISOString().slice(0,10));const days=dates.map(date=>({date,...sum(s.logs.filter((l:any)=>l.date===date)),water:s.water[date]||0,meals:new Set(s.logs.filter((l:any)=>l.date===date).map((l:any)=>l.meal)).size}));const logged=days.filter(d=>d.meals>0);const avg:any={};for(const k of [...keys,'water'])avg[k]=logged.length?Math.round(logged.reduce((a,d)=>a+(d as any)[k],0)/logged.length*10)/10:0;const weights=s.weights.filter((w:any)=>dates.includes(w.date)).sort((a:any,b:any)=>a.date.localeCompare(b.date));return {days,loggedDays:logged.length,consistency:Math.round(logged.length/range*100),averages:avg,weightTrend:weights.length>=2?Math.round((weights.at(-1).weight-weights[0].weight)*10)/10:null,weights};}
export function initial(){return {profile:null,logs:[],water:{},plan:[],groceries:[],weights:[],conversations:[],cycle:{enabled:false,start:'',length:28,duration:5}};}
