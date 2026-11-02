'use client';

import type {CSSProperties} from 'react';
import {ArrowUpRight, CalendarDays, ChartNoAxesCombined, Droplets, Flame, Leaf, Plus, RefreshCw, Sparkles} from 'lucide-react';
import {Progress} from '@/components/ui/progress';
import {EnergyRing, AssistantText} from './studio-visuals';
import {bloomCopy} from './bloom-brand';
import {DIET_OPTIONS, GOAL_OPTIONS, CUISINE_OPTIONS, COOKING_OPTIONS, BUDGET_OPTIONS, optionLabel} from '@/lib/options';
import {MealLog} from './meal-log';

const round = (n: number) => Math.round(n * 10) / 10;

function Meter({label, value, target, color, unit = 'g'}: {label: string; value: number; target: number; color: string; unit?: string}) {
  const percent = target > 0 ? Math.min(100, value / target * 100) : 0;
  return <div className="meter">
    <div><span>{label}</span><strong>{round(value)}<small> / {target} {unit}</small></strong></div>
    <Progress aria-label={`${label} daily progress`} value={percent} style={{'--meter': color} as CSSProperties}/>
    <p>{round(Math.max(0, target - value))} {unit} remaining</p>
  </div>;
}

type Props = {
  data: any;
  date: string;
  busy: boolean;
  onRecommend: (refresh: boolean) => void;
  onWater: (amount: number) => void;
  onNavigate: (page: string) => void;
  onAddFood: () => void;
  onAddMeal: (meal: string) => void;
  onEditEntry: (entry: any, food: any) => void;
  onRemoveEntry: (id: string, target: HTMLElement) => void;
};

export function HomePage({data, date, busy, onRecommend, onWater, onNavigate, onAddFood, onAddMeal, onEditEntry, onRemoveEntry}: Props) {
  const s = data.state;
  const profile = s.profile;
  const t = data.targets;
  const n = data.totals;
  const suggestions: any[] = data.suggestions ?? [];
  const recommendation = data.recommendation;
  const dayWater = s.water[date] || 0;
  const dayLogs = s.logs.filter((l: any) => l.date === date);

  return <>
    <div className="home-plan panel">
      <div className="home-plan-copy">
        <p className="eyebrow">YOUR PLAN</p>
        <h2>Built around how you eat.</h2>
        <div className="plan-chips">
          <span className="pill">{optionLabel(DIET_OPTIONS, profile.diet)}</span>
          <span className="pill">{optionLabel(GOAL_OPTIONS, profile.goal)}</span>
          <span className="pill">{optionLabel(CUISINE_OPTIONS, profile.cuisine)}</span>
          <span className="pill">{optionLabel(COOKING_OPTIONS, profile.cooking)}</span>
          <span className="pill">{optionLabel(BUDGET_OPTIONS, profile.budget)}</span>
        </div>
      </div>
      <dl className="plan-targets">
        <div><dt>Energy</dt><dd>{t.calories.toLocaleString()} kcal</dd></div>
        <div><dt>Protein</dt><dd>{t.protein} g</dd></div>
        <div><dt>Water</dt><dd>{(t.water / 1000).toFixed(1)} L</dd></div>
      </dl>
    </div>

    <div className="dashboard-grid">
      <section className="energy-card">
        <div className="section-head"><span className="eyebrow"><Flame size={16}/> TODAY’S NOURISHMENT</span><span className="hero-goal">{optionLabel(GOAL_OPTIONS, profile.goal)}</span></div>
        <div className="energy-main">
          <EnergyRing value={n.calories} target={t.calories}/>
          <div className="energy-story">
            <h2>A little care.<br/><em>Every plate.</em></h2>
            <p>Your daily energy, at a glance.</p>
            <div className="energy-target"><strong>{Math.round(data.remaining.calories).toLocaleString()}<span> kcal</span></strong><small>remaining of your estimated target</small></div>
          </div>
        </div>
        <div className="energy-footer"><span><span className="status-dot"/>Your day, at your own pace</span><span>BMI {t.bmi} · {t.category}</span></div>
      </section>
      <section className="macro-card">
        <div className="section-head"><div><p className="eyebrow">THE DAILY BALANCE</p><h2>Beyond calories.</h2></div><Leaf size={23} strokeWidth={1.5}/></div>
        <Meter label="Protein" value={n.protein} target={t.protein} color="var(--nutrient-protein)"/>
        <Meter label="Carbohydrates" value={n.carbs} target={t.carbs} color="var(--nutrient-carbs)"/>
        <Meter label="Fat" value={n.fat} target={t.fat} color="var(--nutrient-fat)"/>
        <Meter label="Fiber" value={n.fiber} target={t.fiber} color="var(--nutrient-fiber)"/>
      </section>
    </div>

    <section className="panel meal-page today-plate">
      <div className="section-head"><div><p className="eyebrow">FROM MORNING TO EVENING</p><h2>Your plate today.</h2></div><button type="button" className="text-button" onClick={() => onNavigate('Meals')}>View meals<ArrowUpRight size={15}/></button></div>
      <MealLog logs={dayLogs} onAdd={onAddMeal} onEdit={onEditEntry} onRemove={onRemoveEntry}/>
    </section>

    <section className="panel recommend-panel">
      <div className="section-head">
        <div><p className="eyebrow">PICKED FOR YOUR PROFILE</p><h2>Recommended meals</h2></div>
        <button type="button" className="secondary" onClick={onAddFood}><Plus size={16}/>Log a meal</button>
      </div>
      <p className="muted">Built from your {optionLabel(DIET_OPTIONS, profile.diet).split(':')[0].toLowerCase()} diet, {optionLabel(COOKING_OPTIONS, profile.cooking).toLowerCase()} cooking time and {optionLabel(BUDGET_OPTIONS, profile.budget).split(':')[0].toLowerCase()} budget.</p>
      {suggestions.length ? <div className="suggestion-grid">
        {suggestions.map(item => <article className="suggestion-card" key={item.type}>
          <span className="eyebrow">{item.type}</span>
          <ul className="suggestion-foods">
            {item.meals.map((m: any) => <li key={m.name}><strong>{m.name}</strong><small>{m.quantity} × {m.serving}</small></li>)}
          </ul>
          <p className="suggestion-totals">{Math.round(item.totals.calories)} kcal · {item.totals.protein} g protein</p>
          <ul className="reason-list">{item.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
        </article>)}
      </div> : <div className="empty"><Sparkles/><h2>No suggestions yet.</h2><p>Your restrictions rule out every meal in the library. Review allergies and foods you avoid on your profile.</p></div>}
      <p className="footnote">Portions are estimates. Check ingredients for allergens before eating.</p>
    </section>

    <div className="home-lower">
      <section className="panel ask-tip">
        <div className="section-head">
          <div><p className="eyebrow">ASK BLOOM · TODAY</p><h2>Your personal tip</h2></div>
          {data.aiAvailable
            ? <button type="button" className="secondary" disabled={busy} onClick={() => onRecommend(Boolean(recommendation))}>{recommendation ? <RefreshCw size={16}/> : <Sparkles size={16}/>}{busy ? 'Writing…' : recommendation ? 'Refresh tip' : 'Create tip'}</button>
            : <span className="pill">Ask Bloom setup needed</span>}
        </div>
        {recommendation
          ? <><AssistantText text={bloomCopy(recommendation.text)}/><p className="footnote">Made from your diet, cuisine and the last few days you’ve logged, so it changes day to day. Created once per day to save quota — press Refresh for another option.</p></>
          : <p className="muted">{data.aiAvailable ? 'Create a tip for today using your diet, goal and what you have logged so far.' : 'Ask Bloom needs its connection set up before it can write tips. The meal suggestions above still work.'}</p>}
      </section>
      <aside>
        <section className="water-card">
          <div className="section-head"><div><p className="eyebrow">A MOMENT TO HYDRATE</p><h2>Keep it flowing.</h2></div><Droplets size={25} strokeWidth={1.5}/></div>
          <strong>{(dayWater / 1000).toFixed(2)} <span>/ {(t.water / 1000).toFixed(1)} L</span></strong>
          <Progress aria-label="Daily hydration progress" value={Math.min(100, dayWater / t.water * 100)} style={{'--meter': 'var(--water-accent)'} as CSSProperties}/>
          <p>{Math.max(0, t.water - dayWater)} ml to your estimated goal</p>
          <div className="inline-actions">
            <button type="button" disabled={busy} className="secondary" onClick={() => onWater(250)}><Plus size={16}/>250 ml</button>
            <button type="button" disabled={busy || !dayWater} className="text-button" onClick={() => onWater(-250)}>Undo 250 ml</button>
          </div>
        </section>
        <button type="button" className="path-link" onClick={() => onNavigate('Progress')}>
          <ChartNoAxesCombined/><span><small>YOUR RECENT RHYTHM</small><strong>{data.weekly.loggedDays} of the last 7 days logged.</strong></span><ArrowUpRight/>
        </button>
        <button type="button" className="path-link" onClick={() => onNavigate('Planner')}>
          <CalendarDays/><span><small>A LITTLE PREPARATION</small><strong>Plan meals for the week.</strong></span><ArrowUpRight/>
        </button>
      </aside>
    </div>
  </>;
}
