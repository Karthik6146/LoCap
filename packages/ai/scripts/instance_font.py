"""One-off: pin a variable font's wght axis to a static TTF. Usage: instance_font.py <in> <out> <weight>"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

src, out, weight = sys.argv[1], sys.argv[2], float(sys.argv[3])
font = instantiateVariableFont(TTFont(src), {"wght": weight}, updateFontNames=True)
font.save(out)
