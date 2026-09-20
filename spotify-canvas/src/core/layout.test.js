import { describe, it, expect } from 'vitest'
import { fanOutPositions, outwardAngle } from './layout.js'

describe('fanOutPositions', () => {
  const opts = { radius: 100, arcRad: Math.PI / 2, baseAngle: 0 }

  it('returns `count` positions', () => {
    expect(fanOutPositions({ x: 0, y: 0 }, 5, opts)).toHaveLength(5)
  })

  it('places every position at the given radius from the origin', () => {
    const origin = { x: 10, y: 20 }
    for (const p of fanOutPositions(origin, 4, { ...opts, radius: 150 })) {
      expect(Math.hypot(p.x - origin.x, p.y - origin.y)).toBeCloseTo(150)
    }
  })

  it('places a lone node exactly along baseAngle', () => {
    const [p] = fanOutPositions({ x: 0, y: 0 }, 1, opts)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(0)
  })

  it('spreads positions symmetrically around baseAngle', () => {
    const [first, last] = fanOutPositions({ x: 0, y: 0 }, 2, opts)
    expect(first.y).toBeCloseTo(-last.y)
    expect(first.x).toBeCloseTo(last.x)
  })
})

describe('outwardAngle', () => {
  it('points from the first point toward the second', () => {
    expect(outwardAngle({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0)
    expect(outwardAngle({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2)
  })
})
