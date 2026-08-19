const STYLES = {
  paid: 'bg-green-100 text-green-700 border border-green-300',
  waiting_approval: 'bg-amber-100 text-amber-700 border border-amber-300',
  not_paid: 'bg-red-100 text-red-700 border border-red-300',
  approved: 'bg-green-100 text-green-700 border border-green-300',
  rejected: 'bg-red-100 text-red-700 border border-red-300',
}

const LABELS = {
  paid: 'Rent Paid',
  waiting_approval: 'Waiting for Approval',
  not_paid: 'Rent Not Paid',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function ApprovalStatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {LABELS[status] || status}
    </span>
  )
}
