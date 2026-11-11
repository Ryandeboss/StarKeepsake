import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterDestination } from '../src/workshopNavigation.ts'

const complete = {
  hasPhoto:true, hasDimensions:true, detectionReady:true,
  placement:'within', hasForeground:true, skyCurrent:true
}
const go = (index,state=complete) => chapterDestination(index,state)
test('all five chapters are accessible after a complete design', () => {
  assert.deepEqual([0,1,2,3,4].map(i=>go(i).stage),
    ['welcome','choice','moment','preview','home'])
})
test('returning to photograph never discards the completed design state', () => {
  assert.equal(go(0,{...complete,skyCurrent:false}).stage,'welcome')
})
test('missing photograph returns to upload even when a later chapter is requested', () => {
  assert.equal(go(4,{...complete,hasPhoto:false}).stage,'welcome')
})
test('in-flight or incomplete photo preparation returns to detection', () => {
  assert.equal(go(1,{...complete,hasDimensions:false}).stage,'detecting')
  assert.equal(go(3,{...complete,detectionReady:false}).stage,'detecting')
})
test('manual horizon preparation is required for in-photo stars', () => {
  assert.equal(go(3,{...complete,hasForeground:false}).stage,'refine')
  assert.equal(go(2,{...complete,hasForeground:false}).stage,'refine')
})
test('sky above photograph does not need a foreground cutout', () => {
  assert.equal(go(2,{...complete,placement:'above',hasForeground:false,skyCurrent:false}).stage,'moment')
  assert.equal(go(4,{...complete,placement:'above',hasForeground:false}).stage,'home')
})
test('missing or outdated sky requires recalculation instead of showing stale stars', () => {
  const destination=go(4,{...complete,skyCurrent:false})
  assert.equal(destination.stage,'moment')
  assert.match(destination.notice,/reveal your night/)
})
