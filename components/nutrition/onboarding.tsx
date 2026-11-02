'use client';

import {useState} from 'react';
import {Check} from 'lucide-react';
import {toast} from 'sonner';
import {Progress} from '@/components/ui/progress';
import {ThemeToggle, StudioToaster} from './studio-theme';
import {BloomMark, BloomWordmark} from './bloom-brand';
import {BloomStep} from './bloom-step';
import {ProfileFields, emptyProfile, formToPayload, profileProblem, type ProfileForm} from './profile-fields';
import {SEX_OPTIONS, ACTIVITY_OPTIONS, GOAL_OPTIONS, DIET_OPTIONS, CUISINE_OPTIONS, FREQUENCY_OPTIONS, COOKING_OPTIONS, BUDGET_OPTIONS, optionLabel} from '@/lib/options';

const STEP_LABELS = ['About you', 'Your focus', 'Your food', 'Your needs', 'Review'];
const STEP_TITLES = ['Hello, let’s meet.', 'What feels right for you?', 'How do you like to eat?', 'Tell us what to avoid.', 'Ready for your everyday?'];
const STEP_NOTES = [
  'For adults 18 and over. Targets are estimates, not a medical prescription.',
  'Choose one main goal. You can change it later on your profile page.',
  'These shape your meal suggestions and planner.',
  'Allergies are always avoided. Intolerances and dislikes are avoided too.',
  'Check your details. You can edit them any time from your profile.',
];

/** First-run setup. Each step validates before moving on; the saved profile unlocks the app. */
export function Onboarding({busy, onSave}: {busy: boolean; onSave: (payload: any) => Promise<boolean>}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof ProfileForm, value: string) => setForm(current => ({...current, [key]: value}));

  async function next() {
    const message = profileProblem(form, [step]);
    setProblem(message);
    if (message) {toast.error(message); return;}
    if (step < 4) {setStep(step + 1); return;}
    const complete = profileProblem(form);
    if (complete) {toast.error(complete); return;}
    if (await onSave(formToPayload(form))) toast.success('Your nutrition profile is ready.');
  }

  return <main className="onboarding">
    <div className="onboarding-utilities"><ThemeToggle/></div>
    <div className="onboard-aside">
      <BloomMark className="onboard-flower-watermark"/>
      <div className="brand-home"><BloomWordmark/></div>
      <p className="eyebrow">NOURISH. GROW. GLOW.</p>
      <h1>A little about you.<br/><em>A plan that fits.</em></h1>
      <p>Food you enjoy. Goals that feel right. Let’s start with the person behind the numbers.</p>
      <div className="onboard-visual"><img src="/food.jpg" alt="Fresh vegetables, grains and chickpeas in a bowl"/><div className="onboard-image-caption"><BloomMark/><span>Good food.<br/>Small daily rituals.</span></div></div>
      <small>Photo by Anna Pelzer / Unsplash</small>
    </div>
    <section className="onboard-form">
      <p className="guest-note">No account needed. Your profile and meals are saved only in this browser. On a shared device, end the session when you finish.</p>
      <p className="eyebrow">YOUR NUTRITION PROFILE · {step + 1} / 5</p>
      <div className="onboarding-steps" aria-label={`Profile step ${step + 1} of 5`}>
        {STEP_LABELS.map((label, i) => <span key={label} data-current={i === step} data-done={i < step}><b>{i < step ? <Check size={12}/> : i + 1}</b><small>{label}</small></span>)}
      </div>
      <Progress aria-label="Profile completion" value={(step + 1) * 20}/>
      <BloomStep step={step}>
        <h1>{STEP_TITLES[step]}</h1>
        <p className="muted">{STEP_NOTES[step]}</p>
        <div className="form-grid step-reveal" key={step}>
          {step === 4 ? <ReviewSummary form={form}/> : <ProfileFields form={form} set={set} step={step}/>}
        </div>
        {problem && <p className="form-problem" role="alert">{problem}</p>}
      </BloomStep>
      <div className="form-actions">
        {step > 0 && <button type="button" className="secondary" onClick={() => {setProblem(null); setStep(step - 1);}}>Back</button>}
        <button type="button" disabled={busy} onClick={next}>{busy ? 'Saving…' : step === 4 ? 'Create my nutrition' : 'Continue'}</button>
      </div>
    </section>
    <StudioToaster/>
  </main>;
}

function ReviewSummary({form}: {form: ProfileForm}) {
  const rows: [string, string][] = [
    ['Name', form.name],
    ['Age and sex', `${form.age} years · ${optionLabel(SEX_OPTIONS, form.sex)}`],
    ['Height and weight', `${form.height} cm · ${form.weight} kg`],
    ['Activity', optionLabel(ACTIVITY_OPTIONS, form.activity)],
    ['Goal', optionLabel(GOAL_OPTIONS, form.goal)],
    ['Diet', optionLabel(DIET_OPTIONS, form.diet)],
    ['Cuisine', optionLabel(CUISINE_OPTIONS, form.cuisine)],
    ['Meals per day', optionLabel(FREQUENCY_OPTIONS, form.frequency)],
    ['Cooking time', optionLabel(COOKING_OPTIONS, form.cooking)],
    ['Budget', optionLabel(BUDGET_OPTIONS, form.budget)],
    ['Allergies', form.allergies || 'None listed'],
    ['Intolerances', form.intolerances || 'None listed'],
    ['Foods you avoid', form.dislikes || 'None listed'],
    ['Foods you enjoy', form.preferred || 'None listed'],
  ];
  return <dl className="review">
    {rows.map(([label, value]) => <div className="detail-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}
