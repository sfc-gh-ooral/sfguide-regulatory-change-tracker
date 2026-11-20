'use client';

import { useEffect, useState } from 'react';

/** Load async data and reload when deps change. With keep, the previous data stays on screen while reloading. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], keep = false) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => (keep ? { ...s, loading: true } : { loading: true }));
    fn().then((data) => live && setState({ data, loading: false }), (e) => live && setState({ error: String(e?.message ?? e), loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
