import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';
import { Sparkles, XCircle, CheckCircle, Info } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  const icons = {
    success: <CheckCircle size={20} className="text-green-500" />,
    error: <XCircle size={20} className="text-red-500" />,
    info: <Info size={20} className="text-blue-500" />,
    sweet: <Sparkles size={20} className="text-brand" />,
  };

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="pointer-events-auto fluid-glass p-4 px-6 rounded-full flex items-center gap-4 shadow-layer-2 min-w-[280px]"
          >
            <div className="flex-shrink-0">{icons[toast.type]}</div>
            <p className="font-black text-sm text-brand-dark flex-1">{toast.message}</p>
            <button 
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-brand/10 rounded-full transition-colors opacity-40 hover:opacity-100"
            >
              <XCircle size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
