import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Fee Forecast | CW WIP' }
import Header from '@/components/layout/Header'
import ForecastTable from '@/components/tables/ForecastTable'
import type { ForecastTableRow } from '@/components/tables/ForecastTable'
import { getForecastData } from '@/lib/data'

export const dynamic = 'force-dynamic'

function getQuarter(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1
  return `Q${q} ${d.getFullYear()}`
}

function getMonth(d: Date): string {
  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export default async function ForecastPage() {
  const raw = await getForecastData()

  const data: ForecastTableRow[] = raw.map(r => ({
    address: r.address,
    vendor: r.vendor,
    purchaser: r.purchaser,
    value: r.value,
    settlementDate: r.settlementDate ? r.settlementDate.toISOString().split('T')[0] : null,
    settlementMonth: r.settlementDate ? getMonth(r.settlementDate) : '',
    settlementQuarter: r.settlementDate ? getQuarter(r.settlementDate) : '',
    status: r.status,
    fee: r.fee,
    mironSolomons: r.mironSolomons,
    mattPontey: r.mattPontey,
    henryRobertson: r.henryRobertson,
    jakeSmith: r.jakeSmith,
    x: r.x,
  }))

  const totalFee = data.reduce((s, r) => s + (r.fee ?? 0), 0)
  const settled = data.filter(r => r.status === 'Settled').reduce((s, r) => s + (r.fee ?? 0), 0)

  return (
    <>
      <Header
        title="Fee Forecast"
        subtitle={`— ${data.length} deals · ${data.filter(r => r.status === 'Settled').length} settled`}
      />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-full space-y-4">
          {/* Quick summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Deals', value: data.length.toString() },
              { label: 'Settled', value: data.filter(r => r.status === 'Settled').length.toString() },
              { label: 'Total Fees', value: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(totalFee) },
              { label: 'Settled Fees', value: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(settled) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <ForecastTable data={data} />
        </div>
      </main>
    </>
  )
}
