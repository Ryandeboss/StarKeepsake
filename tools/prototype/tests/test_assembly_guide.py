import json
import unittest
from tools.prototype.artwork import export
from tools.prototype.assembly_guide import GuideError, generate

def inputs():
    order={"format":"starkeepsake-order-v1","reference":"SK-0123456789ABCDEF",
      "status":"UNPAID_PREVIEW","preferences":{"layout":"above"},
      "design":{"schemaVersion":"1.5","designId":"SK-0123456789ABCDEF",
       "astronomy":{"catalog":"hipparcos"},"framePresetId":"11x14",
       "physicalArtwork":{"widthMm":279.4,"heightMm":355.6,"origin":"top-left","units":"mm"},
       "regions":{"sky":{"xMm":6,"yMm":6,"widthMm":267.4,"heightMm":161.132},
          "engravingPhoto":{"xMm":6,"yMm":170.688,"widthMm":267.4,"heightMm":142.24},
          "text":{"xMm":6,"yMm":314.706,"widthMm":267.4,"heightMm":34.894}},
       "stars":[{"hipparcosId":1,"xMm":40,"yMm":40,"holeSizeMm":1.4,"magnitude":1},
          {"hipparcosId":2,"xMm":120,"yMm":60,"holeSizeMm":1.0,"magnitude":2},
          {"hipparcosId":3,"xMm":150,"yMm":100,"holeSizeMm":1.0,"magnitude":3}]}}
    files=export(order,max_leds=3)
    return json.loads(files["led_map.json"]),json.loads(files["prototype_review.json"])

class M5Tests(unittest.TestCase):
    def test_m4_to_m5_stays_on_hold(self):
        a,b=inputs()
        files=generate(a,b)
        guide=json.loads(files["assembly_workbook.json"])
        self.assertEqual(guide["status"],"HOLD_NOT_APPROVED")
        self.assertFalse(guide["manufacturingAuthorized"])
        self.assertFalse(guide["paymentVerified"])
        self.assertEqual(len(guide["steps"]),9)
        self.assertTrue(all(s["state"]=="unverified" for s in guide["steps"]))
        self.assertEqual(guide["ledCount"],3)
        self.assertIn("Unmeasured",files["assembly_guide.html"])
        self.assertIn("manufacturingAuthorized:false",files["assembly_guide.html"])
    def test_mismatch_rejected(self):
        a,b=inputs()
        b["designReference"]="SK-AAAAAAAAAAAAAAAA"
        with self.assertRaises(GuideError):generate(a,b)
        a,b=inputs();a["count"]=30
        with self.assertRaises(GuideError):generate(a,b)
    def test_partial_untrusted_dimensions_rejected(self):
        a,b=inputs()
        with self.assertRaises(GuideError):
            generate(a,b,{"openingWidthMm":250})
        with self.assertRaises(GuideError):
            generate(a,b,{"openingWidthMm":float("nan"),"openingHeightMm":350})
        with self.assertRaises(GuideError):
            generate(a,b,{"customerEmail":"test@example.com"})
    def test_nonuniform_scale_warning(self):
        a,b=inputs()
        files=generate(a,b,{"openingWidthMm":250,"openingHeightMm":350,
           "usableDepthMm":35,"substrate":"printed-paper","ledModel":"TESTLED","supplyModel":"TESTPSU"})
        d=json.loads(files["assembly_workbook.json"])
        self.assertIn("nonuniform scaling"," ".join(d["warnings"]))
        self.assertFalse(d["manufacturingAuthorized"])
    def test_html_escape_and_privacy(self):
        a,b=inputs()
        evil="<script>alert(1)</script>"
        files=generate(a,b,{"frameModel":evil})
        self.assertNotIn(evil,files["assembly_guide.html"])
        self.assertIn("&lt;script&gt;",files["assembly_guide.html"])
        self.assertNotIn("http://",files["assembly_guide.html"])
        self.assertNotIn("https://",files["assembly_guide.html"])
    def test_bad_led_position_and_contiguous_mapping(self):
        a,b=inputs();a["leds"][1]["index"]=5
        with self.assertRaises(GuideError):generate(a,b)
        a,b=inputs();a["leds"][0]["xMm"]=999
        with self.assertRaises(GuideError):generate(a,b)

if __name__=="__main__":
    unittest.main()

from datetime import datetime, timezone
from tools.prototype.review_validation import check_review, ReviewError

class EvidenceTests(unittest.TestCase):
    def fixture(self):
        a,b=inputs()
        workbook=json.loads(generate(a,b)["assembly_workbook.json"])
        record={"format":"starkeepsake-m5-qc-review-v1",
            "reference":workbook["reference"],"mapFingerprint":workbook["mapFingerprint"],
            "status":"PROTOTYPE_REVIEW_ONLY",
            "manufacturingAuthorized":False,"paymentVerified":False,
            "reviewerName":"Bench reviewer",
            "exportedAtUtc":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
            "steps":[{"id":s["id"],"state":"unverified","evidenceNotes":""} for s in workbook["steps"]]}
        return workbook,record

    def test_html_has_editable_checks_and_import_button(self):
        a,b=inputs()
        files=generate(a,b)
        guide=files["assembly_guide.html"]
        self.assertIn('data-state=',guide)
        self.assertIn('data-evidence=',guide)
        self.assertIn('id="load-review"',guide)
        self.assertIn('data-fingerprint=',guide)
        self.assertIn("manufacturingAuthorized:false",guide)
        self.assertNotIn("https://",guide)

    def test_pass_and_needs_rework_still_hold(self):
        workbook,record=self.fixture()
        record["steps"][0]["state"]="passed"
        record["steps"][0]["evidenceNotes"]="Verified reference for a test prototype"
        record["steps"][1]["state"]="needs_rework"
        record["steps"][1]["evidenceNotes"]="Frame dimensions need measurement"
        result=check_review(record,workbook)
        self.assertEqual(result["passed"],1)
        self.assertEqual(result["needsRework"],1)
        self.assertEqual(result["unverified"],7)
        self.assertFalse(result["manufacturingAuthorized"])

    def test_review_refuses_wrong_map_and_fake_authorization(self):
        workbook,record=self.fixture()
        record["mapFingerprint"]="a"*64
        with self.assertRaises(ReviewError):check_review(record,workbook)
        workbook,record=self.fixture()
        record["paymentVerified"]=True
        with self.assertRaises(ReviewError):check_review(record,workbook)
        workbook,record=self.fixture()
        record["manufacturingAuthorized"]=True
        with self.assertRaises(ReviewError):check_review(record,workbook)

    def test_no_empty_pass_or_unexpected_private_fields(self):
        workbook,record=self.fixture()
        record["steps"][0]["state"]="passed"
        with self.assertRaises(ReviewError):check_review(record,workbook)
        record["steps"][0]["evidenceNotes"]="Measured on bench"
        record["customerEmail"]="private@example.com"
        with self.assertRaises(ReviewError):check_review(record,workbook)
        workbook,record=self.fixture()
        record["steps"][0]["evidenceNotes"]="x"*1201
        with self.assertRaises(ReviewError):check_review(record,workbook)

    def test_full_review_still_does_not_authorize_manufacturing(self):
        workbook,record=self.fixture()
        for step in record["steps"]:
            step["state"]="passed"
            step["evidenceNotes"]="Inspection evidence on the physical prototype"
        result=check_review(record,workbook)
        self.assertEqual(result["passed"],9)
        self.assertEqual(result["unresolvedStepIds"],[])
        self.assertEqual(result["status"],"HOLD_NOT_APPROVED")
        self.assertFalse(result["paymentVerified"])
