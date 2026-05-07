// ─── WIP Sheet ───────────────────────────────────────────────────────────────

export interface WIPRow {
  id: string
  date: string | null          // ISO date  "YYYY-MM-DD"
  rating: string | null        // "A" | "B" | "C"
  address: string
  vendor: string | null
  value: number | null         // AUD
  fee: number | null           // AUD
  landArea: string | null      // free text e.g. "1,850 sqm"
  agent1: string | null
  agent2: string | null
  agent3: string | null
  status: string | null        // "Active" | "Under Offer" | "Conditional" | "Unconditional" | "Withdrawn" | "Lapsed"
  campaignType: string | null  // "EOI" | "Auction" | "Private Treaty" | "Off-Market" | "Tender"
}

// ─── Active Listings Sheet ────────────────────────────────────────────────────

export interface ActiveListingRow {
  id: string
  date: string | null          // Listed date
  address: string
  vendor: string | null
  price: number | null         // AUD
  fee: number | null           // AUD
  agents: string | null        // Free text, may be comma-separated
  status: string | null        // "For Sale" | "Under Offer" | "Conditional" | "Sold" | "Withdrawn"
  closeDate: string | null     // Campaign close date
  process: string | null       // "EOI" | "Auction" | "Private Treaty" | "Off-Market"
  assetClass: string | null    // "Industrial" | "Office" | "Retail" | "Development Site" | "Mixed Use" | "Land" | "Medical" | "Childcare"
}

// ─── Fee Forecast Sheet ───────────────────────────────────────────────────────

export interface FeeForecastRow {
  id: string
  address: string
  vendor: string | null
  purchaser: string | null
  value: number | null         // AUD sale price
  settlementDate: string | null
  status: string | null        // "Settled" | "Unconditional" | "Conditional" | "Forecast"
  fee: number | null           // Total fee AUD
  mironSolomons: number | null // Agent split AUD
  mattPontey: number | null
  henryRobertson: number | null
  jakeSmith: number | null
  x: number | null             // Referral / other split
}

// ─── Derived / summary types ──────────────────────────────────────────────────

export interface DashboardSummary {
  wipCount: number
  wipTotalValue: number
  wipTotalFee: number
  activeListingsCount: number
  activeListingsTotalValue: number
  activeListingsTotalFee: number
  forecastFeeThisMonth: number
  forecastFeeThisQuarter: number
  settledFeeYTD: number
  totalForecastFee: number
  usingMockData: boolean
}

export interface AgentSummary {
  name: string
  totalFee: number
  settledFee: number
  forecastFee: number
  dealCount: number
  avgDealFee: number
  shareOfTotal: number  // 0–1
}
