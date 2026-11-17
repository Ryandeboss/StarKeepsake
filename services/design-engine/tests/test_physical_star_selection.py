import unittest
from dataclasses import dataclass
from physical_star_selection import select_physical_stars

@dataclass(frozen=True)
class S:
    hipparcos_id:int
    x_mm:float
    y_mm:float
    magnitude:float

class SelectionTests(unittest.TestCase):
    def test_deterministic_bright_and_spatial(self):
        crowded=[S(i+1,10+i*.15,10+i*.15,-0.5+i*.04) for i in range(25)]
        spread=[S(100+i,40+(i%6)*18,16+(i//6)*17,2+i*.01) for i in range(30)]
        stars=crowded+spread
        args=dict(maximum=24,minimum_separation_mm=4.5,
                  sky_region=(0,0,160,100),hole_diameter=lambda _:1.0)
        chosen,eligible=select_physical_stars(stars,**args)
        self.assertEqual(len(chosen),24)
        self.assertEqual(eligible,len(stars))
        hips=[s.hipparcos_id for s,_,_ in chosen]
        self.assertIn(1,hips)
        self.assertTrue(any(hip>=100 for hip in hips))
        self.assertEqual(hips,[s.hipparcos_id for s,_,_ in
            select_physical_stars(list(reversed(stars)),**args)[0]])
        for i,(a,_,_) in enumerate(chosen):
            for b,_,_ in chosen[:i]:
                self.assertGreaterEqual((a.x_mm-b.x_mm)**2+
                   (a.y_mm-b.y_mm)**2,4.5**2)
    def test_48_and_sparse(self):
        candidates=[S(i+1,12+(i%9)*15,12+(i//9)*13,2+i*.001)
                    for i in range(65)]
        args=dict(maximum=48,minimum_separation_mm=4.5,
                 sky_region=(0,0,160,125),hole_diameter=lambda _:1.2)
        self.assertEqual(len(select_physical_stars(candidates,**args)[0]),48)
        self.assertEqual(len(select_physical_stars(candidates[:12],**args)[0]),12)
        with self.assertRaises(ValueError):
            select_physical_stars(candidates,**{**args,"maximum":129})
    def test_edges(self):
        stars=[S(1,.5,.5,-1),S(2,45,45,0),S(3,46,46,1),S(4,90,70,2)]
        selected,_=select_physical_stars(stars,maximum=9,
              minimum_separation_mm=5,sky_region=(0,0,110,100),
              hole_diameter=lambda _:1)
        self.assertEqual([s.hipparcos_id for s,_,_ in selected],[2,4])

if __name__=="__main__":unittest.main()
