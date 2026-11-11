import json
import unittest
from pathlib import Path

CATALOG=Path(__file__).resolve().parents[3]/'docs'/'manufacturing'/'m6-prototype-catalog.json'

class M6CandidateCatalogTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc=json.loads(CATALOG.read_text(encoding='utf-8'))

    def test_never_auto_import_or_purchase_draft(self):
        self.assertEqual(self.doc['status'],'CANDIDATE_PROTOTYPE_ONLY')
        self.assertFalse(self.doc['externalSpendAllowed'])
        self.assertFalse(self.doc['autoImportToM3'])
        for recipe in self.doc['recipes']:
            self.assertFalse(recipe['readyForManufacturing'])
            self.assertFalse(recipe['readyForAutomaticOrder'])

    def test_unique_material_ids_and_compatible_units(self):
        items=self.doc['materials']
        skus=[p['sku'] for p in items]
        self.assertEqual(len(skus),len(set(skus)))
        self.assertGreaterEqual(len(skus),15)
        for p in items:
            self.assertIn(p['unit'],('each','ft','m','sheet','ml'))
            self.assertIsNone(p['unitCostCents'],'Catalog costs cannot be fabricated.')
            self.assertIsNone(p['amazonAsin'],'Do not invent Amazon ASINs.')
            self.assertIsNone(p['verifiedOnHand'],'Verify physical stock manually.')
            self.assertFalse(p['packSizeVerified'])
            self.assertFalse(p['physicalSpecsVerified'])

    def test_two_finish_recipes_reference_catalog(self):
        catalog=set(p['sku'] for p in self.doc['materials'])
        self.assertEqual(set(r['finish'] for r in self.doc['recipes']),{'walnut','ebony'})
        for recipe in self.doc['recipes']:
            self.assertEqual(recipe['desiredFrameSizeIn'],'11x14')
            self.assertIsNone(recipe['confirmedVendorFrameDepthIn'])
            skus=[x['sku'] for x in recipe['lines']]
            self.assertEqual(len(skus),len(set(skus)))
            self.assertTrue(set(skus).issubset(catalog))
            self.assertTrue(all(x['wastePercent'] is None for x in recipe['lines']))
        walnut=next(r for r in self.doc['recipes'] if r['finish']=='walnut')
        ebony=next(r for r in self.doc['recipes'] if r['finish']=='ebony')
        self.assertIn('FRAME-WALNUT',[x['sku'] for x in walnut['lines']])
        self.assertIn('FRAME-BLACK',[x['sku'] for x in ebony['lines']])
        self.assertNotIn('FRAME-WALNUT',[x['sku'] for x in ebony['lines']])
        self.assertNotIn('FRAME-BLACK',[x['sku'] for x in walnut['lines']])

    def test_existing_controller_is_only_reported_owned(self):
        p=next(p for p in self.doc['materials'] if p['sku']=='PICO-W')
        self.assertEqual(p['reportedOwnedQuantity'],2)
        self.assertIsNone(p['verifiedOnHand'])

if __name__=='__main__':
    unittest.main()
