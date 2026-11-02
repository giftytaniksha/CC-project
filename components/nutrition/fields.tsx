'use client';

import {useId, type InputHTMLAttributes, type ReactNode} from 'react';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import type {Option} from '@/lib/options';

/** A labelled form row: label, control, then either an error message or a short description. */
export function Field({id, label, hint, error, children}: {id: string; label: string; hint?: string; error?: string; children: ReactNode}) {
  const message = error ?? hint;
  return <div className={'field' + (error ? ' field-invalid' : '')}>
    <label htmlFor={id}><span className="field-label">{label}</span></label>
    {children}
    {message && <small id={`${id}-message`} className={error ? 'field-error' : 'field-hint'} role={error ? 'alert' : undefined}>{message}</small>}
  </div>;
}

type TextProps = InputHTMLAttributes<HTMLInputElement> & {label: string; hint?: string; error?: string};

/** Text and number inputs start empty; placeholder text describes the field instead of giving a sample value. */
export function TextField({label, hint, error, id, ...input}: TextProps) {
  const fallback = useId();
  const fieldId = id ?? fallback;
  return <Field id={fieldId} label={label} hint={hint} error={error}>
    <input id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${fieldId}-message` : undefined} {...input}/>
  </Field>;
}

/** Radix Select renders its list in a portal, above the page, with an opaque surface. Nothing else on the page moves. */
export function SelectField({id, label, hint, error, value, options, placeholder, onChange}: {
  id?: string; label: string; hint?: string; error?: string; value: string;
  options: readonly Option[]; placeholder: string; onChange: (value: string) => void;
}) {
  const fallback = useId();
  const fieldId = id ?? fallback;
  return <Field id={fieldId} label={label} hint={hint} error={error}>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${fieldId}-message` : undefined} className="select-trigger-wide">
        <SelectValue placeholder={placeholder}/>
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} align="start" className="select-content-opaque">
        {options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}
      </SelectContent>
    </Select>
  </Field>;
}
