/**
 * Main data access layer.
 *
 * Swap `adapter` here to connect a different source (Google Sheets,
 * SharePoint, Supabase, etc.) without touching any page or component code.
 * Any replacement must satisfy the DataAdapter interface in ./types.ts
 */
import { XLSXAdapter } from './xlsx-adapter'

const adapter = new XLSXAdapter()

export const getWIPData = () => adapter.getWIP()
export const getListingsData = () => adapter.getListings()
export const getForecastData = () => adapter.getForecast()

// Re-export types and helpers for convenience
export type { WIPRow, ListingRow, ForecastRow, DataAdapter } from './types'
export { formatDate, formatCurrency } from './excel-date'
