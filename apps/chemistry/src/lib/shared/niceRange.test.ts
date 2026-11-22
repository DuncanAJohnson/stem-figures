import { describe, expect, it } from 'vitest'
import { niceRange } from './niceRange'

describe('fitting an axis', () => {
  it('counts in tidy steps', () => {
    expect(niceRange(0, 308.8, true)).toEqual([0, 320, 20])
    expect(niceRange(-20, 120)).toEqual([-20, 120, 10])
    expect(niceRange(0, 20, true)).toEqual([0, 20, 1])
  })
})
