import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

type DialogVariant = 'danger' | 'warning' | 'info' | 'primary' | 'success';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  required?: boolean;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within DialogProvider');
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<'confirm' | 'prompt'>('confirm');
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [resolve, setResolve] = useState<((val: any) => void) | null>(null);
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((res) => {
      setType('confirm');
      setOptions(opts);
      setResolve(() => res);
      setIsOpen(true);
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((res) => {
      setType('prompt');
      setOptions(opts);
      setInputValue('');
      setResolve(() => res);
      setIsOpen(true);
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (resolve) {
      if (type === 'confirm') resolve(false);
      else resolve(null);
    }
    setResolve(null);
  }, [resolve, type]);

  const handleConfirm = useCallback(() => {
    if (type === 'prompt' && options?.required && !inputValue.trim()) return;
    setIsOpen(false);
    if (resolve) {
      if (type === 'confirm') resolve(true);
      else resolve(inputValue.trim());
    }
    setResolve(null);
  }, [resolve, type, inputValue, options]);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn" onClick={handleClose}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl animate-scaleIn overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  options.variant === 'danger' ? 'bg-red-50 text-red-600' :
                  options.variant === 'warning' ? 'bg-amber-50 text-amber-600' :
                  options.variant === 'success' ? 'bg-emerald-50 text-emerald-600' :
                  options.variant === 'info' ? 'bg-blue-50 text-blue-600' :
                  'bg-primary-50 text-primary-600'
                }`}>
                  {options.variant === 'danger' ? <AlertTriangle size={20} /> :
                   options.variant === 'warning' ? <AlertCircle size={20} /> :
                   options.variant === 'success' ? <CheckCircle size={20} /> :
                   <Info size={20} />}
                </div>
                <div className="flex-1 mt-1">
                  <h3 className="text-lg font-bold text-gray-900">{options.title}</h3>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">{options.message}</p>
                </div>
              </div>

              {type === 'prompt' && (
                <div className="mt-5">
                  <input
                    type="text"
                    autoFocus
                    className="input w-full"
                    placeholder={options.placeholder || 'Enter value...'}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleConfirm();
                      if (e.key === 'Escape') handleClose();
                    }}
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50/50 px-6 py-4 border-t flex gap-3">
              <button className="btn btn-outline flex-1" onClick={handleClose}>
                {options.cancelText || 'Cancel'}
              </button>
              <button 
                className={`btn flex-1 ${options.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                onClick={handleConfirm}
                disabled={type === 'prompt' && options.required && !inputValue.trim()}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
