import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui/Surface';

/**
 * Modal — title, × close, body, footer with Cancel + primary action.
 * Escape and backdrop close it, body scroll locks, focus moves into the dialog
 * on open and returns to the trigger on close.
 *
 * FOCUS BUG, FIXED. This effect used to depend on [open, onClose]. Every call
 * site passes an inline arrow for onClose, so its identity changed on every
 * parent render — meaning one keystroke in any field re-ran the effect, and its
 * `dialogRef.focus()` pulled focus straight back out of the input. It read like
 * a remount but nothing was remounting; the input simply lost focus after each
 * character.
 *
 * The fix is to keep onClose in a ref and key the effect on `open` alone, so
 * setup runs exactly once per opening. Anything that reads a prop inside a
 * long-lived listener has to go through a ref like this.
 */
export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Kept current without becoming an effect dependency.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    const previous = document.activeElement;
    const { overflow } = document.body.style;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current?.()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal modal--${size}`}
      >
        <header className="modal__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="card__title">{title}</h2>
            {subtitle && <p className="micro subtle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={() => onCloseRef.current?.()} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="modal__body">{children}</div>

        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="small muted">{message}</p>
    </Modal>
  );
}

export default Modal;
