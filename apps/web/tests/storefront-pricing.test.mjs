import test from 'node:test'
import assert from 'node:assert/strict'
import {PREVIEW_FRAME_QUOTES,frameQuoteFor,moneyUsd} from '../src/storefrontPricing.ts'
test('two finished 11x14 options have distinct depth and price',()=>{
  assert.deepEqual(PREVIEW_FRAME_QUOTES.map(q=>q.id),['walnut','ebony'])
  assert.deepEqual(PREVIEW_FRAME_QUOTES.map(q=>q.depthInches),[2.5,3.5])
  assert.ok(PREVIEW_FRAME_QUOTES[1].priceCents>PREVIEW_FRAME_QUOTES[0].priceCents)
  assert.equal(frameQuoteFor(PREVIEW_FRAME_QUOTES,'oak'),null)
  assert.equal(moneyUsd(79900),'$799')
})
