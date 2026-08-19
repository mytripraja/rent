const CATEGORY_LABELS = {
  eb_staff: 'EB Staff / Complaint Numbers',
  eb_office: 'EB Office',
  technician: 'AC Technician',
  mechanic: 'Mechanic',
  puncture_shop: 'Puncture Shop',
  electrician: 'Electrician',
  other: 'Other',
}

const CATEGORY_ORDER = ['eb_staff', 'eb_office', 'technician', 'mechanic', 'puncture_shop', 'electrician', 'other']

export default function ServiceContactsList({ contacts, renderAction }) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: contacts.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0)

  if (grouped.length === 0) {
    return <p className="text-sm text-slate-400">No service contacts added yet.</p>
  }

  return (
    <div className="space-y-5">
      {grouped.map((g) => (
        <div key={g.cat}>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[g.cat]}
          </h4>
          <div className="space-y-2">
            {g.items.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                <div>
                  <p className="text-slate-700 font-medium">{c.label}</p>
                  <div className="flex gap-3 mt-0.5">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-xs text-brand hover:underline">
                        {c.phone}
                      </a>
                    )}
                    {c.mapsUrl && (
                      <a href={c.mapsUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                        View on map
                      </a>
                    )}
                  </div>
                </div>
                {renderAction && renderAction(c)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export { CATEGORY_LABELS, CATEGORY_ORDER }
