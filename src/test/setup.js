import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement a few browser APIs the UI relies on.
 * Components call matchMedia for prefers-reduced-motion checks and Framer
 * Motion may query ResizeObserver, so provide safe defaults here. Tests can
 * override window.matchMedia to simulate a reduced-motion user.
 */
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      constructor() { this.root = null; this.rootMargin = ''; this.thresholds = [] }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
  }
}
