import json
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET
from tools.prototype.artwork import PrototypeError,parse_order,select_leds,export
from firmware.pico2w.effects import intensity

def packet():
    return {"format":"starkeepsake-order-v1","reference":"SK-0123456789ABCDEF",
        "status":"UNPAID_PREVIEW","preferences":{"layout":"above","finish":"oak"},
        "design":{"schemaVersion":"1.5","designId":"SK-0123456789ABCDEF",
        "framePresetId":"11x14","astronomy":{"catalog":"hipparcos"},
        "physicalArtwork":{"widthMm":279.4,"heightMm":355.6,
            "units":"mm","origin":"top-left"},
        "regions":{"sky":{"xMm":6,"yMm":6,"widthMm":267.4,"heightMm":161.132},
                   "engravingPhoto":{"xMm":6,"yMm":170.688,"widthMm":267.4,"heightMm":142.24},
                   "text":{"xMm":6,"yMm":314.706,"widthMm":267.4,"heightMm":34.894}},
        "stars":[{"hipparcosId":1,"xMm":40,"yMm":40,"holeSizeMm":1.4,"magnitude":1.0},
                 {"hipparcosId":2,"xMm":41,"yMm":41,"holeSizeMm":1.2,"magnitude":2.0},
                 {"hipparcosId":3,"xMm":120,"yMm":60,"holeSizeMm":1.0,"magnitude":3.0},
                 {"hipparcosId":4,"xMm":150,"yMm":100,"holeSizeMm":1.0,"magnitude":4.0}]}}

class PrototypeTest(unittest.TestCase):
    def test_nominal_svg_and_led_indices(self):
        outputs=export(packet(),3)
        mapping=json.loads(outputs["led_map.json"])
        self.assertEqual(mapping["count"],3)
        self.assertEqual([led["hipparcosId"] for led in mapping["leds"]],[1,3,4])
        self.assertEqual([led["index"] for led in mapping["leds"]],[0,1,2])
        svg=ET.fromstring(outputs["registration_reference.svg"])
        self.assertEqual(svg.get("data-purpose"),"REFERENCE_ONLY_NOT_LASER_READY")
        self.assertEqual(svg.get("width"),"279.4mm")
        self.assertEqual(len(svg.findall(".//{http://www.w3.org/2000/svg}g")),3)
    def test_not_a_permanent_reference(self):
        p=packet();p["reference"]="SK-ABCDEF012345"
        with self.assertRaises(PrototypeError):parse_order(p)
    def test_outside_sky_not_allowed(self):
        p=packet();p["design"]["stars"][0]["yMm"]=210
        with self.assertRaises(PrototypeError):parse_order(p)
    def test_nonfinite_rejected(self):
        p=packet();p["design"]["stars"][0]["xMm"]=float("nan")
        with self.assertRaises(PrototypeError):parse_order(p)
    def test_no_private_customer_data(self):
        p=packet()
        p["design"]["moment"]={"location":{"displayName":"PRIVATE HOME ADDRESS"}}
        p["original"]={"name":"private-person.jpg"}
        merged=" ".join(export(p).values())
        self.assertNotIn("PRIVATE HOME ADDRESS",merged)
        self.assertNotIn("private-person",merged)
    def test_led_cap_and_count(self):
        for i in range(30):
            self.assertLessEqual(max(intensity(0,i,12345,20)),20)
        with self.assertRaises(ValueError):intensity(0,0,0,255)
        with self.assertRaises(PrototypeError):select_leds(parse_order(packet()),129)
    def test_authoritative_variable_n_is_preserved(self):
        p=packet()
        p["design"]["physicalStars"]=[
            dict(s,ledIndex=i,selectionReason="bright_anchor")
            for i,s in enumerate([p["design"]["stars"][0],p["design"]["stars"][2],p["design"]["stars"][3]])]
        p["design"]["physicalSelection"]={"maxPhysicalStars":48,"algorithm":"bright-anchors-spatial-v1"}
        result=export(p)
        mapping=json.loads(result["led_map.json"])
        self.assertEqual(mapping["selectionSource"],"saved_physicalStars")
        self.assertEqual(mapping["count"],3)
        self.assertEqual(mapping["estimatedDriverCount"],1)
        self.assertEqual(mapping["leds"][-1]["index"],2)
        p["design"]["physicalStars"][0]["xMm"]+=7
        with self.assertRaises(PrototypeError):export(p)
    def test_camera_view_print_positions_drive_registration(self):
        p=packet()
        originals=[p["design"]["stars"][0],p["design"]["stars"][2]]
        p["design"]["physicalStars"]=[
            dict(originals[0],ledIndex=0,printXMm=65.4,printYMm=186.2,
                 selectionReason="view_auto"),
            dict(originals[1],ledIndex=1,printXMm=185.4,printYMm=215.2,
                 selectionReason="view_manual")]
        m=json.loads(export(p)["led_map.json"])
        self.assertEqual(m["count"],2)
        self.assertEqual(m["leds"][0]["xMm"],65.4)
        self.assertEqual(m["leds"][0]["yMm"],186.2)
        self.assertEqual(m["leds"][0]["catalogueXMm"],40.0)
        self.assertEqual(m["leds"][0]["coordinateSpace"],"observer-print-v1")
        p["design"]["physicalStars"][1]["printXMm"]=300
        with self.assertRaises(PrototypeError):export(p)

    def test_more_than_24_leds_without_one_driver_limit(self):
        p=packet()
        p["design"]["stars"]=[
            {"hipparcosId":i+1,"xMm":9+(i%8)*27,"yMm":9+(i//8)*29,
             "holeSizeMm":1.0,"magnitude":2.0} for i in range(36)]
        p["design"]["physicalStars"]=[
            dict(s,ledIndex=i,selectionReason="balanced_field")
            for i,s in enumerate(p["design"]["stars"])]
        with patch.dict("os.environ",{"MAX_PHYSICAL_STARS":"48"}):
            m=json.loads(export(p)["led_map.json"])
        self.assertEqual(m["count"],36)
        self.assertEqual(m["estimatedDriverCount"],2)
        self.assertEqual([s["index"] for s in m["leds"]],list(range(36)))
    def test_invalid_geometry_overlap(self):
        p=packet();p["design"]["regions"]["engravingPhoto"]["yMm"]=70
        with self.assertRaises(PrototypeError):parse_order(p)

if __name__=="__main__":
    unittest.main()
