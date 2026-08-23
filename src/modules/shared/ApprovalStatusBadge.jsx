// The app's signature element: a rubber-stamp badge instead of a flat pill,
// echoing the passbook/ledger visual language (see index.css .stamp).
const STAMP_CLASS = {
  paid: 'stamp-green',
  waiting_approval: 'stamp-amber',
  not_paid: 'stamp-red',
  approved: 'stamp-green',
  rejected: 'stamp-red',
}

const LABELS = {
  paid: 'Paid',
  waiting_approval: 'Pending',
  not_paid: 'Not Paid',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function ApprovalStatusBadge({ status }) {
  return (
    <span className={`stamp ${STAMP_CLASS[status] || 'stamp-ink'}`}>
      {LABELS[status] || status}
    </span>
  )
}
