'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import NumberFlowBase from '@number-flow/react';

/** Nonce del CSP de esta respuesta; lo pone `Providers`. */
export const NonceContext = createContext<string | undefined>(undefined);

/**
 * `NumberFlow` con el nonce del CSP. Cada número mete un `<style>` en su
 * shadow DOM; sin el nonce, `style-src` (sin `unsafe-inline` en producción)
 * lo bloquea y se ven los dígitos 0-9 encimados en lugar de la cifra.
 */
export default function NumberFlow(props: ComponentProps<typeof NumberFlowBase>) {
  const nonce = useContext(NonceContext);
  return <NumberFlowBase nonce={nonce} {...props} />;
}
