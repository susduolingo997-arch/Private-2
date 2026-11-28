"""Compact IRL script -> engine episode YAML.
'= id | set | cast-yaml'  starts a scene; 'who: text' is a line; '@ {beat}' is a raw beat; 'id:/title:' header lines."""
import sys, yaml
src, out = sys.argv[1], sys.argv[2]
ep = {"scenes": [], "target_seconds": 600, "fps": 24, "resolution": [1280, 720]}
sc = None
for raw in open(src, encoding="utf-8"):
    l = raw.strip()
    if not l or l.startswith("#"): continue
    if l.startswith("="):
        i, s, c = [x.strip() for x in l[1:].split("|")]
        sc = {"id": i, "set": s}
        if c: sc["cast"] = yaml.safe_load(c)
        sc["beats"] = []; ep["scenes"].append(sc)
    elif l.startswith("@"):
        sc["beats"].append(yaml.safe_load(l[1:]))
    elif sc is None:
        k, v = l.split(":", 1); ep[k.strip()] = v.strip()
    else:
        who, text = l.split(":", 1)
        sc["beats"].append({"say": who.strip(), "text": text.strip()})
yaml.safe_dump(ep, open(out, "w"), sort_keys=False, width=200, allow_unicode=True)
