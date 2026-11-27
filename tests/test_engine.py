import glob
import os
import tempfile
import unittest

from engine import audio, cast, overlay, plan as planner, schema, sets

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPISODES = sorted(glob.glob(os.path.join(ROOT, "episodes", "*.yaml")))
NOCLIP = os.path.join(ROOT, "episodes", "s01e01_noclip.yaml")  # the game-HUD reference episode


def mini(beats, **kw):
    ep = dict(id="t", title="T", scenes=[dict(id="a", set="apartment", cast={"dave": "left"}, beats=beats)])
    ep.update(kw)
    return ep


class SchemaTests(unittest.TestCase):
    def test_all_episodes_load(self):
        self.assertTrue(EPISODES)
        for path in EPISODES:
            schema.load(path)

    def test_rejects_unknown_character_set_verb_mark(self):
        with self.assertRaises(schema.EpisodeError) as c:
            schema.validate(mini([
                {"say": "ghost", "text": "boo"},
                {"act": 1, "acts": [{"who": "dave", "do": "moonwalk"}]},
                {"act": 1, "acts": [{"who": "dave", "do": "walk_to", "to": "narnia"}]},
            ]))
        msg = "\n".join(c.exception.errors)
        self.assertIn("unknown speaker", msg)
        self.assertIn("unknown verb", msg)
        self.assertIn("unknown mark", msg)

    def test_speaker_must_be_in_scene_cast(self):
        with self.assertRaises(schema.EpisodeError):
            schema.validate(mini([{"say": "kyle", "text": "hi"}]))

    def test_beat_needs_exactly_one_kind(self):
        with self.assertRaises(schema.EpisodeError):
            schema.validate(mini([{"say": "dave", "text": "x", "act": 2}]))


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.ep = schema.load(NOCLIP)
        self.plan = planner.build_plan(self.ep, estimate=True)

    def test_beats_are_contiguous_and_shards_cover_every_frame(self):
        for sc in self.plan["scenes"]:
            cursor = 0
            for b in sc["beats"]:
                self.assertEqual(b["f0"], cursor)
                cursor = b["f1"]
            self.assertEqual(cursor, sc["frames"])
            covered = sum(s["end"] - s["start"] + 1 for s in self.plan["shards"] if s["scene"] == sc["index"])
            self.assertEqual(covered, sc["frames"])
        self.assertEqual(self.plan["total_frames"], sum(s["frames"] for s in self.plan["scenes"]))

    def test_say_beat_lasts_at_least_its_speech(self):
        for sc in self.plan["scenes"]:
            for b in sc["beats"]:
                if b["kind"] == "say":
                    words = len(b["text"].split())
                    # voices differ (cast.KV_RATE); no line may be shorter than a fast reader would need
                    self.assertGreaterEqual((b["f1"] - b["f0"]) / self.plan["fps"],
                                            words / (schema.WORDS_PER_SEC * 2.0))

    def test_cheat_beat_emits_console_and_toast(self):
        kinds = {e["kind"] for e in self.plan["events"]}
        self.assertTrue({"console", "system", "subtitle", "loading", "card", "fps"} <= kinds)


class OutputTests(unittest.TestCase):
    def test_overlay_and_audio_build(self):
        ep = schema.load(NOCLIP)
        plan = planner.build_plan(ep, estimate=True)
        with tempfile.TemporaryDirectory() as d:
            ass = overlay.build_ass(plan, os.path.join(d, "o.ass"))
            with open(ass, encoding="utf-8") as f:
                text = f.read()
            self.assertIn("[Events]", text)
            self.assertGreater(text.count("Dialogue:"), 500)
            wav = audio.mix(plan, os.path.join(d, "m.wav"))
            self.assertGreater(os.path.getsize(wav), plan["seconds"] * audio.SR)  # 16-bit mono

    def test_every_sfx_name_can_be_synthesised(self):
        for name in schema.SFX:
            self.assertGreater(len(audio.make_sfx(name)), 100, name)

    def test_cast_and_sets_are_consistent(self):
        self.assertTrue(cast.known("npc_whoever"))
        for name, s in sets.SETS.items():
            self.assertIn("center", s["marks"], name)



class UniverseTests(unittest.TestCase):
    def test_universe_is_valid_and_builds(self):
        from engine import universe
        u = universe.load()
        self.assertGreaterEqual(len(u["channels"]), 3)
        with tempfile.TemporaryDirectory() as d:
            data = universe.build_site(d)
            self.assertTrue(os.path.exists(os.path.join(d, "index.html")))
            self.assertTrue(os.path.exists(os.path.join(d, "data.js")))
            ep = next(v for v in data["videos"] if v.get("episode"))
            self.assertEqual(ep["status"], "scripted")
            self.assertTrue(ep["duration"])

    def test_rejects_dangling_references(self):
        from engine import universe
        u = universe.load()
        u["videos"][0]["channel"] = "nope"
        u["videos"][0]["mentions"] = ["ghost"]
        u["videos"][0]["cast"] = ["nobody"]
        with self.assertRaises(universe.UniverseError) as c:
            universe.validate(u)
        msg = "\n".join(c.exception.errors)
        self.assertIn("unknown channel", msg)
        self.assertIn("mentions unknown video", msg)
        self.assertIn("not in characters", msg)

    def test_publish_makes_video_live(self):
        from engine import universe
        with tempfile.TemporaryDirectory() as b, tempfile.TemporaryDirectory() as s:
            open(os.path.join(b, "s01e01.mp4"), "wb").write(b"x")
            self.assertEqual(universe.publish(b, s), ["irl-s01e01"])

    def test_every_episode_is_in_the_universe_and_every_video_has_art(self):
        from engine import universe
        u = universe.load()
        linked = {v["episode"] for v in u["videos"] if v.get("episode")}
        for path in EPISODES:
            self.assertIn(os.path.relpath(path, ROOT), linked, path + " is not a video in universe.yaml")
        for ch in u["channels"]:
            self.assertGreaterEqual(sum(v["channel"] == ch["id"] for v in u["videos"]), 5, ch["id"])
        with tempfile.TemporaryDirectory() as d:
            data = universe.build_site(d)
            for v in data["videos"]:
                self.assertTrue(v["thumb_img"], v["id"] + " has no thumbnail (python -m engine universe art)")
            for p in data["characters"] + data["channels"]:
                if p.get("engine") or "logo" in p:  # 3D models and channel logos get art; others use initials
                    self.assertTrue(p["avatar"], p["id"] + " has no avatar")
            emb = [v for v in data["videos"] if v.get("embed_src")]
            self.assertTrue(emb and all(v["status"] == "live" for v in emb))
            self.assertTrue(os.path.exists(os.path.join(d, emb[0]["embed_src"])))

    def test_estimate_tracks_cast_voices(self):
        # a slow voice must estimate longer than a fast one for the same words
        ep = lambda who: dict(id="t", title="T", scenes=[dict(id="a", set="newsroom", cast={who: "center"},
                              beats=[{"say": who, "text": "one two three four five six seven eight nine ten"}])])
        slow = planner.build_plan(_prep(ep("sarah")), estimate=True)
        fast = planner.build_plan(_prep(ep("emma")), estimate=True)
        self.assertGreater(slow["seconds"], fast["seconds"])


def _prep(ep):
    schema.validate(ep)
    ep.setdefault("fps", 24)
    ep.setdefault("resolution", [1280, 720])
    for s in ep["scenes"]:
        s["cast"] = s.get("cast") or {}
        for i, b in enumerate(s["beats"]):
            b["kind"], b["index"] = schema.beat_kind(b), i
    return ep


if __name__ == "__main__":
    unittest.main()
