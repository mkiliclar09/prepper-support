// Prepper Support — kişi ve grup modeli
// config/access belgesi (yalnızca yöneticiler okur):
//   { members: { "eposta": { name, role: "admin"|"member", groups: ["gid"] } },
//     groups:  { "gid": { name, members: ["eposta", ...] } } }
// directory/{eposta} belgesi (yalnızca o kişi okur): kişinin görebileceği gruplar ve kişiler.
// Kural: herkes yalnızca aynı gruptaki kişileri görür. Yöneticiler herkesi görür ve herkese görünür.

const lower = s => String(s || "").trim().toLowerCase();

// Grup üye listelerini kişilerin grup bilgisinden yeniden üretir (sıralı, tutarlı)
export function normalize(access, bootAdmins = []) {
  const members = {}, groups = {};
  Object.entries((access && access.members) || {}).forEach(([e, m]) => {
    members[lower(e)] = { name: String(m.name || e), role: m.role === "admin" ? "admin" : "member", groups: [...new Set(m.groups || [])] };
  });
  bootAdmins.map(lower).forEach(e => { if (!members[e]) members[e] = { name: e, role: "admin", groups: [] }; else members[e].role = "admin"; });
  Object.entries((access && access.groups) || {}).forEach(([id, g]) => { groups[id] = { name: String(g.name || "Grup"), members: [] }; });
  Object.entries(members).forEach(([e, m]) => { m.groups = m.groups.filter(id => groups[id]); m.groups.forEach(id => groups[id].members.push(e)); });
  Object.values(groups).forEach(g => g.members.sort());
  return { members, groups };
}

// Bir kişinin görebileceği gruplar ve kişiler
export function buildDir(access, email) {
  email = lower(email);
  const me = access.members[email]; if (!me) return null;
  const groups = me.groups.filter(id => access.groups[id]).map(id => ({ id, name: access.groups[id].name, members: access.groups[id].members.slice() }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const contacts = {};
  Object.entries(access.members).forEach(([e, m]) => {
    if (e === email) return;
    const visible = me.role === "admin" || m.role === "admin" || m.groups.some(id => me.groups.includes(id));
    if (visible) contacts[e] = { name: m.name, role: m.role };
  });
  return { name: me.name, role: me.role, groups, contacts };
}

export const newGroupId = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
