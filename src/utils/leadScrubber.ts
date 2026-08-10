/**
 * leadScrubber.ts — Batch spreadsheet boundary filter using Mapbox Matrix API.
 *
 * Accepts an array of lead rows (address or coordinate pairs) and drops any
 * row whose driving time to Park Central Square exceeds 12 minutes (720 s).
 *
 * Usage:
 *   import { scrubLeads } from '../utils/leadScrubber';
 *   const clean = await scrubLeads(rawRows);
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface LeadRow {
  /** Unique row index preserved through the scrub (caller-assigned or auto). */
  id?: number | string;
  /** Street address — either this or lat/lng must be present. */
  address?: string;
  /** Latitude (ignored if address is present and geocoding succeeds). */
  lat?: number;
  /** Longitude (ignored if address is present and geocoding succeeds). */
  lng?: number;
  /** Any extra caller payload — passed through untouched to the output. */
  [key: string]: unknown;
}

export interface ScrubbedLead extends LeadRow {
  /** Driving duration in seconds from this lead to Park Central Square. */
  transit_seconds: number;
  /** Human-readable driving time. */
  transit_label: string;
}

export interface ScrubResult {
  /** Rows that passed the 12-minute boundary check. */
  kept: ScrubbedLead[];
  /** Rows that were dropped (includes transit_seconds for diagnostics). */
  dropped: ScrubbedLead[];
  /** Summary counts. */
  summary: { total: number; kept: number; dropped: number };
}

// ── Constants ──────────────────────────────────────────────────────────────

const EPICENTER = { lat: 37.208957, lng: -93.292299 }; // Park Central Square
const MAX_TRANSIT_SECONDS = 720; // 12 minutes
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? '';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Deep-clone purge + primitive mapping: strips all prototype baggage, class
 * instances, Buffers, and hidden metadata from row arrays by running them
 * through JSON round-trip serialization, then forces every cell to a safe
 * string or number primitive so the xlsx writer never sees a non-serializable
 * token.
 */
export function deepPurgeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  // Strip hidden class metadata, prototypes, and non-serializable tokens
  const purged: Record<string, unknown>[] = JSON.parse(JSON.stringify(rows));

  return purged.map((row) => {
    const flatRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      // Detect address/location columns that may carry Geocodio-style nested
      // objects; extract the human-readable formatted string instead of
      // JSON-stringifying the whole nested blob.
      if (key.toLowerCase().includes('address') || key.toLowerCase().includes('location')) {
        if (value && typeof value === 'object') {
          const v = value as Record<string, unknown>;
          flatRow[key] = v.formatted_address || v.street || v.address || JSON.stringify(value);
        } else {
          flatRow[key] = value || '';
        }
      } else if (value === null || value === undefined) {
        flatRow[key] = ''; // prevents undefined tokens from corrupting cells
      } else if (typeof value === 'object') {
        flatRow[key] = JSON.stringify(value); // stringifies nested structures safely
      } else {
        flatRow[key] = value; // pure primitives pass through
      }
    }
    return flatRow;
  });
}

/** Convert spreadsheet cell values into types supported by XLSX output cells. */
export function sanitizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (value === undefined) return '';
  return value;
}

function secondsToLabel(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}m ${sec}s`;
}

/**
 * Geocode a single address string → { lat, lng } via Mapbox Geocoding API.
 * Returns null when the address cannot be resolved.
 */
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(address)}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=1&country=US`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      features?: Array<{ center: [number, number] }>;
    };
    const feat = body.features?.[0];
    if (!feat) return null;
    return { lng: feat.center[0], lat: feat.center[1] };
  } catch {
    return null;
  }
}

/**
 * Call the Mapbox Matrix API (driving) to get durations from every origin
 * coordinate to the single epicentre destination.
 *
 * Returns an array of durations in seconds, in the same order as `origins`.
 * Returns `Infinity` for any coordinate that fails.
 */
async function fetchDurations(
  origins: { lat: number; lng: number }[],
): Promise<number[]> {
  // Matrix API coordinate format: lng,lat pairs separated by ;
  const destStr = `${EPICENTER.lng},${EPICENTER.lat}`;
  const originStr = origins.map((o) => `${o.lng},${o.lat}`).join(';');
  const coords = `${originStr};${destStr}`;

  // sources = all origin indices; destinations = last index (the epicentre)
  const sourceIndices = origins.map((_, i) => i).join(';');
  const destIndex = origins.length; // the epicentre is appended last
  const url =
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}` +
    `?access_token=${MAPBOX_TOKEN}` +
    `&annotations=duration` +
    `&sources=${sourceIndices}` +
    `&destinations=${destIndex}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return origins.map(() => Infinity);
    const body = (await res.json()) as {
      durations?: number[][];
    };
    // body.durations[i][0] = duration from origin i to destination
    return (body.durations ?? []).map((row) => row[0] ?? Infinity);
  } catch {
    return origins.map(() => Infinity);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function scrubLeads(rows: LeadRow[]): Promise<ScrubResult> {
  if (!MAPBOX_TOKEN) {
    throw new Error('MAPBOX_ACCESS_TOKEN is not configured in the environment.');
  }

  if (rows.length === 0) {
    return {
      kept: [],
      dropped: [],
      summary: { total: 0, kept: 0, dropped: 0 },
    };
  }

  // 1. Resolve every row to a coordinate pair
  const resolved: Array<{
    row: LeadRow;
    coord: { lat: number; lng: number } | null;
  }> = [];

  for (const row of rows) {
    if (row.lat != null && row.lng != null) {
      resolved.push({ row, coord: { lat: row.lat, lng: row.lng } });
    } else if (row.address) {
      const coord = await geocodeAddress(row.address);
      resolved.push({ row, coord });
    } else {
      // No address and no coordinates — drop immediately
      resolved.push({ row, coord: null });
    }
  }

  // 2. Collect all valid coordinates for the Matrix call
  const validIndices: number[] = [];
  const validCoords: { lat: number; lng: number }[] = [];
  resolved.forEach((r, i) => {
    if (r.coord) {
      validIndices.push(i);
      validCoords.push(r.coord);
    }
  });

  // 3. Fetch durations in one batch
  let durations: number[] = [];
  if (validCoords.length > 0) {
    durations = await fetchDurations(validCoords);
  }

  // Map durations back to resolved indices
  const durationMap = new Map<number, number>();
  validIndices.forEach((resolvedIdx, j) => {
    durationMap.set(resolvedIdx, durations[j] ?? Infinity);
  });

  // 4. Split into kept / dropped
  const kept: ScrubbedLead[] = [];
  const dropped: ScrubbedLead[] = [];

  resolved.forEach((r, i) => {
    const duration = durationMap.get(i) ?? Infinity;
    const sanitizedRow = Object.fromEntries(
      Object.entries(r.row).map(([key, value]) => [key, sanitizeValue(value)]),
    ) as LeadRow;
    const enriched: ScrubbedLead = {
      ...sanitizedRow,
      transit_seconds: duration,
      transit_label: Number.isFinite(duration) ? secondsToLabel(duration) : 'N/A',
    };

    if (Number.isFinite(duration) && duration <= MAX_TRANSIT_SECONDS) {
      kept.push(enriched);
    } else {
      dropped.push(enriched);
    }
  });

  return {
    kept: deepPurgeRows(kept) as unknown as ScrubbedLead[],
    dropped: deepPurgeRows(dropped) as unknown as ScrubbedLead[],
    summary: {
      total: rows.length,
      kept: kept.length,
      dropped: dropped.length,
    },
  };
}
