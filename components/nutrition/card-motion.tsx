'use client';

import {useEffect,useRef,type ReactNode} from 'react';

// Presentation targets only; forms, charts, dialogs and their handlers stay live.
export const CARD_TARGETS='.energy-card,.macro-card,.today-plate,.water-card,.food-feature,.path-link,.food-card,.planner-actions,.plan-day,.grocery,.summary-strip,.trend,.progress-bottom>.panel,.weekly-card,.cycle-card,.wellness-guidance article,.prompts>button';

export function CardMotion({page,children}:{page:string;children:ReactNode}) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=root.current;
    if(!element||typeof IntersectionObserver==='undefined')return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer=window.matchMedia('(hover: hover) and (pointer: fine)');
    const seen=new WeakSet<Element>(),observed=new Set<Element>(),running=new Map<HTMLElement,Animation>();
    const stop=()=>{running.forEach(animation=>animation.cancel());running.clear();};
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting||seen.has(entry.target))continue;
        const card=entry.target as HTMLElement;
        observer.unobserve(card);observed.delete(card);seen.add(card);
        if(reduced.matches||!pointer.matches||card.contains(document.activeElement)||typeof card.animate!=='function')continue;
        try{
          const animation=card.animate([{opacity:.72,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'cubic-bezier(.16,1,.3,1)',fill:'none'});
          running.set(card,animation);
          animation.finished.catch(()=>{}).finally(()=>{if(running.get(card)===animation)running.delete(card);});
        }catch{/* Keep the ordinary visible card if animation is unsupported. */}
      }
    },{threshold:.08,rootMargin:'0px 0px -16px 0px'});
    const register=(node:Element)=>{
      const cards=[...(node.matches(CARD_TARGETS)?[node]:[]),...node.querySelectorAll(CARD_TARGETS)];
      for(const card of cards){
        if(seen.has(card)||observed.has(card))continue;
        if(reduced.matches||!pointer.matches){seen.add(card);continue;}
        observed.add(card);observer.observe(card);
      }
    };
    register(element);
    // New food results and generated plan cards join without reanimating existing data.
    const mutations=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)register(node);
      for(const card of observed)if(!element.contains(card)){observer.unobserve(card);observed.delete(card);}
      for(const [card,animation] of running)if(!element.contains(card)){animation.cancel();running.delete(card);}
    });
    mutations.observe(element,{childList:true,subtree:true});
    const preference=()=>{
      if(reduced.matches||!pointer.matches){stop();observed.forEach(card=>seen.add(card));observer.disconnect();observed.clear();}
    };
    const focus=(event:FocusEvent)=>{for(const [card,animation] of running)if(card.contains(event.target as Node)){animation.cancel();running.delete(card);}};
    reduced.addEventListener('change',preference);pointer.addEventListener('change',preference);element.addEventListener('focusin',focus);
    return()=>{stop();observer.disconnect();mutations.disconnect();observed.clear();reduced.removeEventListener('change',preference);pointer.removeEventListener('change',preference);element.removeEventListener('focusin',focus);};
  },[]);
  return <div ref={root} className="page-reveal" data-page={page}>{children}</div>;
}
