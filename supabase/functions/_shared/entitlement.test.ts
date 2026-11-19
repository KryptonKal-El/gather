import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { decideAccess } from './entitlement.ts'

const NOW = new Date('2026-11-19T12:00:00Z')
const free = (used: number) => ({ isSignedIn: true, isPro: false, used })

Deno.test('signed-out callers are refused', () => {
  const decision = decideAccess('image_lookup', { isSignedIn: false, isPro: false, used: 0 }, NOW)
  assertEquals(decision.allowed, false)
  assertEquals(decision.reason, 'sign_in_required')
})

Deno.test('Pro users are never limited', () => {
  const pro = { isSignedIn: true, isPro: true, used: 10_000 }
  assertEquals(decideAccess('image_lookup', pro, NOW).allowed, true)
  assertEquals(decideAccess('recipe_search', pro, NOW).allowed, true)
})

Deno.test('free users are allowed below the cap and refused at it', () => {
  assertEquals(decideAccess('image_lookup', free(24), NOW).allowed, true)
  const atCap = decideAccess('image_lookup', free(25), NOW)
  assertEquals(atCap.allowed, false)
  assertEquals(atCap.reason, 'limit_reached')
  assertEquals(atCap.limit, 25)
  assertEquals(atCap.resetsAt, '2026-12-01T00:00:00.000Z')

  assertEquals(decideAccess('recipe_import', free(4), NOW).allowed, true)
  assertEquals(decideAccess('recipe_import', free(5), NOW).reason, 'limit_reached')
})

Deno.test('features without a free allowance need Pro', () => {
  assertEquals(decideAccess('recipe_search', free(0), NOW).reason, 'pro_required')
})

Deno.test('the reset date rolls over the year', () => {
  const december = decideAccess('recipe_import', free(5), new Date('2026-12-31T23:59:59Z'))
  assertEquals(december.resetsAt, '2027-01-01T00:00:00.000Z')
})
