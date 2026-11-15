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
  const go = useCallback((to) => {
    if (read() === to) return;
    location.hash = to;
    history.replaceState({ inApp: true }, ''); // mark: this page was reached from inside the app
  }, []);
  return [path, go];
}

/** Back to wherever you came from; if the page was opened directly (a link, the home-screen icon), go to `fallback`. */
export function goBack(fallback = '/') {
  if (history.state?.inApp) history.back();
  else location.hash = fallback;
}
