'use client';

import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';

/** Retain only a brief, inert visual of the outgoing step; live fields remain controlled by the app. */
export function BloomStep({step,children}: {step:number;children:ReactNode}) {
  const previous=useRef({step,children});
  const [outgoing,setOutgoing]=useState<ReactNode>(null);
  useLayoutEffect(()=>{
    if(previous.current.step===step)return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setOutgoing(null);return;}
    setOutgoing(previous.current.children);
    const timer=window.setTimeout(()=>setOutgoing(null),180);
    return()=>window.clearTimeout(timer);
  },[step]);
  useLayoutEffect(()=>{previous.current={step,children};});
  return <div className="bloom-step-stage">
    {outgoing&&<div className="bloom-step-outgoing" aria-hidden="true" inert>{outgoing}</div>}
    <div className="bloom-step-current" key={step}>{children}</div>
  </div>;
}
