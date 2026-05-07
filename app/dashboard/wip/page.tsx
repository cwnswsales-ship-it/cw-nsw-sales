export default function WIPPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-1">
          Pipeline
        </p>
        <h1 className="text-2xl font-bold" style={{ color: '#0C2340' }}>
          WIP
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Work in progress — submissions pipeline
        </p>
      </div>
      <ComingSoon stage={2} />
    </div>
  )
}

function ComingSoon({ stage }: { stage: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: '#e6f7ee' }}
      >
        <span className="text-xl" style={{ color: '#00A650' }}>⚡</span>
      </div>
      <h2 className="text-lg font-semibold text-slate-700 mb-1">Coming in Stage {stage}</h2>
      <p className="text-slate-400 text-sm max-w-xs">
        Data parsing, filtering, sorting and table view will be built in Stage {stage}.
      </p>
    </div>
  )
}
