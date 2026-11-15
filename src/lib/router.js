import { useEffect, useState, useCallback } from 'react';

const read = () => (location.hash.replace(/^#/, '') || '/');

/** Tiny hash router: returns [path, go]. Paths: "/", "/p/<id>", "/mine", "/santa", "/me", "/admin" */
export function useRoute() {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((to) => { if (read() !== to) location.hash = to; }, []);
  return [path, go];
}
