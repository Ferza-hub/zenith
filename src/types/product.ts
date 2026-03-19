export interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
  imageUrl: string;
  opportunityScore: number;
  monthlySales: number;
  monthlyRevenue: number;
  reviewCount: number;
  rating: number;
  insightLine: string;
  bsr: number;
  lastUpdated: string;
  history_90d?: Array<{date: string; price: number; rank: number; sales: number;}>;
}
