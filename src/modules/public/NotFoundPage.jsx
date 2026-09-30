import { Link } from 'react-router-dom'
import { Home, SearchX } from 'lucide-react'

export default function NotFoundPage() {
  return <main className="min-h-[100dvh] bg-paper grid place-items-center p-5" role="main">
    <div className="w-full max-w-lg rm-card p-7 sm:p-10 text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-brand/10 text-brand grid place-items-center"><SearchX size={30}/></div>
      <p className="rm-kicker mt-5">Error 404</p>
      <h1 className="font-display text-4xl font-extrabold mt-1">Page not found</h1>
      <p className="text-sm text-ink-soft mt-3 leading-6">The page may have moved, the link may be old, or the address may be incorrect.</p>
      <div className="flex flex-col sm:flex-row gap-2 mt-6"><Link to="/" className="rm-hero-button flex-1"><Home size={17}/> Go home</Link><button onClick={()=>window.history.back()} className="rm-secondary-button flex-1">Go back</button></div>
    </div>
  </main>
}
