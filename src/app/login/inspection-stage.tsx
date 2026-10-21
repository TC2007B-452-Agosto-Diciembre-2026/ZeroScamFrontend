'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "[.]" en vez de ".": así se muestran los dominios en el panel, sin enlace posible. */
const defang = (text: string) => text.replaceAll('.', '[.]');

type Sample = {
  /** Partes del dominio; `true` es lo que delata el engaño. */
  parts: [string, boolean][];
  /** Lo que aparenta lo marcado, dicho en corto. */
  looksLike: string;
  note: string;
};

const SAMPLES: Sample[] = [
  {
    parts: [
      ['rn', true],
      ['ercadolibre.com.mx', false],
    ],
    looksLike: 'se lee como "m"',
    note: 'Una "r" y una "n" juntas se hacen pasar por una "m".',
  },
  {
    parts: [
      ['paypa', false],
      ['1', true],
      ['.com', false],
    ],
    looksLike: 'se lee como "l"',
    note: 'Un uno en el lugar de la ele.',
  },
  {
    parts: [
      ['bbva', false],
      ['-mx-seguridad', true],
      ['.com', false],
    ],
    looksLike: 'no es del banco',
    note: 'Agregar "seguridad" al nombre no lo vuelve un sitio del banco.',
  },
  {
    parts: [
      ['sat', false],
      ['-gob-mx', true],
      ['.com', false],
    ],
    looksLike: 'no es gob.mx',
    note: 'Con guiones en vez de puntos, "gob-mx" deja de ser del gobierno: es un .com cualquiera.',
  },
];

/** Dominios del fondo: antes, lo que delata, después. */
const FIELD: [string, string, string][] = [
  ['', 'rn', 'ercadolibre.com.mx'],
  ['paypa', '1', '.com'],
  ['bbva', '-mx-seguridad', '.com'],
  ['sat', '-gob-mx', '.com'],
  ['a', 'rn', 'azon.com.mx'],
  ['te', '1', 'cel.com'],
  ['coppe', '1', '.com.mx'],
  ['', '0', 'xxo-premios.com'],
  ['wal', 'rn', 'art.com.mx'],
  ['netf', '1', 'ix.com'],
  ['banorte', '-enlinea', '.info'],
  ['santander.com.mx', '.verifica', '.co'],
  ['g', '0', 'ogle-soporte.com'],
  ['dhl', '-paquete-retenido', '.com'],
  ['', 'rn', 'icrosoft-cuenta.com'],
  ['mercadopag', '0', '.com'],
  ['liverpoo', '1', '.com.mx'],
  ['cfe', '-pagos', '.online'],
  ['hsbc', '-alertas', '.net'],
  ['app', '1', 'e-id.com'],
  ['spei', '-reembolso', '.com'],
  ['imss', '-citas', '.org'],
];

const ROWS = 34;
const PER_ROW = 7;

// Tiempos de cada ejemplo, en milisegundos desde que aparece.
const DURATION = 7200;
const SETTLE_START = 220;
const SETTLE_STEP = 34;
const SCAN = 1100;
/** Cuando aparece el primer ejemplo, la página todavía está entrando. */
const FIRST_LEAD = 650;

/** Glifos que se confunden entre sí: con ellos se "descifra" cada dominio. */
const LOOKALIKES = 'Il1|O0o8B5S2Zrnmvw';
const isPunct = (ch: string) => '[].-'.includes(ch);

/** El cero tachado de la marca, trazado al cargar. */
function DrawnMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-8" fill="none">
      <motion.ellipse
        cx="12"
        cy="12"
        rx="6"
        ry="8.5"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.path
        d="M5.5 19.5 18.5 4.5"
        stroke="var(--accent)"
        strokeWidth="2.25"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.85, ease: [0.23, 1, 0.32, 1] }}
      />
    </svg>
  );
}

function DomainField({ lens = false }: { lens?: boolean }) {
  return (
    <div className={cn('domain-field', lens && 'domain-field--lens')}>
      {Array.from({ length: ROWS }, (_, row) => {
        const items = Array.from({ length: PER_ROW }, (_, k) => FIELD[(row * 5 + k * 3) % FIELD.length]);
        const style = { '--drift': `${95 + ((row * 23) % 70)}s`, marginLeft: -((row * 137) % 420) } as CSSProperties;
        return (
          <div key={row} className="domain-row" data-dir={row % 2 ? 'rev' : undefined} style={style}>
            {/* Dos copias iguales: al recorrer la mitad, la fila vuelve a empezar sin brinco. */}
            {[0, 1].map((copy) => (
              <span key={copy} className="flex shrink-0">
                {items.map(([before, mark, after], k) => (
                  <span key={k} className="domain">
                    {defang(before)}
                    <span className="domain-mark">{defang(mark)}</span>
                    {defang(after)}
                  </span>
                ))}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Mueve la lupa. Con mouse la sigue con un poco de inercia; sin mouse (o
 * mientras no hay puntero encima) pasea sola por el campo.
 */
function useLens(
  stageRef: RefObject<HTMLDivElement | null>,
  lensRef: RefObject<HTMLDivElement | null>,
  innerRef: RefObject<HTMLDivElement | null>,
  reduced: boolean,
) {
  useEffect(() => {
    const stage = stageRef.current;
    const lens = lensRef.current;
    const inner = innerRef.current;
    if (!stage || !lens || !inner) return;

    const SCALE = 1.45;
    let w = stage.clientWidth;
    let h = stage.clientHeight;
    let r = Math.min(132, h * 0.26);
    let x = w * 0.68;
    let y = h * 0.42;
    let tx = x;
    let ty = y;
    let pointer = false;
    let visible = true;
    let raf = 0;

    const size = () => {
      w = stage.clientWidth;
      h = stage.clientHeight;
      r = Math.min(132, h * 0.26);
      stage.style.setProperty('--lr', `${r}px`);
      inner.style.setProperty('--sw', `${w}px`);
      inner.style.setProperty('--sh', `${h}px`);
    };
    const paint = () => {
      lens.style.transform = `translate3d(${x - r}px, ${y - r}px, 0)`;
      inner.style.transform = `translate3d(${r - x * SCALE}px, ${r - y * SCALE}px, 0) scale(${SCALE})`;
    };

    const start = performance.now();
    const frame = (now: number) => {
      if (!pointer) {
        const t = now - start;
        tx = w * (0.66 + 0.22 * Math.sin(t / 5200));
        ty = h * (0.48 + 0.26 * Math.sin(t / 7300 + 1.3));
      }
      const ease = pointer ? 0.16 : 0.035;
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      paint();
      raf = requestAnimationFrame(frame);
    };
    // En pantallas angostas el ejemplo ocupa todo el ancho: ahí no hay lupa.
    const wide = window.matchMedia('(min-width: 64rem)');
    const run = () => {
      cancelAnimationFrame(raf);
      if (!reduced && visible && wide.matches) raf = requestAnimationFrame(frame);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const box = stage.getBoundingClientRect();
      tx = event.clientX - box.left;
      ty = event.clientY - box.top;
      pointer = true;
      stage.dataset.lens = '';
      if (reduced) {
        x = tx;
        y = ty;
        paint();
      }
    };
    const onLeave = () => {
      pointer = false;
      if (reduced) delete stage.dataset.lens;
    };

    size();
    paint();
    // Con movimiento reducido la lupa solo aparece bajo el mouse y no pasea.
    if (!reduced) stage.dataset.lens = '';

    const resize = new ResizeObserver(size);
    resize.observe(stage);
    // Fuera de la vista (en el teléfono, al bajar al formulario) no se anima.
    const view = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      run();
    });
    view.observe(stage);
    wide.addEventListener('change', run);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    run();

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      view.disconnect();
      wide.removeEventListener('change', run);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      delete stage.dataset.lens;
    };
  }, [stageRef, lensRef, innerRef, reduced]);
}

/** Las partes del ejemplo en glifos, con la posición donde empieza cada una. */
function split(sample: Sample) {
  const segments: { chars: string[]; marked: boolean; offset: number }[] = [];
  let length = 0;
  for (const [text, marked] of sample.parts) {
    const chars = [...defang(text)];
    segments.push({ chars, marked, offset: length });
    length += chars.length;
  }
  return { segments, length };
}

/**
 * Un ejemplo: el dominio se "descifra" glifo por glifo, una línea de escaneo
 * lo recorre y, al pasar, marca lo que delata el engaño.
 */
function Specimen({ sample, lead, reduced }: { sample: Sample; lead: number; reduced: boolean }) {
  const line = useRef<HTMLSpanElement>(null);

  const { segments, length } = useMemo(() => split(sample), [sample]);

  const decodeEnd = SETTLE_START + length * SETTLE_STEP;
  const scanAt = (lead + decodeEnd + 150) / 1000;
  const litAt = (offset: number) => scanAt + ((SCAN / 1000) * offset) / length;

  useEffect(() => {
    const cells = Array.from(line.current?.querySelectorAll<HTMLElement>('[data-c]') ?? []);
    // Se cambia el valor del mismo nodo de texto que puso React: así no se le mueve nada.
    const settle = (cell: HTMLElement) => {
      if (cell.firstChild) cell.firstChild.nodeValue = cell.dataset.c ?? '';
      cell.dataset.on = '';
    };
    if (reduced) {
      cells.forEach(settle);
      return;
    }
    const start = performance.now() + lead;
    let last = -Infinity;
    let raf = 0;
    const frame = (now: number) => {
      if (now - last >= 50) {
        last = now;
        const t = now - start;
        let pending = false;
        cells.forEach((cell, i) => {
          if (cell.dataset.on !== undefined) return;
          if (t >= SETTLE_START + i * SETTLE_STEP) return settle(cell);
          pending = true;
          if (cell.firstChild && !isPunct(cell.dataset.c ?? '')) {
            cell.firstChild.nodeValue = LOOKALIKES[Math.floor(Math.random() * LOOKALIKES.length)];
          }
        });
        if (!pending) return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lead, reduced]);

  const glyphs = (chars: string[]) =>
    chars.map((ch, i) => (
      <span key={i} data-c={ch} data-punct={isPunct(ch) ? '' : undefined} className="glyph">
        {ch}
      </span>
    ));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
    >
      <p className="specimen-domain pt-[2.4rem]" style={{ '--len': length } as CSSProperties}>
        <span ref={line} className="relative inline-block">
          {segments.map(({ chars, marked, offset }) =>
            marked ? (
              <motion.span
                key={offset}
                data-mark=""
                className="relative isolate inline-block"
                initial={{ color: '#f1f3f9' }}
                animate={{ color: '#0a1330' }}
                transition={{ delay: reduced ? 0 : litAt(offset) + 0.05, duration: 0.2 }}
              >
                <motion.span
                  aria-hidden
                  className="absolute inset-x-[-0.06em] inset-y-[0.06em] -z-10 origin-left rounded-[0.1em] bg-accent"
                  initial={{ scaleX: reduced ? 1 : 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: litAt(offset), duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                />
                {glyphs(chars)}
                <motion.span
                  className="annot"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduced ? 0 : litAt(offset) + 0.3, type: 'spring', stiffness: 380, damping: 26 }}
                >
                  {sample.looksLike}
                </motion.span>
              </motion.span>
            ) : (
              <span key={offset}>{glyphs(chars)}</span>
            ),
          )}
          {!reduced && (
            <motion.span
              className="beam"
              initial={{ left: '0%', opacity: 0 }}
              animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
              transition={{
                left: { delay: scanAt, duration: SCAN / 1000, ease: [0.45, 0, 0.55, 1] },
                opacity: { delay: scanAt, duration: SCAN / 1000, times: [0, 0.06, 0.9, 1] },
              }}
            />
          )}
        </span>
      </p>
      <motion.p
        className="mt-4 max-w-[40ch] text-[17px] leading-snug text-[#f1f3f9]/80 sm:text-[19px]"
        initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: reduced ? 0 : scanAt + SCAN / 1000 - 0.2, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {sample.note}
      </motion.p>
    </motion.div>
  );
}

function Specimens({ reduced }: { reduced: boolean }) {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const show = (next: number) => {
    setStarted(true);
    setIndex(next);
  };

  return (
    <section
      aria-labelledby="specimen-title"
      className="relative my-auto py-8 lg:py-12"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <motion.h2
        id="specimen-title"
        className="text-[15px] text-[var(--mist)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        Detalles que delatan un fraude
      </motion.h2>
      {/* Para lectores de pantalla, los cuatro ejemplos sin animación. */}
      <ul className="sr-only">
        {SAMPLES.map((sample) => (
          <li key={sample.note}>
            {defang(sample.parts.map(([text]) => text).join(''))}. {sample.note}
          </li>
        ))}
      </ul>

      <div aria-hidden className="specimen-box flex min-h-[10rem] flex-col sm:min-h-[11.5rem] lg:min-h-[12.5rem]">
        <AnimatePresence mode="wait">
          <Specimen key={index} sample={SAMPLES[index]} lead={started ? 0 : FIRST_LEAD} reduced={reduced} />
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center gap-1" data-paused={paused || undefined}>
        {SAMPLES.map((sample, i) => (
          <button
            key={sample.note}
            type="button"
            onClick={() => show(i)}
            aria-label={`Ver ejemplo ${i + 1} de ${SAMPLES.length}`}
            aria-current={i === index || undefined}
            className="group grid h-8 w-12 place-items-center rounded-sm outline-none focus-visible:outline-3 focus-visible:outline-accent"
          >
            <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/15 transition-colors duration-200 group-hover:bg-white/30">
              {i < index && <span className="absolute inset-0 bg-white/55" />}
              {i === index && (
                <span
                  key={index}
                  className="progress-fill absolute inset-0 bg-accent"
                  style={{ '--d': `${DURATION}ms` } as CSSProperties}
                  onAnimationEnd={() => show((index + 1) % SAMPLES.length)}
                />
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Caja del escenario; también la usa el hueco que se pinta antes de hidratar. */
export const STAGE_CLASS =
  "stage relative isolate flex min-h-[25rem] flex-col overflow-hidden px-5 pt-5 pb-6 sm:px-10 sm:pt-8 sm:pb-8 lg:sticky lg:top-0 lg:h-dvh lg:px-14 lg:pt-10 lg:pb-12";

export function InspectionStage() {
  const reduced = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLens(stage, lens, inner, reduced);

  return (
    <div
      ref={stage}
      className={STAGE_CLASS}
    >
      <div aria-hidden className="stage-field absolute inset-0 -z-10">
        <DomainField />
      </div>
      <div aria-hidden className="stage-vignette absolute inset-0 -z-10" />
      <div ref={lens} aria-hidden className="lens -z-10">
        <div ref={inner} className="lens-inner">
          <DomainField lens />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-3">
          <DrawnMark />
          <motion.span
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-[19px] font-bold tracking-[-0.01em]">ZeroScam</span>
            <span className="hidden border-l border-white/20 pl-3 text-[15px] text-[#f1f3f9]/70 sm:block">Panel de revisión</span>
          </motion.span>
        </p>
        <motion.p
          className="flex items-center gap-2 text-[14px] text-[var(--mist)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <Lock aria-hidden className="size-4" />
          Acceso restringido
        </motion.p>
      </div>

      <Specimens reduced={reduced} />

      <p className="hidden max-w-[56ch] text-[14px] leading-relaxed text-[var(--mist)] lg:block">
        Uso exclusivo del personal autorizado.
      </p>
    </div>
  );
}
