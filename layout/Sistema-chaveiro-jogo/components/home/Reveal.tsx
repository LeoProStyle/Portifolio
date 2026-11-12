'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

// Fades its content in when it scrolls into view. Server markup carries no data-visible,
// so the content is visible without JavaScript; the CSS lives in app/globals.css (.reveal).
export default function Reveal({ children, className = '', id }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    node.dataset.visible = 'false';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.dataset.visible = 'true';
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
