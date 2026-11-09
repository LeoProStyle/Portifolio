import { useEffect, useState } from 'react';

// Same string as tailwind `wide:` and the bezel media rule in app/globals.css (0002F SF04, design.md D3).
export const WIDE_MEDIA_QUERY = '(min-width: 1024px) and (pointer: fine)';

// False on the server and on the first client render, so markup matches before hydration.
export default function useWideScreen(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(WIDE_MEDIA_QUERY);
    setWide(media.matches);
    const handleChange = (event: MediaQueryListEvent) => setWide(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return wide;
}
