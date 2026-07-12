import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia. Provide a minimal polyfill so components
// that read media queries (ThemeToggle, WinCelebration, etc.) render in tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
