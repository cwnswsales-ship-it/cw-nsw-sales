export interface WIPRow {
  date: Date | null
  rating: string
  address: string
  vendor: string
  value: number | null
  fee: number | null
  landArea: number | null
  agent1: string
  agent2: string
  agent3: string
  status: string
  campaignType: string
  assetType: string
}

export interface ListingRow {
  date: Date | null
  address: string
  vendor: string
  price: number | null
  fee: number | null
  agents: string
  status: string
  closeDate: Date | null
  process: string
  assetClass: string
}

export interface ForecastRow {
  address: string
  vendor: string
  purchaser: string
  value: number | null
  settlementDate: Date | null
  status: string
  fee: number | null
  mironSolomons: number | null
  mattPontey: number | null
  henryRobertson: number | null
  jakeSmith: number | null
  x: number | null
}

export interface DataAdapter {
  getWIP(): Promise<WIPRow[]>
  getListings(): Promise<ListingRow[]>
  getForecast(): Promise<ForecastRow[]>
}
