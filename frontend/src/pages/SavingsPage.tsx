import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { PiggyBank, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import type { ForecastPoint } from '../types'

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function linearRegression(ys: number[]) {
  const n = ys.length
  const xs = ys.map((_, i) => i)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function SavingsPage() {
  const { user } = useAuth()
  const [chartData, setChartData] = useState<ForecastPoint[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const now = new Date()
    const historicalPoints: ForecastPoint[] = []

    // Collect last 12 months of actual savings
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')

      const [{ data: expData }, { data: incData }] = await Promise.all([
        supabase.from('expenses').select('amount,source').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('income').select('amount').eq('user_id', user.id).eq('month', m).eq('year', y),
      ])

      const income = (incData ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const expenses = (expData ?? []).filter((e: any) => e.source !== 'investment').reduce((s: number, r: any) => s + Number(r.amount), 0)
      const investments = (expData ?? []).filter((e: any) => e.source === 'investment').reduce((s: number, r: any) => s + Number(r.amount), 0)
      const savings = income - expenses - investments

      historicalPoints.push({
        label: format(d, 'MMM yy'),
        month: m, year: y,
        savings,
        isForecast: false,
      })
    }

    // Compute forecast for next 6 months using linear regression
    const savingsValues = historicalPoints.map(p => p.savings)
    const nonZeroMonths = historicalPoints.filter(p => p.savings !== 0)

    const forecastPoints: ForecastPoint[] = []
    if (nonZeroMonths.length >= 2) {
      const { slope, intercept } = linearRegression(savingsValues)
      for (let i = 1; i <= 6; i++) {
        const d = addMonths(now, i)
        const projected = intercept + slope * (savingsValues.length - 1 + i)
        forecastPoints.push({
          label: format(d, 'MMM yy'),
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          savings: Math.max(projected, 0),
          isForecast: true,
        })
      }
    }

    setChartData([...historicalPoints, ...forecastPoints])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const actual = chartData.filter(p => !p.isForecast)
  const forecast = chartData.filter(p => p.isForecast)

  const totalSavings = actual.reduce((s, p) => s + (p.savings > 0 ? p.savings : 0), 0)
  const avgSavings = actual.length > 0 ? actual.reduce((s, p) => s + p.savings, 0) / actual.length : 0
  const lastMonth = actual[actual.length - 1]
  const prevMonth = actual[actual.length - 2]
  const trend = prevMonth && prevMonth.savings !== 0
    ? ((lastMonth?.savings - prevMonth.savings) / Math.abs(prevMonth.savings)) * 100 : 0

  const projectedAnnual = forecast.length > 0 ? forecast.reduce((s, p) => s + p.savings, 0) : null

  // Build dual-key dataset for recharts (actual + forecast as separate lines)
  const merged = chartData.map(p => ({
    label: p.label,
    actual: p.isForecast ? null : p.savings,
    forecast: p.isForecast ? p.savings : null,
  }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Savings & Forecast</h1>
        <p className="text-sm text-gray-500">Historical savings and AI-powered projections</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <PiggyBank className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total Saved</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtCurrency(totalSavings)}</p>
            <p className="text-xs text-gray-400">Last 12 months</p>
          </div>
        </div>

        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Avg Monthly</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtCurrency(avgSavings)}</p>
          </div>
        </div>

        <div className="card flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trend >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            {trend >= 0
              ? <TrendingUp className="w-5 h-5 text-green-600" />
              : <TrendingDown className="w-5 h-5 text-red-500" />
            }
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Month Trend</p>
            <p className={`text-xl font-bold mt-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="card flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Projected (6mo)</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {projectedAnnual !== null ? fmtCurrency(projectedAnnual) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Savings Trend & 6-Month Forecast</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-indigo-600 rounded" />
              Actual
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-violet-400 rounded border-b-2 border-dashed border-violet-400" style={{ borderStyle: 'dashed' }} />
              Forecast
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={merged}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#e2e8f0" />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Savings"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#6366f1' }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: '#a78bfa' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {actual.length < 2 && !loading && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Add at least 2 months of income + expenses data to enable savings forecasting.
          </p>
        )}
      </div>

      {/* Monthly breakdown table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Savings</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {chartData.map(p => (
                <tr key={p.label} className={`hover:bg-gray-50 ${p.isForecast ? 'opacity-70' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.label}</td>
                  <td className={`px-4 py-3 text-right font-bold ${p.savings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtCurrency(p.savings)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.isForecast ? (
                      <span className="badge bg-violet-100 text-violet-700">Projected</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-700">Actual</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
