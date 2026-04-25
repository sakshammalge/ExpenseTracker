import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, Receipt,
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { MonthlySummary, Category } from '../types'

const COLORS = ['#6366f1','#f97316','#22c55e','#a855f7','#0ea5e9','#ec4899','#eab308','#f43f5e','#10b981','#64748b']

interface CategoryBreakdown {
  category: Category
  total: number
  percentage: number
  prevTotal: number
}

function MetricCard({ title, value, sub, trend, color, icon: Icon }: {
  title: string; value: string; sub?: string; trend?: number; color: string; icon: React.ElementType
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtCurrency(p.value)}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summaries, setSummaries] = useState<MonthlySummary[]>([])
  const [categories, setCategories] = useState<CategoryBreakdown[]>([])
  const [recentExpenses, setRecentExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Build 6-month summaries
    const months: MonthlySummary[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')

      const [{ data: expData }, { data: incData }] = await Promise.all([
        supabase.from('expenses').select('amount,source').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('income').select('amount').eq('user_id', user.id).eq('month', m).eq('year', y),
      ])

      const totalIncome = (incData ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const totalExpenses = (expData ?? []).filter((e: any) => e.source !== 'investment').reduce((s: number, r: any) => s + Number(r.amount), 0)
      const totalInvestments = (expData ?? []).filter((e: any) => e.source === 'investment').reduce((s: number, r: any) => s + Number(r.amount), 0)

      months.push({
        month: m, year: y,
        label: format(d, 'MMM yy'),
        totalIncome, totalExpenses, totalInvestments,
        savings: totalIncome - totalExpenses - totalInvestments,
      })
    }
    setSummaries(months)

    // Category breakdown for current month
    const start = format(startOfMonth(now), 'yyyy-MM-dd')
    const end = format(endOfMonth(now), 'yyyy-MM-dd')
    const startPrev = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
    const endPrev = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')

    const [{ data: catData }, { data: expCur }, { data: expPrev }, { data: recent }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id),
      supabase.from('expenses').select('category_id,amount').eq('user_id', user.id).gte('date', start).lte('date', end).neq('source', 'investment'),
      supabase.from('expenses').select('category_id,amount').eq('user_id', user.id).gte('date', startPrev).lte('date', endPrev).neq('source', 'investment'),
      supabase.from('expenses').select('*, categories(name,icon,color)').eq('user_id', user.id).order('date', { ascending: false }).limit(6),
    ])

    const totalCur = (expCur ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const catMap = new Map<string, number>()
    const prevMap = new Map<string, number>()
    ;(expCur ?? []).forEach((e: any) => catMap.set(e.category_id, (catMap.get(e.category_id) ?? 0) + Number(e.amount)))
    ;(expPrev ?? []).forEach((e: any) => prevMap.set(e.category_id, (prevMap.get(e.category_id) ?? 0) + Number(e.amount)))

    const breakdown: CategoryBreakdown[] = (catData ?? [])
      .filter((c: any) => catMap.has(c.id))
      .map((c: any) => ({
        category: c,
        total: catMap.get(c.id) ?? 0,
        percentage: totalCur > 0 ? ((catMap.get(c.id) ?? 0) / totalCur) * 100 : 0,
        prevTotal: prevMap.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    setCategories(breakdown)
    setRecentExpenses(recent ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const current = summaries[summaries.length - 1]
  const prev = summaries[summaries.length - 2]

  const expTrend = prev && prev.totalExpenses > 0
    ? ((current?.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100 : undefined
  const savTrend = prev && prev.savings > 0
    ? ((current?.savings - prev.savings) / prev.savings) * 100 : undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{format(now, 'MMMM yyyy')} overview</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Monthly Income"
          value={fmtCurrency(current?.totalIncome ?? 0)}
          color="bg-green-500"
          icon={Wallet}
        />
        <MetricCard
          title="Total Expenses"
          value={fmtCurrency(current?.totalExpenses ?? 0)}
          trend={expTrend !== undefined ? -expTrend : undefined}
          sub="excl. investments"
          color="bg-red-500"
          icon={Receipt}
        />
        <MetricCard
          title="Investments"
          value={fmtCurrency(current?.totalInvestments ?? 0)}
          color="bg-indigo-500"
          icon={TrendingUp}
        />
        <MetricCard
          title="Net Savings"
          value={fmtCurrency(current?.savings ?? 0)}
          trend={savTrend}
          color="bg-violet-500"
          icon={PiggyBank}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly trend */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Overview (6 months)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summaries} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="totalIncome" name="Income" fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="totalExpenses" name="Expenses" fill="#f97316" radius={[4,4,0,0]} />
              <Bar dataKey="totalInvestments" name="Investments" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category</h2>
          {categories.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No expenses this month</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="total"
                  nameKey="category.name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                >
                  {categories.map((entry, index) => (
                    <Cell key={entry.category.id} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Savings trend + Category table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Savings line */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Savings Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={summaries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="savings" name="Savings" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top categories */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Categories</h2>
          <div className="space-y-3">
            {categories.slice(0, 5).map((c, i) => {
              const change = c.prevTotal > 0 ? ((c.total - c.prevTotal) / c.prevTotal) * 100 : 0
              return (
                <div key={c.category.id} className="flex items-center gap-3">
                  <span className="text-base">{c.category.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 truncate">{c.category.name}</span>
                      <span className="text-xs font-semibold text-gray-900 ml-1">{fmtCurrency(c.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${c.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                  <div className={`text-xs font-medium flex items-center ${change >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {change >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {Math.abs(change).toFixed(0)}%
                  </div>
                </div>
              )
            })}
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No expenses yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Expenses</h2>
        {recentExpenses.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No expenses recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Description</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Category</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Date</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 font-medium text-gray-800">{e.description}</td>
                    <td className="py-2.5 text-gray-500">
                      {e.categories ? (
                        <span className="flex items-center gap-1">
                          <span>{e.categories.icon}</span>
                          {e.categories.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 text-gray-400">{format(new Date(e.date), 'MMM d')}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900">{fmtCurrency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
