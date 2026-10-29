from skyfield.api import Loader
from skyfield.data import hipparcos

loader = Loader("/app/data", verbose=True)

# DE440s covers 1849-2150 and is cached into the container image.
loader("de440s.bsp")

# Cache the Hipparcos catalog into the container image so requests never
# depend on a runtime download.
with loader.open(hipparcos.URL):
    pass

print("Skyfield astronomy data ready.")
