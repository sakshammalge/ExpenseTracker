// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  is_system: boolean
  created_at: string
}

export type ExpenseSource = 'manual' | 'investment' | 'subscription'

export interface Expense {
  id: string
  user_id: string
  category_id: string | null
  category?: Category
  amount: number
  description: string
  date: string
  source: ExpenseSource
  source_id: string | null
  created_at: string
  updated_at: string
}

export interface Income {
  id: string
  user_id: string
  amount: number
  source: string
  month: number
  year: number
  notes: string | null
  created_at: string
}

export type InvestmentType = 'SIP' | 'Stock' | 'MutualFund' | 'Bond' | 'FD' | 'PPF' | 'NPS' | 'Other'
export type Frequency = 'monthly' | 'quarterly' | 'yearly' | 'one-time'

export interface Investment {
  id: string
  user_id: string
  name: string
  type: InvestmentType
  amount: number
  frequency: Frequency
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  category_id: string | null
  category?: Category
  created_at: string
  updated_at: string
}

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

export interface Subscription {
  id: string
  user_id: string
  name: string
  amount: number
  billing_cycle: BillingCycle
  start_date: string
  next_billing_date: string | null
  category_id: string | null
  category?: Category
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Derived / Aggregate Types ───────────────────────────────────────────────

export interface MonthlySummary {
  month: number
  year: number
  label: string
  totalIncome: number
  totalExpenses: number       // manual + subscription
  totalInvestments: number    // investment-sourced expenses
  savings: number             // income - expenses - investments
}

export interface CategorySummary {
  category: Category
  total: number
  percentage: number
  previousTotal: number
  change: number  // percentage change vs previous month
}

export interface ForecastPoint {
  label: string
  month: number
  year: number
  savings: number
  isForecast: boolean
}
