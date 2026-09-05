export default function IconButton({ icon: Icon, label, size = 18, className = '', ...props }) {
  return (
    <button type="button" aria-label={label} title={label} className={`text-brass-light hover:text-paper transition ${className}`} {...props}>
      <Icon size={size} aria-hidden="true" />
    </button>
  )
}
