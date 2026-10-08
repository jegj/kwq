export interface MonthNav {
  month: string;
  label: string;
  prev: string;
  next: string | null;
}

export interface CategorySlice {
  name: string;
  color: string;
  amount: number;
}

export interface TransactionItem {
  id: string;
  merchant: string;
  categoryName: string | null;
  color: string;
  amount: number;
  date: string;
}

export interface MerchantTotal {
  merchant: string;
  amount: number;
  count: number;
}

export interface CurrencySummary {
  currency: string;
  total: number;
  count: number;
  average: number;
  delta: number | null;
  categories: CategorySlice[];
  topCategory: string | null;
  daily: number[];
  recent: TransactionItem[];
  biggest: TransactionItem[];
  topMerchants: MerchantTotal[];
  uncategorized: number;
}
