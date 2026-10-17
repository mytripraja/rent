import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoadingScreen from '../modules/shared/LoadingScreen'
import Button from '../modules/shared/ui/Button'
import Tilt3D from '../modules/shared/ui/Tilt3D'
import AnimatedCounter from '../modules/shared/ui/AnimatedCounter'

/** Let a test pretend the user asked for reduced motion (or did not). */
function stubMatchMedia(reducedMotion) {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

describe('LoadingScreen', () => {
  it('exposes an accessible busy status and the custom label', () => {
    render(<LoadingScreen label="Booting workspace…" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Booting workspace…')).toBeInTheDocument()
    expect(screen.getByText('Rental Manager')).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('renders children and stays enabled', () => {
    render(<Button>Save entry</Button>)
    expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled()
  })

  it('disables and marks itself busy while loading', () => {
    render(
      <Button loading loadingText="Saving…">
        Save entry
      </Button>
    )
    const button = screen.getByRole('button', { name: /Saving…/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('applies variant styling', () => {
    render(<Button variant="danger">Remove</Button>)
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('bg-stamp-red')
  })
})

describe('Tilt3D', () => {
  it('renders its children inside the perspective wrapper', () => {
    render(
      <Tilt3D>
        <button>Card action</button>
      </Tilt3D>
    )
    expect(screen.getByRole('button', { name: 'Card action' })).toBeInTheDocument()
  })

  it('creates the .rm-scene perspective container', () => {
    const { container } = render(
      <Tilt3D className="extra">
        <div>child</div>
      </Tilt3D>
    )
    const scene = container.querySelector('.rm-scene')
    expect(scene).not.toBeNull()
    expect(scene).toHaveClass('extra')
    expect(scene.querySelector('.rm-3d')).not.toBeNull()
  })
})

describe('AnimatedCounter', () => {
  beforeEach(() => stubMatchMedia(true))

  it('renders the final grouped value immediately for reduced-motion users', () => {
    render(<AnimatedCounter value={60000} prefix="₹" />)
    expect(screen.getByText('₹60,000')).toBeInTheDocument()
  })

  it('supports a suffix', () => {
    render(<AnimatedCounter value={12} suffix="+" />)
    expect(screen.getByText('12+')).toBeInTheDocument()
  })

  it('shows non-numeric values as-is', () => {
    render(<AnimatedCounter value="3/5" />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })
})
