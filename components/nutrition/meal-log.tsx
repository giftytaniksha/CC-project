'use client';
import {Plus, Trash2} from 'lucide-react';
import {loggedFood} from '@/lib/nutrition';
import {DAILY_MEALS} from '@/lib/options';

const round = (n: number) => Math.round(n * 10) / 10;

/** The visitor's logged meals for one date, grouped by meal. Shared by Home and the Meals page so logging looks and works the same in both places. */
export function MealLog({logs, onAdd, onEdit, onRemove}: {
  logs: any[];
  onAdd: (meal: string) => void;
  onEdit: (entry: any, food: any) => void;
  onRemove: (id: string, target: HTMLElement) => void;
}) {
  return <>{DAILY_MEALS.map((m, i) => {
    const entries = logs.filter(l => l.meal === m);
    const totals = entries.reduce((a, l) => {const f = loggedFood(l); if (!f) return a; return {calories: a.calories + f.calories * l.quantity, protein: a.protein + f.protein * l.quantity};}, {calories: 0, protein: 0});
    return <section className="meal-group" key={m}>
      <div className="section-head"><h3><span className="meal-number">0{i + 1}</span>{m}</h3><button type="button" className="icon-button" aria-label={'Add food to ' + m} onClick={() => onAdd(m)}><Plus size={20}/></button></div>
      {entries.length ? entries.map(l => {
        const f = loggedFood(l);
        if (!f) return null;
        return <div className="meal-row" key={l.id}>
          <div><strong>{f.name}</strong><small>{f.serving} · {l.quantity} serving(s)</small></div>
          <span>{Math.round(f.calories * l.quantity)} kcal<small>{round(f.protein * l.quantity)} g protein</small></span>
          <button type="button" className="text-button" onClick={() => onEdit(l, f)}>Edit</button>
          <button type="button" className="icon-button" aria-label={'Remove ' + f.name} onClick={event => onRemove(l.id, event.currentTarget)}><Trash2 size={16}/></button>
        </div>;
      }) : <p className="muted">Nothing logged yet. Add what you enjoyed.</p>}
      {entries.length > 0 && <p className="meal-total">{Math.round(totals.calories)} kcal · {round(totals.protein)} g protein</p>}
    </section>;
  })}</>;
}
