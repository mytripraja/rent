import RentSubmission from './RentSubmission'
import RentHistory from './RentHistory'
import EBBillShare from './EBBillShare'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

export default function TenantDashboard() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-slate-800">Welcome, {user?.name}</h1>
          <p className="text-xs text-slate-400">House {user?.houseId}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">Log out</button>
      </header>

      <main className="p-6 grid md:grid-cols-2 gap-6">
        <RentSubmission onSubmitted={() => {}} />
        <RentHistory />
        <EBBillShare />
      </main>
    </div>
  )
}
