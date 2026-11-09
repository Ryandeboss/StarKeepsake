import json
import unittest
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
        with self.assertRaises(PrototypeError):select_leds(parse_order(packet()),31)
    def test_invalid_geometry_overlap(self):
        p=packet();p["design"]["regions"]["engravingPhoto"]["yMm"]=70
        with self.assertRaises(PrototypeError):parse_order(p)

if __name__=="__main__":
    unittest.main()
