/* GK Family Tree — mobile-first viewer + GitHub-backed editor.
 *
 * Primary view is a FOCUS view: one person centred, their parent above and
 * children below; tap any relative to re-centre on them. This scales to a
 * large family on a phone, where a full wide chart cannot. A secondary
 * "Whole tree" tab shows the classic zoomable chart.
 *
 * Public visitors can only view (name, photo, location). Phone numbers are
 * stored in family.json but NEVER shown on the page. Editing needs a GitHub
 * token saved only in the owner's own browser.
 */

const DATA_FILE = "family.json";
const CFG_KEY = "gkfamily.cfg.v1"; // { owner, repo, branch, token }

let people = [];
let byId = {};
let currentSha = null;
let editing = false;
let focusId = null;   // person centred in focus view
let mode = "focus";   // "focus" | "overview"
let zoom = 0.9;

/* ----------------------------- config ----------------------------------- */
function getCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } }
function setCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
function hasToken() { const c = getCfg(); return !!(c.owner && c.repo && c.token); }

/* ----------------------------- load -------------------------------------- */
async function load() {
  const res = await fetch(DATA_FILE + "?t=" + Date.now());
  people = await res.json();
  index();
  const root = people.find(p => !p.parentId);
  focusId = (root && root.id) || (people[0] && people[0].id);
  renderFocus();
}

function index() {
  byId = {};
  people.forEach(p => { p.children = []; byId[p.id] = p; });
  people.forEach(p => { if (p.parentId && byId[p.parentId]) byId[p.parentId].children.push(p); });
}

function nextId() {
  let max = 0;
  people.forEach(p => { const m = /^p(\d+)$/.exec(p.id); if (m) max = Math.max(max, +m[1]); });
  return "p" + (max + 1);
}

/* ----------------------------- focus view -------------------------------- */
function go(id) { focusId = id; closeResults(); if (mode !== "focus") setMode("focus"); else renderFocus(); window.scrollTo(0, 0); }

function ancestry(id) {
  const chain = [];
  let p = byId[id];
  while (p) { chain.unshift(p); p = p.parentId ? byId[p.parentId] : null; }
  return chain; // root ... current
}

function renderFocus() {
  const p = byId[focusId];
  if (!p) return;

  // breadcrumbs (root → … → current)
  const chain = ancestry(p.id);
  const crumbs = document.getElementById("crumbs");
  crumbs.innerHTML = "";
  chain.forEach((c, i) => {
    if (i) { const s = document.createElement("span"); s.className = "sep"; s.textContent = "›"; crumbs.appendChild(s); }
    if (c.id === p.id) { const b = document.createElement("b"); b.textContent = c.name; crumbs.appendChild(b); }
    else { const a = document.createElement("a"); a.textContent = c.name; a.onclick = () => go(c.id); crumbs.appendChild(a); }
  });

  // parent chip
  const parentRow = document.getElementById("parentRow");
  parentRow.innerHTML = "";
  if (p.parentId && byId[p.parentId]) {
    const par = byId[p.parentId];
    const el = document.createElement("div");
    el.className = "uplink";
    el.onclick = () => go(par.id);
    el.appendChild(thumb(par, "tiny"));
    const t = document.createElement("span"); t.textContent = par.name;
    const up = document.createElement("span"); up.className = "up-arrow"; up.textContent = "↑ parent";
    el.appendChild(t); el.appendChild(up);
    parentRow.appendChild(el);
  }

  // hero card
  const wrap = document.getElementById("centerWrap");
  wrap.innerHTML = "";
  const hero = document.createElement("div");
  hero.className = "hero " + (p.gender === "female" ? "female" : "male");
  hero.appendChild(thumb(p, "photo"));
  const name = document.createElement("div"); name.className = "name"; name.textContent = p.name; hero.appendChild(name);
  if (p.spouseName) { const s = document.createElement("div"); s.className = "spouse"; s.textContent = "• " + p.spouseName; hero.appendChild(s); }
  if (p.location) { const l = document.createElement("div"); l.className = "loc"; l.textContent = "📍 " + p.location; hero.appendChild(l); }
  if (editing) {
    const row = document.createElement("div"); row.className = "editrow";
    const e = document.createElement("button"); e.className = "primary"; e.textContent = "Edit"; e.onclick = () => openEdit(p);
    const a = document.createElement("button"); a.textContent = "+ Add child"; a.onclick = () => openEdit(null, p.id);
    row.appendChild(e); row.appendChild(a); hero.appendChild(row);
  }
  wrap.appendChild(hero);

  // children
  const head = document.getElementById("childrenHead");
  const row = document.getElementById("childrenRow");
  row.innerHTML = "";
  if (p.children.length) {
    head.textContent = p.children.length + (p.children.length === 1 ? " child" : " children");
    p.children.forEach(c => row.appendChild(kidCard(c)));
  } else {
    head.textContent = editing ? "No children yet" : "";
  }
}

function kidCard(c) {
  const el = document.createElement("div");
  el.className = "kid " + (c.gender === "female" ? "female" : "male");
  el.onclick = () => go(c.id);
  el.appendChild(thumb(c, "photo"));
  const n = document.createElement("div"); n.className = "name"; n.textContent = c.name; el.appendChild(n);
  if (c.location) { const m = document.createElement("div"); m.className = "meta"; m.textContent = c.location; el.appendChild(m); }
  if (c.children.length) { const k = document.createElement("div"); k.className = "haskids"; k.textContent = c.children.length + " ↓"; el.appendChild(k); }
  return el;
}

function thumb(p, cls) {
  if (p.photo) {
    const img = document.createElement("img");
    img.className = cls; img.src = p.photo; img.alt = p.name;
    img.onerror = () => img.replaceWith(avatar(p, cls));
    return img;
  }
  return avatar(p, cls);
}
function avatar(p, cls) {
  const d = document.createElement("div");
  d.className = (cls === "photo" ? "avatar" : cls);
  if (cls !== "photo") d.classList.add("avatar");
  d.textContent = p.gender === "female" ? "👩" : "👨";
  return d;
}

/* ----------------------------- overview chart ---------------------------- */
function renderOverview() {
  const tree = document.getElementById("tree");
  tree.innerHTML = "";
  const roots = people.filter(p => !p.parentId);
  const ul = document.createElement("ul");
  roots.forEach(r => ul.appendChild(overviewNode(r)));
  tree.appendChild(ul);
  setZoom(zoom);
}
function overviewNode(p) {
  const li = document.createElement("li");
  const n = document.createElement("div");
  n.className = "node " + (p.gender === "female" ? "female" : "male");
  n.dataset.id = p.id;
  n.appendChild(thumb(p, "photo"));
  const nm = document.createElement("div"); nm.className = "name"; nm.textContent = p.name; n.appendChild(nm);
  if (p.location) { const m = document.createElement("div"); m.className = "meta"; m.textContent = p.location; n.appendChild(m); }
  n.onclick = () => go(p.id);
  li.appendChild(n);
  if (p.children.length) {
    const ul = document.createElement("ul");
    p.children.forEach(c => ul.appendChild(overviewNode(c)));
    li.appendChild(ul);
  }
  return li;
}
function setZoom(z) { zoom = Math.min(1.6, Math.max(0.3, z)); document.getElementById("tree").style.transform = "scale(" + zoom + ")"; }

/* ----------------------------- modes ------------------------------------- */
function setMode(m) {
  mode = m;
  document.getElementById("focus").hidden = m !== "focus";
  document.getElementById("overview").hidden = m !== "overview";
  document.getElementById("tabFocus").classList.toggle("active", m === "focus");
  document.getElementById("tabOverview").classList.toggle("active", m === "overview");
  if (m === "focus") renderFocus(); else renderOverview();
}

/* ----------------------------- search ------------------------------------ */
function search(q) {
  q = q.trim().toLowerCase();
  const box = document.getElementById("results");
  if (!q) { box.classList.remove("show"); box.innerHTML = ""; return; }
  const hits = people.filter(p =>
    (p.name + " " + (p.spouseName || "") + " " + (p.location || "")).toLowerCase().includes(q)
  ).slice(0, 40);
  box.innerHTML = "";
  if (!hits.length) { box.innerHTML = '<div class="r"><div class="rn">No match</div></div>'; box.classList.add("show"); return; }
  hits.forEach(p => {
    const r = document.createElement("div"); r.className = "r";
    r.appendChild(thumb(p, "mini"));
    const col = document.createElement("div");
    const n = document.createElement("div"); n.className = "rn"; n.textContent = p.name;
    const l = document.createElement("div"); l.className = "rl";
    l.textContent = [p.spouseName ? "• " + p.spouseName : "", p.location || ""].filter(Boolean).join("  ·  ");
    col.appendChild(n); if (l.textContent) col.appendChild(l);
    r.appendChild(col);
    r.onclick = () => { document.getElementById("searchBox").value = ""; go(p.id); };
    box.appendChild(r);
  });
  box.classList.add("show");
}
function closeResults() { const b = document.getElementById("results"); b.classList.remove("show"); b.innerHTML = ""; }

/* ----------------------------- editor ------------------------------------ */
function descendants(id) {
  const out = new Set();
  (function walk(i) { (byId[i].children || []).forEach(c => { out.add(c.id); walk(c.id); }); })(id);
  return out;
}
function parentOptions(selfId, selected) {
  const skip = selfId ? descendants(selfId) : new Set();
  if (selfId) skip.add(selfId);
  return people
    .filter(p => !skip.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}"${p.id === selected ? " selected" : ""}>${esc(p.name)}</option>`)
    .join("");
}

function openEdit(p, presetParent) {
  if (!hasToken()) return openSettings();
  const isNew = !p;
  const d = p || { id: "", parentId: presetParent || null, name: "", gender: "male", photo: "", spouseName: "", location: "", phone: "" };
  const m = modal();
  m.innerHTML = `
    <h2>${isNew ? "Add person" : "Edit " + esc(d.name)}</h2>
    <label>Name</label>
    <input id="f_name" value="${esc(d.name)}" placeholder="Full name">
    <div class="row">
      <div>
        <label>Gender</label>
        <select id="f_gender">
          <option value="male"${d.gender === "male" ? " selected" : ""}>Male</option>
          <option value="female"${d.gender === "female" ? " selected" : ""}>Female</option>
        </select>
      </div>
      <div>
        <label>Spouse name</label>
        <input id="f_spouse" value="${esc(d.spouseName)}" placeholder="optional">
      </div>
    </div>
    <label>Parent (whose child are they?)</label>
    <select id="f_parent">
      <option value="">— none (top of tree) —</option>
      ${parentOptions(d.id, d.parentId)}
    </select>
    <label>Location</label>
    <input id="f_location" value="${esc(d.location)}" placeholder="City / town">
    <label>Phone <span class="hint">(stored privately, never shown on the page)</span></label>
    <input id="f_phone" value="${esc(d.phone)}" inputmode="tel" placeholder="optional">
    <label>Photo</label>
    <input id="f_photo" type="file" accept="image/*">
    <div class="hint">${d.photo ? "Current photo set — pick a new file to replace it." : "No photo yet."}</div>
    <div class="actions">
      ${(!isNew && d.parentId) ? `<button class="danger" onclick="removePerson('${d.id}')">Delete</button>` : ""}
      <div class="spacer"></div>
      <button onclick="closeModal()">Cancel</button>
      <button class="primary" onclick="savePerson(${isNew ? "null" : "'" + d.id + "'"})">Save</button>
    </div>`;
  openOverlay();
}

async function savePerson(id) {
  if (!hasToken()) { toast("Set up editing first.", true); return; }
  const isNew = !id;
  const rec = isNew ? { id: nextId(), children: [] } : byId[id];
  rec.name = val("f_name").trim();
  if (!rec.name) { toast("Name is required.", true); return; }
  rec.gender = val("f_gender");
  rec.spouseName = val("f_spouse").trim();
  rec.parentId = val("f_parent") || null;
  rec.location = val("f_location").trim();
  rec.phone = val("f_phone").trim();

  const file = document.getElementById("f_photo").files[0];
  try {
    toast("Saving…");
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = "img/" + rec.id + "." + ext;
      await ghPut(path, await fileToBase64(file), "Photo: " + rec.name, true);
      rec.photo = path;
    } else if (isNew) { rec.photo = ""; }

    if (isNew) people.push(rec);
    const payload = people.map(({ children, ...keep }) => keep);
    const resp = await ghPut(DATA_FILE, utf8ToBase64(JSON.stringify(payload, null, 2)), (isNew ? "Add " : "Update ") + rec.name, false);
    currentSha = resp.content.sha;

    index();
    focusId = rec.id;
    closeModal();
    mode === "overview" ? renderOverview() : renderFocus();
    toast("Saved ✓");
  } catch (e) { toast("Save failed: " + e.message, true); }
}

async function removePerson(id) {
  const p = byId[id];
  if (!p) return;
  const target = byId[p.parentId];
  if (!confirm(`Delete ${p.name}? Their ${p.children.length} child(ren) will move up to ${target ? target.name : "the top"}.`)) return;
  try {
    toast("Deleting…");
    people.forEach(x => { if (x.parentId === id) x.parentId = p.parentId; });
    people = people.filter(x => x.id !== id);
    const payload = people.map(({ children, ...keep }) => keep);
    const resp = await ghPut(DATA_FILE, utf8ToBase64(JSON.stringify(payload, null, 2)), "Delete " + p.name, false);
    currentSha = resp.content.sha;
    index();
    focusId = (target && target.id) || (people.find(x => !x.parentId) || {}).id;
    closeModal();
    mode === "overview" ? renderOverview() : renderFocus();
    toast("Deleted ✓");
  } catch (e) { toast("Delete failed: " + e.message, true); }
}

/* ----------------------------- GitHub API -------------------------------- */
function ghUrl(path) { const c = getCfg(); return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`; }
async function ghGetSha(path) {
  const c = getCfg();
  const r = await fetch(ghUrl(path) + "?ref=" + (c.branch || "main"), { headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("read " + r.status);
  return (await r.json()).sha;
}
async function ghPut(path, base64, message, isBinary) {
  const c = getCfg();
  const sha = path === DATA_FILE ? (currentSha || await ghGetSha(path)) : await ghGetSha(path);
  const body = { message, content: base64, branch: c.branch || "main" };
  if (sha) body.sha = sha;
  const r = await fetch(ghUrl(path), {
    method: "PUT",
    headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(r.status + (r.status === 401 ? " bad token" : r.status === 409 ? " conflict, reload" : "") + " " + t.slice(0, 100));
  }
  return r.json();
}

/* ----------------------------- settings ---------------------------------- */
function openSettings() {
  const c = getCfg();
  const m = modal();
  m.innerHTML = `
    <h2>Editing setup</h2>
    <div class="hint">Only you, on this device. The token is saved in this browser only.</div>
    <label>GitHub username</label>
    <input id="s_owner" value="${esc(c.owner || "balaji4aws")}" autocapitalize="off">
    <label>Repository</label>
    <input id="s_repo" value="${esc(c.repo || "gkfamily")}" autocapitalize="off">
    <label>Branch</label>
    <input id="s_branch" value="${esc(c.branch || "main")}" autocapitalize="off">
    <label>Access token <span class="hint">(fine-grained: Contents Read &amp; write)</span></label>
    <input id="s_token" type="password" value="${esc(c.token || "")}" placeholder="github_pat_…">
    <div class="actions">
      ${c.token ? `<button class="danger" onclick="signOut()">Sign out</button>` : ""}
      <div class="spacer"></div>
      <button onclick="closeModal()">Cancel</button>
      <button class="primary" onclick="saveSettings()">Enable editing</button>
    </div>`;
  openOverlay();
}
function saveSettings() {
  setCfg({ owner: val("s_owner").trim(), repo: val("s_repo").trim(), branch: val("s_branch").trim() || "main", token: val("s_token").trim() });
  currentSha = null;
  editing = hasToken();
  closeModal(); refreshEditUI();
  mode === "overview" ? renderOverview() : renderFocus();
  toast(editing ? "Editing enabled ✓" : "Saved");
}
function signOut() { localStorage.removeItem(CFG_KEY); editing = false; closeModal(); refreshEditUI(); renderFocus(); toast("Signed out"); }
function toggleEdit() { if (!hasToken()) return openSettings(); editing = !editing; refreshEditUI(); mode === "overview" ? renderOverview() : renderFocus(); }
function refreshEditUI() {
  const btn = document.getElementById("editBtn");
  btn.querySelector("span") ? (btn.querySelector("span").textContent = editing ? "Done" : (hasToken() ? "Edit" : "Set up editing")) : null;
  btn.classList.toggle("active", editing);
  document.getElementById("addBtn").style.display = editing ? "" : "none";
  document.getElementById("editBadge").textContent = editing ? "editing" : "";
}

/* ----------------------------- helpers ----------------------------------- */
function modal() { return document.getElementById("modalBody"); }
function openOverlay() { document.getElementById("overlay").classList.add("open"); }
function closeModal() { document.getElementById("overlay").classList.remove("open"); }
function val(id) { return document.getElementById(id).value; }
function esc(s) { return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fileToBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); }); }
function utf8ToBase64(s) { return btoa(unescape(encodeURIComponent(s))); }
let toastTimer;
function toast(msg, err) { const el = document.getElementById("status"); el.textContent = msg; el.classList.toggle("err", !!err); el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), err ? 6000 : 2200); }

/* ----------------------------- wire up ----------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchBox").addEventListener("input", e => search(e.target.value));
  document.getElementById("gearBtn").addEventListener("click", openSettings);
  document.getElementById("editBtn").addEventListener("click", toggleEdit);
  document.getElementById("addBtn").addEventListener("click", () => openEdit(null, focusId));
  document.getElementById("tabFocus").addEventListener("click", () => setMode("focus"));
  document.getElementById("tabOverview").addEventListener("click", () => setMode("overview"));
  document.getElementById("zin").addEventListener("click", () => setZoom(zoom + 0.15));
  document.getElementById("zout").addEventListener("click", () => setZoom(zoom - 0.15));
  document.getElementById("overlay").addEventListener("click", e => { if (e.target.id === "overlay") closeModal(); });
  document.addEventListener("click", e => { if (!e.target.closest(".searchwrap")) closeResults(); });
  editing = false;
  refreshEditUI();
  load().catch(e => toast("Could not load family data: " + e.message, true));
});
