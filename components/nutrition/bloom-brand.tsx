import type {CSSProperties} from 'react';

export const BLOOM_PETAL = 'M40 37C29 30 27 15 34 9C43 3 53 13 49 24C47 30 43 35 40 37Z';

export function BloomMark({className=''}: {className?:string}) {
  return <svg className={`bloom-mark ${className}`} viewBox="0 0 80 80" fill="currentColor" aria-hidden="true" focusable="false">
    {Array.from({length:6},(_,i)=><g key={i} transform={`rotate(${i*60} 40 40)`}><path className="bloom-petal" style={{'--petal-index':i} as CSSProperties} d={BLOOM_PETAL}/></g>)}
    <circle className="bloom-heart" cx="40" cy="40" r="4"/>
  </svg>;
}

export function BloomWordmark() {
  return <span className="bloom-wordmark" aria-label="The Daily Bloom"><BloomMark/><span>The Daily <strong>Bloom</strong></span></span>;
}

// Presentation only: keep existing server messages and saved conversations intact.
export const bloomCopy = (text:string) => text.replace(/\bNourish\b/g,'The Daily Bloom');
