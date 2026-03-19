export type Platform = 'amazon' | 'etsy' | 'tiktok';

export interface Product {
  id: string;
  name: string;
  price: number;
  revenue: number;       // estimated monthly revenue (USD)
  reviews: number;       // total review count (0 = digital download)
  score: number;         // opportunity score 0-100
  insight: string;       // 1-line actionable insight
  bestFor: Platform[];   // platforms this product is suited for

  // Extended fields (reserved for future data layer)
  category?: string;
  platform?: Platform;
  bsr?: number;          // Amazon Best Seller Rank
  rating?: number;
  monthlySales?: number;
  lastUpdated?: string;
  history_90d?: Array<{
    date: string;
    price: number;
    rank: number;
    sales: number;
  }>;
}

export interface UserRecord {
  uid: string;
  email: string;
  isPaid: boolean;
  activatedAt?: Date;
  cancelledAt?: Date;
}

export interface PendingUser {
  email: string;
  isPaid: boolean;
  event: string;
  activatedAt?: Date;
  lsOrderId?: string | null;
  status?: string;
}