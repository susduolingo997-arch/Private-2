"""Builds Channel 9 Episode 3 ("The Small Episode") from the original Episode 2 page: same player, 3D studio and
voices; only the title strings, ticker and the SECTIONS script change. Usage: build_episode3.py <ep2.html> <out.html>"""
import re, sys
src, out = sys.argv[1], sys.argv[2]
h = open(src, encoding="utf-8").read()

SECTIONS = r'''const SECTIONS=[
['News intro',45,[
  ['logo','','',{d:11}],
  ['wide','','',{d:3,scr:'logo'}],
  ['two','M',"Good evening. You're watching CHANNEL 9. I'm Martin Miller.",{lt:['MARTIN MILLER','Main Anchor']}],
  ['two','S',"And I'm Sarah Collins. Tonight, everything is rather small.",{lt:['SARAH COLLINS','Co-Anchor / Producer'],em:'flat'}],
  ['m','M',"Small, Sarah. Easy to lose. Hard to find. Impossible to forgive.",{em:'grave'}],
  ['s','S',"A speaker the size of rice went on sale today. We'd like not to lose it.",{em:'flat'}],
  ['m','M',"We have already lost it.",{em:'grave',d:1}],
  ['two','','',{d:1.8,em:'flat'}],
  ['m','M',"Let's begin.",{em:'grave'}]]],
['The main headlines',90,[
  ['m','M',"Our top story tonight. A company called Passionfruit has released a speaker the size of a grain of rice.",{em:'grave',strap:'SPEAKER THE SIZE OF RICE ON SALE'}],
  ['s','S',"It plays one note.",{}],
  ['m','M',"Which note, Sarah?",{em:'grave'}],
  ['s','S',"A good one, apparently.",{em:'flat'}],
  ['m','M',"Residents say they have heard the note in their kitchens. Nobody has seen the speaker.",{em:'grave',d:1}],
  ['s','S',"It is the size of rice, Martin.",{em:'flat'}],
  ['m','M',"Or it is a very small ghost.",{em:'shock',d:1}],
  ['two','','',{d:2}],
  ['s','S',"Moving on. The town council is considering a ban on unnecessarily small signs.",{strap:'COUNCIL EYES SIGN SIZE LIMITS'}],
  ['m','M',"Define... unnecessarily.",{em:'grave'}],
  ['s','S',"Under four centimetres. Unless it says something important.",{}],
  ['m','M',"And if it says nothing?",{em:'grave'}],
  ['s','S',"Then it is a very small sign saying nothing, Martin. That is allowed.",{em:'flat',d:1}],
  ['two','','',{d:1.5}],
  ['m','M',"Our third headline. A man says his pocket has become a smaller place.",{em:'shock',strap:"MAN'S POCKET REPORTED SMALLER"}],
  ['s','S',"He found his keys in it. Then he lost them again. Then he found a speck.",{}],
  ['m','M',"A speck, Sarah?",{em:'grave'}],
  ['s','S',"It said hello.",{em:'flat'}],
  ['m','M',"The speck said hello.",{em:'grave',d:1.5}]]],
['Breaking news',90,[
  ['two','','',{d:3,bn:'SMALL SITUATION',fx:'sting'}],
  ['s','S',"I'm sorry, Martin. I'm being told we have breaking news. Greenway Supermarket's shopping baskets have shrunk.",{fx:'ear',strap:'GREENWAY BASKETS NOW THIMBLE SIZED'}],
  ['m','M',"Shrunk, Sarah?",{em:'shock',d:1.2}],
  ['s','S',"To roughly the size of a thimble.",{em:'flat',d:1}],
  ['m','M',"Ladies and gentlemen, this is a major developing situation. Let's go live to Emma Parker, who is at the scene. Emma?",{em:'grave'}],
  ['mkt','E',"Thanks, Martin. I'm outside Greenway Supermarket, where shoppers are carrying their groceries... in thimbles.",{lt:['EMMA PARKER','Live · Greenway Supermarket'],em:'grave'}],
  ['mktM','M',"How are people coping, Emma?",{em:'grave',feed:'STUDIO'}],
  ['mkt','E',"Let's find out. Excuse me, sir! Channel 9 News. How are you feeling tonight?",{}],
  ['mktP','P1',"I'm just buying one pea.",{d:.8}],
  ['mktP','E',"In a basket the size of a thimble. How does that make you feel?",{em:'grave'}],
  ['mktP','P1',"It's one pea.",{d:1.5,fx:'walk1'}],
  ['mkt','E',"Ma'am! Ma'am, a quick word for Channel 9?",{fx:'p2'}],
  ['mkt','P2',"No, thank you. I'm small.",{d:1}],
  ['mkt','E',"It seems the public is simply too small to speak. Back to you, Martin.",{em:'grave'}],
  ['m','M',"Brave reporting, Emma. Stay safe out there.",{em:'grave'}],
  ['mkt','E',"The baskets are in the car park, Martin.",{em:'flat',d:1}]]],
['The weather',90,[
  ['m','M',"Now, with a forecast nobody could see coming, here's David Storm.",{em:'grave'}],
  ['wx','D',"Thank you, Martin. Folks... you may want to look closely.",{lt:['DAVID STORM','Chief Weather Presenter'],wx:'base',em:'grave'}],
  ['wxc','D',"Tomorrow begins small. Very small.",{em:'grave',d:1.2}],
  ['map','D',"By Tuesday, we are tracking a tiny system moving in from the west.",{wx:'cloud'}],
  ['wxc','D',"It's a cloud the size of a coin. Not a large coin. A small coin.",{em:'shock',d:.8}],
  ['wx','S',"Is that bad?",{feed:'STUDIO'}],
  ['wxc','D',"It's not good, Sarah. It's also not very much.",{em:'grave',d:1}],
  ['map','D',"Wednesday, the sun returns. A very small sun. Roughly the size of a lamp.",{wx:'sun',strap:'WEATHER WARNING: SMALL SUN'}],
  ['wxc','D',"Pleasant. Warm. Perhaps twenty-two degrees. Wear a small hat.",{em:'shock'}],
  ['map','D',"And on Thursday, our models show a forty percent chance... of a very small umbrella.",{wx:'umb'}],
  ['wxc','D',"That umbrella... could be yours.",{em:'grave',d:1.5,fx:'zoom'}],
  ['wx','S',"David. The map.",{feed:'STUDIO',wx:'wrong'}],
  ['wxc','D',"What about it?",{}],
  ['map','S',"That's Iceland again.",{wx:'wrong'}],
  ['wxc','','',{d:2.6,em:'shock'}],
  ['wxc','D',"It's a smaller Iceland. Back to you.",{em:'grave'}]]],
['Studio interruption',75,[
  ['m','M',"Thank you, David. And now, in other news... the... the...",{em:'grave',fx:'prompt'}],
  ['m','','',{d:2.5,em:'shock'}],
  ['m','M',"In other news, there is a very small news.",{em:'grave'}],
  ['s','S',"Control room, we've lost the prompter. Can anyone hear me? Kevin?",{fx:'ear',em:'flat'}],
  ['kitchen','K',"Oops. Is this the studio? It looks like a thimble.",{feed:'CAM 3 · KITCHEN'}],
  ['kitchen','','',{d:2.5,fx:'beep',feed:'CAM 3 · KITCHEN'}],
  ['kitchen','M',"And here we see... the kitchen. A very small kitchen.",{em:'grave',feed:'CAM 3 · KITCHEN'}],
  ['kitchen','S',"Kevin! Kevin, we are live!",{feed:'CAM 3 · KITCHEN'}],
  ['kevin','K',"Sorry! Okay! There's a speck on my shoulder. It said keys.",{lt:['KEVIN BROOKS','Camera Operator'],feed:'CAM 3 · KITCHEN'}],
  ['kitchen','S',"Kevin, you are holding your keys.",{feed:'CAM 3 · KITCHEN'}],
  ['kevin','K',"I know! It said it twice!",{fx:'spin',feed:'CAM 3 · KITCHEN'}],
  ['tilt','','',{d:2}],
  ['two','M',"Welcome back. As I was saying, everything is completely normal.",{em:'grave'}],
  ['s','S',"The prompter is still off, Martin.",{em:'flat'}],
  ['m','M',"I know, Sarah. I'll read from the heart.",{em:'grave',d:1}],
  ['m','M',"My heart says... a very small sandwich?",{em:'shock',d:1}],
  ['s','S',"Not again.",{em:'flat'}],
  ['m','M',"Let's find out together. Emma?",{em:'grave'}]]],
['Live report: the park',90,[
  ['park','E',"Martin, I'm at Riverside Park, where a very small sound was heard near this bench earlier this evening.",{lt:['EMMA PARKER','Live · Riverside Park'],strap:'SMALL SOUND HEARD IN RIVERSIDE PARK'}],
  ['park','E',"Park staff have cordoned off the area... with a smaller cone.",{em:'grave'}],
  ['parkM','M',"Describe the sound, Emma.",{em:'grave',feed:'STUDIO'}],
  ['parkE','E',"It's a single note. Warm. Round. Honest.",{}],
  ['parkM','M',"Is it dangerous?",{em:'shock',feed:'STUDIO'}],
  ['parkE','E',"Kevin, can we get a closer look at the source?",{}],
  ['pigeon','','',{d:2.5,feed:'CAM 2'}],
  ['pigeon','E',"Kevin, that's a pigeon.",{em:'flat',feed:'CAM 2'}],
  ['pigeon','','',{d:1.5,feed:'CAM 2'}],
  ['parkC','E',"The speaker, Kevin.",{feed:'CAM 2'}],
  ['parkE','E',"Martin, I can now confirm. The pigeon has swallowed a speaker.",{em:'grave',strap:'CONFIRMED: THE PIGEON HAS A SPEAKER'}],
  ['m','M',"How does the pigeon feel, Emma?",{em:'grave'}],
  ['parkE','','',{d:1.8,em:'flat'}],
  ['parkE','E',"Musical, Martin. It seems musical.",{}],
  ['m','M',"Has it said anything?",{em:'shock'}],
  ['parkC','E',"Just the one note.",{}],
  ['m','M',"So the pigeon is... an instrument.",{em:'grave',d:1.5}],
  ['parkE','E',"Yes, Martin. The pigeon is an instrument. Back to the studio.",{em:'strain',d:1}]]],
['Station manager',75,[
  ['two','','',{d:1.5,fx:'door'}],
  ['wide','R',"Stop the broadcast! Stop everything!",{fx:'enter'}],
  ['s','S',"Richard, we're live.",{em:'flat'}],
  ['wide','R',"Good! Let the town hear it! CHANNEL 9 has achieved record-breaking audience numbers!",{lt:['RICHARD WILSON','Station Manager']}],
  ['m','M',"How many, sir?",{em:'grave'}],
  ['wide','R',"Forty-eight.",{d:1.5}],
  ['s','S',"Forty-eight... viewers?",{em:'flat'}],
  ['wide','R',"Up from forty-seven! That's a two percent increase! Bigger than any network on Earth, per capita!",{strap:'CHANNEL 9 VIEWERS UP 2%* (*ONE SPECK)'}],
  ['s','S',"Richard, the extra viewer is a speck. It's on Kevin.",{em:'flat'}],
  ['wide','R',"A viewer is a viewer! Does it clap?",{}],
  ['m','','',{d:1.5,fx:'confetti'}],
  ['m','M',"Hooray.",{em:'flat',d:1.5}],
  ['wide','R',"More joy, Martin! The whole world is watching! All forty-eight of them!",{}],
  ['s','S',"Richard, please. You're in the shot.",{em:'flat'}],
  ['wide','R',"I AM the shot! Thank you, world! Thank you!",{fx:'exit'}],
  ['two','','',{d:3}]]],
['The final broadcast',45,[
  ['m','M',"That's all we have time for. Tonight's headlines: Gerald is still missing...",{em:'grave'}],
  ['two','','',{d:2,bn:'GERALD UPDATE',fx:'sting'}],
  ['s','S',"Martin. More breaking news. Experts say Gerald is small.",{fx:'ear'}],
  ['m','M',"Experts have never seen him, Sarah.",{em:'grave',strap:'GERALD: STILL SMALL. STILL MISSING.'}],
  ['m','M',"I'm Martin Miller.",{em:'grave'}],
  ['scam','','',{d:3.5,fx:'stare'}],
  ['two','M',"Goodnight.",{}],
  ['logo','','',{d:5,outro:1}]]]];'''

a = h.index("const SECTIONS=[")
b = h.index("]]]];", a) + len("]]]];")
h = h[:a] + SECTIONS + h[b:]
h = h.replace("CHANNEL 9 – Episode 2", "CHANNEL 9 – Episode 3")
h = h.replace("CHANNEL 9 – THE ENERGY EPISODE", "CHANNEL 9 – THE SMALL EPISODE")
h = h.replace("Episode 2 · 10:00 · Sound on · Contains random screaming", "Episode 3 · 10:00 · Sound on · Contains one very small speaker")
ticker_old = re.search(r'GERALD THE GNOME: STILL MISSING.*?CHANNEL 9 — THE MOST TRUSTED NAME IN CHANNEL 9 &nbsp;•&nbsp;', h, re.S)
ticker_new = ("SPEAKER SIZE OF RICE ON SALE: ONE NOTE &nbsp;•&nbsp; GERALD THE GNOME: STILL MISSING (STILL SMALL) &nbsp;•&nbsp; "
              "GREENWAY BASKETS NOW THIMBLE SIZED &nbsp;•&nbsp; COUNCIL TO DEBATE &quot;UNNECESSARILY SMALL&quot; SIGNS &nbsp;•&nbsp; "
              "LOCAL PIGEON IS AN INSTRUMENT &nbsp;•&nbsp; TRAFFIC: ONE CAR ON MAIN STREET, DRIVER DESCRIBED AS &quot;FINE&quot; &nbsp;•&nbsp; "
              "CHANNEL 9 — THE MOST TRUSTED NAME IN CHANNEL 9 &nbsp;•&nbsp;")
assert ticker_old
h = h[:ticker_old.start()] + ticker_new + h[ticker_old.end():]
open(out, "w", encoding="utf-8").write(h)
print("ok", len(h) // 1024, "KB")
