import { supabase } from './supabase'
import { addMonths, addYears, format, isBefore, parseISO } from 'date-fns'
import type { Investment, Subscription } from '../types'

type ExistingExpenseRow = { date: string }

/**
 * For each active investment, generate expense rows for every billing period
 * between start_date and today that doesn't already have a record.
 */
export async function syncInvestmentExpenses(userId: string): Promise<void> {
  const { data: investments, error } = await supabase
    .from('investments')
    .select<Investment>('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !investments?.length) return

  const today = new Date()

  for (const inv of investments) {
    const startDate = parseISO(inv.start_date)
    const endDate = inv.end_date ? parseISO(inv.end_date) : null

    // Gather all expected billing dates up to today
    const expectedDates: string[] = []

    if (inv.frequency === 'one-time') {
      expectedDates.push(inv.start_date)
    } else {
      let cur = startDate
      while (isBefore(cur, today) && (!endDate || !isBefore(endDate, cur))) {
        expectedDates.push(format(cur, 'yyyy-MM-dd'))
        if (inv.frequency === 'monthly')     cur = addMonths(cur, 1)
        else if (inv.frequency === 'quarterly') cur = addMonths(cur, 3)
        else if (inv.frequency === 'yearly')  cur = addYears(cur, 1)
        else break
      }
    }

    if (!expectedDates.length) continue

    // Fetch already-recorded expense dates for this investment
    const { data: existing } = await supabase
      .from('expenses')
      .select<ExistingExpenseRow>('date')
      .eq('source', 'investment')
      .eq('source_id', inv.id)

    const recorded = new Set((existing ?? []).map(e => e.date))

    const toInsert = expectedDates
      .filter(d => !recorded.has(d))
      .map(d => ({
        user_id: userId,
        category_id: inv.category_id,
        amount: inv.amount,
        description: `${inv.name} (${inv.type})`,
        date: d,
        source: 'investment',
        source_id: inv.id,
      }))

    if (toInsert.length) {
      await supabase.from('expenses').insert(toInsert)
    }
  }
}

/**
 * For each active subscription, generate expense rows for every billing period
 * between start_date and today that doesn't already have a record.
 * Also updates next_billing_date.
 */
export async function syncSubscriptionExpenses(userId: string): Promise<void> {
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select<Subscription>('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !subscriptions?.length) return

  const today = new Date()

  for (const sub of subscriptions) {
    const startDate = parseISO(sub.start_date)
    const expectedDates: string[] = []
    let cur = startDate

    while (isBefore(cur, today)) {
      expectedDates.push(format(cur, 'yyyy-MM-dd'))
      if (sub.billing_cycle === 'monthly')     cur = addMonths(cur, 1)
      else if (sub.billing_cycle === 'quarterly') cur = addMonths(cur, 3)
      else if (sub.billing_cycle === 'yearly')  cur = addYears(cur, 1)
      else break
    }

    // Update next_billing_date
    const nextDate = format(cur, 'yyyy-MM-dd')
    await supabase
      .from('subscriptions')
      .update({ next_billing_date: nextDate })
      .eq('id', sub.id)

    if (!expectedDates.length) continue

    const { data: existing } = await supabase
      .from('expenses')
      .select<ExistingExpenseRow>('date')
      .eq('source', 'subscription')
      .eq('source_id', sub.id)

    const recorded = new Set((existing ?? []).map(e => e.date))

    const toInsert = expectedDates
      .filter(d => !recorded.has(d))
      .map(d => ({
        user_id: userId,
        category_id: sub.category_id,
        amount: sub.amount,
        description: `${sub.name} (Subscription)`,
        date: d,
        source: 'subscription',
        source_id: sub.id,
      }))

    if (toInsert.length) {
      await supabase.from('expenses').insert(toInsert)
    }
  }
}
