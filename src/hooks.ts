import { useEffect, useState } from 'react';
import { getProduct, listProducts } from './services/productService';
import type { Product } from './types';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

export function useProducts(): AsyncState<Product[]> {
  const [state, setState] = useState<AsyncState<Product[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    let active = true;
    listProducts()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((e: Error) => active && setState({ data: [], loading: false, error: e.message }));
    return () => { active = false; };
  }, []);
  return state;
}

export function useProduct(id: string): AsyncState<Product | null> {
  const [state, setState] = useState<AsyncState<Product | null>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });
    getProduct(id)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((e: Error) => active && setState({ data: null, loading: false, error: e.message }));
    return () => { active = false; };
  }, [id]);
  return state;
}
