import { describe, it, expect } from 'vitest'

describe('trivial', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have a working test environment', () => {
    expect(typeof document).toBe('object')
    expect(document.createElement('div')).toBeTruthy()
  })
})
