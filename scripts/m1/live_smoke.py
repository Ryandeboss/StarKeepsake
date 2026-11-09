#!/usr/bin/env python3
"""Live M1 save/reopen smoke test, synthetic 8x8 PNG only, no customer photos.

Requires only the publicly deployed API. Never prints access keys.
Creates ONE clearly identified synthetic SAVED_UNPAID design; it does not
create an Etsy order or interact with payment providers.
"""
import hashlib
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib

BASE = os.getenv("STARKEEPSAKE_API_URL", "https://starkeepsake-api-dev.wittyflower-9225f265.centralus.azurecontainerapps.io").rstrip("/")
EXPECTED_SHA = os.getenv("EXPECTED_DEPLOY_COMMIT", "708b8df73c83a496282e02f45bc40d8fe527c956")

def call(path, *, method="GET", data=None, headers=None):
    request = urllib.request.Request(BASE + path, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            return response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        # Avoid echoing any response bodies that could include user-controlled data.
        return error.code, b"", error.headers

def png_fixture():
    width = height = 8
    rows = b"".join(b"\x00" + bytes((x * 23 + y * 11) % 256 for x in range(width)) for y in range(height))
    def chunk(name, body):
        return struct.pack(">I", len(body)) + name + body + struct.pack(">I", zlib.crc32(name + body) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b""))

def multipart(fields, image):
    boundary = "M1SmokeTestBoundary"
    chunks = []
    for name, value in fields.items():
        chunks.append(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n").encode())
    chunks.append(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"m1-smoke.png\"\r\nContent-Type: image/png\r\n\r\n").encode())
    chunks.append(image)
    chunks.append(("\r\n--" + boundary + "--\r\n").encode())
    return b"".join(chunks), "multipart/form-data; boundary=" + boundary

print("Waiting for the intended M1 API deployment (health commit SHA checked)...")
for attempt in range(25):
    status, body, _ = call("/health")
    if status == 200:
        try:
            health = json.loads(body)
            if health.get("commitSha") == EXPECTED_SHA:
                break
        except (ValueError, TypeError):
            pass
    if attempt == 24:
        sys.exit("FAIL: Azure API deployment did not reach the expected commit")
    time.sleep(10)
print("PASS: desired Azure API version is healthy")

image = png_fixture()
design = {
    "schemaVersion": "1.5",
    "designId": "smoke-test-only",
    "moment": {"date": "2026-11-09", "location": {
        "query": "M1 synthetic test", "displayName": "M1 SYNTHETIC TEST - NOT A CUSTOMER"
    }},
    "photo": {"assetId": "synthetic-png"},
    "astronomy": {"catalog": "smoke-test"},
    "stars": [],
}
preferences = {"layout": "above", "finish": "oak"}
data, content_type = multipart({"design": json.dumps(design), "preferences": json.dumps(preferences)}, image)
status, body, _ = call("/api/designs", method="POST", data=data, headers={"Content-Type": content_type})
if status != 200:
    sys.exit("FAIL: synthetic Save Design returned HTTP " + str(status))
receipt = json.loads(body)
design_id = receipt.get("designId", "")
key = receipt.get("accessKey", "")
if not re.fullmatch(r"SK-[0-9A-F]{16}", design_id) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", key):
    sys.exit("FAIL: invalid design receipt format")
if receipt.get("status") != "SAVED_UNPAID":
    sys.exit("FAIL: saved state was not SAVED_UNPAID")
print("PASS: saved synthetic design", design_id, "(no payment or Etsy order created)")

private_path = "/api/designs/" + design_id
status, _, _ = call(private_path)
if status != 404:
    sys.exit("FAIL: unauthenticated metadata GET returned " + str(status))
status, _, _ = call(private_path + "/assets/original")
if status != 404:
    sys.exit("FAIL: unauthenticated image GET returned " + str(status))
status, _, _ = call(private_path, headers={"X-Design-Access-Key": "X" * 43})
if status != 404:
    sys.exit("FAIL: incorrect key returned " + str(status))
print("PASS: missing/wrong keys cannot read private design")

private_headers = {"X-Design-Access-Key": key}
status, body, _ = call(private_path, headers=private_headers)
if status != 200:
    sys.exit("FAIL: authenticated design GET returned " + str(status))
loaded = json.loads(body)
if loaded.get("designId") != design_id:
    sys.exit("FAIL: loaded Design ID mismatch")
if loaded.get("design", {}).get("moment", {}).get("date") != "2026-11-09":
    sys.exit("FAIL: saved design moment mismatch")
if loaded.get("preferences", {}).get("finish") != "oak":
    sys.exit("FAIL: saved preferences mismatch")
if loaded.get("hasPreparedForeground"):
    sys.exit("FAIL: unexpectedly saved a foreground image")
print("PASS: private design details round-trip")

status, returned_image, response_headers = call(private_path + "/assets/original", headers=private_headers)
if status != 200 or hashlib.sha256(returned_image).digest() != hashlib.sha256(image).digest():
    sys.exit("FAIL: private image bytes did not round-trip")
if "image/png" not in response_headers.get("Content-Type", ""):
    sys.exit("FAIL: image content type was wrong")
print("PASS: private synthetic PNG round-trip (SHA-256 verified)")
print("M1 synthetic backend smoke test PASSED")
