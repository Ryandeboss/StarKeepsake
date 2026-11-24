import test from 'node:test'
import assert from 'node:assert/strict'
import {supplierCandidateFor,supplierSkuFor,resolveSupplierLink,SUPPLIER_COMPONENTS,assemblyQuantity,SUPPLIER_CANDIDATES} from '../src/supplierCandidates.ts'
test('saved links take priority and blank/invalid links fall back for frozen and new orders',()=>{
  const c=supplierCandidateFor('wall_power')
  assert.ok(c)
  assert.equal(supplierSkuFor('wall_power',null),c.sku)
  assert.equal(supplierSkuFor('star_led','LED3FWAW'),'LED3FWAW')
  assert.equal(resolveSupplierLink(c.sku,c,[{sku:c.sku,supplier_url:'https://example.com/owner'}]),'https://example.com/owner')
  assert.equal(resolveSupplierLink(c.sku,c,[{sku:c.sku,supplier_url:''}]),c.url)
  assert.equal(resolveSupplierLink(c.sku,c,[{sku:c.sku,supplier_url:'javascript:bad'}]),c.url)
  assert.equal(resolveSupplierLink(null,null),null)
})
test('all purchased maker parts except expenses have a sourcing candidate',()=>{
  for(const key of ['frame','professional_print','star_led','pico','led_driver','accent_mosfet','wall_power','power_entry','fuse','distribution','harness_groups','star_service','accent_service','mounting_hardware','wire_management','rear_closure','hanger_upgrade','shipping','sintra','mount_film','petg','star_bus_wire','channel_wire','main_wire','heat_shrink','accent_cob','accent_channel','rtv','instruction_stock','spacer_stock'])assert.ok(supplierCandidateFor(key),key)
  assert.ok(SUPPLIER_CANDIDATES.every(c=>c.buildValidation==='Research Candidate'))
})
test('harness component quantities depend on exact frozen star count and group count',()=>{
  const components=SUPPLIER_COMPONENTS.filter(c=>c.key==='harness_groups')
  assert.equal(components.length,4)
  for(const n of [1,10,12,13,24]){
    assert.deepEqual(components.map(c=>assemblyQuantity(c.quantityRule,Math.ceil(n/12),n)),[Math.ceil(n/12),Math.ceil(n/12),n,n])
  }
  assert.equal(SUPPLIER_COMPONENTS.filter(c=>c.key==='shipping').length,2)
})
