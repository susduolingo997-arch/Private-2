import glob
import os
import tempfile
import unittest

from engine import audio, cast, overlay, plan as planner, schema, sets

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPISODES = sorted(glob.glob(os.path.join(ROOT, "episodes", "*.yaml")))


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
        self.ep = schema.load(EPISODES[0])
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
                    self.assertGreaterEqual((b["f1"] - b["f0"]) / self.plan["fps"],
                                            words / schema.WORDS_PER_SEC)

    def test_cheat_beat_emits_console_and_toast(self):
        kinds = {e["kind"] for e in self.plan["events"]}
        self.assertTrue({"console", "system", "subtitle", "loading", "card", "fps"} <= kinds)


class OutputTests(unittest.TestCase):
    def test_overlay_and_audio_build(self):
        ep = schema.load(EPISODES[0])
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


if __name__ == "__main__":
    unittest.main()
