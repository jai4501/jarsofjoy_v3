import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    // Force the scroll to be instant, bypassing any CSS smooth scroll rules
    const doc = document.documentElement;
    const originalStyle = doc.style.scrollBehavior;
    doc.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    doc.style.scrollBehavior = originalStyle;
  }, [location.pathname, location.search]);

  return null;
};
