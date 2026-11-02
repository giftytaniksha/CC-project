'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {Check, Pencil} from 'lucide-react';
import {TextField, SelectField} from './fields';
import {
  SEX_OPTIONS, ACTIVITY_OPTIONS, GOAL_OPTIONS, DIET_OPTIONS, CUISINE_OPTIONS,
  FREQUENCY_OPTIONS, COOKING_OPTIONS, BUDGET_OPTIONS, optionLabel,
} from '@/lib/options';

// Every field starts empty. The form stores text, and the payload converts numbers at save time.
export const emptyProfile = {
  name: '', age: '', sex: '', height: '', weight: '', activity: '',
  goal: '', diet: '', cuisine: '', frequency: '', cooking: '', budget: '',
  allergies: '', intolerances: '', dislikes: '', preferred: '',
};
export type ProfileForm = typeof emptyProfile;

export function profileToForm(profile: any): ProfileForm {
  const form: ProfileForm = {...emptyProfile};
  if (!profile) return form;
  for (const key of Object.keys(emptyProfile) as (keyof ProfileForm)[]) {
    const value = profile[key];
    form[key] = value === undefined || value === null ? '' : String(value);
  }
  return form;
}

export function formToPayload(form: ProfileForm) {
  return {
    ...form,
    name: form.name.trim(),
    age: Number(form.age),
    height: Number(form.height),
    weight: Number(form.weight),
    frequency: Number(form.frequency),
  };
}

const inRange = (value: string, min: number, max: number) => {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
};

/** Returns the first problem in the given steps, phrased for the person filling the form. */
export function profileProblem(form: ProfileForm, steps: readonly number[] = [0, 1, 2, 3]): string | null {
  const has = (n: number) => steps.includes(n);
  if (has(0)) {
    if (!form.name.trim()) return 'Enter your name.';
    if (!inRange(form.age, 18, 100)) return 'Age must be between 18 and 100.';
    if (!form.sex) return 'Choose the sex used for your calorie estimate.';
    if (!inRange(form.height, 120, 230)) return 'Height must be between 120 and 230 cm.';
    if (!inRange(form.weight, 35, 250)) return 'Weight must be between 35 and 250 kg.';
    if (!form.activity) return 'Choose your usual activity level.';
  }
  if (has(1) && !form.goal) return 'Choose a goal.';
  if (has(2)) {
    if (!form.diet) return 'Choose your diet.';
    if (!form.cuisine) return 'Choose your cuisine preference.';
    if (!form.frequency) return 'Choose how many meals you prefer each day.';
    if (!form.cooking) return 'Choose how much time you have to cook.';
    if (!form.budget) return 'Choose your food budget.';
  }
  return null;
}

const GOAL_HELP: Record<string, string> = {
  'Weight management': 'A moderate calorie reduction.',
  'Weight gain': 'A moderate calorie increase.',
  'Muscle gain': 'Higher protein with a small calorie increase.',
  'Maintenance': 'Calories set to match your usual energy use.',
  'General wellness': 'Balanced targets for everyday health.',
  'More energy': 'Balanced targets with regular, steady meals.',
};

type Props = {form: ProfileForm; set: (key: keyof ProfileForm, value: string) => void; step?: number; errors?: Partial<Record<keyof ProfileForm, string>>};

/** Shared form fields. Pass `step` to show one onboarding step; omit it to show everything. */
export function ProfileFields({form, set, step, errors = {}}: Props) {
  const show = (n: number) => step === undefined || step === n;
  return <>
    {show(0) && <>
      <TextField id="pf-name" label="Your name" placeholder="The name you'd like to be called" hint="Shown on your home page." maxLength={60} autoComplete="given-name" value={form.name} error={errors.name} onChange={e => set('name', e.target.value)}/>
      <TextField id="pf-age" label="Age" type="number" inputMode="numeric" min={18} max={100} placeholder="Your age in years" hint="Adults only: 18 to 100." value={form.age} error={errors.age} onChange={e => set('age', e.target.value)}/>
      <SelectField label="Sex" hint="Used only for the calorie estimate." placeholder="Choose one" value={form.sex} options={SEX_OPTIONS} error={errors.sex} onChange={v => set('sex', v)}/>
      <TextField id="pf-height" label="Height (cm)" type="number" inputMode="decimal" min={120} max={230} placeholder="Your height in centimetres" hint="120 to 230 cm." value={form.height} error={errors.height} onChange={e => set('height', e.target.value)}/>
      <TextField id="pf-weight" label="Weight (kg)" type="number" inputMode="decimal" min={35} max={250} step="0.1" placeholder="Your weight in kilograms" hint="35 to 250 kg. Decimals are fine." value={form.weight} error={errors.weight} onChange={e => set('weight', e.target.value)}/>
      <SelectField label="Usual activity" hint="Think about a typical week, not your best week." placeholder="Choose the closest match" value={form.activity} options={ACTIVITY_OPTIONS} error={errors.activity} onChange={v => set('activity', v)}/>
    </>}
    {show(1) && <div className="goal-field">
      <span className="field-label" id="pf-goal-label">What is your main goal?</span>
      <div className="goal-options" role="radiogroup" aria-labelledby="pf-goal-label">
        {GOAL_OPTIONS.map(([value, label]) => <button type="button" role="radio" aria-checked={form.goal === value} className={form.goal === value ? 'chosen' : ''} key={value} onClick={() => set('goal', value)}>
          <span><strong>{label}</strong><small>{GOAL_HELP[value]}</small></span>{form.goal === value && <Check size={18} aria-hidden="true"/>}
        </button>)}
      </div>
      {errors.goal && <small className="field-error" role="alert">{errors.goal}</small>}
    </div>}
    {show(2) && <>
      <SelectField label="Diet" hint="Foods outside this diet are never suggested." placeholder="Choose your diet" value={form.diet} options={DIET_OPTIONS} error={errors.diet} onChange={v => set('diet', v)}/>
      <SelectField label="Cuisine" hint="Used to sort meal suggestions." placeholder="Choose a cuisine" value={form.cuisine} options={CUISINE_OPTIONS} error={errors.cuisine} onChange={v => set('cuisine', v)}/>
      <SelectField label="Meals per day" hint="Three meals skips the snack slot in the planner." placeholder="Choose a number" value={form.frequency} options={FREQUENCY_OPTIONS} error={errors.frequency} onChange={v => set('frequency', v)}/>
      <SelectField label="Cooking time" hint="How long you can usually spend on a meal." placeholder="Choose a time" value={form.cooking} options={COOKING_OPTIONS} error={errors.cooking} onChange={v => set('cooking', v)}/>
      <SelectField label="Food budget" hint="Tight budgets limit suggestions to everyday staples." placeholder="Choose a budget" value={form.budget} options={BUDGET_OPTIONS} error={errors.budget} onChange={v => set('budget', v)}/>
    </>}
    {show(3) && <>
      <TextField id="pf-allergies" label="Allergies" placeholder="List foods, separated by commas" hint="Foods that can cause a serious reaction. These are always avoided." value={form.allergies} maxLength={500} onChange={e => set('allergies', e.target.value)}/>
      <TextField id="pf-intolerances" label="Intolerances" placeholder="List foods, separated by commas" hint="Foods that upset your stomach but are not dangerous, such as lactose or gluten." value={form.intolerances} maxLength={500} onChange={e => set('intolerances', e.target.value)}/>
      <TextField id="pf-dislikes" label="Foods you avoid" placeholder="List foods, separated by commas" hint="Foods you simply don’t enjoy." value={form.dislikes} maxLength={500} onChange={e => set('dislikes', e.target.value)}/>
      <TextField id="pf-preferred" label="Foods you enjoy" placeholder="List foods, separated by commas" hint="Your planner gives these priority." value={form.preferred} maxLength={500} onChange={e => set('preferred', e.target.value)}/>
    </>}
  </>;
}

function DetailRow({label, value}: {label: string; value: string}) {
  return <div className="detail-row"><dt>{label}</dt><dd>{value || 'Not set'}</dd></div>;
}

/** Read-only details with an Edit button. Saving goes through the same validation as onboarding. */
export function ProfilePage({profile, targets, busy, onSave}: {
  profile: any; targets: any; busy: boolean; onSave: (payload: any) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(() => profileToForm(profile));
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {if (!editing) setForm(profileToForm(profile));}, [profile, editing]);

  const set = (key: keyof ProfileForm, value: string) => setForm(current => ({...current, [key]: value}));
  const start = () => {setForm(profileToForm(profile)); setProblem(null); setEditing(true);};
  const cancel = () => {setForm(profileToForm(profile)); setProblem(null); setEditing(false);};
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = profileProblem(form);
    setProblem(message);
    if (message || busy) return;
    if (await onSave(formToPayload(form))) setEditing(false);
  }

  if (editing) return <form className="profile-edit panel" onSubmit={save} noValidate>
    <div className="section-head"><div><p className="eyebrow">EDIT PROFILE</p><h2>Update your details</h2></div></div>
    <p className="muted">Changes update your targets and meal suggestions straight away.</p>
    <div className="form-grid">
      <ProfileFields form={form} set={set}/>
    </div>
    {problem && <p className="form-problem" role="alert">{problem}</p>}
    <div className="form-actions">
      <button type="button" className="secondary" onClick={cancel} disabled={busy}>Cancel</button>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;

  const profileLabels = {
    sex: optionLabel(SEX_OPTIONS, profile.sex),
    activity: optionLabel(ACTIVITY_OPTIONS, profile.activity),
    goal: optionLabel(GOAL_OPTIONS, profile.goal),
    diet: optionLabel(DIET_OPTIONS, profile.diet),
    cuisine: optionLabel(CUISINE_OPTIONS, profile.cuisine),
    frequency: optionLabel(FREQUENCY_OPTIONS, profile.frequency),
    cooking: optionLabel(COOKING_OPTIONS, profile.cooking),
    budget: optionLabel(BUDGET_OPTIONS, profile.budget),
  };

  return <div className="profile-page">
    <div className="profile-hero panel">
      <div className="profile-avatar" aria-hidden="true">{profile.name?.[0]?.toUpperCase() ?? '?'}</div>
      <div className="profile-summary">
        <p className="eyebrow">YOUR PROFILE</p>
        <h2>{profile.name}</h2>
        <p className="muted">{profileLabels.diet} · {profileLabels.goal} · {profileLabels.cooking}</p>
      </div>
      <button type="button" onClick={start} disabled={busy}><Pencil size={16} aria-hidden="true"/>Edit profile</button>
    </div>
    <div className="profile-grid">
      <section className="panel"><h3 className="card-title">About you</h3><dl>
        <DetailRow label="Age" value={`${profile.age} years`}/>
        <DetailRow label="Sex" value={profileLabels.sex}/>
        <DetailRow label="Height" value={`${profile.height} cm`}/>
        <DetailRow label="Weight" value={`${profile.weight} kg`}/>
        <DetailRow label="BMI" value={targets ? `${targets.bmi} · ${targets.category}` : ''}/>
        <DetailRow label="Activity" value={profileLabels.activity}/>
      </dl></section>
      <section className="panel"><h3 className="card-title">Your goal and daily targets</h3><dl>
        <DetailRow label="Goal" value={profileLabels.goal}/>
        <DetailRow label="Energy" value={targets ? `${targets.calories.toLocaleString()} kcal a day (estimate)` : ''}/>
        <DetailRow label="Protein" value={targets ? `${targets.protein} g` : ''}/>
        <DetailRow label="Water" value={targets ? `${(targets.water / 1000).toFixed(1)} L` : ''}/>
      </dl></section>
      <section className="panel"><h3 className="card-title">Food preferences</h3><dl>
        <DetailRow label="Diet" value={profileLabels.diet}/>
        <DetailRow label="Cuisine" value={profileLabels.cuisine}/>
        <DetailRow label="Meals per day" value={profileLabels.frequency}/>
        <DetailRow label="Cooking time" value={profileLabels.cooking}/>
        <DetailRow label="Budget" value={profileLabels.budget}/>
      </dl></section>
      <section className="panel"><h3 className="card-title">Restrictions and likes</h3><dl>
        <DetailRow label="Allergies" value={profile.allergies}/>
        <DetailRow label="Intolerances" value={profile.intolerances}/>
        <DetailRow label="Foods you avoid" value={profile.dislikes}/>
        <DetailRow label="Foods you enjoy" value={profile.preferred}/>
      </dl></section>
    </div>
    <p className="footnote">Targets are estimates, not a medical prescription. For pregnancy, breastfeeding, medical conditions or specialised diets, ask a clinician for individual targets.</p>
  </div>;
}
