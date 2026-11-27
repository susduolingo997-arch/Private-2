# PASSIONFRUIT Event 6 - "Think Small" (ready to render)

Written with the PASSIONFRUIT event engine's own format (`passionfruit/eventN/event.json` + an empty `RENDER` file).
Validated with the engine's tooling: valid JSON, **160 beats, 19 segments, 3,350 spoken words, estimated 23.2 minutes**
(rule: 22-29), 11 locations (lab, cafe, factory, park, beach sunset, datacenter, city night, rooftop, theater, desert
sunrise, studio), host Theo (not the CEO), no phone, new product categories only. A 12-still check rendered
without page errors (`still.jpg` is one of them).

To render it, copy `event6/` to `passionfruit/event6/` in `susduolingo997-arch/private` (branch
`claude/voxel-survival-letsplay-k76okk`) and push: GitHub Actions publishes release `pf-6.0`.
`build_event6.py` regenerates `event.json` from event 5's cast (`python3 build_event6.py <event5/event.json> event6/event.json`).
