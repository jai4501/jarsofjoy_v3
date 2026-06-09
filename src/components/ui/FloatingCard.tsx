import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FloatingCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export const FloatingCard = ({ children, className = '', delay = 0 }: FloatingCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ 
        duration: 0.8,
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
      className={`bg-white rounded-luxury p-6 shadow-soft border border-brand/5 ${className}`}
    >
      {children}
    </motion.div>
  );
};
