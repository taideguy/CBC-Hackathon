// src/lib/fleet.ts
// Fleet profile: make/model-year data from FMCSA inspections + NHTSA VIN decode.

import { createClient } from '@supabase/supabase-js'
import type { FleetProfile } from '@/types'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

export async function getFleetProfile(dotNumber: string): Promise<FleetProfile | null> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('fleet_profiles')
      .select('*')
      .eq('dot_number', dotNumber)
      .single()

    if (error || !data) return null

    return {
      dotNumber: data.dot_number,
      topMakes: data.top_makes ?? [],
      avgModelYear: data.avg_model_year ?? null,
      unitCount: data.unit_count ?? 0,
      lastUpdated: data.last_updated,
    }
  } catch {
    return null
  }
}

export async function buildFleetProfile(dotNumber: string): Promise<FleetProfile | null> {
  try {
    // 1. Fetch inspection records from FMCSA data portal
    const inspUrl = `https://data.transportation.gov/resource/fx4q-ay7w.json?dot_number=${encodeURIComponent(dotNumber)}&$limit=50`
    const inspRes = await fetch(inspUrl, { headers: { Accept: 'application/json' } })
    if (!inspRes.ok) return null

    const inspections = await inspRes.json() as Array<{ veh_make?: string; vin_no?: string }>
    if (!Array.isArray(inspections) || inspections.length === 0) return null

    // Tally makes; collect unique 17-char VINs
    const makeCounts: Record<string, number> = {}
    const vins: string[] = []

    for (const rec of inspections) {
      const make = rec.veh_make?.trim().toUpperCase()
      if (make) {
        makeCounts[make] = (makeCounts[make] ?? 0) + 1
      }
      const vin = rec.vin_no?.trim()
      if (vin && vin.length === 17) {
        vins.push(vin)
      }
    }

    const topMakes = Object.entries(makeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([make]) => make)

    // 2. Batch decode VINs via NHTSA vPIC
    let avgModelYear: number | null = null
    if (vins.length > 0) {
      const uniqueVins = [...new Set(vins)].slice(0, 50)
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 200)) // gentle throttle
        const nhtsaRes = await fetch(
          'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch?format=json',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `DATA=${uniqueVins.join(';')}`,
          }
        )
        if (nhtsaRes.ok) {
          const nhtsaData = await nhtsaRes.json() as {
            Results?: Array<{ ModelYear?: string; ErrorCode?: string }>
          }
          const currentYear = new Date().getFullYear()
          const years = (nhtsaData.Results ?? [])
            .filter((r) => r.ErrorCode === '0' && r.ModelYear)
            .map((r) => parseInt(r.ModelYear!, 10))
            .filter((y) => !isNaN(y) && y > 1990 && y <= currentYear + 1)

          if (years.length > 0) {
            avgModelYear = Math.round(years.reduce((a, b) => a + b, 0) / years.length)
          }
        }
      } catch (err) {
        console.error('NHTSA vPIC error:', err)
      }
    }

    const profile: FleetProfile = {
      dotNumber,
      topMakes,
      avgModelYear,
      unitCount: inspections.length,
      lastUpdated: new Date().toISOString(),
    }

    // 3. Upsert to Supabase
    try {
      const supabase = getClient()
      await supabase.from('fleet_profiles').upsert({
        dot_number: dotNumber,
        top_makes: topMakes,
        avg_model_year: avgModelYear,
        unit_count: profile.unitCount,
        last_updated: profile.lastUpdated,
      }, { onConflict: 'dot_number' })
    } catch (err) {
      console.error('fleet_profiles upsert error:', err)
    }

    return profile
  } catch (err) {
    console.error('buildFleetProfile error:', err)
    return null
  }
}
