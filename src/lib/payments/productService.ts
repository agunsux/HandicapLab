import { supabase } from '../supabase.server';
import { Product } from './core/types';

export class ProductService {
  static async getProductBySlug(slug: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      console.error(`[ProductService] Failed to load product by slug ${slug}:`, error);
      return null;
    }
    return data as Product;
  }

  static async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error(`[ProductService] Failed to load product by ID ${id}:`, error);
      return null;
    }
    return data as Product;
  }
}
