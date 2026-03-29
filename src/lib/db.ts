// src/lib/db.ts
// All Supabase queries live here.

import { createClient } from '@supabase/supabase-js'
import type { WatchlistItem, CarrierSnapshot, OwnershipEvent, Verdict } from '@/types'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Carrier snapshots — for ownership change detection
// ---------------------------------------------------------------------------

export async function getOwnershipSnapshot(dotNumber: string): Promise<CarrierSnapshot | null> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('carrier_snapshots')
      .select('*')
      .eq('dot_number', dotNumber)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return {
      dotNumber: data.dot_number,
      snapshotDate: data.snapshot_date,
      legalName: data.legal_name,
      physicalAddress: data.physical_address,
      phone: data.phone,
      ein: data.ein,
      insuranceCancellationDate: data.insurance_cancellation_date ?? null,
    }
  } catch {
    return null
  }
}

// Returns the most recent snapshot strictly before today — used for ownership diff at lookup time.
// After writing today's snapshot synchronously, getOwnershipSnapshot would return today's record,
// so we need this separate query to get the previous day's baseline.
export async function getPreviousSnapshot(dotNumber: string): Promise<CarrierSnapshot | null> {
  try {
    const supabase = getClient()
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('carrier_snapshots')
      .select('*')
      .eq('dot_number', dotNumber)
      .lt('snapshot_date', today)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return {
      dotNumber: data.dot_number,
      snapshotDate: data.snapshot_date,
      legalName: data.legal_name,
      physicalAddress: data.physical_address,
      phone: data.phone,
      ein: data.ein,
      insuranceCancellationDate: data.insurance_cancellation_date ?? null,
    }
  } catch {
    return null
  }
}

export async function writeSnapshot(
  dotNumber: string,
  snapshot: Omit<CarrierSnapshot, 'dotNumber' | 'snapshotDate'> & { rawJson?: unknown }
): Promise<void> {
  try {
    const supabase = getClient()
    const today = new Date().toISOString().split('T')[0]

    // ignoreDuplicates: true → ON CONFLICT DO NOTHING (repeat lookups same day are no-ops)
    await supabase.from('carrier_snapshots').upsert({
      dot_number: dotNumber,
      snapshot_date: today,
      legal_name: snapshot.legalName,
      physical_address: snapshot.physicalAddress,
      phone: snapshot.phone,
      ein: snapshot.ein,
      insurance_cancellation_date: snapshot.insuranceCancellationDate ?? null,
      raw_json: snapshot.rawJson ?? null,
    }, { onConflict: 'dot_number,snapshot_date', ignoreDuplicates: true })

    // Prune snapshots older than 30 days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    await supabase
      .from('carrier_snapshots')
      .delete()
      .eq('dot_number', dotNumber)
      .lt('snapshot_date', cutoff.toISOString().split('T')[0])
  } catch (err) {
    console.error('writeSnapshot error:', err)
  }
}

// ---------------------------------------------------------------------------
// InsHist ownership flags — name change / transfer signals from bulk file
// Table: ins_hist_flags (dot_number, cancellation_method, cancellation_date)
// Populated nightly by cron; queried at lookup time.
// ---------------------------------------------------------------------------

export interface InsHistFlag {
  dotNumber: string
  cancellationMethod: string
  cancellationDate: string  // ISO date string
}

export async function getInsHistFlag(dotNumber: string): Promise<InsHistFlag | null> {
  try {
    const supabase = getClient()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    const { data, error } = await supabase
      .from('ins_hist_flags')
      .select('*')
      .eq('dot_number', dotNumber)
      .gte('cancellation_date', cutoff.toISOString().split('T')[0])
      .order('cancellation_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return {
      dotNumber: data.dot_number,
      cancellationMethod: data.cancellation_method,
      cancellationDate: data.cancellation_date,
    }
  } catch {
    return null
  }
}

export async function writeInsHistFlags(
  flags: { dotNumber: string; cancellationMethod: string; cancellationDate: string }[]
): Promise<void> {
  if (flags.length === 0) return
  try {
    const supabase = getClient()
    await supabase.from('ins_hist_flags').upsert(
      flags.map((f) => ({
        dot_number: f.dotNumber,
        cancellation_method: f.cancellationMethod,
        cancellation_date: f.cancellationDate,
      })),
      { onConflict: 'dot_number,cancellation_date,cancellation_method', ignoreDuplicates: true }
    )
  } catch (err) {
    console.error('writeInsHistFlags error:', err)
  }
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    if (error) throw error
    if (!data) return []

    // Check for unread ownership events for each carrier
    const dotNumbers = data.map((r) => r.dot_number)
    const { data: events } = await supabase
      .from('ownership_events')
      .select('dot_number')
      .in('dot_number', dotNumbers)
      .eq('alerted', false)

    const alertedDots = new Set((events ?? []).map((e) => e.dot_number))

    return data.map((row) => ({
      id: row.id,
      dotNumber: row.dot_number,
      carrierName: row.carrier_name,
      mcNumber: row.mc_number ?? null,
      lastVerdict: (row.last_verdict as Verdict) ?? null,
      lastChecked: row.last_checked ?? null,
      alertPhone: row.alert_phone ?? null,
      alertEmail: row.alert_email ?? null,
      ownershipAlert: alertedDots.has(row.dot_number),
      addedAt: row.added_at,
    }))
  } catch (err) {
    console.error('getWatchlist error:', err)
    return []
  }
}

export async function addToWatchlist(
  userId: string,
  dotNumber: string,
  carrierName: string,
  mcNumber?: string,
  alertPhone?: string,
  alertEmail?: string
): Promise<string> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      dot_number: dotNumber,
      carrier_name: carrierName,
      mc_number: mcNumber ?? null,
      alert_phone: alertPhone ?? null,
      alert_email: alertEmail ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function removeFromWatchlist(id: string, userId: string): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', userId) // guard against deleting other users' entries

  if (error) throw error
}

export async function updateWatchlistVerdict(
  userId: string,
  dotNumber: string,
  verdict: Verdict
): Promise<void> {
  try {
    const supabase = getClient()
    await supabase
      .from('watchlist')
      .update({
        last_verdict: verdict,
        last_checked: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('dot_number', dotNumber)
  } catch (err) {
    console.error('updateWatchlistVerdict error:', err)
  }
}

export async function getWatchedCarriers(): Promise<
  { userId: string; dotNumber: string; alertPhone: string | null; alertEmail: string | null; carrierName: string }[]
> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('watchlist')
      .select('user_id, dot_number, alert_phone, alert_email, carrier_name')

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
      userId: row.user_id,
      dotNumber: row.dot_number,
      alertPhone: row.alert_phone ?? null,
      alertEmail: row.alert_email ?? null,
      carrierName: row.carrier_name,
    }))
  } catch (err) {
    console.error('getWatchedCarriers error:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Ownership events
// ---------------------------------------------------------------------------

export async function writeOwnershipEvent(event: {
  dotNumber: string
  fieldChanged: string
  oldValue: string | null
  newValue: string | null
}): Promise<void> {
  try {
    const supabase = getClient()
    await supabase.from('ownership_events').insert({
      dot_number: event.dotNumber,
      field_changed: event.fieldChanged,
      old_value: event.oldValue,
      new_value: event.newValue,
    })
  } catch (err) {
    console.error('writeOwnershipEvent error:', err)
  }
}

export async function getUnalertedEvents(): Promise<OwnershipEvent[]> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('ownership_events')
      .select('*')
      .eq('alerted', false)

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
      id: row.id,
      dotNumber: row.dot_number,
      detectedAt: row.detected_at,
      fieldChanged: row.field_changed,
      oldValue: row.old_value,
      newValue: row.new_value,
      alerted: row.alerted,
    }))
  } catch (err) {
    console.error('getUnalertedEvents error:', err)
    return []
  }
}

export async function getOwnershipEvents(dotNumber: string): Promise<OwnershipEvent[]> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('ownership_events')
      .select('*')
      .eq('dot_number', dotNumber)
      .order('detected_at', { ascending: false })

    if (error || !data) return []

    return data.map((row) => ({
      id: row.id,
      dotNumber: row.dot_number,
      detectedAt: row.detected_at,
      fieldChanged: row.field_changed,
      oldValue: row.old_value,
      newValue: row.new_value,
      alerted: row.alerted,
    }))
  } catch {
    return []
  }
}

export async function getOwnershipEventCount(dotNumber: string): Promise<number> {
  try {
    const supabase = getClient()
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { count, error } = await supabase
      .from('ownership_events')
      .select('id', { count: 'exact', head: true })
      .eq('dot_number', dotNumber)
      .gte('detected_at', since.toISOString())

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function markEventsAlerted(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    const supabase = getClient()
    await supabase.from('ownership_events').update({ alerted: true }).in('id', ids)
  } catch (err) {
    console.error('markEventsAlerted error:', err)
  }
}

// ---------------------------------------------------------------------------
// Cache — FMCSA results cached for 4 hours
// ---------------------------------------------------------------------------

export async function getCachedResult(dotNumber: string): Promise<unknown | null> {
  try {
    const supabase = getClient()
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

    const { data } = await supabase
      .from('carrier_snapshots')
      .select('raw_json, snapshot_date')
      .eq('dot_number', dotNumber)
      .gte('snapshot_date', cutoff.split('T')[0])
      .not('raw_json', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    return data?.raw_json ?? null
  } catch {
    return null
  }
}
