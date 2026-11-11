/* Deck appliance cabinet — product viewer.
   Model mm: x across (kitchen side 0 -> studio side), y back from the cabinet front, z up from the deck.
   three.js: X = x - W/2, Y = z, Z = -(y - D/2). */
(function () {
  var M = window.__M, STEPS = window.__STEPS || [];
  var P = M.params, W = P.W, D = P.D, T = P.T;
  var canvas = document.getElementById('c');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(32, 1, 20, 80000);
  var ctl = new THREE.OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.93;
  var maxAniso = renderer.capabilities.getMaxAnisotropy();
  function V(x, y, z) { return new THREE.Vector3(x - W / 2, z, -(y - D / 2)); }

  /* ---------- light ---------- */
  (function () {
    var c = document.createElement('canvas'); c.width = 2; c.height = 256; var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#bcd3ea'); gr.addColorStop(0.55, '#e6edf2'); gr.addColorStop(1, '#f4f1ea'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; scene.background = t;
    if (THREE.RoomEnvironment) { var pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; }
  })();
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x9a8a70, 0.45));
  var sun = new THREE.DirectionalLight(0xfff1dc, 1.7); sun.position.set(-2400, 4600, 3200); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); var sc = sun.shadow.camera; sc.left = -2600; sc.right = 2600; sc.top = 2800; sc.bottom = -1400; sc.near = 500; sc.far = 12000;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 1.5; scene.add(sun);
  var fill = new THREE.DirectionalLight(0xdfe8ff, 0.35); fill.position.set(3000, 1600, 2000); scene.add(fill);

  /* ---------- helpers ---------- */
  function std(o, phys) { var m = phys ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o); m.color.convertSRGBToLinear(); return m; }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function ctex(w, h, fn, srgb) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; if (srgb) t.encoding = THREE.sRGBEncoding; return t; }
  function planarUV(geo, tile) {
    var p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
    for (var i = 0; i < p.count; i++) {
      var nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i)), u, v;
      if (nx >= ny && nx >= nz) { u = p.getZ(i); v = p.getY(i); } else if (ny >= nz) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
    } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  // black film-faced formply: smooth phenolic film with faint mottling and the odd scuff
  var filmTex = ctex(1024, 1024, function (g, w, h) { g.fillStyle = '#1b1a1a'; g.fillRect(0, 0, w, h); var r = rng(7);
    for (var i = 0; i < 90; i++) { var x = r() * w, y = r() * h, rr = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, rr); var c = r() < 0.5 ? '255,255,255' : '0,0,0'; gr.addColorStop(0, 'rgba(' + c + ',0.007)'); gr.addColorStop(1, 'rgba(' + c + ',0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
    for (var k = 0; k < 14000; k++) { g.fillStyle = 'rgba(255,255,255,' + (r() * 0.025) + ')'; g.fillRect(r() * w, r() * h, 1, 1); }
    g.strokeStyle = 'rgba(255,255,255,0.03)'; for (var k = 0; k < 18; k++) { g.beginPath(); var x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 30); g.stroke(); } }, true);
  var filmRough = ctex(256, 256, function (g, w, h) { g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h); var r = rng(3); for (var i = 0; i < 60; i++) { var x = r() * w, y = r() * h, rr = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(' + (r() < 0.5 ? '255,255,255' : '0,0,0') + ',0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); } });
  // sealed ply edge: thin veneers under black edge sealer
  var edgeTex = ctex(64, 256, function (g, w, h) { g.fillStyle = '#141313'; g.fillRect(0, 0, w, h); var n = 11; for (var i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#232120' : '#1b1918'; g.fillRect(0, i * h / n, w, h / n - 2); } }, true);
  var walnutTex = ctex(256, 1024, function (g, w, h) { var r = rng(21); g.fillStyle = '#4a3020'; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 160; i++) { var x = r() * w; g.strokeStyle = 'rgba(' + (r() < 0.5 ? '28,16,10' : '120,80,50') + ',' + (0.12 + r() * 0.25) + ')'; g.lineWidth = 0.6 + r() * 2.4; g.beginPath(); g.moveTo(x, 0);
      for (var y = 0; y <= h; y += 64) g.lineTo(x + Math.sin(y / 140 + i) * (4 + r() * 6), y); g.stroke(); }
    for (var k = 0; k < 4; k++) { var cy = r() * h, cx = r() * w; g.strokeStyle = 'rgba(30,18,10,0.3)'; for (var q = 1; q < 6; q++) { g.beginPath(); g.ellipse(cx, cy, q * 5, q * 22, 0, 0, Math.PI * 2); g.stroke(); } } }, true);
  function planarUVlong(geo) { var p = geo.attributes.position, uv = geo.attributes.uv; for (var i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 120, p.getY(i) / 900); uv.needsUpdate = true; }
  var MAT = {
    film: std({ map: filmTex, roughnessMap: filmRough, color: 0xffffff, roughness: 0.55, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.45 }, true),
    edge: std({ map: edgeTex, color: 0xffffff, roughness: 0.75 }),
    asa: std({ color: 0x27282b, roughness: 0.7 }),
    walnut: std({ map: walnutTex, color: 0xffffff, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5 }, true),
    alu: std({ color: 0xb9bcbf, roughness: 0.35, metalness: 0.9 }),
    aluBlack: std({ color: 0x1d1e20, roughness: 0.45, metalness: 0.6 }),
    mesh: std({ color: 0x141516, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide }),
    steel: std({ color: 0xc9cccf, roughness: 0.28, metalness: 0.85 }),
    steelDark: std({ color: 0x8b8f93, roughness: 0.35, metalness: 0.8 }),
    white: std({ color: 0xf2f2ef, roughness: 0.38, metalness: 0.05 }, true),
    grey: std({ color: 0x9da1a5, roughness: 0.5 }),
    glass: std({ color: 0x334048, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 }, true),
    rubber: std({ color: 0x3a3c3e, roughness: 0.9 }),
    chrome: std({ color: 0xdcdcdc, roughness: 0.15, metalness: 1 }),
    ghost: new THREE.MeshBasicMaterial({ color: 0x2c3a48, transparent: true, opacity: 0.16, depthWrite: false }),
    hi: std({ color: 0xd9a441, roughness: 0.5, emissive: 0x3a2400 })
  };
  var pickables = [], all = [], groups = {};
  function G(n) { if (!groups[n]) { groups[n] = new THREE.Group(); scene.add(groups[n]); } return groups[n]; }
  function shadow(o) { o.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
  function tag(o, ud) { o.traverse(function (m) { if (m.isMesh) { m.userData = ud; pickables.push(m); } }); o.userData = ud; return o; }

  // a ply panel as a box: film on the two big faces, sealed edge elsewhere
  function plyBox(b) {
    var sx = b[3] - b[0], sy = b[4] - b[1], sz = b[5] - b[2];
    var geo = new THREE.BoxGeometry(sx, sz, sy); planarUV(geo, 900);
    var thin = Math.min(sx, sy, sz), mats = [];
    // BoxGeometry groups: +x,-x,+y,-y,+z,-z (three axes). Map our x->X, z->Y, y->Z
    var dims = [sx, sx, sz, sz, sy, sy];
    for (var i = 0; i < 6; i++) { var axisSize = [sx, sx, sz, sz, sy, sy][i]; mats.push(Math.abs(axisSize - thin) < 0.01 ? MAT.film : MAT.edge); }
    var m = new THREE.Mesh(geo, mats); m.position.copy(V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2)); return m;
  }
  // a ply panel from a 2D shape with holes, extruded through its thickness. axis: 'x' (panel in the y-z plane) or 'y' (panel in x-z plane)
  function plyShape(outline, holes, thick, place) {
    var s = new THREE.Shape(outline.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
    holes.forEach(function (h) { s.holes.push(h); });
    var geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 10 });
    geo.computeVertexNormals(); planarUV(geo, 900);
    // group 0 = caps (film), group 1 = sides (edge)
    var m = new THREE.Mesh(geo, [MAT.film, MAT.edge]); place(m); return m;
  }
  function stadium(cx, cy, w, h) { var r = h / 2, p = new THREE.Path(); p.moveTo(cx - w / 2 + r, cy - r); p.lineTo(cx + w / 2 - r, cy - r); p.absarc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2, false); p.lineTo(cx - w / 2 + r, cy + r); p.absarc(cx - w / 2 + r, cy, r, Math.PI / 2, Math.PI * 1.5, false); return p; }
  function rrect(cx, cy, w, h, r) { var p = new THREE.Path(), x0 = cx - w / 2, y0 = cy - h / 2; p.moveTo(x0 + r, y0); p.lineTo(x0 + w - r, y0); p.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0); p.lineTo(x0 + w, y0 + h - r); p.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2); p.lineTo(x0 + r, y0 + h); p.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI); p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5); return p; }
  function circ(cx, cy, r) { var p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, false); return p; }

  /* ---------- deck and site context (indicative) ---------- */
  var ctx = G('context');
  (function () {
    var deckTex = ctex(1024, 1024, function (g, w, h) { var r = rng(11); var n = 7, bw = w / n;
      for (var i = 0; i < n; i++) { var base = 150 + r() * 22; g.fillStyle = 'rgb(' + (base + 34 | 0) + ',' + (base - 2 | 0) + ',' + (base - 62 | 0) + ')'; g.fillRect(i * bw, 0, bw - 6, h);
        for (var k = 0; k < 70; k++) { g.strokeStyle = 'rgba(120,85,40,' + (0.05 + r() * 0.08) + ')'; g.lineWidth = 1 + r() * 2; g.beginPath(); var x = i * bw + r() * (bw - 6); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 18, h * 0.3, x + (r() - 0.5) * 18, h * 0.7, x + (r() - 0.5) * 10, h); g.stroke(); }
        for (var q = 0; q < 2; q++) { var ky = r() * h; g.fillStyle = 'rgba(110,70,30,0.35)'; g.beginPath(); g.ellipse(i * bw + r() * (bw - 20) + 10, ky, 6 + r() * 6, 10 + r() * 8, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = 'rgba(40,30,20,0.85)'; g.fillRect(i * bw + bw - 6, 0, 6, h); } }, true);
    deckTex.repeat.set(1, 1);
    var dw = 5200, dd = 4200, geo = new THREE.PlaneGeometry(dw, dd); geo.rotateX(-Math.PI / 2);
    var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * dw / 966, uv.getY(i) * dd / 2600);
    var deck = new THREE.Mesh(geo, std({ map: deckTex, roughness: 0.82 })); deck.receiveShadow = true;
    deck.position.copy(V(W / 2 - 900, D + M.site.screen_gap - dd / 2, -0.5)); ctx.add(deck);
    // white vertical slat screen behind the cabinet, between dark posts
    var sy = D + M.site.screen_gap, slat = std({ color: 0xe9ebe8, roughness: 0.5, metalness: 0.2 }), post = std({ color: 0x2a2522, roughness: 0.7 });
    var x0 = -1700, x1 = W + M.site.studio_gap;
    var sg = new THREE.BoxGeometry(42, 2300, 16), n = Math.floor((x1 - x0 - 90) / 62), inst = new THREE.InstancedMesh(sg, slat, n), mtx = new THREE.Matrix4();
    for (var k = 0; k < n; k++) { var p = V(x0 + 90 + 31 + k * 62, sy + 30, 1150); mtx.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(k, mtx); }
    inst.castShadow = true; inst.receiveShadow = true; ctx.add(inst);
    [x0, x1 - 90].forEach(function (x) { var pm = new THREE.Mesh(new THREE.BoxGeometry(90, 2700, 90), post); pm.position.copy(V(x + 45, sy + 30, 1350)); shadow(pm); ctx.add(pm); });
    var rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 70, 45), post); rail.position.copy(V((x0 + x1) / 2, sy + 70, 2335)); shadow(rail); ctx.add(rail);
    // corrugated studio wall on the right
    var sx = W + M.site.studio_gap + 2, cg = new THREE.PlaneGeometry(dd - 600, 2700, 1, 1);
    var corr = ctex(256, 64, function (g, w, h) { var gr = g.createLinearGradient(0, 0, w, 0); for (var i = 0; i <= 8; i++) { gr.addColorStop(i / 8, i % 2 ? '#8f9599' : '#d7dbdd'); } g.fillStyle = gr; g.fillRect(0, 0, w, h); }, true);
    corr.repeat.set((dd - 600) / 304, 1);
    var wall = new THREE.Mesh(cg, std({ map: corr, roughness: 0.35, metalness: 0.75, color: 0xffffff })); wall.rotation.y = -Math.PI / 2; wall.position.copy(V(sx, sy - (dd - 600) / 2, 1350)); wall.receiveShadow = true; ctx.add(wall);
    var sp = new THREE.Mesh(new THREE.BoxGeometry(90, 2700, 90), post); sp.position.copy(V(sx - 45, -700, 1350)); shadow(sp); ctx.add(sp);
    // power point on the studio wall (indicative only: position unmeasured)
    var gpo = new THREE.Mesh(new THREE.BoxGeometry(14, 80, 120), std({ color: 0xf4f4f0, roughness: 0.5 })); gpo.position.copy(V(sx - 7, M.params.cable.y, 1150)); ctx.add(tag(gpo, { name: 'Power point (indicative)', desc: 'Owner confirmed a power point on the studio wall beside the laundry. Position, socket count, rating and weather cover are NOT measured. Electrician to confirm three accessible outlets before the lead holes are cut.' }));
    // pergola rafters overhead (open, per the 9 Nov photo)
    var raft = std({ color: 0xcaa16a, roughness: 0.8 }), rg = G('pergola');
    for (var r = 0; r < 6; r++) { var rm = new THREE.Mesh(new THREE.BoxGeometry(45, 190, dd), raft); rm.position.copy(V(-1500 + r * 600, sy - dd / 2 + 200, 2800)); shadow(rm); rg.add(rm); }
    // a person for scale, 1750 tall, standing on the deck in front
    var pg = new THREE.Group(), pm2 = std({ color: 0x5f6870, roughness: 0.85 });
    var bodyP = [[0, 0], [130, 0], [150, 260], [160, 820], [190, 1000], [210, 1380], [160, 1480], [70, 1500], [70, 1560]];
    var lathe = new THREE.LatheGeometry(bodyP.map(function (p) { return new THREE.Vector2(p[0] * 0.75, p[1]); }), 28); var bm = new THREE.Mesh(lathe, pm2); bm.scale.set(1, 1, 0.6); pg.add(bm);
    var head = new THREE.Mesh(new THREE.SphereGeometry(105, 24, 16), pm2); head.position.y = 1645; head.scale.set(0.85, 1, 0.95); pg.add(head);
    pg.position.copy(V(-520, 250, 0)); shadow(pg); G('person').add(pg);
  })();

  /* ---------- the cabinet ---------- */
  var leafGroups = {};
  M.parts.forEach(function (p) {
    var b = p.b, o, ud = { name: p.name, desc: p.desc, b: b, step: stepOf(p), kind: p.kind };
    if (p.kind === 'panel' && (p.cnc === 'C1' || p.cnc === 'C2' || p.cnc === 'C3')) {
      // vertical panel in the y-z plane with its 60 mm lead hole; shape u = y, v = z, extruded along +x
      var cb = M.params.cable;
      o = plyShape(p.outline || [[b[1], b[2]], [b[4], b[2]], [b[4], b[5]], [b[1], b[5]]], p.cnc === 'C1' ? [] : [circ(cb.y, cb.z, cb.d / 2)], T, function (m) { m.rotation.y = Math.PI / 2; m.position.set(b[0] - W / 2, 0, D / 2); });
    } else if (p.kind === 'leaf') {
      var holes = [];
      (p.feats || []).forEach(function (f) { if (f.t === 'slot') holes.push(stadium(f.cx, f.cy, f.w, f.h)); else if (f.t === 'pull') holes.push(rrect(f.cx, f.cy, f.w, f.h, 4)); });
      var L = b[3] - b[0], H = b[5] - b[2];
      o = new THREE.Group();
      var pu = p.panel_u || [0, L]; var lm = plyShape([[pu[0], 0], [pu[1], 0], [pu[1], H], [pu[0], H]], holes, T, function () {}); lm.position.set(0, 0, -T); o.add(lm);
      // stainless insect mesh behind each vent group (low and high)
      [function (f) { return f.cy < H / 2; }, function (f) { return f.cy >= H / 2; }].forEach(function (inG) {
        var ss = (p.feats || []).filter(function (f) { return f.t === 'slot' && inG(f); }); if (!ss.length) return;
        var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; ss.forEach(function (f) { x0 = Math.min(x0, f.cx - f.w / 2); x1 = Math.max(x1, f.cx + f.w / 2); y0 = Math.min(y0, f.cy - f.h / 2); y1 = Math.max(y1, f.cy + f.h / 2); });
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 30, y1 - y0 + 30), MAT.mesh); mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, -T - 1.5); o.add(mesh); });
      o.position.copy(V(b[0], b[1], b[2])); o.position.z = -(b[1] - D / 2);
      leafGroups[p.cnc] = o; shadow(o);
      tag(o, ud); G('doors').add(o); all.push({ o: o, p: p }); return;
    } else if (p.kind === 'panel') { o = plyBox(b); }
    else if (p.kind === 'angle') { var sx = b[3] - b[0], sz = b[5] - b[2]; o = new THREE.Group();
      var a1 = new THREE.Mesh(new THREE.BoxGeometry(sx, sz, 3), MAT.aluBlack), a2 = new THREE.Mesh(new THREE.BoxGeometry(3, sz, b[4] - b[1]), MAT.aluBlack);
      var c = V((b[0] + b[3]) / 2, b[4] - 1.5, (b[2] + b[5]) / 2); a1.position.copy(c); o.add(a1);
      var nearLeft = (b[0] < 30 || Math.abs(b[0] - (T + 740 + T)) < 1); a2.position.copy(V(nearLeft ? b[0] + 1.5 : b[3] - 1.5, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2)); o.add(a2); }
    else if (p.kind === 'track') { o = new THREE.Group(); var tl = b[3] - b[0];
      var top = new THREE.Mesh(new THREE.BoxGeometry(tl, 4, b[4] - b[1]), MAT.alu); top.position.copy(V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5] - 2)); o.add(top);
      [b[1] + 2, (b[1] + b[4]) / 2, b[4] - 2].forEach(function (y) { var w = new THREE.Mesh(new THREE.BoxGeometry(tl, b[5] - b[2], 3), MAT.alu); w.position.copy(V((b[0] + b[3]) / 2, y, (b[2] + b[5]) / 2)); o.add(w); }); }
    else if (p.kind === 'stile') { o = new THREE.Mesh(new THREE.BoxGeometry(b[3] - b[0], b[5] - b[2], b[4] - b[1]), MAT.walnut); planarUVlong(o.geometry); o.position.copy(V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2)); }
    else if (p.stl) { o = asaMesh(p); }
    else { o = new THREE.Mesh(new THREE.BoxGeometry(b[3] - b[0], b[5] - b[2], b[4] - b[1]), MAT.grey); o.position.copy(V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2)); }
    shadow(o); tag(o, ud); G(p.group).add(o); all.push({ o: o, p: p });
  });
  // pulls ride with their leaves
  function asaMesh(p) {
    var d = M.asaMeshes[p.stl], g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.v, 3)); g.setIndex(d.i); g = g.toNonIndexed();
    var R = p.R, t = p.t, m4 = new THREE.Matrix4();
    m4.set(R[0][0], R[0][1], R[0][2], t[0] - W / 2, R[2][0], R[2][1], R[2][2], t[2], -R[1][0], -R[1][1], -R[1][2], -(t[1] - D / 2), 0, 0, 0, 1);
    g.applyMatrix4(m4); g.computeVertexNormals(); return new THREE.Mesh(g, MAT.asa);
  }
  all.forEach(function (a) { if (a.p.kind === 'stile') leafGroups[a.p.leaf].attach(a.o); });

  /* ---------- appliances ---------- */
  var appG = G('appliances');
  function rbox(w, h, d, r, mat) { var s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    var g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * Math.min(r, 6), bevelEnabled: true, bevelThickness: Math.min(r, 6), bevelSize: Math.min(r, 6) - 0.5, bevelSegments: 3, curveSegments: 6 }); g.translate(0, 0, -(d - 2 * Math.min(r, 6)) / 2); return new THREE.Mesh(g, mat); }
  var fridgeDoor;
  (function () {
    var a = M.app.fridge, b = a.b, w = b[3] - b[0], d = b[4] - b[1], h = b[5] - b[2];
    var g = new THREE.Group(), body = rbox(w, h, d - 55, 10, MAT.steel); body.position.set(0, h / 2, -(55 + (d - 55) / 2)); g.add(body);
    // freezer drawer (bottom), fridge door (top) as separate stainless fronts with a gap
    var fz = 640, drawer = rbox(w - 4, fz - 6, 55, 8, MAT.steel); drawer.position.set(0, (fz) / 2 + 2, -27.5); g.add(drawer);
    var doorPivot = new THREE.Group(); doorPivot.position.set(-w / 2, 0, 0);
    var door = rbox(w - 4, h - fz - 6, 55, 8, MAT.steel); door.position.set(w / 2, fz + (h - fz) / 2, -27.5); doorPivot.add(door);
    var hdl = new THREE.Mesh(new THREE.BoxGeometry(24, 360, 14), MAT.steelDark); hdl.position.set(w - 34, fz + 260, 3); doorPivot.add(hdl);
    var hdl2 = new THREE.Mesh(new THREE.BoxGeometry(380, 22, 14), MAT.steelDark); hdl2.position.set(0, fz - 40, 3); g.add(hdl2);
    var gasket = new THREE.Mesh(new THREE.BoxGeometry(w - 10, 3, 50), MAT.rubber); gasket.position.set(0, fz + 0.5, -27); g.add(gasket);
    g.add(doorPivot); fridgeDoor = doorPivot;
    g.position.copy(V((b[0] + b[3]) / 2, b[1], 0)); shadow(g);
    tag(g, { name: 'Fridge: ' + a.model, desc: 'Manufacturer envelope. Left-hinged door shown; the 115° swing clears the cheek. Maker asks for 50 back and sides, 100 above: this bay gives 72.5, 186 and 183.', step: 11, b: b });
    appG.add(g);
  })();
  function frontLoader(b, label, desc, isDryer) {
    var w = b[3] - b[0], d = b[4] - b[1], h = b[5] - b[2], g = new THREE.Group();
    var body = rbox(w, h, d - 30, 12, MAT.white); body.position.set(0, h / 2, -(30 + (d - 30) / 2)); g.add(body);
    var panel = new THREE.Mesh(new THREE.BoxGeometry(w - 10, 110, 20), MAT.white); panel.position.set(0, h - 62, -22); g.add(panel);
    var disp = new THREE.Mesh(new THREE.BoxGeometry(150, 46, 4), std({ color: 0x15191c, roughness: 0.2 })); disp.position.set(40, h - 62, -10); g.add(disp);
    var knob = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 18, 32), MAT.chrome); knob.rotation.x = Math.PI / 2; knob.position.set(-170, h - 62, -6); g.add(knob);
    var drawerS = new THREE.Mesh(new THREE.BoxGeometry(170, 70, 6), MAT.white); drawerS.position.set(-180, h - 62, -10); if (isDryer) g.add(drawerS);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(205, 26, 18, 60), MAT.chrome); ring.position.set(0, h * 0.44, -2); g.add(ring);
    var glass = new THREE.Mesh(new THREE.CircleGeometry(185, 48), MAT.glass); glass.position.set(0, h * 0.44, 4); g.add(glass);
    var drum = new THREE.Mesh(new THREE.CircleGeometry(190, 48), std({ color: 0x8e9398, roughness: 0.4, metalness: 0.8 })); drum.position.set(0, h * 0.44, -40); g.add(drum);
    var kick = new THREE.Mesh(new THREE.BoxGeometry(w - 30, 60, 4), MAT.white); kick.position.set(0, 50, -28); g.add(kick);
    g.position.copy(V((b[0] + b[3]) / 2, b[1], b[2])); shadow(g); tag(g, { name: label, desc: desc, step: 11, b: b }); appG.add(g);
  }
  frontLoader(M.app.washer.b, 'Washer (provisional)', M.app.washer.model + '. It stands on the deck and carries the dryer; the cabinet never carries either machine.', false);
  frontLoader(M.app.dryer.b, 'Dryer (provisional)', M.app.dryer.model, true);
  (function () { var b = M.app.dryer.b, k = new THREE.Mesh(new THREE.BoxGeometry(b[3] - b[0] - 4, 30, b[4] - b[1] - 30), MAT.white); k.position.copy(V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2 + 15, b[2] - 15)); shadow(k);
    tag(k, { name: 'Stacking kit (maker\'s own)', desc: 'Use the stacking kit the washer and dryer makers list for this exact pair. The dryer is secured to the washer by the kit, not by the cabinet.', step: 11 }); appG.add(k); })();
  // leads, indicative: fridge -> divider hole -> behind the laundry -> studio cheek hole -> wall
  (function () { var cb = M.params.cable, fb = M.app.fridge.b, z = cb.z;
    var pts = [[fb[3] - 40, fb[4], 300], [fb[3] - 40, fb[4] + 60, 300], [P.BAY + T - 30, cb.y, z], [P.BAY + 2 * T + 30, cb.y, z], [W - T - 60, cb.y + 10, z - 20], [W - T - 10, cb.y, z], [W + 40, cb.y, z], [W + M.site.studio_gap - 20, cb.y, 1150]];
    var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return V(p[0], p[1], p[2]); })), tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 5, 8, false), std({ color: 0xe7e5df, roughness: 0.6 }));
    tag(tube, { name: 'Appliance leads (indicative route)', desc: 'Three separate original leads: fridge through the divider and the studio cheek; washer and dryer through the studio cheek. No powerboard, nothing in a door track or under a machine foot. Route only: socket position and plug sizes are unmeasured (HOLD).', step: 10 });
    G('leads').add(tube); })();

  /* ---------- dimension lines ---------- */
  var dimG = G('dims');
  function label(txt) { var c = document.createElement('canvas'); c.width = 512; c.height = 96; var g = c.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.93)'; g.fillRect(0, 10, 512, 76); g.fillStyle = '#1d1b19'; g.font = '600 46px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256, 50);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(760, 143, 1); s.renderOrder = 9; return s; }
  function dim(a, b, off, txt) { var A = V(a[0], a[1], a[2]).add(off), B = V(b[0], b[1], b[2]).add(off), g = new THREE.BufferGeometry().setFromPoints([A, B]);
    dimG.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x1d1b19, depthTest: false }))); var l = label(txt); l.position.copy(A.clone().add(B).multiplyScalar(0.5)); dimG.add(l); }
  dim([-P.CAP_OH_L, -T - P.CAP_OH_F, P.H], [W, -T - P.CAP_OH_F, P.H], new THREE.Vector3(0, 140, 0), (W + P.CAP_OH_L) + ' cap · ' + W + ' body');
  dim([W, 0, 0], [W, 0, P.H], new THREE.Vector3(160, 0, 160), P.H + ' high');
  dim([W, 0, 30], [W, D, 30], new THREE.Vector3(160, 0, 0), D + ' deep');
  dim([T, 0, 1000], [T + P.BAY, 0, 1000], new THREE.Vector3(0, 0, 220), P.BAY + ' bay');
  dim([T + P.BAY + T, 0, 1000], [W - T, 0, 1000], new THREE.Vector3(0, 0, 220), P.BAY + ' bay');
  dimG.visible = false;

  /* ---------- state ---------- */
  var state = { doors: 'closed', swing: 0, app: true, context: true, person: false, dims: false, xray: false, leads: false, step: 0 };
  var leafX = { D1: 0, D2: 0 }, leafTarget = { D1: 0, D2: 0 }, swingNow = 0;
  function targets() { leafTarget.D1 = state.doors === 'fridge' ? (W - 2 * T - P.LEAF_W) : 0; leafTarget.D2 = state.doors === 'laundry' ? -((P.LEAF_W - P.OVL) - P.REAR_STOP) : 0; }
  function stepOf(p) {
    if (p.group === 'asa' && p.name.indexOf('foot') > 0) return 3; if (p.cnc === 'C4' || (p.group === 'carcass' && p.cnc !== 'C7')) return 4;
    if (p.kind === 'angle') return 5; if (p.cnc === 'C7' || p.kind === 'track') return 7; if (p.kind === 'leaf' || p.kind === 'stile') return 8;
    if (p.name.indexOf('floor guide') >= 0) return 9; if (p.name.indexOf('grommet') >= 0) return 10; return 4; }
  function apply() {
    targets();
    G('appliances').visible = state.app; G('context').visible = state.context; G('person').visible = state.person; dimG.visible = state.dims; G('leads').visible = state.leads;
    var first = 3, last = 11;
    all.concat([]).forEach(function (a) { var st = stepOf(a.p); a.o.visible = state.step < 3 || st <= state.step;
      a.o.traverse(function (m) { if (!m.isMesh) return; if (!m.userData._mat) m.userData._mat = m.material;
        var mat = m.userData._mat; if (state.step && st === state.step) mat = MAT.hi; else if (state.xray && (a.p.kind === 'panel' || a.p.kind === 'leaf')) mat = MAT.ghost; m.material = mat; }); });
    G('appliances').visible = state.app && (!state.step || state.step >= 11);
    if (state.step && state.step < 11) G('leads').visible = false;
    document.querySelectorAll('.tools button[data-k]').forEach(function (b) { var k = b.dataset.k, v = b.dataset.v; b.classList.toggle('on', v ? state[k] === v : !!state[k]); });
    var sw = document.getElementById('swingRow'); if (sw) sw.style.display = state.doors === 'fridge' ? 'flex' : 'none';
  }
  window.__state = state; window.__apply = apply;
  document.querySelectorAll('.tools button[data-k]').forEach(function (b) { b.onclick = function () { var k = b.dataset.k, v = b.dataset.v; if (v) { state[k] = state[k] === v && v !== 'closed' ? 'closed' : v; if (state[k] !== 'fridge') state.swing = 0; } else state[k] = !state[k]; apply(); }; });
  var sl = document.getElementById('swing'); if (sl) sl.oninput = function () { state.swing = +sl.value; };
  (function () { var first = 1, last = 11;
    function show() { var t = document.getElementById('sTxt'); if (!state.step) t.innerHTML = '<b>Build along</b> Press ▶ to step through the assembly.'; else { var s = STEPS[state.step - 1] || ['', '']; t.innerHTML = '<b>Step ' + state.step + ' · ' + s[0] + '</b> ' + s[1]; } apply(); }
    document.getElementById('sPrev').onclick = function () { state.step = state.step <= first ? 0 : state.step - 1; show(); };
    document.getElementById('sNext').onclick = function () { state.step = !state.step ? first : Math.min(last, state.step + 1); show(); };
    document.getElementById('sAll').onclick = function () { state.step = 0; show(); }; window.__step = function (n) { state.step = n; show(); }; show(); })();

  /* ---------- views, picking, loop ---------- */
  function setView(n) { var c = new THREE.Vector3(0, 1000, 0), p;
    if (n === 'front') p = new THREE.Vector3(0, 1050, 5600); else if (n === 'side') p = new THREE.Vector3(-5600, 1100, 0); else if (n === 'top') p = new THREE.Vector3(0, 7600, 10);
    else if (n === 'inside') { p = new THREE.Vector3(-200, 1500, 2600); c.set(0, 950, -100); } else p = new THREE.Vector3(-3200, 2100, 4300);
    cam.position.copy(p); ctl.target.copy(c); ctl.update(); }
  window.__setView = setView; window.__cam = cam; window.__ctl = ctl;
  document.querySelectorAll('.tools button[data-view]').forEach(function (b) { b.onclick = function () { setView(b.dataset.view); }; });
  setView('3/4');
  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), info = document.getElementById('info'), down = null;
  canvas.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', function (e) { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; var r = canvas.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, cam);
    var hs = ray.intersectObjects(pickables, false).filter(function (h) { var v = true; h.object.traverseAncestors(function (a) { if (!a.visible) v = false; }); return v && h.object.visible && h.object.material !== MAT.ghost; });
    if (!hs.length) return; var d = hs[0].object.userData, b = d.b;
    info.innerHTML = '<h3>' + d.name + '</h3><p>' + (d.desc || '') + '</p>' + (b ? '<p><span class="k">Envelope</span> ' + Math.round(b[3] - b[0]) + ' W × ' + Math.round(b[4] - b[1]) + ' D × ' + Math.round(b[5] - b[2]) + ' H mm</p>' : ''); });
  function resize() { var w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } }
  apply();
  var last = performance.now();
  (function loop() { requestAnimationFrame(loop); resize(); var now = performance.now(), k = 1 - Math.exp(-Math.min(0.5, (now - last) / 1000) * 7); last = now;
    var kk = k; ['D1', 'D2'].forEach(function (k) { leafX[k] += (leafTarget[k] - leafX[k]) * kk; if (Math.abs(leafTarget[k] - leafX[k]) < 0.3) leafX[k] = leafTarget[k]; leafGroups[k].position.x = (k === 'D1' ? T : T + P.LEAF_W - P.OVL) - W / 2 + leafX[k]; });
    var sw = state.doors === 'fridge' ? state.swing : 0; swingNow += (sw - swingNow) * kk; if (Math.abs(sw - swingNow) < 0.2) swingNow = sw; fridgeDoor.rotation.y = -swingNow * Math.PI / 180;
    G('pergola').visible = state.context && cam.position.y < 2600; ctl.update(); renderer.render(scene, cam); })();
  window.__ready = true;
})();
