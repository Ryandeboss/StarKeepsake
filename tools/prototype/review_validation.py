"""Validate exported M5 local inspection records. Never authorizes manufacturing."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re

FIELDS={"format","reference","mapFingerprint","status","manufacturingAuthorized",
        "paymentVerified","reviewerName","exportedAtUtc","steps"}
STATES={"unverified","passed","needs_rework"}

class ReviewError(ValueError):
    pass

def check_review(review,workbook):
    if not isinstance(review,dict) or not isinstance(workbook,dict):
        raise ReviewError("Expected review and workbook objects")
    if workbook.get("format")!="starkeepsake-m5-workbook-v1" or \
       workbook.get("status")!="HOLD_NOT_APPROVED" or \
       workbook.get("manufacturingAuthorized") is not False or \
       workbook.get("paymentVerified") is not False:
        raise ReviewError("Invalid or privileged workbook")
    if set(review)!=FIELDS or review.get("format")!="starkeepsake-m5-qc-review-v1":
        raise ReviewError("Review fields or version invalid")
    ref=workbook.get("reference")
    digest=workbook.get("mapFingerprint")
    if not isinstance(ref,str) or not re.fullmatch(r"SK-[0-9A-F]{16}",ref) or \
       not isinstance(digest,str) or not re.fullmatch(r"[0-9a-f]{64}",digest) or \
       review.get("reference")!=ref or review.get("mapFingerprint")!=digest:
        raise ReviewError("Review belongs to another design or star map")
    if review.get("manufacturingAuthorized") is not False or \
       review.get("paymentVerified") is not False or \
       review.get("status")!="PROTOTYPE_REVIEW_ONLY":
        raise ReviewError("Local review cannot approve a paid order or manufacturing")
    name=review.get("reviewerName")
    if not isinstance(name,str) or len(name)>100 or any(ord(c)<32 for c in name):
        raise ReviewError("Invalid reviewer identifier")
    stamp=review.get("exportedAtUtc")
    if not isinstance(stamp,str) or len(stamp)>40 or not stamp.endswith("Z"):
        raise ReviewError("Invalid review timestamp")
    try:
        datetime.fromisoformat(stamp.replace("Z","+00:00"))
    except ValueError as exc:
        raise ReviewError("Invalid review timestamp") from exc
    expected=workbook.get("steps")
    steps=review.get("steps")
    if not isinstance(expected,list) or not 1<=len(expected)<=50 or \
       not isinstance(steps,list) or len(expected)!=len(steps):
        raise ReviewError("Missing or incomplete inspection checklist")
    ids=[s.get("id") if isinstance(s,dict) else None for s in expected]
    if None in ids or len(set(ids))!=len(ids):
        raise ReviewError("Invalid workbook checklist IDs")
    counts={s:0 for s in STATES}
    pending=[]
    for idx,item in enumerate(steps):
        if not isinstance(item,dict) or set(item)!={"id","state","evidenceNotes"} or \
           item.get("id")!=ids[idx] or item.get("state") not in STATES:
            raise ReviewError("Inspection ID, state or order changed")
        note=item.get("evidenceNotes")
        if not isinstance(note,str) or len(note)>1200 or "\x00" in note:
            raise ReviewError("Inspection evidence is invalid")
        if item["state"]=="passed" and len(note.strip())<3:
            raise ReviewError("Pass requires written inspection evidence")
        counts[item["state"]]+=1
        if item["state"]!="passed":
            pending.append(item["id"])
    return {"reference":ref,"status":"HOLD_NOT_APPROVED",
            "manufacturingAuthorized":False,"paymentVerified":False,
            "passed":counts["passed"],"needsRework":counts["needs_rework"],
            "unverified":counts["unverified"],"unresolvedStepIds":pending}

def read(path):
    raw=Path(path).read_bytes()
    if len(raw)>512*1024:
        raise ReviewError("Inspection file exceeds 512 KiB")
    return json.loads(raw)

def main():
    parser=argparse.ArgumentParser(description="Inspect an offline M5 review; never authorizes production")
    parser.add_argument("--workbook",type=Path,required=True)
    parser.add_argument("--review",type=Path,required=True)
    args=parser.parse_args()
    try:
        summary=check_review(read(args.review),read(args.workbook))
    except (OSError,TypeError,ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(summary,indent=2))
    print("NOT proof of payment, laser safety, or manufacturing approval.")

if __name__=="__main__":
    main()
