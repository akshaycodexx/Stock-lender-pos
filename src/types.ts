export type UserRole = 'admin' | 'manager' | 'cashier';

export type BillTemplateStyle = 'classic' | 'modern' | 'thermal';
export type BarcodeTemplateStyle = 'standard' | 'compact' | 'detailed';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  item_count?: number;
  created_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  tagline: string;
  gst_number: string;
  address: string;
  phone: string;
  email: string;
  currency_symbol: string;
  invoice_footer: string;
  logo_data: string;
  bill_template: BillTemplateStyle;
  bill_accent_color: string;
  bill_show_gst: number;
  bill_show_mrp: number;
  barcode_template: BarcodeTemplateStyle;
  barcode_show_company: number;
  barcode_show_mrp: number;
  barcode_height: number;
  updated_at: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  mrp: number;
  selling_price: number;
  buying_price: number | null;
  tax_rate: number;
  stock_qty: number;
  low_stock_threshold: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id: number;
  bill_id: number;
  item_id: number;
  item_name: string;
  barcode: string;
  qty: number;
  mrp: number;
  unit_price: number;
  buying_price: number | null;
  tax_rate: number;
  line_total: number;
}

export interface Bill {
  id: number;
  bill_number: string;
  customer_name: string;
  customer_phone: string;
  payment_method: 'Cash' | 'UPI' | 'Card';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  total_cost: number | null;
  created_by_id: number;
  created_by_name: string;
  created_at: string;
  items?: BillItem[];
}

export interface StockLog {
  id: number;
  item_id: number;
  item_name: string;
  change_qty: number;
  previous_qty: number;
  new_qty: number;
  reason: string;
  user_name: string;
  created_at: string;
}

export interface DailySalesPoint {
  date: string;
  bills_count: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
}

export interface DashboardSummary {
  total_skus: number;
  total_stock_units: number;
  inventory_selling_value: number;
  inventory_buying_value: number | null;
  low_stock_count: number;
  out_of_stock_count: number;
  today_revenue: number;
  today_bills_count: number;
  today_profit: number | null;
  today_units_sold: number;
  daily_series: DailySalesPoint[];
  low_stock_items: InventoryItem[];
  recent_bills: Bill[];
}
