'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useAnimate, useReducedMotion, type Variants } from 'motion/react';
import { OTPInput, type SlotProps } from 'input-otp';
import { ArrowBigUp, ArrowLeft, Check, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { errorMessage, login, verifyCode, type TwoFactorChallenge } from '@/lib/api';
import { cn } from '@/lib/utils';
import { InspectionStage, STAGE_CLASS } from './inspection-stage';
import './login.css';

/** Lo que dura el código de verificación, igual que en el servidor. */
const CODE_TTL_SECONDS = 5 * 60;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Cada paso entra en cascada y sale hacia el lado contrario del que llega el siguiente.
const stepVariants: Variants = {
  hidden: (direction: number) => ({ opacity: 0, x: 28 * direction }),
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT, staggerChildren: 0.06, delayChildren: 0.08 } },
  exit: (direction: number) => ({
    opacity: 0,
    x: -28 * direction,
    filter: 'blur(6px)',
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  }),
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE_OUT } },
};

const control =
  'h-[52px] w-full rounded-[10px] border border-(color:--field) bg-surface px-4 text-[17px] text-ink transition-[border-color,box-shadow] duration-200 ease-out outline-none placeholder:text-muted hover:border-ink-2 focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_var(--accent)] focus-visible:outline-none';

const noSubscribe = () => () => {};

/**
 * `false` en el HTML del servidor y `true` ya en el navegador. Las animaciones
 * de motion escriben su estado inicial como `style=""` en el HTML del servidor,
 * y el CSP (sin `unsafe-inline`) bloquea esos atributos. En el navegador motion
 * usa CSSOM, que sí está permitido; por eso esas partes se pintan hasta hidratar.
 */
function useHydrated() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

export default function LoginPage() {
  const hydrated = useHydrated();
  return (
    <div className="login-page grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.3fr)_minmax(30rem,1fr)]">
      {hydrated ? <InspectionStage /> : <div aria-hidden className={STAGE_CLASS} />}

      <main className="relative z-10 flex flex-col px-5 pt-10 pb-8 sm:px-10 lg:min-h-dvh lg:px-14 lg:pt-12 xl:px-20 lg:shadow-[-40px_0_90px_-50px_rgb(5_11_34/0.6)] dark:lg:border-l dark:lg:border-white/8">
        <div className="my-auto w-full max-w-[25rem] py-4 lg:py-10">
          {hydrated ? <LoginPanel /> : <div className="min-h-[30rem]" />}
        </div>

        <p className="mt-10 max-w-[56ch] border-t border-line pt-6 text-sm text-ink-2 lg:hidden">
          Uso exclusivo del personal autorizado.
        </p>
      </main>
    </div>
  );
}

function LoginPanel() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();

  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [granted, setGranted] = useState(false);
  // Con verificación en dos pasos el login regresa un desafío en vez de tokens.
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState('');
  // 1: hacia el código; -1: de regreso al correo y la contraseña.
  const [direction, setDirection] = useState(1);

  /** Un "no" con la cabeza: el formulario tiembla cuando algo falla. */
  function shake() {
    if (reduced || !scope.current) return;
    void animate(scope.current, { x: [0, -10, 9, -6, 4, -2, 0] }, { duration: 0.45, ease: 'easeOut' });
  }

  function fail(message: string) {
    setError(message);
    shake();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setSending(true);
    try {
      const pending = await login(String(form.get('email')), String(form.get('password')));
      if (pending) {
        setDirection(1);
        setChallenge(pending);
        setSending(false);
        return;
      }
      setSending(false);
      setGranted(true);
      router.replace('/');
    } catch (e) {
      setSending(false);
      fail(errorMessage(e));
    }
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || code.length < 6) return;
    setError('');
    setSending(true);
    try {
      await verifyCode(challenge.challengeId, code);
      setSending(false);
      setGranted(true);
      router.replace('/');
    } catch (e) {
      setCode('');
      setSending(false);
      fail(errorMessage(e));
    }
  }

  function backToPassword() {
    setDirection(-1);
    setChallenge(null);
    setCode('');
    setError('');
  }

  const buttonState = granted ? 'done' : sending ? 'loading' : 'idle';

  return (
    <div ref={scope}>
      <AnimatePresence mode="wait" custom={direction}>
        {challenge ? (
          <CodeStep
            key={challenge.challengeId}
            destination={challenge.destination}
            code={code}
            onCode={setCode}
            onSubmit={handleCode}
            onBack={backToPassword}
            error={error}
            state={buttonState}
          />
        ) : (
          <motion.form
            key="password"
            custom={direction}
            variants={stepVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onSubmit={handleSubmit}
            aria-labelledby="login-title"
          >
            <motion.div variants={itemVariants}>
              <h1 id="login-title" className="text-[2.25rem] leading-[1.05] font-bold tracking-[-0.025em] sm:text-[2.625rem]">
                Iniciar sesión
              </h1>
              <p className="mt-3 text-[17px] text-ink-2">Acceso para Administración, Owner y Policía Cibernética.</p>
            </motion.div>

            <Alert error={error} />

            <motion.div variants={itemVariants} className="mt-8">
              <EmailField />
            </motion.div>

            <motion.div variants={itemVariants} className="mt-5">
              <PasswordField />
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8">
              <SubmitButton state={buttonState}>Iniciar sesión</SubmitButton>
            </motion.div>

            <motion.p variants={itemVariants} className="mt-10 border-t border-line pt-6 text-[15px] text-ink-2">
              ¿No puedes entrar? Pide a quien administra las cuentas del panel que revise tu acceso.
            </motion.p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Aviso que se abre en su lugar: empuja lo de abajo en vez de aparecer de golpe. */
function Alert({ error }: { error: string }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.div
          key={error}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <p role="alert" className="mt-6 flex gap-2.5 rounded-[10px] bg-danger-wash px-4 py-3 text-[15px] leading-snug text-danger">
            <CircleAlert aria-hidden className="mt-px size-[18px] shrink-0" />
            {error}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmailField() {
  const [valid, setValid] = useState(false);
  return (
    <div className="grid gap-2">
      <label htmlFor="email" className="text-[15px] font-semibold text-ink">
        Correo electrónico
      </label>
      <span className="relative block">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          autoFocus
          onChange={(event) => setValid(event.currentTarget.value.includes('@') && event.currentTarget.validity.valid)}
          className={cn(control, 'pr-12')}
        />
        <AnimatePresence>
          {valid && (
            <motion.span
              aria-hidden
              className="absolute top-1/2 right-4 -mt-2.5 text-ok"
              initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            >
              <CircleCheck className="size-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

function PasswordField() {
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'));

  return (
    <div className="grid gap-2">
      <label htmlFor="password" className="text-[15px] font-semibold text-ink">
        Contraseña
      </label>
      <span className="relative block">
        <input
          id="password"
          name="password"
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          required
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCapsLock(false)}
          className={cn(control, 'pr-14')}
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-pressed={shown}
          aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-2 transition-colors duration-150 outline-none hover:bg-sunk hover:text-ink focus-visible:outline-3 focus-visible:outline-accent"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={shown ? 'off' : 'on'}
              initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
              transition={{ type: 'spring', stiffness: 600, damping: 30 }}
              className="grid"
            >
              {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </span>
      <AnimatePresence initial={false}>
        {capsLock && (
          <motion.p
            role="status"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <span className="flex items-center gap-1.5 pt-0.5 text-[14px] font-semibold text-accent-ink">
              <ArrowBigUp aria-hidden className="size-4" />
              Bloq Mayús está activado
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

type ButtonState = 'idle' | 'loading' | 'done';

/** Botón principal: la etiqueta cambia en su lugar mientras se verifica y al entrar. */
function SubmitButton({ state, disabled, children }: { state: ButtonState; disabled?: boolean; children: ReactNode }) {
  const busy = state !== 'idle';
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      aria-busy={state === 'loading' || undefined}
      className={cn(
        'group relative flex h-[54px] w-full items-center justify-center overflow-hidden rounded-[10px] text-[17px] font-semibold transition-[transform,box-shadow,background-color,color] duration-150 ease-out select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:cursor-not-allowed',
        state === 'done'
          ? 'bg-ok text-white shadow-[0_3px_0_rgb(0_0_0/0.25)] dark:text-bg'
          : 'bg-accent text-on-accent shadow-[0_3px_0_var(--accent-ink)] enabled:hover:brightness-[1.03]',
        disabled && !busy && 'opacity-50',
      )}
    >
      <span aria-hidden className="sheen" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ y: 22, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -22, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className="relative inline-flex items-center gap-2 [&_svg]:size-[18px]"
        >
          {state === 'loading' ? (
            <>
              <LoaderCircle aria-hidden className="spinner" />
              Verificando
            </>
          ) : state === 'done' ? (
            <>
              <Check aria-hidden strokeWidth={3} />
              Acceso concedido
            </>
          ) : (
            children
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** Segundos que le quedan al código desde que llegó el desafío. Solo se muestra: no bloquea nada. */
function useCountdown(total: number) {
  const [left, setLeft] = useState(total);
  useEffect(() => {
    const deadline = Date.now() + total * 1000;
    const id = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(seconds);
      if (seconds === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [total]);
  return left;
}

function CodeStep({
  destination,
  code,
  onCode,
  onSubmit,
  onBack,
  error,
  state,
}: {
  destination: string;
  code: string;
  onCode: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  error: string;
  state: ButtonState;
}) {
  const form = useRef<HTMLFormElement>(null);
  const left = useCountdown(CODE_TTL_SECONDS);
  const expired = left === 0;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  // Anillo del tiempo: circunferencia de un círculo de radio 7.
  const ring = 2 * Math.PI * 7;

  return (
    <motion.form
      ref={form}
      custom={1}
      variants={stepVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      onSubmit={onSubmit}
      aria-labelledby="login-title"
    >
      <motion.div variants={itemVariants}>
        <button
          type="button"
          onClick={onBack}
          className="group -ml-1 mb-8 inline-flex items-center gap-1.5 rounded-sm px-1 text-[15px] font-semibold text-ink-2 transition-colors duration-150 outline-none hover:text-ink focus-visible:outline-3 focus-visible:outline-accent"
        >
          <ArrowLeft aria-hidden className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
          Usar otra cuenta
        </button>
        <h1 id="login-title" className="text-[2.25rem] leading-[1.05] font-bold tracking-[-0.025em] sm:text-[2.625rem]">
          Código de verificación
        </h1>
        <p className="mt-3 text-[17px] text-ink-2">
          Lo enviamos a <strong className="font-semibold text-ink">{destination}</strong>.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-8">
        <OTPInput
          name="code"
          maxLength={6}
          value={code}
          onChange={onCode}
          // Al completar los 6 dígitos se envía solo: no hace falta buscar el botón.
          onComplete={() => form.current?.requestSubmit()}
          autoFocus
          inputMode="numeric"
          pattern="^[0-9]*$"
          aria-label="Código de 6 dígitos"
          containerClassName="flex items-center gap-2"
          render={({ slots }) => (
            <>
              {slots.slice(0, 3).map((slot, index) => (
                <Slot key={index} {...slot} />
              ))}
              <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full bg-(--field)" />
              {slots.slice(3).map((slot, index) => (
                <Slot key={index + 3} {...slot} />
              ))}
            </>
          )}
        />
        <p
          className={cn(
            'mt-3 flex items-center gap-2 text-[15px]',
            expired ? 'font-semibold text-danger' : left <= 60 ? 'text-accent-ink' : 'text-ink-2',
          )}
        >
          <svg viewBox="0 0 18 18" aria-hidden className="size-[18px] -rotate-90">
            <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - left / CODE_TTL_SECONDS)}
              className="countdown-ring"
            />
          </svg>
          {expired ? (
            'El código venció. Usa otra cuenta para pedir uno nuevo.'
          ) : (
            <span>
              Vence en <span className="tnum font-semibold">{clock}</span>
            </span>
          )}
        </p>
      </motion.div>

      <Alert error={error} />

      <motion.div variants={itemVariants} className="mt-8">
        <SubmitButton state={state} disabled={code.length < 6}>
          Verificar e ingresar
        </SubmitButton>
      </motion.div>
    </motion.form>
  );
}

/** Casilla del código. El marco del foco viaja de una casilla a la siguiente. */
function Slot({ char, hasFakeCaret, isActive }: SlotProps) {
  return (
    <span className="relative grid h-[62px] min-w-0 flex-1 place-items-center rounded-[10px] border border-(color:--field) bg-surface font-mono text-[26px] font-semibold text-ink">
      {isActive && (
        <motion.span
          layoutId="otp-focus"
          aria-hidden
          className="absolute -inset-px rounded-[10px] border-2 border-ink shadow-[0_0_0_3px_var(--accent)]"
          transition={{ type: 'spring', stiffness: 550, damping: 38 }}
        />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        {char && (
          <motion.span
            key={char}
            className="relative"
            initial={{ y: 12, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 600, damping: 28 }}
          >
            {char}
          </motion.span>
        )}
      </AnimatePresence>
      {hasFakeCaret && <span aria-hidden className="caret-blink absolute h-7 w-0.5 bg-ink" />}
    </span>
  );
}
