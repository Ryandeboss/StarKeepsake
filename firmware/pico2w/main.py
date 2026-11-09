"""StarKeepsake Pico 2 W MicroPython LED bench demo, OFF by default."""
import json
import time
try:
    import settings
except ImportError:
    raise SystemExit("No settings.py. LEDs remain disabled.")
if not (settings.LEDS_ENABLED and settings.WIRING_REVIEWED):
    raise SystemExit("Wiring interlock is off. LEDs remain disabled.")

from machine import Pin
import neopixel
from effects import intensity

with open("led_map.json","r") as stream:
    mapping=json.load(stream)
lights=mapping.get("leds")
if mapping.get("format")!="starkeepsake-prototype-led-map-v1" or \
   not isinstance(lights,list) or not 1<=len(lights)<=30 or \
   mapping.get("count")!=len(lights) or mapping.get("dataGpio")!=settings.DATA_PIN:
    raise ValueError("Invalid LED map or mismatch with wired GPIO")
if not isinstance(settings.MAX_BRIGHTNESS,int) or not 0<=settings.MAX_BRIGHTNESS<=32:
    raise ValueError("Excessive brightness setting")
if not 50<=settings.REFRESH_MS<=250:
    raise ValueError("Unsupported refresh interval")
for index,light in enumerate(lights):
    if light["index"]!=index or not -3<=float(light["magnitude"])<=8:
        raise ValueError("LED mapping order invalid")

strip=neopixel.NeoPixel(Pin(settings.DATA_PIN,Pin.OUT),len(lights))
strip.fill((0,0,0))
strip.write()
try:
    while True:
        tick=time.ticks_ms()
        for light in lights:
            index=light["index"]
            strip[index]=intensity(light["magnitude"],index,tick,settings.MAX_BRIGHTNESS)
        strip.write()
        time.sleep_ms(settings.REFRESH_MS)
finally:
    strip.fill((0,0,0))
    strip.write()
