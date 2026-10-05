export type Category = 'Monitoring' | 'Diagnostic' | 'Mobility' | 'Respiratory' | 'General';

export type ProductStatus = 'active' | 'draft' | 'archived';

export type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  shortDescription?: string;
  price: number;
  stockQuantity: number;
  brand: string;
  model: string;
  warranty: string;
  /** Key of the CSS placeholder illustration used when there is no imageUrl. */
  visual: string;
  imageUrl?: string | null;
  specifications?: Record<string, string>;
  status?: ProductStatus;
  createdAt?: string;
};

export type CartItem = { product: Product; quantity: number };

export type CategoryInfo = { name: Category; icon: string; description: string };

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
};

export type Navigate = (path: string) => void;
