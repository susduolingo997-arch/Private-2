// Fake video site over window.UNIVERSE (written by `python -m engine universe build`).
(function () {
  const U = window.UNIVERSE;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const chan = Object.fromEntries(U.channels.map((c) => [c.id, c]));
  const person = Object.fromEntries(U.characters.map((p) => [p.id, p]));
  const vid = Object.fromEntries(U.videos.map((v) => [v.id, v]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("vt." + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("vt." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  const num = (n) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n);
  const clock = (s) => { if (s == null) return ""; const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); };
  const day = (iso) => new Date(iso + "T00:00:00");
  const ago = (iso) => {
    const d = Math.round((day(U.site.today) - day(iso)) / 864e5);
    if (d < 0) return "Premieres " + iso;
    if (d < 1) return "today";
    if (d < 7) return d + " days ago";
    if (d < 30) return Math.round(d / 7) + " weeks ago";
    if (d < 365) return Math.round(d / 30) + " months ago";
    return Math.round(d / 365) + " years ago";
  };
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const dot = (o, cls = "") => `<span class="dot ${cls}" style="background:${esc(o.color)}">${esc(initials(o.name))}</span>`;
  const ph = (o) => (o.placeholder ? `<span class="ph" title="Placeholder: edit universe/universe.yaml">draft canon</span>` : "");

  function thumb(v) {
    const len = v.duration ? `<span class="len">${clock(v.duration)}</span>` : "";
    const badge = v.status === "live" ? "" : v.status === "scripted" ? `<span class="badge soon">SCRIPTED</span>` : `<span class="badge soon">PREMIERES SOON</span>`;
    return `<div class="thumb" style="--c:${esc(chan[v.channel].color)}">${badge}<b>${esc(v.title.split("|")[0])}</b>${len}</div>`;
  }
  function stats(v) {
    return v.status === "planned" ? esc(ago(v.published)) : `${num(v.views)} views &middot; ${esc(ago(v.published))}`;
  }
  function card(v) {
    const c = chan[v.channel];
    return `<a class="card" href="#/watch/${esc(v.id)}">${thumb(v)}
      <div class="meta">${dot(c)}<div><div class="t">${esc(v.title)}</div>
      <div class="s">${esc(c.name)}</div><div class="s">${stats(v)}</div></div></div></a>`;
  }
  const byNew = (a, b) => (a.published < b.published ? 1 : -1);

  function sidebar(route) {
    const on = (r) => (route === r ? "on" : "");
    $("#side").innerHTML = `
      <a class="${on("home")}" href="#/">&#127968; Home</a>
      <a class="${on("timeline")}" href="#/timeline">&#128337; Universe timeline</a>
      <a class="${on("people")}" href="#/people">&#128101; Everyone</a><hr>
      <h4>Channels</h4>` + U.channels.map((c) =>
        `<a class="${route === "c/" + c.id ? "on" : ""}" href="#/c/${esc(c.id)}">${dot(c)} ${esc(c.name)}</a>`).join("");
  }

  function home(filter) {
    const chips = [["", "All"], ...U.channels.map((c) => [c.id, c.name]), ["crossover", "Crossovers"]];
    let list = U.videos.slice().sort(byNew);
    if (filter === "crossover") list = list.filter((v) => v.mentions.length);
    else if (filter) list = list.filter((v) => v.channel === filter);
    return `<div class="chips">${chips.map(([id, n]) =>
      `<a class="chip ${id === filter ? "on" : ""}" href="#/${id ? "f/" + id : ""}">${esc(n)}</a>`).join("")}</div>
      <div class="grid">${list.map(card).join("")}</div>`;
  }

  function player(v) {
    const c = chan[v.channel];
    if (v.status === "live") return `<div class="player"><video controls autoplay src="${esc(v.src)}"></video></div>`;
    const msg = v.status === "scripted"
      ? "Script is written. Render it with the engine, then run <code>python -m engine universe publish</code>."
      : "This video has not been made yet.";
    return `<div class="player" style="--c:${esc(c.color)}"><div class="fake">
      <h2>${esc(v.title.split("|")[0])}</h2><p>${esc(v.description.split("\n")[0])}</p>
      <button class="go" id="fakeplay">&#9654; Watch the trailer bar</button>
      <p style="margin-top:14px;font-size:12px;opacity:.65">${msg}</p></div><div class="bar"><i id="fakebar"></i></div></div>`;
  }

  function watch(id) {
    const v = vid[id];
    if (!v) return `<div class="empty">That video was removed by the Admin.</div>`;
    const c = chan[v.channel];
    const subbed = store.get("subs", {})[c.id];
    const vote = store.get("votes", {})[v.id] || 0;
    const mine = store.get("comments", {})[v.id] || [];
    const comments = v.comments.concat(mine);
    const mentions = v.mentions.map((m) => vid[m]).concat(U.videos.filter((o) => o.mentions.includes(v.id)));
    const seen = new Set();
    const related = mentions.filter((m) => !seen.has(m.id) && seen.add(m.id));
    const up = U.videos.filter((o) => o.id !== v.id).sort((a, b) =>
      (related.includes(b) - related.includes(a)) || ((b.channel === v.channel) - (a.channel === v.channel)) || byNew(a, b));
    return `<div class="watch"><div>
      ${player(v)}
      <div class="wtitle">${esc(v.title)}</div>
      <div class="row">
        <a href="#/c/${esc(c.id)}">${dot(c)}</a>
        <div class="grow"><a class="name" href="#/c/${esc(c.id)}">${esc(c.name)}</a>${ph(c)}<div class="sub">${num(c.subs)} subscribers</div></div>
        <button class="btn ${subbed ? "sub-on" : "sub-off"}" id="subbtn">${subbed ? "Subscribed" : "Subscribe"}</button>
        <span class="pill"><button id="up" class="${vote > 0 ? "on" : ""}">&#128077; ${num(v.likes + (vote > 0 ? 1 : 0))}</button><button id="down" class="${vote < 0 ? "on" : ""}">&#128078;</button></span>
      </div>
      <div class="desc"><b>${stats(v)}${v.status === "live" ? "" : " &middot; " + esc(v.status)}${ph(v)}</b>${esc(v.description)}
        ${v.cast.length ? `<div class="cast">${v.cast.map((p) => person[p]).filter(Boolean).map((p) =>
          `<a href="#/people">${dot(p)} ${esc(p.name)}</a>`).join("")}</div>` : ""}
        ${related.length ? `<div class="univ"><b>In this universe</b>${related.map((m) =>
          `<a href="#/watch/${esc(m.id)}">&#8627; ${esc(m.channel_name)}: ${esc(m.title.split("|")[0])}</a>`).join("")}</div>` : ""}
      </div>
      <div class="comments"><h3>${comments.length} Comments</h3>
        <form id="cform" class="row" style="margin-bottom:24px"><span id="me2" class="dot" style="background:#6d5bd0;width:40px;height:40px">YOU</span>
          <input id="ctext" class="grow" placeholder="Add a comment..." style="background:none;border:0;border-bottom:1px solid var(--line);color:var(--text);padding:8px 0;font:inherit"></form>
        ${comments.map((m) => {
          const p = person[m.by];
          const who = p ? p.name : m.by;
          return `<div class="cm">${p ? dot(p, "") : `<span class="dot" style="background:#6d5bd0;width:40px;height:40px">${esc(initials(who))}</span>`}
            <div><div class="who">@${esc(who.toLowerCase().replace(/[^a-z0-9]+/g, ""))}${p && p.channel ? `<span>${esc(chan[p.channel].name)}</span>` : ""}</div>
            <div>${esc(m.text)}</div><div class="lk">&#128077; ${num(m.likes || 0)}</div></div></div>`;
        }).join("")}
      </div></div>
      <aside>${up.map((o) => `<a class="up" href="#/watch/${esc(o.id)}">${thumb(o)}<div><div class="t">${esc(o.title)}</div>
        <div class="s sub">${esc(o.channel_name)}</div><div class="s sub">${stats(o)}</div></div></a>`).join("")}</aside></div>`;
  }

  function channel(id, tab) {
    const c = chan[id];
    if (!c) return `<div class="empty">Channel terminated. (Greg did it.)</div>`;
    tab = tab || "videos";
    const vids = U.videos.filter((v) => v.channel === id).sort(byNew);
    const subbed = store.get("subs", {})[id];
    let body;
    if (tab === "about") body = `<div class="desc"><b>About</b>${esc(c.about.trim())}<br><br>${esc(c.handle)} &middot; ${num(c.subs)} subscribers &middot; ${vids.length} videos</div>`;
    else if (tab === "cast") body = `<div class="people">${U.characters.filter((p) => p.channel === id).map(personCard).join("") || '<div class="empty">No cast listed.</div>'}</div>`;
    else body = vids.length ? `<div class="grid">${vids.map(card).join("")}</div>` : `<div class="empty">No videos yet.</div>`;
    return `<div class="banner" style="--c:${esc(c.color)}"></div>
      <div class="chead">${dot(c, "big")}<div class="grow"><h1>${esc(c.name)}${ph(c)}</h1>
        <div class="sub">${esc(c.handle)} &middot; ${num(c.subs)} subscribers &middot; ${vids.length} videos</div>
        <div class="sub" style="max-width:640px;margin-top:6px">${esc(c.about.trim().slice(0, 140))}&hellip;</div></div>
        <button class="btn ${subbed ? "sub-on" : "sub-off"}" id="subbtn" data-ch="${esc(id)}">${subbed ? "Subscribed" : "Subscribe"}</button></div>
      <div class="tabs">${[["videos", "Videos"], ["cast", "Cast"], ["about", "About"]].map(([t, n]) =>
        `<a class="${t === tab ? "on" : ""}" href="#/c/${esc(id)}${t === "videos" ? "" : "/" + t}">${n}</a>`).join("")}</div>${body}`;
  }

  const personCard = (p) => `<div class="person">${dot(p, "big")}<div><div class="name">${esc(p.name)}${ph(p)}</div>
    <div class="sub">${p.channel ? esc(chan[p.channel].name) : "Resident of the universe"}</div><div style="margin-top:4px">${esc(p.role)}</div></div></div>`;
  const people = () => `<h2>Everyone in the universe</h2><div class="people">${U.characters.map(personCard).join("")}</div>`;

  function timeline() {
    const list = U.videos.slice().sort((a, b) => (a.published < b.published ? -1 : 1));
    return `<h2>Universe timeline</h2><p class="sub">Every video from every channel, in the order it happened in-world.</p>
      <div class="timeline">${list.map((v) => `<div class="ev" style="--c:${esc(chan[v.channel].color)}">
        <small>${esc(v.published)} &middot; ${esc(v.channel_name)}</small><br>
        <a class="name" href="#/watch/${esc(v.id)}">${esc(v.title.split("|")[0])}</a>${ph(v)}</div>`).join("")}</div>`;
  }

  function search(q) {
    const t = q.toLowerCase();
    const hit = (v) => [v.title, v.description, v.channel_name, ...v.cast.map((p) => (person[p] || {}).name || "")].join(" ").toLowerCase().includes(t);
    const list = U.videos.filter(hit).sort(byNew);
    return `<h3>${list.length} results for &ldquo;${esc(q)}&rdquo;</h3><div class="grid">${list.map(card).join("")}</div>`;
  }

  function wire(parts) {
    const sb = $("#subbtn");
    if (sb) sb.onclick = () => {
      const id = sb.dataset.ch || vid[parts[1]].channel;
      const s = store.get("subs", {});
      s[id] = !s[id];
      store.set("subs", s);
      render();
    };
    const vote = (n) => () => {
      const m = store.get("votes", {});
      m[parts[1]] = m[parts[1]] === n ? 0 : n;
      store.set("votes", m);
      render();
    };
    if ($("#up")) { $("#up").onclick = vote(1); $("#down").onclick = vote(-1); }
    const cf = $("#cform");
    if (cf) cf.onsubmit = (e) => {
      e.preventDefault();
      const text = $("#ctext").value.trim();
      if (!text) return;
      const m = store.get("comments", {});
      (m[parts[1]] = m[parts[1]] || []).unshift({ by: "You", text, likes: 0 });
      store.set("comments", m);
      render();
    };
    const fp = $("#fakeplay");
    if (fp) fp.onclick = () => {
      const bar = $("#fakebar");
      let w = 0;
      fp.disabled = true;
      const t = setInterval(() => { w += 1.2; bar.style.width = Math.min(w, 100) + "%"; if (w >= 100) { clearInterval(t); fp.disabled = false; } }, 60);
    };
  }

  function render(top) {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const [r, a, b] = parts;
    let html, route = "home";
    if (r === "watch") { html = watch(a); route = "watch"; }
    else if (r === "c") { html = channel(a, b); route = "c/" + a; }
    else if (r === "timeline") { html = timeline(); route = "timeline"; }
    else if (r === "people") { html = people(); route = "people"; }
    else if (r === "search") { html = search(decodeURIComponent(a || "")); route = ""; }
    else html = home(r === "f" ? a : "");
    sidebar(route);
    $("#view").innerHTML = html;
    document.title = (route === "watch" && vid[a] ? vid[a].title + " - " : "") + U.site.name;
    if (top === true) window.scrollTo(0, 0);
    wire(parts);
  }

  $("#sitename").textContent = U.site.name;
  $("#menu").onclick = () => { document.body.classList.toggle("slim"); $("#side").classList.toggle("open"); };
  $("#search").onsubmit = (e) => { e.preventDefault(); const q = $("#q").value.trim(); if (q) location.hash = "#/search/" + encodeURIComponent(q); };
  window.addEventListener("hashchange", () => render(true));
  render(true);
})();
