import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from '../modules/shared/ui/Toast'

function Probe() {
  const { showToast, success, error, info, warning } = useToast()
  return (
    <div>
      <button onClick={() => showToast({ message: 'low-level', type: 'info' })}>low</button>
      <button onClick={() => success('msg-success')}>success</button>
      <button onClick={() => error('msg-error')}>error</button>
      <button onClick={() => info('msg-info')}>info</button>
      <button onClick={() => warning('msg-warning')}>warning</button>
    </div>
  )
}

function renderToast() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>
  )
}

describe('Toast', () => {
  it('renders the provider and exposes a showToast helper', async () => {
    renderToast()
    fireEvent.click(screen.getByText('low'))
    expect(await screen.findByText('low-level')).toBeInTheDocument()
  })

  // Regression guard: screens call toast.error('…') directly. If these helpers
  // ever disappear, every approval queue and export screen breaks at runtime.
  it('exposes success, error, info and warning helpers', async () => {
    renderToast()

    fireEvent.click(screen.getByText('success'))
    expect(await screen.findByText('msg-success')).toBeInTheDocument()

    fireEvent.click(screen.getByText('error'))
    expect(await screen.findByText('msg-error')).toBeInTheDocument()

    fireEvent.click(screen.getByText('info'))
    expect(await screen.findByText('msg-info')).toBeInTheDocument()

    fireEvent.click(screen.getByText('warning'))
    expect(await screen.findByText('msg-warning')).toBeInTheDocument()
  })

  it('announces toasts through an accessible alert role', async () => {
    renderToast()
    fireEvent.click(screen.getByText('error'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('msg-error')
  })
})
