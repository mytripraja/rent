import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../i18n/translations'
import { useAuth } from './AuthContext'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const { user } = useAuth()
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang')
    return saved === 'ta' ? 'ta' : 'en'
  })

  useEffect(() => {
    const preferred = user?.preferredLanguage
    if (preferred === 'ta' || preferred === 'en') setLang(preferred)
  }, [user?.preferredLanguage])

  useEffect(() => { localStorage.setItem('lang', lang) }, [lang])

  const t = (key) => {
    if (!translations[lang]) return key
    return translations[lang][key] || translations.en[key] || key
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}
