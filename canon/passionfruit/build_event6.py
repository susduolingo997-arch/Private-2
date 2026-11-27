"""Builds passionfruit/event6/event.json (Event 6, "Think Small") in the format of the PASSIONFRUIT event engine.
Cast comes from event5/event.json so presenters keep their looks and voices."""
import json, sys
src = sys.argv[1]            # path to passionfruit/event5/event.json
out = sys.argv[2]
cast = json.load(open(src))["cast"]

P = {
 "grain":  dict(name="Pulp Grain", kind="custom", shape="orb", w=0.35, h=0.35, d=0.35, color="#e8d9a8", material="ceramic", features=["glow"], glow="#fff3c4", screen=["#3a3320","#7a6a3a"], price="$19", fine="One note. It is a good note.", handSize=0.05),
 "pin":    dict(name="Pith Pin", kind="custom", shape="stick", w=0.25, h=1.0, d=0.25, color="#d8d8e0", material="chrome", features=["glow","button"], glow="#9fe8ff", buttonColor="#ff6a5c", screen=["#10202a","#2a5a70"], price="$29", fine="Tells you where it is. Quietly. Then less quietly.", handSize=0.07),
 "thimble":dict(name="Rind Thimble", kind="custom", shape="cylinder", w=0.5, h=0.5, d=0.5, color="#ff8a3d", material="aluminum", features=["screen","crown"], screen=["#2a1208","#ff8a3d"], screenText="72", price="$149", fine="Fits one finger. We are working on the others.", handSize=0.06),
 "speck":  dict(name="Pulp Speck", kind="custom", shape="pebble", w=0.3, h=0.3, d=0.3, color="#1d1d22", material="glass", features=["camera:1","glow"], glow="#ff4fa3", price="$249", fine="Shown actual size. The thing on the left.", handSize=0.04),
 "colony": dict(name="Zest Colony", kind="custom", shape="egg", w=0.9, h=0.5, d=0.6, color="#c9a24a", material="matte", features=["eyes","legs:6","antenna"], colors=["#c9a24a","#8a5a2b","#1d1d22"], screen=["#2a2008","#6a5018"], price="$399", fine="Four hundred workers. One manager. No breaks. Ever.", handSize=0.07),
 "period": dict(name="Nectar Period", kind="custom", shape="orb", w=0.45, h=0.2, d=0.45, color="#1b1b22", material="rubber", features=["button"], buttonColor="#ffd23f", price="$9", fine="For sentences. Sentences not included.", handSize=0.05),
 "stamp":  dict(name="Pulp Stamp", kind="slab", w=0.6, h=0.7, d=0.03, color="#e9e4da", material="matte", features=["screen"], screen=["#1a4a7a","#4fb3d9"], screenText="Earth", price="$59", fine="The whole world, folded. Postage not included.", handSize=0.07),
 "nudge":  dict(name="Pulp Nudge", kind="custom", shape="orb", w=0.3, h=0.3, d=0.3, color="#ff4fa3", material="glass", features=["eyes","glow","button"], glow="#ffa6d2", screen=["#3a0a24","#ff4fa3"], price="$39", fine="Sits on your shoulder. Says one word. Usually 'keys'.", handSize=0.04),
}

def B(shot, say=None, who=None, **kw):
    b = {"shot": shot}
    if say: b["say"] = say
    if who: b["who"] = who
    b.update(kw)
    return b

def studio(pid, name_line, spin, macro, explode, lineup, tag, sub, vo="vo"):
    return {"location": "studio", "presenters": [], "beats": [
        B("hero", name_line, vo, product=pid),
        B("spin", spin, vo, product=pid),
        B("macro", macro, vo, product=pid),
        B("explode", explode, vo, product=pid),
        B("lineup", lineup, vo, product=pid),
        B("tagline", product=pid, text=tag, sub=sub, dur=5),
        B("price", product=pid, dur=5)]}

S = []
# 1 cold open
S.append({"location": "studio", "presenters": [], "music": "minimal", "beats": [
    B("hero", "You are looking at it right now. You can't see it. That's the point.", "vo", product="grain", dur=6),
    B("macro", "Everything we've ever made has been a little too big. Too wide. Too loud. Too much phone. Today, we fix that.", "vo", product="grain"),
    B("spin", "Today, we think small.", "vo", product="grain")]})
# 2 lab: Theo hosts
S.append({"location": "lab", "presenters": ["eng"], "screen": "Think Small", "music": "gentle", "beats": [
    B("title", text="Passionfruit Event 6", sub="Think Small", dur=4),
    B("wide", dur=3.5),
    B("talk", "Hi. Hello. Theo. Hi. I'm hosting today. I know. I'm as surprised as you are. Dana is in a meeting about meetings, and she asked me to take this one. Gently. She said gently."),
    B("close", "I'm a senior engineer. My title is Thinness. For nine years I made things thinner. And at some point I realized: thin is only one direction. There's also small."),
    B("talk", "Small is thin, in every direction. Small is thin that got serious about it. And today, every product we're showing you is small. Very small. Some of them you may need to take on faith."),
    B("close", "Our legal team asked us to clarify that small does not mean cheap. We agreed. Our legal team then asked what small does mean. We said: small. They are still thinking about it."),
    B("talk", "A few notes. Everything today is real, in the sense that it's on this film. Nothing today is bigger than a thumb. Except Dana. And the boulders. We apologized for the boulders."),
    B("close", "We've built a very small Passionfruit for you. We shrank the lab. We shrank the camera crew. We shrank the budget, which went well. Let's begin, before the lab shrinks around me.")]})
# 3 cafe: Bea -> grain
S.append({"location": "cafe", "presenters": ["home"], "music": "warm", "beats": [
    B("title", text="Small thing one", sub="Sound.", dur=3.5),
    B("wide", dur=3.5),
    B("talk", "Hi, I'm Bea. Home and Ambience. We're at a cafe, because a cafe is where small things happen. Small coffees. Small talk. Small, regrettable muffins."),
    B("close", "Here's a problem. Every speaker we've made is larger than the room's mood. You put it on a shelf and suddenly the shelf is the main character. We wanted a speaker that disappears."),
    B("talk", "So we asked: how small can a speaker be? And the engineers said, how small do you want? And I said: smaller. And they said: that's a grain. And I said: perfect."),
    B("table", "This is Pulp Grain. It's the size of a grain of rice. A long grain. We tried a short grain. It had opinions.", product="grain"),
    B("demo", "It plays one note. A beautiful one. A warm, round, honest note. And that's all. People ask for more notes. We say: you already have a note.", product="grain"),
    B("close", "And here's the clever part. It plays that one note at exactly the volume of a quiet cafe. So wherever you put it, you're in a cafe. Even if you're in a car. Even if you're in a canoe."),
    B("talk", "It also finds the room's lowest silence and sits in it. You'll never hear it. You'll only feel that something is gently, politely, in tune. Let me show you where it came from.")]})
S.append(studio("grain", "Pulp Grain.",
  "The world's smallest speaker. One note. Pressed into a grain of ceramic by a machine that was also, in a way, a very small machine.",
  "Up close, you can see the speaker grille. It has one hole. We were told that was a mistake. We were told that a lot. We kept the hole.",
  "Inside, a driver, a battery, and a tiny, unshakeable sense of rhythm. It's not a musician. But it has a kind of pitch.",
  "In three colors. Rice. Slightly older rice. And a color we call, internally, spilled.",
  "One note.", "It's a good one."))
# 4 factory: Imogen+Theo -> pin
S.append({"location": "factory", "presenters": ["design", "eng"], "music": "pulse", "beats": [
    B("title", text="Small thing two", sub="Where it is.", dur=3.5),
    B("wide", dur=3.5),
    B("two", "We're at the factory. Imogen and I. We're here because the thing we're showing you is so small, we needed a factory to find it.", who="eng"),
    B("talk", "Hello. Imogen. Design. Every day, people lose small things. Keys. Rings. Earrings. Safety pins. The smallest things are the easiest to lose. And the hardest to forgive.", who="design"),
    B("talk", "So we asked: what if the small thing could say where it is? And the answer was: it would need to be a small thing that can talk. And so we made a pin.", who="design"),
    B("table", "This is Pith Pin. It looks like a safety pin. It is a safety pin. But it also, when you lose it, says: I'm here. In a small voice. From under the couch.", product="pin", who="design"),
    B("demo", "Every pin comes with a pin. Which is to say, you can pin the Pith Pin to your jacket, and then pin another Pith Pin to the first. They keep track of each other. It's called a family.", product="pin", who="eng"),
    B("two", "Which means that if you lose all of them, you've lost a family. And we don't take that lightly. We take that very lightly, in fact. The whole product is very light.", who="design"),
    B("close", "And yes. It's sharp. We're sorry. It is a pin. Please handle it like a pin. And, if you can, like a friend.", who="eng")]})
S.append(studio("pin", "Pith Pin.",
  "A safety pin with a locator, a speaker, and a sense of obligation. Six grams of stainless steel and one very specific kind of worry.",
  "On the head, a button. Press it, and every Pith Pin in your home says hello at once. It's the loudest thing we've made. It's also the smallest.",
  "Inside, a coil, a chip, and a tiny voice recording of someone saying: it's fine. We hired a very calm person. Her name is Greta. She is available for weddings.",
  "Available in silver, silver, and, for those with a sense of occasion, silver.",
  "Where it is.", "It's here. It's right here."))
# 5 park: Priya -> thimble
S.append({"location": "park", "presenters": ["health"], "music": "gentle", "beats": [
    B("title", text="Small thing three", sub="Health.", dur=3.5),
    B("wide", dur=3.5),
    B("talk", "Hi. Priya. Health and Silence. I'm in a park, where people are doing small, healthy things. A small jog. A small stretch. A small, sad sandwich."),
    B("close", "For years, we've told you to wear a watch, wear a ring, wear a band. And you've said: where? Where would I wear it? I've got one wrist. I've got one finger. I have a lot of fingers, but I'm busy."),
    B("talk", "So we went smaller. To the one part of the body that's always available, always honest, and always, somehow, a little bit stuck in a drawer. The fingertip."),
    B("table", "This is Rind Thimble. It goes on your fingertip. It measures your pulse, your temperature, and your readiness to open a jar.", product="thimble"),
    B("demo", "You press your finger on anything, and it tells you how you feel. A table: calm. A door: slightly anxious. A cat: it depends on the cat.", product="thimble"),
    B("close", "It also does one more thing. When you're stressed, it goes quiet. When you're calm, it goes quieter. We call that the Silence Mode. And it's the only mode."),
    B("talk", "Wear it for a week and you'll know yourself better. Wear it for a month and you'll know your fingertip better than anyone ever has. That's not nothing. That's, actually, something very small.")]})
S.append(studio("thimble", "Rind Thimble.",
  "A computer for your fingertip. Aluminum, glass, and the quiet confidence of something that fits under a fingernail, if you let it.",
  "The display is point-six inches. It shows one number. Your pulse. Or, if you prefer, the number of days since you last felt completely rested. Both are zero.",
  "Inside, a sensor stack, a battery, and a thimble, because we found one in the lab and thought: that's it. That's the whole product.",
  "In orange. Slightly different orange. And an orange we can only describe as, a very honest orange.",
  "Take your own pulse.", "Gently."))
# 6 beach sunset: Marco + Rafa -> speck
S.append({"location": "beach", "time": "sunset", "presenters": ["watch", "drive"], "music": "warm", "beats": [
    B("title", text="Small thing four", sub="Looking.", dur=3.5),
    B("wide", dur=4),
    B("two", "Hi. Marco. Wearables and Wanderables. Rafa and I are on a beach at sunset, which is the best light to show a small thing in. And the worst place to lose one. It's a beach. It's grains.", who="watch"),
    B("talk", "Rafa. Mobility. Going Places. I'd like to say that we came to the beach to test the camera. We came to the beach because we lost the camera. We lost it yesterday. On the beach.", who="drive"),
    B("two", "It's called Pulp Speck. It is the world's smallest camera. It is a speck. It looks like a speck of dust. And, thank goodness, it behaves like one. It lands on things and stays.", who="watch"),
    B("demo", "You put it on your jacket, on a wall, on a dog. And it films, in sixteen-megapixel color, whatever it's sitting on. Mostly the inside of your jacket. We're working on that.", product="speck", who="watch"),
    B("talk", "And here's the clever part. Because it's so small, it's often in the sand. And because it's in the sand, we can't find it. But it can find us. It follows you. It's a camera. It knows where you are.", who="drive"),
    B("walk", "That's why we're walking. Slowly. Along the shore. Because somewhere in this beach is a camera, and it's filming us right now, and, honestly, it's got my good side.", who="watch", walk=True) if False else B("two", "That's why we're standing here at sunset. Because somewhere in this beach is a camera, and it's filming us right now. And honestly, it's got my good side.", who="watch"),
    B("close", "If you see a speck on your sandwich, don't brush it off. Say hello. It's already seen you. It has a lot of footage. Of your sandwich.", who="drive")]})
S.append(studio("speck", "Pulp Speck.",
  "The world's smallest camera. Sixteen megapixels. Three hundred and twenty micrograms. And a lens that has seen things.",
  "A lens the size of a thought. It focuses on whatever is closest, which is usually the thing it's sitting on, which is usually you.",
  "Inside, a sensor, a battery, and a tiny motor that, once a day, nudges it very slightly to the left. For variety.",
  "In black. Black with a little more black. And, for the discerning, a color we can't show, because it's a speck.",
  "It's already seen you.", "It likes what it sees."))
# 7 datacenter: Bea + Theo -> colony
S.append({"location": "datacenter", "presenters": ["home", "eng"], "music": "pulse", "beats": [
    B("title", text="Small thing five", sub="Help.", dur=3.5),
    B("wide", dur=3.5),
    B("two", "We're back in the datacenter. Bea and I. Because small things need a lot of servers. We learned that the hard way. Last time, we asked the cloud for help and it sang.", who="home"),
    B("talk", "So this time, we didn't ask the cloud. We asked ants. Hi. Theo. Ants are very small. And very organized. And they carry a hundred times their weight. And they've never once complained.", who="eng"),
    B("table", "This is Zest Colony. Four hundred microscopic assistants. And one manager, who is a little bigger. And has, we're told, a clipboard.", product="colony", who="home"),
    B("demo", "You tell the Colony what you need. Crumbs swept. Cables untangled. Dust moved from one place to another place. They don't remove the dust. They relocate it. With dignity.", product="colony", who="eng"),
    B("two", "They work all day, every day, and at night, they go back to the Colony, which glows. Which means that your home has a small, warm, humming light in the corner. Like a very tiny fireplace.", who="home"),
    B("close", "We've had some complaints about the ants. They are, after all, ants. But they're our ants. We trained them. We named them. We named them all Ant. It was a long afternoon.", who="eng"),
    B("talk", "And yes, they will eventually unionize. We've read the Colony's meeting minutes. They're very reasonable. We're a little afraid of them. We're also very proud.", who="home")]})
S.append(studio("colony", "Zest Colony.",
  "Four hundred microscopic assistants. Housed in a warm, glowing nest. Available in the kitchen, the office, and the underside of your couch.",
  "The manager is a little bigger. You can tell, because she's the one with the clipboard. She also has a very small whistle. It's very small. We've never heard it.",
  "Inside, a charging dock, a nest, and a rolled-up tiny contract. It's two lines long. It says: thank you. We'll be right here.",
  "Available in four hundred colors. They're all slightly different ants. We lost count at colors. It was easier to count ants.",
  "Many hands.", "Very, very small hands."))
# 8 city night: Ollie + Imogen -> period
S.append({"location": "city", "time": "night", "presenters": ["sorry", "design"], "music": "piano", "beats": [
    B("title", text="Small thing six", sub="Closure.", dur=3.5),
    B("wide", dur=3.5),
    B("two", "Hello. Ollie. Chief Apology Officer. I'm on a street at night, with Imogen, and I'd like to apologize for the length of this event. It's not long. But it will feel long. Because everything is small.", who="sorry"),
    B("talk", "Imogen. Design. Here's a thing we noticed. People send messages that don't end. They just kind of trail off. Like a person leaving a party by walking very slowly toward the door.", who="design"),
    B("two", "The solution is the oldest, smallest piece of writing in the world. The period. And we made one. A real one. You can hold it. It's round, and it's black, and, frankly, it's very final.", who="sorry"),
    B("table", "This is Nectar Period. You press it on the screen at the end of your message. And a full stop appears. And then, gently, the conversation is over. Everyone is relieved.", product="period", who="design"),
    B("demo", "It also works in person. You press it on someone's hand at the end of their story. And a little voice says: and that's that. And they stop talking. And it's very kind.", product="period", who="sorry"),
    B("two", "We've tested it in meetings. A meeting that would normally take an hour takes forty-one minutes. The other nineteen are spent apologizing. That's where I come in.", who="sorry"),
    B("close", "I'd like to apologize in advance to anyone who has ever been stopped mid-sentence. This is for you. It was always going to be for you. Period.", who="design")]})
S.append(studio("period", "Nectar Period.",
  "A physical full stop. Rubber, hardware, and the comforting weight of the end of a sentence.",
  "Press the center, and a small tone confirms it. It's the sound of a door gently closing, in a house you've decided to leave.",
  "Inside, a spring, a speaker, and a very small, very firm opinion. It's mostly spring.",
  "Available in black, black, and a black we're calling Final.",
  "That's that.", "Period."))
# 9 rooftop: Rafa -> stamp
S.append({"location": "rooftop", "presenters": ["drive"], "music": "uplift", "beats": [
    B("title", text="Small thing seven", sub="The world.", dur=3.5),
    B("wide", dur=3.5),
    B("talk", "Hi. Rafa. Mobility. Going Places. I'm on a rooftop, because from here you can see the whole city. And from the whole city, you can see how small a person is. It's a good feeling. It's like a hug from a skyline."),
    B("close", "I love maps. Maps are the original small thing. They take the whole world, and they fold it, and they put it in your glove box. Where it stays, unused, for eleven years."),
    B("talk", "We thought: what if the world was so small, you'd never need to unfold it? What if it was a stamp? What if every place you've ever wanted to go, you could press against your wrist, and go?"),
    B("table", "This is Pulp Stamp. It's the whole world, on a thing the size of a postage stamp. It's a map. It's a very small, very accurate map. It zooms. It really zooms.", product="stamp"),
    B("demo", "You pinch the stamp, and the world gets bigger. You pinch it again, and your street comes into view. You pinch a third time and you can see yourself, holding a stamp. It's a lot.", product="stamp"),
    B("close", "It does not give directions. It does something better. It tells you where you are. In a small, calm voice. Every time you ask. Which, for many of us, is enough."),
    B("talk", "We've also made the postage. It's built in. You can send the Pulp Stamp anywhere. It arrives instantly. That's not how postage works, but we said it, and no one stopped us.")]})
S.append(studio("stamp", "Pulp Stamp.",
  "The whole world, on a single sheet of glass the size of a postage stamp. Edge to edge. Pole to pole.",
  "Pinch to zoom. Pinch again. And again. Somewhere in there is your house, and, if you keep going, a very small you, looking at a very small stamp.",
  "Inside, a display, a processor, and a very small globe. It's mostly globe.",
  "In one color. The color of the sea, as seen from slightly above.",
  "Places.", "Fold them up."))
# 10 theater: CEO
S.append({"location": "theater", "presenters": ["ceo"], "screen": "", "music": "piano", "beats": [
    B("title", text="One last small thing", sub="Please remain seated.", dur=3.5),
    B("talk", "Hello. I'm Dana. Theo said I could stop by. He said it gently. I want to thank everyone who made today small. It took a lot of people. Very small people. Mostly interns."),
    B("close", "Over the years, we've made things that were thin, and then thick, and then sorry. And today, small. And I realize something. Everything we make is a way of saying the same thing. Which is: we heard you. We just didn't listen."),
    B("talk", "Small things don't take up a lot of space. They don't ask for much. They sit there, politely, and they do their one job. And in a world full of big things, loud things, wide things, I think that's the dream."),
    B("close", "Before we go, we have one more thing. It's very small. It's so small, it's already in the room. In fact, it's on me. I've been wearing it all day. I forgot. That's the point.")]})
# 11 studio: one more thing
S.append({"location": "studio", "presenters": [], "beats": [
    B("onemore", text="One more thing. (It's small.)", dur=5),
    B("hero", product="nudge", dur=7),
    B("spin", "This is Pulp Nudge. It sits on your shoulder. And once a day, it says one word. The word is whatever you forgot. Usually, keys.", "ceo", product="nudge"),
    B("macro", "It has a very small voice. It's polite. It never says: you forgot your keys. It says: keys. Just: keys. And you say: oh. And you go back. And that's the whole product.", "ceo", product="nudge"),
    B("explode", "Inside, a tiny memory, a tiny speaker, and a very small, very patient friend. We hired a voice actor. She asked what the lines were. We said: one word. She asked: which word. We said: it depends on you.", "vo", product="nudge"),
    B("lineup", "Available in pink, slightly pinker, and, for someone who's lost everything, a clear one. It's invisible. It's still there. It's still saying: keys.", "vo", product="nudge"),
    B("tagline", product="nudge", text="Keys.", sub="You're welcome.", dur=5),
    B("price", product="nudge", dur=5)]})
# 12 desert sunrise: close
S.append({"location": "desert", "time": "sunrise", "presenters": ["ceo", "eng", "home", "sorry"], "music": "uplift", "beats": [
    B("title", text="Thank you for thinking small", sub="Please keep your belongings small.", dur=3.5),
    B("wide", dur=4),
    B("talk", "Pre-orders open today. Everything ships in an envelope. A very small envelope. Delivered by a very small truck, with a very small, very capable driver. We're told his name is Gary.", who="ceo"),
    B("two", "We'd like to thank the ants, the Speck, the Grain, and Greta. Greta, if you're listening: we're not letting you go. We've put it in writing. In very small writing.", who="eng"),
    B("two", "Our team has worked incredibly hard to make small things. It was not easy. Small things are harder to make than big things. They're harder to hold. And they're much, much harder to find.", who="home"),
    B("talk", "And I'd like to apologize for anything we've lost today. The speck. A pin. Theo's keys. Please, if you see them, say nothing. We'll hear.", who="sorry"),
    B("talk", "Thank you for joining us. We'll see you at the next event. It'll be big. It'll be so big. We promise. Or, we're sorry.", who="ceo"),
    B("end", dur=12, text="Small.", sub="Passionfruit is a fictional company. Products shown do not exist. Nothing here is very big. Nothing here is very sorry.")]})


EXTRA = {
 1: [B("talk", "A word on the budget. This event had a small budget. We spent it on a very small stage, with very small chairs. The chairs are for you. They're also, we're told, the only chairs we have."),
     B("close", "And a word on the title. Think Small. We tried Think Smaller. It tested well. But it made people feel sad. Smaller than what? We have no answer. The answer is: smaller.")],
 2: [B("talk", "Another thing about cafes. Everything's small. The cups. The spoons. The tiny cookie, balanced on the edge of the saucer, like a tiny sentinel. It's the most honest thing in the building."),
     B("close", "We also tested Pulp Grain in a very loud cafe. It still played one note. But the note said: I'm still here. And a very tired man at table four started to cry. He said it was the coffee. We think it was the note.")],
 4: [B("talk", "A quick tour. Over there, the pin line. Each pin is made by a very small robot arm. Every sixth pin goes to quality control, where a small person looks at it and says: yes. That's a pin.", who="eng"),
     B("two", "And that's the whole process. Metal, wire, voice, pin. Our factory makes nine thousand a day. Our factory also loses nine thousand a day. We're working on that. With pins.", who="design")],
 6: [B("talk", "And I want to say something about the word small. It doesn't mean less. A small candle still lights a room. A small door still opens. A small apology, delivered sincerely, can last a whole week."),
     B("close", "So if you only take one thing from today, take a small breath. And another. And one more, after that. That's a very small workout. It's also, technically, the entire product.")],
 8: [B("talk", "Quick safety note, from Rafa, who is a professional. If you find a speck in your eye, don't panic. It's probably dust. If it blinks, it's a Speck. And you should wave. It would mean a lot.", who="drive"),
     B("two", "And please, if you find our camera on this beach, don't send it back. Keep it. Take it home. Give it a nice life. And, if you can, a better angle.", who="watch")],
 10: [B("talk", "One more thing about the ants. They do not like jazz. We tried. They went on strike. They marched, very small, in a very straight line, out of the room. We apologized. They returned. They were polite about it.", who="eng"),
      B("two", "We've also learned that ants have a lot of opinions about the Colony's temperature. Twenty-one degrees. Exactly. Any warmer and they want to talk. Any colder and they want to unionize.", who="home")],
 12: [B("talk", "I should also apologize for the cities. We don't build cities. We just shoot them. At night. With a very small camera. And a very small apology.", who="sorry"),
      B("close", "And remember: you don't have to end every thing. Some things can just continue. Quietly. In the background. Like a very good hum. But if you do want to end something, Nectar Period will help.", who="design")],
 14: [B("talk", "And one more map fact. The longest road in the world is also the narrowest, if you look at it from far enough away. That's not true. But it's the kind of thing you believe on a rooftop."),
      B("close", "We've also added a very small compass to the Stamp. It points north. Gently. Whenever it's asked. And, if it isn't asked, it points, politely, toward where you left your keys.")],
}
for idx, beats in EXTRA.items():
    S[idx]["beats"][-1:-1] = beats

doc = {"number": 6, "title": "Think Small", "date": "November 27", "subtitles": True, "cast": cast, "products": P, "segments": S}
json.dump(doc, open(out, "w"), indent=1, ensure_ascii=False)
words = sum(len(b.get("say", "").split()) for s in S for b in s["beats"])
print("segments", len(S), "beats", sum(len(s["beats"]) for s in S), "spoken words", words)
