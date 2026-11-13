/** Formatos que trafegam entre API e telas (JSON). */

export interface ProductDTO {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  emoji: string;
  active: boolean;
  sortOrder: number;
}

export interface RegisterItemDTO {
  productId: string;
  name: string;
  category: string;
  emoji: string;
  priceCents: number;
  qty: number;
}

export interface RegisterDTO {
  date: string;
  status: "open" | "closed";
  items: RegisterItemDTO[];
  totalCents: number;
  totalItems: number;
  notes: string;
  closedAt: string | null;
}

export interface SaidaResponse {
  today: string;
  register: RegisterDTO;
  products: ProductDTO[];
  /** Dias anteriores que ficaram abertos (esqueceram de fechar). */
  pendingDates: string[];
}

export interface StatsDay {
  date: string;
  status: "open" | "closed" | "empty";
  totalCents: number;
  totalItems: number;
  notes: string;
  items: RegisterItemDTO[];
}

export interface StatsProduct {
  productId: string;
  name: string;
  emoji: string;
  category: string;
  qty: number;
  totalCents: number;
}

export interface StatsResponse {
  from: string;
  to: string;
  totals: { totalCents: number; totalItems: number; activeDays: number; avgPerDayCents: number };
  previous: { totalCents: number; totalItems: number };
  days: StatsDay[];
  products: StatsProduct[];
  categories: { category: string; qty: number; totalCents: number }[];
}
