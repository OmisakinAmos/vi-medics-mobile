import { mockProducts } from '../data/products';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Category, Product, ProductStatus } from '../types';

type ProductRow = {
  id: string;
  name: string;
  category: Category;
  description: string;
  short_description: string | null;
  price: number | string;
  stock_quantity: number;
  brand: string;
  model: string;
  warranty: string;
  visual: string;
  image_url: string | null;
  specifications: Record<string, string> | null;
  status: ProductStatus;
  created_at: string;
};

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  description: row.description,
  shortDescription: row.short_description ?? undefined,
  price: Number(row.price),
  stockQuantity: row.stock_quantity,
  brand: row.brand,
  model: row.model,
  warranty: row.warranty,
  visual: row.visual,
  imageUrl: row.image_url,
  specifications: row.specifications ?? undefined,
  status: row.status,
  createdAt: row.created_at,
});

/** Lists purchasable products. Uses Supabase when configured, mock data otherwise. */
export async function listProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return mockProducts;
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ProductRow[]).map(toProduct);
}

/** Returns one product, or null when it does not exist. */
export async function getProduct(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) return mockProducts.find((p) => p.id === id) ?? null;
  const { data, error } = await supabase.from('products').select('*').eq('id', id).eq('status', 'active').maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProduct(data as ProductRow) : null;
}
