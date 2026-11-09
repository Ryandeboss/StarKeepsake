"""Pure bench-only RGB effects. No network or hardware side effects."""
import math

def intensity(magnitude,index,elapsed_ms,cap=20):
    if not isinstance(cap,int) or not 0<=cap<=32:
        raise ValueError("Bench brightness cap must be between 0 and 32")
    if not isinstance(index,int) or not 0<=index<30:
        raise ValueError("LED index out of range")
    if not -3<=float(magnitude)<=8:
        raise ValueError("Invalid visual magnitude")
    base=max(.15,min(.90,1-(float(magnitude)+1)/10))
    twinkle=.80+.20*math.sin(elapsed_ms/1350.0+index*1.71)
    value=max(0,min(cap,int(round(cap*base*twinkle))))
    return (value,int(value*.93),int(value*.85))
