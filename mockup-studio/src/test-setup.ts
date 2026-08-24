import "@testing-library/jest-dom/vitest"

// jsdom doesn't implement ResizeObserver, which DialKit's inline panel relies on.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  Reflect.set(globalThis, "ResizeObserver", ResizeObserverStub)
}
