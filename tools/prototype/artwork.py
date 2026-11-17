"""StarKeepsake M4 offline prototype guide generator (NOT LASER READY).

Reads order.json saved design packet. Outputs nominal-mm registration crosshairs,
a physically sequential LED map and a non-production QA report. No laser commands.
"""
import argparse
import json
import math
import os
import re
from pathlib import Path
from xml.etree import ElementTree as ET

class PrototypeError(ValueError):
    pass

def check_num(value, label, low, high):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not low <= value <= high:
        raise PrototypeError("Invalid " + label)
    return float(value)

def rect(value, key, w, h):
    if not isinstance(value, dict):
        raise PrototypeError("Missing " + key)
    x = check_num(value.get("xMm"), key+".x", 0, w)
    y = check_num(value.get("yMm"), key+".y", 0, h)
    a = check_num(value.get("widthMm"), key+".width", 1, w)
    b = check_num(value.get("heightMm"), key+".height", 1, h)
    if x+a > w+.002 or y+b > h+.002:
        raise PrototypeError("Region outside artboard: " + key)
    return (x,y,a,b)

def parse_order(payload):
    if not isinstance(payload,dict) or payload.get("format")!="starkeepsake-order-v1":
        raise PrototypeError("Expected StarKeepsake order.json")
    ref=payload.get("reference")
    if not isinstance(ref,str) or not re.fullmatch(r"SK-[0-9A-F]{16}",ref):
        raise PrototypeError("Permanent SK-16-hex Design ID required. Save design first.")
    if payload.get("status")!="UNPAID_PREVIEW":
        raise PrototypeError("Unsupported packet status")
    d=payload.get("design")
    if not isinstance(d,dict) or d.get("schemaVersion")!="1.5" or d.get("designId")!=ref or not d.get("astronomy"):
        raise PrototypeError("Incomplete/mismatched DesignSpec v1.5")
    art=d.get("physicalArtwork")
    if not isinstance(art,dict) or art.get("units")!="mm" or art.get("origin")!="top-left":
        raise PrototypeError("Expected millimeter top-left artboard")
    w=check_num(art.get("widthMm"),"artboard width",100,600)
    h=check_num(art.get("heightMm"),"artboard height",100,650)
    r=d.get("regions")
    if not isinstance(r,dict):
        raise PrototypeError("Missing artwork regions")
    regions={name:rect(r.get(name),name,w,h) for name in ("sky","engravingPhoto","text")}
    for i,key in enumerate(regions):
        ax,ay,aw,ah=regions[key]
        for other in list(regions)[i+1:]:
            bx,by,bw,bh=regions[other]
            if min(ax+aw,bx+bw)>max(ax,bx)+.001 and min(ay+ah,by+bh)>max(ay,by)+.001:
                raise PrototypeError("Overlapping design regions")
    stars=d.get("stars")
    if not isinstance(stars,list) or not 1<=len(stars)<=200:
        raise PrototypeError("Missing canonical star field")
    normalized=[]
    seen=set()
    sx,sy,sw,sh=regions["sky"]
    for s in stars:
        if not isinstance(s,dict):
            raise PrototypeError("Bad star record")
        x=check_num(s.get("xMm"),"star x",0,w)
        y=check_num(s.get("yMm"),"star y",0,h)
        dia=check_num(s.get("holeSizeMm"),"star marker size",.3,4)
        mag=check_num(s.get("magnitude"),"star magnitude",-3,8)
        hip=s.get("hipparcosId")
        if isinstance(hip,bool) or not isinstance(hip,int) or hip<=0 or hip in seen:
            raise PrototypeError("Invalid/duplicate star catalog ID")
        seen.add(hip)
        if not sx<=x<=sx+sw or not sy<=y<=sy+sh:
            raise PrototypeError("Star outside sky region; do not fabricate")
        normalized.append({"xMm":x,"yMm":y,"diameter":dia,"magnitude":mag,"hipparcosId":hip})
    physical=d.get("physicalStars")
    subset=None
    if physical is not None:
        if not isinstance(physical,list) or len(physical)>128:
            raise PrototypeError("Invalid physical star set")
        by_hip={s["hipparcosId"]:s for s in normalized}
        subset=[]
        for i,record in enumerate(physical):
            if not isinstance(record,dict) or record.get("ledIndex")!=i:
                raise PrototypeError("Physical LED indices must be 0..N-1")
            hip=record.get("hipparcosId")
            if isinstance(hip,bool) or not isinstance(hip,int) or hip not in by_hip:
                raise PrototypeError("Physical star must be included in digital catalogue")
            canonical=by_hip[hip]
            if any(abs(check_num(record.get(k),k,-3 if k=="magnitude" else 0,
                     8 if k=="magnitude" else max(w,h))-canonical[k])>.002
                   for k in ("xMm","yMm","magnitude")):
                raise PrototypeError("Physical star coordinates mismatch saved sky")
            subset.append({**canonical,"index":i,
                "selectionReason":record.get("selectionReason","unspecified")})
    return {"reference":ref,"widthMm":w,"heightMm":h,
            "framePresetId":d.get("framePresetId"),"regions":regions,"stars":normalized,
            "physicalStars":subset,"physicalSelection":d.get("physicalSelection"),
            "printSpec":payload.get("manufacturing",{}).get("print") if isinstance(payload.get("manufacturing"),dict) else None}

def select_leds(design,count=None,spacing=3.5):
    limit=int(os.getenv("MAX_PHYSICAL_STARS","48"))
    if limit<1 or limit>128:
        raise PrototypeError("MAX_PHYSICAL_STARS must be 1..128")
    if count is not None and (isinstance(count,bool) or not isinstance(count,int) or not 1<=count<=limit):
        raise PrototypeError("LED request exceeds configured physical-star maximum")
    spacing=check_num(spacing,"spacing",2,20)
    sx,sy,sw,sh=design["regions"]["sky"]
    selected=[]
    authoritative=design.get("physicalStars")
    if authoritative is not None:
        if len(authoritative)>limit:
            raise PrototypeError("Saved physical star count exceeds current product limit; review before manufacturing")
        source=authoritative[:count] if count is not None else authoritative
    else:
        source=sorted(design["stars"],key=lambda s:(s["magnitude"],s["hipparcosId"]))
    for star in source:
        x,y=star["xMm"],star["yMm"]
        margin=2+star["diameter"]/2
        if not sx+margin<=x<=sx+sw-margin or not sy+margin<=y<=sy+sh-margin:
            if authoritative is not None:raise PrototypeError("Saved physical star is too close to sky edge")
            continue
        if any(math.hypot(x-s["xMm"],y-s["yMm"])<spacing for s in selected):
            if authoritative is not None:raise PrototypeError("Physical star separation failed validation")
            continue
        selected.append({**star,"index":len(selected)})
        if authoritative is None and len(selected)==(count if count is not None else limit):break
    if not selected:
        raise PrototypeError("No safe physical stars were available; production HOLD")
    return selected

def number(v):
    return ("%.3f"%v).rstrip("0").rstrip(".")

def registration_svg(design,leds):
    ns="http://www.w3.org/2000/svg"
    ET.register_namespace("",ns)
    w,h=design["widthMm"],design["heightMm"]
    root=ET.Element("{%s}svg"%ns,{
        "width":number(w)+"mm","height":number(h)+"mm",
        "viewBox":"0 0 %s %s"%(number(w),number(h)),
        "data-purpose":"REFERENCE_ONLY_NOT_LASER_READY"})
    ET.SubElement(root,"{%s}title"%ns).text="StarKeepsake nominal prototype registration - DO NOT CUT"
    ET.SubElement(root,"{%s}desc"%ns).text=("Crosshair alignment reference only. "
        "No approved cutting paths, real frame measurements, kerf or machine settings.")
    for zone,color in (("sky","#486f93"),("engravingPhoto","#739170"),("text","#ac8d53")):
        x,y,rw,rh=design["regions"][zone]
        ET.SubElement(root,"{%s}rect"%ns,{"id":zone,"x":number(x),"y":number(y),
            "width":number(rw),"height":number(rh),"fill":"none",
            "stroke":color,"stroke-width":"0.3"})
    for led in leds:
        x,y=led["xMm"],led["yMm"]
        group=ET.SubElement(root,"{%s}g"%ns,{"id":"LED-%02d"%led["index"]})
        for x1,y1,x2,y2 in ((x-1,y,x+1,y),(x,y-1,x,y+1)):
            ET.SubElement(group,"{%s}line"%ns,{
                "x1":number(x1),"y1":number(y1),"x2":number(x2),"y2":number(y2),
                "stroke":"#d36844","stroke-width":"0.18"})
    return ET.tostring(root,encoding="unicode")

def export(payload,max_leds=None):
    d=parse_order(payload)
    leds=select_leds(d,count=max_leds)
    mapping={"format":"starkeepsake-prototype-led-map-v1","reference":d["reference"],
        "board":"Pico W family (model/wiring to be verified)",
        "dataGpio":0,"count":len(leds),
        "driverChannelsPerBoard":24,"estimatedDriverCount":math.ceil(len(leds)/24),
        "selectionSource":"saved_physicalStars" if d["physicalStars"] is not None else "legacy_reselected_HOLD",
        "leds":[{"index":s["index"],"hipparcosId":s["hipparcosId"],
                 "xMm":round(s["xMm"],3),"yMm":round(s["yMm"],3),
                 "magnitude":s["magnitude"],"apertureMm":s["diameter"],
                 "selectionReason":s.get("selectionReason","legacy_unverified")} for s in leds],
        "powerNote":"At 60mA full white per WS2812-compatible RGB pixel, the LED-only theoretical upper estimate is %d mA; verify actual strip and supply."%(len(leds)*60)}
    report={"status":"REFERENCE_ONLY_NOT_APPROVED_FOR_LASER",
        "designReference":d["reference"],"nominalArtworkMm":{"width":d["widthMm"],"height":d["heightMm"]},
        "selectedLedCount":len(leds),"originalStarCount":len(d["stars"]),
        "maxPhysicalStars":int(os.getenv("MAX_PHYSICAL_STARS","48")),
        "printSpec":d["printSpec"],
        "driverCountEstimate":math.ceil(len(leds)/24),
        "selectionSource":mapping["selectionSource"],
        "reviewRequired":[
          "UNPAID_PREVIEW is not a paid Etsy order or authorization to manufacture.",
          "Confirm real frame opening, substrate dimensions, kerf and laser compatibility.",
          "Nominal star coordinates are NOT a validated physical cut path.",
          "Reconcile immersive camera/horizon composition against canonical artwork.",
          "Verify print bleed/trim/safe metadata and oversize lab proof before mounting.",
          "Legacy packets must be recalculated for authoritative physicalStars.",
          "LED index is a proposed logical wiring order, not physical routing."
        ]}
    return {"registration_reference.svg":registration_svg(d,leds),
            "led_map.json":json.dumps(mapping,indent=2,sort_keys=True)+"\n",
            "prototype_review.json":json.dumps(report,indent=2,sort_keys=True)+"\n",
            "READ_ME_FIRST.txt":"M4 prototype reference only. NOT LASER READY. Do not send this SVG directly to any laser or cutting machine.\nNo G-code, machine settings, or verified kerf/stock dimensions exist. Do not fabricate a customer order without verified payment and physical QA.\n"}

def main():
    ap=argparse.ArgumentParser(description="Offline StarKeepsake prototype alignment exporter (NO laser output)")
    ap.add_argument("order_json",type=Path)
    ap.add_argument("--out",required=True,type=Path)
    ap.add_argument("--leds",type=int,default=None,
                    help="Optional smaller bench subset. Default uses ALL saved physicalStars, max configured.")
    args=ap.parse_args()
    try:
        data=args.order_json.read_bytes()
        if len(data)>2*1024*1024:
            raise PrototypeError("Order JSON exceeds 2 MiB")
        outputs=export(json.loads(data),args.leds)
        args.out.mkdir(parents=True,exist_ok=True)
        for name,value in outputs.items():
            (args.out/name).write_text(value,encoding="utf-8")
    except (PrototypeError,ValueError,OSError) as exc:
        ap.error(str(exc))
    print("Reference files exported; not machine-ready. No purchases or laser commands.")

if __name__=="__main__":
    main()
