import {targets,sum,keys,stats,cycle,suggestions} from '@/lib/nutrition';

// Numeric seed from the date keeps Home suggestions stable for a whole day.
export const daySeed=(date:string)=>Number(date.replaceAll('-',''))%997;

// Pure derivation of everything the screens show for one date. Runs on the server (to answer actions) and in the browser (to render saved data).
export function view(s:any,date:string){
  const t=s.profile?targets(s.profile):null;
  const totals=sum(s.logs.filter((l:any)=>l.date===date));
  const remaining:any={};
  if(t)for(const k of keys)remaining[k]=Math.max(0,Math.round(((t as any)[k]-totals[k])*10)/10);
  return {state:s,targets:t,totals,remaining,cycleEstimate:cycle(s.cycle,date),weekly:stats(s,date),suggestions:s.profile&&t?suggestions(s.profile,t,daySeed(date)):[],recommendation:s.recommendation?.date===date?s.recommendation:null};
}
