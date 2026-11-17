"""Deterministic physical-star selection; coordinates are never relocated."""
from __future__ import annotations
import math
from typing import Callable, Protocol

class StarPoint(Protocol):
    hipparcos_id: int
    magnitude: float
    x_mm: float
    y_mm: float

def select_physical_stars(candidates: list[StarPoint], *, maximum: int,
                          minimum_separation_mm: float,
                          sky_region: tuple[float,float,float,float],
                          hole_diameter: Callable[[float],float]
                          ) -> tuple[list[tuple[StarPoint,str,float]],int]:
    """Bright anchors, followed by spatially distributed, magnitude-aware fill."""
    if isinstance(maximum,bool) or not 1<=maximum<=128:
        raise ValueError("MAX_PHYSICAL_STARS must be 1..128.")
    if not 1<=minimum_separation_mm<=20:
        raise ValueError("Physical minimum separation must be 1..20 mm.")
    x,y,width,height=sky_region
    eligible=[]
    seen=set()
    for star in candidates:
        if star.hipparcos_id in seen:continue
        seen.add(star.hipparcos_id)
        margin=2.0+hole_diameter(star.magnitude)/2
        if x+margin<=star.x_mm<=x+width-margin and y+margin<=star.y_mm<=y+height-margin:
            eligible.append(star)
    eligible.sort(key=lambda star:(star.magnitude,star.hipparcos_id))
    selected:list[tuple[StarPoint,str,float]]=[]
    picked=set()
    spacing_squared=minimum_separation_mm**2
    def nearest_sq(star):
        return min(((star.x_mm-other.x_mm)**2+(star.y_mm-other.y_mm)**2)
                   for other,_,_ in selected) if selected else float("inf")
    for star in eligible:
        if len(selected)>=min(6,maximum):break
        if nearest_sq(star)>=spacing_squared:
            selected.append((star,"bright_anchor",1.0))
            picked.add(star.hipparcos_id)
    coverage_scale=max(10.0,math.hypot(width,height)/6)
    while len(selected)<maximum:
        best=None
        best_score=float("-inf")
        for star in eligible:
            if star.hipparcos_id in picked:continue
            sq=nearest_sq(star)
            if sq<spacing_squared:continue
            coverage=min(math.sqrt(sq),coverage_scale)/coverage_scale
            brightness=min(1.0,max(0.0,(6.5-star.magnitude)/8.5))
            score=1.7*brightness+1.25*coverage
            if score>best_score+1e-12 or (
                abs(score-best_score)<=1e-12 and best is not None
                and (star.magnitude,star.hipparcos_id)<(best.magnitude,best.hipparcos_id)):
                best,best_score=star,score
        if best is None:break
        selected.append((best,"balanced_field",round(best_score,5)))
        picked.add(best.hipparcos_id)
    return selected,len(eligible)
