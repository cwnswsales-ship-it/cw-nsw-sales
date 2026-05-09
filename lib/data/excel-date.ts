/**
 * Convert an Excel date serial number to a JS Date.
 * Excel counts days from 1900-01-01 (with a historical leap-year bug).
 * 25569 = days from Excel epoch (1900-01-00) to Unix epoch (1970-01-01).
 */
export function excelDateToDate(serial: unknown): Date | null {
  if (serial === null || serial === undefined || typeof serial !== 'number') return null
  if (serial <= 0) return null
  const utcMs = (serial - 25569) * 86400 * 1000
  const d = new Date(utcMs)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
