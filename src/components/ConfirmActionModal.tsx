import React, {useState} from 'react';
import {AlertTriangle, CheckCircle2, X} from 'lucide-react';
import {ConfirmActionState} from '../types/journal';

interface ConfirmActionModalProps {
  state: ConfirmActionState | null;
  onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  state,
  onClose,
}) => {
  const [submitting, setSubmitting] = useState(false);

  if (!state || !state.isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await state.onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            {state.isDestructive ? (
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#1E3A8A] shrink-0" />
            )}
            <h3
              id="confirm-modal-title"
              className="font-editorial text-lg font-semibold text-stone-900"
            >
              {state.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
            aria-label="關閉確認視窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 text-sm text-stone-600 leading-relaxed">
          <p>{state.description}</p>
          {state.details && state.details.length > 0 && (
            <ul className="bg-[#FBF9F5] border border-stone-200 rounded-lg px-4 py-3 space-y-1.5 text-xs text-stone-700">
              {state.details.map((item, idx) => (
                <li key={idx} className="truncate">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 bg-[#F7F4EE] border-t border-stone-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              state.isDestructive
                ? 'bg-red-700 hover:bg-red-800 disabled:bg-red-400'
                : 'bg-[#1E3A8A] hover:bg-[#172554] disabled:bg-stone-400'
            }`}
          >
            {submitting ? '處理中...' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
