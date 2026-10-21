'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from './button';

/** Confirmación de algo que no se deshace solo (suspender, cambiar rol). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="backdrop fixed inset-0 z-50 bg-[#050a1c]/50" />
        <AlertDialog.Popup className="modal fixed top-1/2 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-pop outline-none">
          <AlertDialog.Title className="text-base font-semibold tracking-[-0.01em]">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-ink-2">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close render={<Button variant="ghost" />}>Cancelar</AlertDialog.Close>
            <AlertDialog.Close
              render={<Button variant={tone === 'danger' ? 'danger' : 'primary'} />}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
