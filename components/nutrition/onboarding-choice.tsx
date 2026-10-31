'use client';

import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Check, ChevronDown} from 'lucide-react';

type ChoiceOption = string | readonly [string, string];
type Props = {
  label: string;
  value: string | number;
  options: readonly ChoiceOption[];
  onChange: (value: string) => void;
};

/** Inline listbox: expanding a choice reserves space instead of covering other fields. */
export function OnboardingChoice({label, value, options, onChange}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typeahead = useRef({text: '', time: 0});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const items = options.map(option => typeof option === 'string'
    ? {value: option, label: option}
    : {value: option[0], label: option[1]});
  const selected = items.findIndex(item => item.value === String(value));
  const selectedLabel = items[selected]?.label ?? '';

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({block: 'nearest'});
  }, [open, active]);

  function show() {
    setActive(Math.max(0, selected));
    setOpen(true);
  }

  function choose(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.value);
    setOpen(false);
    trigger.current?.focus({preventScroll: true});
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') {setOpen(false); return;}
    if (event.key === 'Escape') {setOpen(false); event.preventDefault(); return;}
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else show();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        setActive(event.key === 'End' ? items.length - 1 : event.key === 'Home' ? 0 : Math.max(0, selected));
        setOpen(true);
      } else {
        setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
      }
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const time = Date.now();
      const text = (time - typeahead.current.time < 700 ? typeahead.current.text : '') + event.key.toLowerCase();
      typeahead.current = {text, time};
      const match = items.findIndex(item => item.label.toLowerCase().startsWith(text));
      if (match >= 0) {setActive(match); setOpen(true);}
    }
  }

  return <div className="field onboarding-choice" ref={root}
    onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);}}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="onboarding-choice-trigger" role="combobox"
      aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={keyDown}>
      <span id={`${id}-value`}>{selectedLabel}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && <div ref={list} id={`${id}-list`} className="onboarding-choice-list" role="listbox"
      aria-labelledby={`${id}-label`}>
      {items.map((item, index) => <div key={item.value} id={`${id}-option-${index}`}
        role="option" aria-selected={index === selected} data-active={index === active}
        className="onboarding-choice-option"
        onPointerDown={event => event.preventDefault()}
        onClick={() => choose(index)}>
        <span>{item.label}</span>{index === selected && <Check size={16} aria-hidden="true"/>}
      </div>)}
    </div>}
  </div>;
}
