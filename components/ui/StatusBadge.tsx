const STATUS_STYLES: Record<string, string> = {
  // WIP / Listings statuses
  'Exchanged':       'bg-green-100 text-green-800',
  'Active Listing':  'bg-blue-100 text-blue-800',
  'On Market':       'bg-blue-100 text-blue-800',
  'Active':          'bg-blue-100 text-blue-800',
  'Submission':      'bg-amber-100 text-amber-800',
  'Appraisal':       'bg-purple-100 text-purple-800',
  'Pending':         'bg-cyan-100 text-cyan-800',
  'In DD':           'bg-amber-100 text-amber-800',
  'Lost':            'bg-gray-100 text-gray-500',
  'Withdrawn':       'bg-gray-100 text-gray-500',
  'TBC':             'bg-gray-100 text-gray-500',
  'Sold':            'bg-green-100 text-green-800',
  // Fee Forecast statuses
  'Settled':         'bg-green-100 text-green-800',
  'To be invoiced':  'bg-amber-100 text-amber-800',
}

const RATING_STYLES: Record<string, string> = {
  'AAAA - Closed / Sold': 'bg-green-100 text-green-800',
  'AAA - Awarded / Won':  'bg-blue-100 text-blue-800',
  'AA - Proposing / Sub': 'bg-amber-100 text-amber-800',
  'A - Validating':       'bg-purple-100 text-purple-800',
  'Withdrawn / Lost':     'bg-gray-100 text-gray-500',
}

const RATING_SHORT: Record<string, string> = {
  'AAAA - Closed / Sold': 'AAAA',
  'AAA - Awarded / Won':  'AAA',
  'AA - Proposing / Sub': 'AA',
  'A - Validating':       'A',
  'Withdrawn / Lost':     'Lost',
}

interface Props {
  value: string
  variant?: 'status' | 'rating'
}

export default function StatusBadge({ value, variant = 'status' }: Props) {
  const styles = variant === 'rating' ? RATING_STYLES : STATUS_STYLES
  const cls = styles[value] ?? 'bg-gray-100 text-gray-600'
  const label = variant === 'rating' ? (RATING_SHORT[value] ?? value) : value

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}
