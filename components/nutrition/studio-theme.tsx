'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {ThemeProvider, useTheme} from 'next-themes';
import {Moon, Sun} from 'lucide-react';
import {Toaster} from 'sonner';

export function StudioTheme({children}: {children: ReactNode}) {
  return <ThemeProvider attribute="data-theme" storageKey="nourish-appearance" defaultTheme="system" enableSystem enableColorScheme>{children}</ThemeProvider>;
}

export function ThemeToggle() {
  const {resolvedTheme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div className="theme-toggle" role="group" aria-label="Color theme">
    <button type="button" className="theme-light" aria-label="Use light theme" aria-pressed={mounted && resolvedTheme === 'light'} onClick={() => setTheme('light')}><Sun size={16}/><span>Light</span></button>
    <button type="button" className="theme-dark" aria-label="Use dark theme" aria-pressed={mounted && resolvedTheme === 'dark'} onClick={() => setTheme('dark')}><Moon size={16}/><span>Dark</span></button>
  </div>;
}

export function StudioToaster() {
  const {resolvedTheme} = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} position="bottom-right" toastOptions={{className:'studio-toast'}}/>;
}
