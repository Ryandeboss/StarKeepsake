"""StarKeepsake M5 offline dynamic assembly workbook. No manufacturing authorization."""
import argparse
import hashlib
from html import escape
import json
import math
from pathlib import Path
import re

class GuideError(ValueError):
    pass

def bounded(x, name, low, high):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) or not low <= x <= high:
        raise GuideError("Invalid " + name)
    return float(x)

def optional_number(measurements, name, low, high):
    x = measurements.get(name)
    return None if x is None else bounded(x, name, low, high)

def validate(mapping, review, measurements):
    if not isinstance(mapping, dict) or mapping.get("format") != "starkeepsake-prototype-led-map-v1":
        raise GuideError("Expected M4 led_map.json")
    if not isinstance(review, dict) or review.get("status") != "REFERENCE_ONLY_NOT_APPROVED_FOR_LASER":
        raise GuideError("Expected unapproved M4 prototype_review.json")
    ref = mapping.get("reference")
    if not isinstance(ref, str) or not re.fullmatch(r"SK-[0-9A-F]{16}", ref) or review.get("designReference") != ref:
        raise GuideError("Saved Design IDs must match")
    n = mapping.get("count")
    leds = mapping.get("leds")
    if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= 30 or not isinstance(leds, list) or len(leds) != n or review.get("selectedLedCount") != n:
        raise GuideError("Invalid LED count")
    if not isinstance(mapping.get("board"), str) or "Pico 2 W" not in mapping["board"] or mapping.get("dataGpio") != 0:
        raise GuideError("Pico 2 W / GPIO0 prototype map expected")
    art = review.get("nominalArtworkMm")
    if not isinstance(art, dict):
        raise GuideError("Nominal dimensions missing")
    w = bounded(art.get("width"), "nominal width", 100, 600)
    h = bounded(art.get("height"), "nominal height", 100, 650)
    ids = set()
    points = []
    for index, led in enumerate(leds):
        if not isinstance(led, dict) or isinstance(led.get("index"), bool) or led.get("index") != index:
            raise GuideError("LED indices must be contiguous")
        hip = led.get("hipparcosId")
        if isinstance(hip, bool) or not isinstance(hip, int) or hip <= 0 or hip in ids:
            raise GuideError("Invalid Hipparcos ID")
        ids.add(hip)
        x = bounded(led.get("xMm"), "LED x", 0, w)
        y = bounded(led.get("yMm"), "LED y", 0, h)
        mag = bounded(led.get("magnitude"), "magnitude", -3, 8)
        points.append({"index": index, "hipparcosId": hip, "xMm": x, "yMm": y, "magnitude": mag})
    if not isinstance(measurements, dict):
        raise GuideError("Measurements must be a JSON object")
    allowed = {"openingWidthMm", "openingHeightMm", "usableDepthMm",
               "substrate", "frameModel", "ledModel", "supplyModel", "notes"}
    if set(measurements) - allowed:
        raise GuideError("Unrecognized measurements field; use the sample template")
    mw = optional_number(measurements, "openingWidthMm", 25, 650)
    mh = optional_number(measurements, "openingHeightMm", 25, 700)
    depth = optional_number(measurements, "usableDepthMm", 1, 300)
    if (mw is None) != (mh is None):
        raise GuideError("Both actual opening dimensions must be measured together")
    substrate = measurements.get("substrate", "unknown")
    if substrate not in ("unknown", "printed-paper", "laser-test", "other"):
        raise GuideError("Unrecognized substrate category")
    fields = {}
    for key in ("frameModel", "ledModel", "supplyModel", "notes"):
        value = measurements.get(key)
        if value is not None and (not isinstance(value, str) or len(value) > (400 if key == "notes" else 120)):
            raise GuideError("Invalid field " + key)
        fields[key] = value.strip() if value else None
    physical = {"openingWidthMm": mw, "openingHeightMm": mh,
                "usableDepthMm": depth, "substrate": substrate, **fields}
    warnings = [
        "Nominal star coordinates are NOT a validated laser or drilling path.",
        "A saved design is not proof of a paid Etsy order. No customer fulfillment is authorized.",
        "No real material, power, thermal, laser, or shipping safety approval is implied."
    ]
    if mw is None or depth is None:
        warnings.append("Actual frame opening/depth missing: mechanical QA remains blocked.")
    else:
        if abs(mw/w - mh/h) > .01:
            warnings.append("Measured opening has nonuniform scaling: never stretch the sky map.")
        if abs(mw/w - 1) > .01 or abs(mh/h - 1) > .01:
            warnings.append("Artwork differs from measured opening: manually revise and recheck registration.")
    if not fields["ledModel"] or not fields["supplyModel"]:
        warnings.append("LED and PSU models unverified; electrical bench work requires a separate review.")
    if substrate == "unknown":
        warnings.append("Printed or laser-tested substrate is not yet selected.")
    return {"reference": ref, "ledCount": n, "nominalWidthMm": w,
            "nominalHeightMm": h, "leds": points, "measurements": physical,
            "warnings": warnings}

def steps(info):
    n = info["ledCount"]
    return [
        ("intake", "Intake", "Verify the saved Design ID and test-only scope",
         "For customer production, independently verify Etsy payment and matching in the private studio. This packet is not evidence of payment.",
         "Reviewer/date and separate work authorization"),
        ("measure", "Frame", "Measure the real frame opening, depth and backing",
         "Compare the physical opening to nominal " + str(info["nominalWidthMm"]) + " x " +
         str(info["nominalHeightMm"]) + " mm. Check rabbet/mat clearance; do not scale only one axis.",
         "Caliper readings, drawing, ruler photo"),
        ("artwork", "Artwork", "Calibrate a paper/photo substrate on scrap",
         "Check the printed registration crosshairs, contrast, print scale, crop and photo/sky/inscription alignment. No laser cutting or machine settings are supplied.",
         "Dated sample, image and calibration notes"),
        ("optics", "Lighting", "Map " + str(n) + " logical star positions to real optical routes",
         "Review light guides/fibers/diffusers, star spacing and serviceability. Logical LED index is not a drilled hole location or strip routing plan.",
         "Optical map and clearance photographs"),
        ("electrical", "Electrical", "Inspect regulated power, logic shifting and current",
         "Verify Pico 2 W 3.3V GPIO, suitable 5V LED logic buffer, common ground, external protected supply, wiring, strain relief and current/thermal measurements.",
         "Wiring diagram, voltage/current/temperature evidence"),
        ("firmware", "Controller", "Bench-test safe LED startup and power-off",
         "Keep firmware interlocks disabled until electronics review. Under supervision, confirm indexed LEDs, low brightness, reset behavior and darkness when off.",
         "Bench video, firmware revision and test report"),
        ("assembly", "Frame build", "Check mechanical retention and light leaks",
         "Inspect backing, edges, secure strain relief, photo registration, rear service access and oblique-angle appearance. Never seal before physical review.",
         "Assembly photo sequence and fit measurements"),
        ("qa", "Final prototype QA", "Inspect stability, heat, color, handling and packaging",
         "Run supervised power/thermal, image quality and handling tests. Document deviations; checkboxes do not certify retail compliance.",
         "Signed QA record and failure/rework notes"),
        ("release", "Approval gate", "Separate prototype completion from customer fulfillment",
         "A human must independently verify payment, finalized M3 BOM, real equipment/material compatibility, and manufacturing safety before a customer build.",
         "Independent production authorization; never generated by this tool"),
    ]

def generate(mapping, review, measurements=None):
    v = validate(mapping, review, {} if measurements is None else measurements)
    checklist = [{"id": sid, "phase": phase, "title": title,
                  "instructions": body, "evidenceRequired": evidence,
                  "state": "unverified", "evidenceNotes": ""}
                 for sid, phase, title, body, evidence in steps(v)]
    fingerprint_source=json.dumps({"reference":v["reference"],"leds":v["leds"]},
                                  sort_keys=True,separators=(",",":"),allow_nan=False)
    fingerprint=hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()
    data = {"format": "starkeepsake-m5-workbook-v1",
            "reference": v["reference"], "mapFingerprint": fingerprint,
            "status": "HOLD_NOT_APPROVED",
            "manufacturingAuthorized": False, "paymentVerified": False,
            "nominalArtworkMm": {"width": v["nominalWidthMm"],
                                 "height": v["nominalHeightMm"]},
            "actualMeasurements": v["measurements"],
            "ledCount": v["ledCount"], "warnings": v["warnings"],
            "steps": checklist}
    e = lambda x: escape(str(x), quote=True)
    alerts = "".join("<li>" + e(s) + "</li>" for s in data["warnings"])
    measures = "".join("<tr><th>" + e(k) + "</th><td>" +
                       (e(value) if value is not None else "Unmeasured") + "</td></tr>"
                       for k, value in v["measurements"].items())
    leds = "".join("<tr><td>" + e(x["index"]) + "</td><td>" + e(x["hipparcosId"]) +
                   "</td><td>" + e(round(x["xMm"], 3)) + "</td><td>" +
                   e(round(x["yMm"], 3)) + "</td></tr>" for x in v["leds"])
    cards = "".join(
        '<section class="step"><p class="kicker">' + e(s["phase"]) +
        '</p><h3>' + e(s["title"]) + '</h3><p>' + e(s["instructions"]) +
        '</p><p><strong>Evidence:</strong> ' + e(s["evidenceRequired"]) +
        '</p><div class="review-inputs"><label>Inspection status <select data-state="' +
        e(s["id"]) + '"><option value="unverified">Not inspected</option>' +
        '<option value="passed">Pass — evidence required</option>' +
        '<option value="needs_rework">Needs rework</option></select></label>' +
        '<label>Evidence and observations <textarea data-evidence="' +
        e(s["id"]) + '" rows="3" maxlength="1200" placeholder="Measurements, photo reference, inspector observations, issues"></textarea></label></div></section>'
        for s in checklist)
    style = """
:root{color-scheme:dark;font-family:system-ui,Arial,sans-serif;background:#0b1523;color:#edf1f9}
body{max-width:1050px;margin:auto;padding:25px 22px 80px;line-height:1.6}
h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:45px}
section,header{background:#132137;border:1px solid #354a60;border-radius:13px;padding:20px;margin:15px 0}
.warning{border-color:#b89051;background:#24211c}
.kicker{letter-spacing:.14em;text-transform:uppercase;color:#d9b778;font-size:11px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #384d63;padding:8px;text-align:left;font-size:13px}
h3{margin:0;font-size:20px}label{display:flex;gap:10px;align-items:center;color:#eed4a4}
input{width:18px;height:18px}button{background:#efd09a;border:0;border-radius:8px;padding:11px 15px;font-weight:700}
.blocked{color:#ffcd84;font-weight:700}.step{break-inside:avoid}
.review-inputs{display:grid;gap:14px;margin:15px 0 0}
.review-inputs label{display:grid;gap:6px;font-size:12px}
.review-inputs select,.review-inputs textarea,#reviewer{box-sizing:border-box;width:100%;padding:10px;border:1px solid #647d93;
border-radius:8px;background:#081826;color:#f1f5f8;font:13px system-ui,sans-serif}
.review-inputs textarea{resize:vertical;min-height:68px}
#reviewer{max-width:340px;margin:4px 0 14px}
.review-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.review-actions label{font-size:12px;display:grid;gap:5px}
.review-actions input[type=file]{font-size:11px;max-width:230px}
#review-status{color:#f0c890;font-size:12px;min-height:18px}
@media(max-width:700px){.grid{grid-template-columns:1fr}h1{font-size:32px}}
@media print{:root{color-scheme:light;background:#fff;color:#000}header,section{background:#fff;color:#000;border-color:#999}
button,.review-actions label{display:none}.blocked{color:#000}
.review-inputs select,.review-inputs textarea,#reviewer{background:#fff;color:#000;border-color:#aaa}}
"""
    javascript = """

const fields=Array.from(document.querySelectorAll('select[data-state]'));
const status=document.getElementById('review-status');
const progress=document.getElementById('progress');
const stepIds=fields.map(x=>x.dataset.state);
const validStates=['unverified','passed','needs_rework'];
function rows(){
 return fields.map(field=>{
   const id=field.dataset.state;
   const note=document.querySelector('textarea[data-evidence="'+id+'"]');
   return {id,state:field.value,evidenceNotes:note.value};
 });
}
function refresh(){
 const steps=rows();
 const passed=steps.filter(x=>x.state==='passed').length;
 const failed=steps.filter(x=>x.state==='needs_rework').length;
 progress.textContent=passed+' passed · '+failed+' need rework · '+
   (steps.length-passed-failed)+' not inspected; manufacturing remains BLOCKED.';
 return steps;
}
fields.forEach(x=>x.addEventListener('change',()=>{status.textContent='';refresh();}));
document.querySelectorAll('textarea[data-evidence]').forEach(x=>
 x.addEventListener('input',()=>{status.textContent='';refresh();}));
document.getElementById('save').addEventListener('click',()=>{
 const steps=refresh();
 if(steps.some(x=>x.state==='passed'&&x.evidenceNotes.trim().length<3)){
   status.textContent='Passed steps require an inspection evidence note.';return;
 }
 const reviewerName=document.getElementById('reviewer').value.slice(0,100);
 const item={format:'starkeepsake-m5-qc-review-v1',
   reference:document.body.dataset.ref,mapFingerprint:document.body.dataset.fingerprint,
   status:'PROTOTYPE_REVIEW_ONLY',
   manufacturingAuthorized:false,paymentVerified:false,
   reviewerName,exportedAtUtc:new Date().toISOString(),steps};
 const url=URL.createObjectURL(new Blob([JSON.stringify(item,null,2)],{type:'application/json'}));
 const link=document.createElement('a');
 link.href=url;link.download='m5-prototype-review.json';
 document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
 status.textContent='Review downloaded locally. This is NOT production approval.';
});
document.getElementById('load-review').addEventListener('change',async event=>{
 const file=event.target.files?.[0];
 event.target.value='';
 if(!file)return;
 if(file.size>512*1024){status.textContent='Review file too large.';return;}
 try{
   const item=JSON.parse(await file.text());
   if(!item||typeof item!=='object'||item.format!=='starkeepsake-m5-qc-review-v1'||
      item.reference!==document.body.dataset.ref||
      item.mapFingerprint!==document.body.dataset.fingerprint||
      item.status!=='PROTOTYPE_REVIEW_ONLY'||
      item.manufacturingAuthorized!==false||item.paymentVerified!==false||
      typeof item.reviewerName!=='string'||item.reviewerName.length>100||
      !Array.isArray(item.steps)||item.steps.length!==stepIds.length||
      !item.steps.every((step,i)=>step&&step.id===stepIds[i]&&
        validStates.includes(step.state)&&typeof step.evidenceNotes==='string'&&
        step.evidenceNotes.length<=1200&&
        (step.state!=='passed'||step.evidenceNotes.trim().length>=3))){
     throw new Error('This record does not match this prototype and star map.');
   }
   document.getElementById('reviewer').value=item.reviewerName;
   item.steps.forEach(step=>{
     document.querySelector('select[data-state="'+step.id+'"]').value=step.state;
     document.querySelector('textarea[data-evidence="'+step.id+'"]').value=step.evidenceNotes;
   });
   refresh();
   status.textContent='Review imported locally. Open problems still require inspection.';
 }catch(e){
   status.textContent=e instanceof Error?e.message:'The review could not be imported.';
 }
});
refresh();

"""
    html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>StarKeepsake M5 prototype assembly</title><style>' + style +
        '</style></head><body data-ref="' + e(v["reference"]) +
        '" data-fingerprint="' + e(fingerprint) + '">' +
        '<header><p class="kicker">STARKEEPSAKE / PRIVATE PROTOTYPE WORKBOOK</p>' +
        '<h1>Assembly & QA</h1><p>Design ' + e(v["reference"]) + ' · ' + e(v["ledCount"]) +
        ' logical LEDs</p><p class="blocked">HOLD: NOT LASER READY, NOT PAID, NOT APPROVED FOR FULFILLMENT</p>' +
        '<label for="reviewer">Inspector name or initials</label>' +
        '<input id="reviewer" maxlength="100" placeholder="Reviewer (kept in local review file)">' +
        '<p id="progress" aria-live="polite"></p>' +
        '<div class="review-actions"><button type="button" id="save">Export QA record</button>' +
        '<label>Resume a previous review <input type="file" id="load-review" accept=".json,application/json"></label>' +
        '<button type="button" onclick="window.print()">Print checklist</button></div>' +
        '<p id="review-status" role="status" aria-live="polite"></p></header>' +
        '<section class="warning"><h2>Calibration warnings</h2><ul>' + alerts + '</ul></section>' +
        '<div class="grid"><section><h2>Physical measurements</h2><table>' +
        measures + '</table></section><section><h2>LED index map (mm)</h2><table><tr><th>LED</th><th>HIP</th><th>X</th><th>Y</th></tr>' +
        leds + '</table></section></div><main><h2>Prototype stages</h2>' + cards +
        '</main><p class="blocked">Checkboxes NEVER authorize a customer build or machine operation.</p>' +
        '<script>' + javascript + '</script></body></html>')
    return {"assembly_guide.html": html,
            "assembly_workbook.json": json.dumps(data, indent=2, sort_keys=True) + "\n"}

def load_json(path):
    raw = path.read_bytes()
    if len(raw) > 512 * 1024:
        raise GuideError("Input JSON exceeds size limit")
    return json.loads(raw)

def main():
    p = argparse.ArgumentParser(description="Offline prototype assembly guide, never a manufacturing approval")
    p.add_argument("--m4", required=True, type=Path)
    p.add_argument("--measurements", type=Path)
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()
    try:
        files = generate(load_json(args.m4 / "led_map.json"),
                         load_json(args.m4 / "prototype_review.json"),
                         load_json(args.measurements) if args.measurements else None)
        args.out.mkdir(parents=True, exist_ok=True)
        for name, value in files.items():
            (args.out / name).write_text(value, encoding="utf-8")
    except (OSError, ValueError, TypeError) as exc:
        p.error(str(exc))
    print("Offline assembly workbook written. Production authorization: BLOCKED.")

if __name__ == "__main__":
    main()
