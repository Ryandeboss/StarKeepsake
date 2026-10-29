import unittest
from io import BytesIO

from PIL import Image
from frame_layout import get_layout
from engraving import prepare_engraving_preview, PIXELS_PER_MM
from astronomy import project_alt_az

class CustomFrameTests(unittest.TestCase):
    def test_aspect_ratio_matches_photo_region(self):
        for ratio in (0.4, 0.5625, 1, 1.5, 16/9, 2.8):
            with self.subTest(ratio=ratio):
                layout=get_layout('auto',ratio)
                x,y,w,h=layout.photo
                self.assertAlmostEqual(w/h,ratio,places=4)
                self.assertLessEqual(layout.height_mm,508)
                self.assertGreater(y,layout.sky[1]+layout.sky[3])
                self.assertGreater(layout.text[1],y+h)
                px,py=project_alt_az(40,80,layout)
                self.assertTrue(layout.sky[0]<=px<=layout.sky[0]+layout.sky[2])
                self.assertTrue(layout.sky[1]<=py<=layout.sky[1]+layout.sky[3])

    def test_bad_aspect_rejected(self):
        for bad in (None,0,0.2,4,float('nan')):
            with self.subTest(bad=bad),self.assertRaises(ValueError):
                get_layout('auto',bad)

    def test_auto_engraving_aspect(self):
        original=Image.new('RGB',(400,250),(85,120,140))
        buf=BytesIO()
        original.save(buf,format='PNG')
        rendered=prepare_engraving_preview(buf.getvalue(),frame_preset_id='auto',photo_aspect_ratio=1.6)
        with Image.open(BytesIO(rendered)) as result:
            layout=get_layout('auto',1.6)
            self.assertEqual(result.size,(
                round(layout.photo[2]*PIXELS_PER_MM),
                round(layout.photo[3]*PIXELS_PER_MM),
            ))

if __name__=='__main__':
    unittest.main()
