import { defang, markUrl } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Una URL desactivada (`hxxp`, `[.]`) en la tipografía mono del login, con lo
 * que delata un dominio falso marcado en ámbar. Nunca es un enlace.
 */
export function DomainText({ url, className }: { url: string; className?: string }) {
  const parts = markUrl(url);
  const suspicious = parts.some((part) => part.mark);
  return (
    <code className={cn('font-mono', className)}>
      {parts.map((part, index) =>
        part.mark ? (
          <mark key={index} className="domain-mark">
            {defangPart(part.text, index === 0)}
          </mark>
        ) : (
          <span key={index}>{defangPart(part.text, index === 0)}</span>
        ),
      )}
      {suspicious && <span className="sr-only"> (tiene partes sospechosas, marcadas)</span>}
    </code>
  );
}

/** `defang` solo cambia "http" al inicio: lo aplica al primer pedazo. */
function defangPart(text: string, first: boolean): string {
  return first ? defang(text) : text.replace(/\./g, '[.]');
}
