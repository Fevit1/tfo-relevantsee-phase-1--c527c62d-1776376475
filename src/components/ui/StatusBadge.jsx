export function StatusBadge({ status, emphasis = false }) {
  const styles = {
    draft: 'bg-gray-800 text-gray-300 border-gray-600',
    pending: 'bg-amber-950 text-amber-300 border-amber-700',
    approved: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    rejected: 'bg-red-950 text-red-300 border-red-700',
  }

  const emphasisStyles = {
    draft: 'ring-2 ring-gray-500 ring-offset-1 ring-offset-gray-900',
    pending: 'ring-2 ring-amber-500 ring-offset-1 ring-offset-gray-900',
    approved: 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-gray-900',
    rejected: 'ring-2 ring-red-500 ring-offset-1 ring-offset-gray-900',
  }

  const labels = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  if (!status) return null

  const baseStyle = styles[status] || styles.draft
  const emphasisStyle = emphasis ? (emphasisStyles[status] || emphasisStyles.draft) : ''
  const label = labels[status] || status

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all duration-150 ${baseStyle} ${emphasisStyle}`}
      aria-label={`Status: ${label}`}
      role="status"
    >
      {label}
    </span>
  )
}