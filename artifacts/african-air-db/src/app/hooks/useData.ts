import { useEffect, useState } from "react";

export function useAsync<T>(fetchFn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchFn()
      .then(d => {
        if (active) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      })
      .catch(e => { if (active) { setError(e); setLoading(false); } });
    return () => { active = false; };
  }, deps);

  return { data, loading, error };
}
