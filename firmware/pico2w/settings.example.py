# Copy to settings.py after a qualified supervised electrical bench review.
# Both interlocks are OFF; no hardware should light at first boot.
LEDS_ENABLED = False
WIRING_REVIEWED = False
DATA_PIN = 0           # Example GPIO0, physical Pico 2 W header pin 1
MAX_BRIGHTNESS = 20    # Conservative software cap 0..32, NOT a power-safety substitute
REFRESH_MS = 80
