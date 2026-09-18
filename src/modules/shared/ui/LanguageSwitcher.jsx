import { useLanguage } from '../../../context/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
      className="flex items-center px-3 py-1 rounded-full bg-brass/10 hover:bg-brass/20 text-ink font-medium text-xs transition-colors border border-brass/30"
      aria-label="Toggle Language"
    >
      <span className={lang === 'en' ? 'font-bold' : 'opacity-70'}>EN</span>
      <span className="mx-1 opacity-50">|</span>
      <span className={lang === 'ta' ? 'font-bold' : 'opacity-70'}>தமிழ்</span>
    </button>
  );
}
