'use client';

import {useId, useState, type CSSProperties, type ReactNode} from 'react';
import {Apple, Bean, Milk, Wheat, CookingPot, Sprout, ArrowUpRight, ChevronLeft, ChevronRight} from 'lucide-react';
import {SidebarMenuButton, useSidebar} from '@/components/ui/sidebar';

export function StudioNavButton({active, onSelect, children}: {active?: boolean; onSelect: () => void; children: ReactNode}) {
  const {isMobile, setOpenMobile} = useSidebar();
  return <SidebarMenuButton isActive={active} aria-current={active ? 'page' : undefined} onClick={() => {onSelect(); if (isMobile) setOpenMobile(false);}}>{children}</SidebarMenuButton>;
}

export function FoodMark({group}: {group: string}) {
  const Icon = ({Produce:Apple, Protein:Bean, Dairy:Milk, Grains:Wheat, Pantry:Sprout} as Record<string, typeof Apple>)[group] || CookingPot;
  return <span className="food-mark" data-group={group} aria-hidden="true"><Icon size={26} strokeWidth={1.5}/></span>;
}

export function EnergyRing({value, target}: {value:number; target:number}) {
  const percent = Math.max(0, Math.min(100, value / target * 100));
  return <div className="energy-ring" role="img" aria-label={`${Math.round(value)} of ${target} kcal logged`}>
    <svg viewBox="0 0 200 200" aria-hidden="true"><circle className="ring-track" cx="100" cy="100" r="88"/><circle className="ring-fill" cx="100" cy="100" r="88" pathLength="100" strokeDasharray="100" strokeDashoffset={100-percent}/></svg>
    <div><strong>{Math.round(value).toLocaleString()}</strong><span>kcal enjoyed</span><small>of {target.toLocaleString()} kcal</small></div>
  </div>;
}

type Day = {date:string; calories:number; protein:number; fiber:number; water:number; logged:boolean};
export function EnergyTrend({history, target}: {history:Day[]; target:number}) {
  const [selected, setSelected] = useState(history.length-1);
  const id = useId();
  const index = Math.min(selected, history.length-1);
  const day = history[index];
  const ceiling = Math.ceil(Math.max(target, ...history.map(d=>d.calories)) / 500) * 500 || 500;
  const dateLabel = (value:string) => new Date(value+'T12:00').toLocaleDateString(undefined, {month:'short',day:'numeric'});
  return <div className="energy-trend">
    <div className="chart-toolbar"><div className="chart-readout" id={id} aria-live="polite"><span>{dateLabel(day.date)}</span><strong>{day.logged ? `${Math.round(day.calories).toLocaleString()} kcal` : 'No food logged'}</strong><small>{day.logged ? `${day.protein} g protein · ${day.fiber} g fiber` : 'Missing days are not estimated.'}</small></div><div className="chart-navigation"><button type="button" className="icon-button" aria-label="Previous chart day" disabled={index===0} onClick={()=>setSelected(index-1)}><ChevronLeft size={18}/></button><button type="button" className="icon-button" aria-label="Next chart day" disabled={index===history.length-1} onClick={()=>setSelected(index+1)}><ChevronRight size={18}/></button></div></div>
    <div className="chart-frame">
      <div className="chart-scale" aria-hidden="true"><span>{ceiling.toLocaleString()}</span><span>{(ceiling/2).toLocaleString()}</span><span>0</span></div>
      <div className="chart-plot" style={{'--goal-position':`${target/ceiling*100}%`} as CSSProperties}>
        <div className="chart-goal" aria-hidden="true"><span>Target {target.toLocaleString()}</span></div>
        <div className="chart-columns" style={{gap:history.length>30?1:history.length>7?3:8}} role="group" aria-label="Daily energy. Use arrow keys to explore days.">
          {history.map((h,i)=><button key={h.date} type="button" className="chart-column" aria-label={`${dateLabel(h.date)}: ${h.logged ? `${h.calories} kcal, ${h.protein} g protein` : 'no food logged'}`} aria-describedby={id} aria-pressed={i===index} tabIndex={i===index?0:-1} onFocus={()=>setSelected(i)} onPointerEnter={()=>setSelected(i)} onClick={()=>setSelected(i)} onKeyDown={event=>{
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
            event.preventDefault();
            const next=event.key==='Home'?0:event.key==='End'?history.length-1:Math.max(0,Math.min(history.length-1,i+(event.key==='ArrowRight'?1:-1)));
            (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
          }}><span style={{height:`${h.logged?Math.max(1,h.calories/ceiling*100):0}%`}}/>{!h.logged&&<i aria-hidden="true"/>}</button>)}
        </div>
      </div>
    </div>
    <div className="chart-dates" aria-hidden="true"><span>{dateLabel(history[0].date)}</span><span>{dateLabel(history[Math.floor(history.length/2)].date)}</span><span>{dateLabel(history.at(-1)!.date)}</span></div>
    <p className="chart-help">Select a day to explore your logged nutrition. <ArrowUpRight size={14} aria-hidden="true"/></p>
  </div>;
}

/** Small text-only renderer: provider text never becomes raw HTML or executable links. */
export function AssistantText({text}: {text:string}) {
  const inline = (value:string) => value.split(/(\*\*[^*]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part);
  const lines=text.split('\n');
  const blocks:ReactNode[]=[];
  for(let i=0;i<lines.length;) {
    const line=lines[i];
    if(!line.trim()){i++;continue;}
    if(/^#{1,3}\s/.test(line)){blocks.push(<h3 key={i}>{inline(line.replace(/^#{1,3}\s+/,''))}</h3>);i++;continue;}
    const list=/^\s*(?:[-*]|\d+[.)])\s+/.test(line);
    if(list) {
      const ordered=/^\s*\d+[.)]/.test(line), start=i, items:ReactNode[]=[];
      const pattern=ordered?/^\s*\d+[.)]\s+/:/^\s*[-*]\s+/;
      while(i<lines.length&&pattern.test(lines[i])){items.push(<li key={i}>{inline(lines[i].replace(pattern,''))}</li>);i++;}
      blocks.push(ordered?<ol key={start}>{items}</ol>:<ul key={start}>{items}</ul>);
    } else {blocks.push(<p key={i}>{inline(line)}</p>);i++;}
  }
  return <div className="assistant-response">{blocks}</div>;
}
