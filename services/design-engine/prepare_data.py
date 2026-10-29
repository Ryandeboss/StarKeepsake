from pathlib import Path
from urllib.request import Request, urlopen

from skyfield.api import Loader

DATA_DIR = Path("/app/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)

loader = Loader(str(DATA_DIR), verbose=True)

# DE440s covers 1849-2150 and is cached into the container image.
loader("de440s.bsp")

# Pin the Hipparcos raw catalog to an immutable mirror commit. The mirror
# documents that this is the original CDS I/239 hip_main.dat file.
HIPPARCOS_URL = (
    "https://raw.githubusercontent.com/Lokilife/hipparcos-data/"
    "f49e8c49bbc987508f35a7686ddd967491134286/hip_main.dat"
)
HIPPARCOS_PATH = DATA_DIR / "hip_main.dat"
EXPECTED_BYTES = 53_316_318
EXPECTED_ROWS = 118_218

request = Request(HIPPARCOS_URL, headers={"User-Agent": "StarKeepsake-build/1.0"})
with urlopen(request, timeout=90) as response, HIPPARCOS_PATH.open("wb") as output:
    while True:
        chunk = response.read(1024 * 1024)
        if not chunk:
            break
        output.write(chunk)

actual_bytes = HIPPARCOS_PATH.stat().st_size
if actual_bytes != EXPECTED_BYTES:
    raise RuntimeError(
        f"Hipparcos catalog size mismatch: expected {EXPECTED_BYTES}, got {actual_bytes}"
    )

with HIPPARCOS_PATH.open("rb") as catalog_file:
    actual_rows = sum(1 for _ in catalog_file)

if actual_rows != EXPECTED_ROWS:
    raise RuntimeError(
        f"Hipparcos catalog row mismatch: expected {EXPECTED_ROWS}, got {actual_rows}"
    )

print(
    f"Skyfield astronomy data ready: {actual_bytes} Hipparcos bytes, "
    f"{actual_rows} catalog rows."
)
