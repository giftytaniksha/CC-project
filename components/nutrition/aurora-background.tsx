'use client';

import {useEffect,useId,useRef} from 'react';
import {AURORA_BANDS,auroraResolution,drawAurora,ribbonSvgPath} from './aurora-motion';

/** A pointer-transparent aurora confined to the Ask Bloom composer. */
export function AuroraBackground() {
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const id=useId().replace(/:/g,'');
  useEffect(()=>{
    const element=canvas.current,container=root.current;
    if(!element||!container)return;
    let ctx:CanvasRenderingContext2D|null;
    try{ctx=element.getContext('2d',{alpha:true});}catch{return;}
    if(!ctx)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let stopped=false,failed=false,frame=0,last=0,nextPaint=0,time=0,fps=30,darkMix=document.documentElement.dataset.theme==='dark'?1:0,targetMix=darkMix;
    const fail=()=>{failed=true;cancelAnimationFrame(frame);container.dataset.animated='false';};
    const paint=()=>{try{drawAurora(ctx!,element.width,element.height,time,darkMix);container.dataset.animated='true';}catch{fail();}};
    const resize=()=>{
      if(stopped)return;
      const size=auroraResolution(container.clientWidth,container.clientHeight);
      element.width=size.width;element.height=size.height;fps=size.fps;
      if(!reduced.matches&&!failed)paint();
    };
    const tick=(now:number)=>{
      if(stopped||failed||document.hidden||reduced.matches)return;
      const elapsed=last?Math.min((now-last)/1000,.1):0;
      time+=elapsed*1.27;last=now;
      darkMix+=(targetMix-darkMix)*(1-Math.exp(-elapsed*7));
      if(!nextPaint||now+.5>=nextPaint){
        paint();
        nextPaint=nextPaint?nextPaint+1000/fps:now+1000/fps;
        if(nextPaint<now)nextPaint=now+1000/fps;
      }
      if(!failed)frame=requestAnimationFrame(tick);
    };
    const resume=()=>{
      cancelAnimationFrame(frame);last=0;nextPaint=0;
      if(reduced.matches){container.dataset.animated='false';return;}
      if(!document.hidden&&!stopped&&!failed)frame=requestAnimationFrame(tick);
    };
    const theme=new MutationObserver(()=>{
      targetMix=document.documentElement.dataset.theme==='dark'?1:0;
      // Keep the same time/phase; only the palette interpolates.
    });
    theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
    observer?.observe(container);
    window.addEventListener('resize',resize);
    document.addEventListener('visibilitychange',resume);
    reduced.addEventListener('change',resume);
    const lost=(event:Event)=>{event.preventDefault();fail();};
    element.addEventListener('contextlost',lost);
    resize();resume();
    return()=>{
      stopped=true;cancelAnimationFrame(frame);observer?.disconnect();theme.disconnect();
      window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);element.removeEventListener('contextlost',lost);
    };
  },[]);
  return <div className="aurora-environment" ref={root} aria-hidden="true" data-animated="false">
    <svg className="aurora-still" viewBox="0 0 1440 1000" preserveAspectRatio="none" focusable="false">
      <defs><filter id={`${id}-soft`} x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="19"/></filter>
        {AURORA_BANDS.map((band,i)=><linearGradient key={i} id={`${id}-color-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`var(--aurora-${band.color})`} stopOpacity="0"/><stop offset=".45" stopColor={`var(--aurora-${band.color})`} stopOpacity={band.strength}/><stop offset="1" stopColor={`var(--aurora-${band.color})`} stopOpacity="0"/></linearGradient>)}
      </defs>
      <g filter={`url(#${id}-soft)`}>{AURORA_BANDS.map((band,i)=><path key={i} d={ribbonSvgPath(band,3)} fill={`url(#${id}-color-${i})`}/>)}</g>
    </svg>
    <canvas ref={canvas} className="aurora-canvas"/>
  </div>;
}
