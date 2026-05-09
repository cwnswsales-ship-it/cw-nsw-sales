import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Active Listings | CW WIP' }
import Header from '@/components/layout/Header'
import ListingsTable from '@/components/tables/ListingsTable'
import type { ListingTableRow } from '@/components/tables/ListingsTable'
import { getListingsData } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ListingsPage() {
  const raw = await getListingsData()

  const data: ListingTableRow[] = raw.map(r => ({
    date: r.date ? r.date.toISOString().split('T')[0] : null,
    address: r.address,
    vendor: r.vendor,
    price: r.price,
    fee: r.fee,
    agents: r.agents,
    status: r.status,
    closeDate: r.closeDate ? r.closeDate.toISOString().split('T')[0] : null,
    process: r.process,
    assetClass: r.assetClass,
  }))

  return (
    <>
      <Header title="Active Listings" subtitle={`— ${data.length} properties`} />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-full">
          <ListingsTable data={data} />
        </div>
      </main>
    </>
  )
}
