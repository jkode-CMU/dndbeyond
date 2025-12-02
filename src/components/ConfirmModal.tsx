import { useEffect, useRef } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  confirmStyle = 'danger',
}: {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmStyle?: 'danger' | 'primary';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement as HTMLElement | null;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => {
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [];
      return Array.from(nodes).filter((n) => !n.hasAttribute('disabled'));
    };

    // Focus the first focusable element in the modal
    const focusable = getFocusable();
    if (focusable.length) {
      focusable[0].focus();
    }

    const handleKey = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Enter to confirm unless focus is in a textarea
      if (e.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        if (active && active.tagName.toLowerCase() === 'textarea') return;
        e.preventDefault();
        onConfirm();
        return;
      }

      // Simple focus trap on Tab
      if (e.key === 'Tab') {
        const focusableEls = getFocusable();
        if (focusableEls.length === 0) return;

        const index = focusableEls.indexOf(document.activeElement as HTMLElement);
        let nextIndex = index;
        if (e.shiftKey) {
          nextIndex = (index - 1 + focusableEls.length) % focusableEls.length;
        } else {
          nextIndex = (index + 1) % focusableEls.length;
        }
        e.preventDefault();
        focusableEls[nextIndex].focus();
      }
    };

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      // restore focus
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      aria-hidden={!open}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
      >
        <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title || 'Confirm'}</h3>
        <p id="confirm-modal-desc" className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message || 'Are you sure?'}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:opacity-90"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded hover:opacity-90 ${
              confirmStyle === 'danger' ? 'bg-red-600' : 'bg-primary'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
