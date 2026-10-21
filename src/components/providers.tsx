'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { NonceContext } from './number-flow';
import { TooltipProvider } from './ui/tooltip';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      gap={8}
      toastOptions={{
        style: {
          fontFamily: 'var(--font-sans)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: 'none',
          boxShadow: 'var(--shadow-pop)',
          borderRadius: 12,
        },
      }}
    />
  );
}

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    // El tema sigue al sistema; cambiarlo no dispara todas las transiciones de color a la vez.
    // `nonce`: el guion que pone la clase del tema es en línea y el CSP lo exige.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      {/* Con "reducir movimiento" Motion deja solo los fundidos. */}
      <MotionConfig reducedMotion="user">
        <NonceContext.Provider value={nonce}>
          <TooltipProvider delay={500} closeDelay={0}>
            {children}
          </TooltipProvider>
        </NonceContext.Provider>
        <ThemedToaster />
      </MotionConfig>
    </ThemeProvider>
  );
}
