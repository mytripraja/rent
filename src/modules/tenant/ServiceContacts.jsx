import { useEffect, useState } from 'react'
import { listServiceContacts } from '../../services/serviceContactService'
import ServiceContactsList from '../shared/ServiceContactsList'

export default function ServiceContacts() {
  const [contacts, setContacts] = useState([])

  useEffect(() => {
    listServiceContacts().then(setContacts)
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="font-semibold text-slate-800 mb-3">Service Contacts</h3>
      <ServiceContactsList contacts={contacts} />
    </div>
  )
}
