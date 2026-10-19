import { useLanguage } from '../../../context/LanguageContext'

export default function LanguageSwitcher({ compact = false }) {
  const { lang, setLang } = useLanguage()
  return (
    <button type="button" onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
      className={`inline-flex items-center justify-center ${compact ? 'px-2.5 py-2' : 'px-3 py-2'} rounded-xl bg-paper-raised text-ink font-semibold text-xs transition-colors border border-[var(--rm-border)]`}
      aria-label={lang === 'en' ? 'Switch to Tamil' : 'Switch to English'}>
      <span className={lang === 'en' ? 'font-bold' : 'opacity-60'}>EN</span><span className="mx-1 opacity-40">|</span><span className={lang === 'ta' ? 'font-bold' : 'opacity-60'}>தமிழ்</span>
    </button>
  )
}
