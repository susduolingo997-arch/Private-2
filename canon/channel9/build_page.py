"""Build a Channel 9 page episode from the original Episode 2 page: same player, studio and voices; new script.
Usage: build_page.py <ep2.html> <script.js> <episode number> <TITLE> <tagline> <ticker text> <out.html>
<script.js> holds the `const SECTIONS=[...]];` block (same shot/opt vocabulary as the original pages)."""
import re, sys
src, script, num, title, tag, ticker, out = sys.argv[1:8]
h = open(src, encoding="utf-8").read()
sec = open(script, encoding="utf-8").read().strip()
a = h.index("const SECTIONS=["); b = h.index("]]]];", a) + 5
h = h[:a] + sec + h[b:]
h = h.replace("CHANNEL 9 – Episode 2", f"CHANNEL 9 – Episode {num}")
h = h.replace("CHANNEL 9 – THE ENERGY EPISODE", f"CHANNEL 9 – {title}")
h = h.replace("Episode 2 · 10:00 · Sound on · Contains random screaming", f"Episode {num} · 10:00 · Sound on · {tag}")
m = re.search(r'GERALD THE GNOME: STILL MISSING.*?CHANNEL 9 — THE MOST TRUSTED NAME IN CHANNEL 9 &nbsp;•&nbsp;', h, re.S)
h = h[:m.start()] + ticker.replace(" | ", " &nbsp;•&nbsp; ") + " &nbsp;•&nbsp; CHANNEL 9 — THE MOST TRUSTED NAME IN CHANNEL 9 &nbsp;•&nbsp;" + h[m.end():]
open(out, "w", encoding="utf-8").write(h)
print("ok", out)
