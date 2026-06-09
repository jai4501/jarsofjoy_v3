import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Button3DProps {
  children: ReactNode;
  onClick?: (e?: any) => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'flat';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button3D = ({ children, onClick, className = '', variant = 'primary', disabled, type = 'button' }: Button3DProps) => {
  const variants = {
    primary: 'bg-brand text-white shadow-[0_4px_0_0_#3D1A1A] hover:shadow-[0_2px_0_0_#3D1A1A] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-[4px]',
    secondary: 'bg-white text-brand border border-brand/20 shadow-[0_4px_0_0_rgba(61,26,26,0.1)] hover:shadow-[0_2px_0_0_rgba(61,26,26,0.1)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-[4px]',
    outline: 'bg-transparent text-brand border-2 border-brand/40 hover:bg-brand/5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
    flat: 'bg-brand text-white shadow-luxury hover:bg-brand-dark active:scale-95 transition-all'
  };

  return (
    <motion.button
      type={type}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`px-8 py-4 rounded-button font-bold tracking-wide transition-all duration-200 ${variants[variant]} ${className}`}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
};

