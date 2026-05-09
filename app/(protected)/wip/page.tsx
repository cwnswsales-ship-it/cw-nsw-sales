import Header from '@/components/layout/Header'
import WIPTable from '@/components/tables/WIPTable'
import type { WIPTableRow } from '@/components/tables/WIPTable'
import { getWIPData } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function WIPPage() {
  const raw = await getWIPData()

  const data: WIPTableRow[] = raw.map(r => ({
    date: r.date ? r.date.toISOString().split('T')[0] : null,
    rating: r.rating,
    address: r.address,
    vendor: r.vendor,
    value: r.value,
    fee: r.fee,
    landArea: r.landArea,
    agent1: r.agent1,
    agent2: r.agent2,
    agent3: r.agent3,
    status: r.status,
    campaignType: r.campaignType,
    assetType: r.assetType,
  }))

  return (
    <>
      <Header title="WIP" subtitle={`— ${data.length} deals in pipeline`} />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-full">
          <WIPTable data={data} />
        </div>
      </main>
    </>
  )
}
