'use client';

import {useEffect, useState} from 'react';
import {BloomMark} from './bloom-brand';

/** Mounted once in the root layout, independently of page, step and theme state. */
export function BloomIntro() {
  const [visible,setVisible]=useState(true);
  useEffect(()=>{
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const dismiss=()=>setVisible(false);
    if(reduced.matches){dismiss();return;}
    const onPreference=()=>{if(reduced.matches)dismiss();};
    const timeout=window.setTimeout(dismiss,2900);
    // The first keyboard interaction reveals the real app before focus moves.
    window.addEventListener('keydown',dismiss,{once:true,capture:true});
    reduced.addEventListener('change',onPreference);
    return()=>{window.clearTimeout(timeout);window.removeEventListener('keydown',dismiss,true);reduced.removeEventListener('change',onPreference);};
  },[]);
  if(!visible)return null;
  return <div className="bloom-intro" aria-hidden="true" onPointerDown={()=>setVisible(false)} onAnimationEnd={event=>{if(event.target===event.currentTarget&&event.animationName==='bloom-intro-screen')setVisible(false);}}>
    <div className="bloom-intro-composition"><BloomMark className="bloom-intro-flower"/><p className="bloom-intro-name">The Daily Bloom</p><p className="bloom-intro-tagline">NOURISH. GROW. GLOW.</p></div>
  </div>;
}
