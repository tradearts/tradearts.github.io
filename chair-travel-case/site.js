/* Chair travel case — product-accurate viewer (Rev D).
   Model units mm: x right, y back from the door face, z up.  three.js: x, y = z, z = -y (mm). */
(function () {
  var M = window.__M, STEPS = window.__STEPS || [], BASE = 'assets/';
  var P = M.params, HX = P.EW / 2, ED = P.ED, Z0 = P.Z0, EH = P.EH, ZT = Z0 + EH;
  var canvas = document.getElementById('c');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(32, 1, 20, 60000);
  var ctl = new THREE.OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.94;
  var maxAniso = renderer.capabilities.getMaxAnisotropy();
  function V(x, y, z) { return new THREE.Vector3(x, z, -y); }

  /* ---------- environment, light, studio ---------- */
  (function () {
    var c = document.createElement('canvas'); c.width = 2; c.height = 256; var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#d9d5ce'); gr.addColorStop(0.65, '#efece6'); gr.addColorStop(1, '#f6f4f0'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; scene.background = t;
    if (THREE.RoomEnvironment) { var pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; }
  })();
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a8478, 0.35));
  var sun = new THREE.DirectionalLight(0xfff3e2, 1.55); sun.position.set(2600, 4200, 2400); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); var sc = sun.shadow.camera; sc.left = -2200; sc.right = 2200; sc.top = 2600; sc.bottom = -1200; sc.near = 500; sc.far = 9000;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 1.2; scene.add(sun);
  var fill = new THREE.DirectionalLight(0xe8eefc, 0.35); fill.position.set(-3000, 1800, -1500); scene.add(fill);

  /* ---------- helpers ---------- */
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function std(o) { var m = new THREE.MeshStandardMaterial(o); m.color.convertSRGBToLinear(); return m; }
  function canvasTex(w, h, fn, srgb) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; if (srgb !== false) t.encoding = THREE.sRGBEncoding; return t; }
  var TL = new THREE.TextureLoader();
  function img(n, srgb) { var t = TL.load(BASE + 'tex/' + n + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; if (srgb) t.encoding = THREE.sRGBEncoding; return t; }
  // planar UVs in mm / tile; long axis runs along U if given
  function planarUV(geo, tile, longAx) {
    var p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
    for (var i = 0; i < p.count; i++) {
      var nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i)), c = [p.getX(i), p.getY(i), p.getZ(i)];
      var ax = (ny >= nx && ny >= nz) ? 1 : (nx >= nz ? 0 : 2), pl = [0, 1, 2].filter(function (a) { return a !== ax; }), u, v;
      if (longAx != null && pl.indexOf(longAx) >= 0) { u = c[longAx]; v = c[pl[0] === longAx ? pl[1] : pl[0]]; } else { u = c[pl[0]]; v = c[pl[1]]; }
      uv[2 * i] = u / tile; uv[2 * i + 1] = v / tile;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  /* ---------- material textures (procedural, to the real products) ---------- */
  // Titan black hexa laminate: ~5 mm raised hex cells, gloss. Tile = 60 mm.
  var hexCanvas = function (bump) {
    return function (g, w, h) {
      var r = 9, hh = r * Math.sqrt(3); g.fillStyle = bump ? '#202020' : '#121214'; g.fillRect(0, 0, w, h);
      for (var y = -1; y < h / (hh / 2) + 2; y++) for (var x = -1; x < w / (r * 3) + 2; x++) {
        var cx = x * r * 3 + (y % 2 ? r * 1.5 : 0), cy = y * hh / 2; g.beginPath();
        for (var k = 0; k < 6; k++) { var a = Math.PI / 3 * k; g.lineTo(cx + r * 0.84 * Math.cos(a), cy + r * 0.84 * Math.sin(a)); } g.closePath();
        if (bump) { g.fillStyle = '#d0d0d0'; g.fill(); } else { var gr = g.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, r); gr.addColorStop(0, '#2b2b2e'); gr.addColorStop(1, '#19191b'); g.fillStyle = gr; g.fill(); }
      }
    };
  };
  var W = 27 * 6, H = Math.round(9 * Math.sqrt(3) * 8);
  var hexMap = canvasTex(W, H, hexCanvas(false)), hexBump = canvasTex(W, H, hexCanvas(true), false);
  function brushed(base, seed) { return canvasTex(512, 64, function (g, w, h) { var r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); for (var k = 0; k < 420; k++) { var y = r() * h, a = 0.03 + r() * 0.08; g.strokeStyle = (r() < 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + a + ')'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5)); g.stroke(); } }); }
  function speckle(base, dots, seed, n) { return canvasTex(256, 256, function (g, w, h) { var r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); for (var k = 0; k < n; k++) { g.fillStyle = dots[(r() * dots.length) | 0]; var s = 0.6 + r() * 1.8; g.beginPath(); g.arc(r() * w, r() * h, s, 0, 6.3); g.fill(); } }); }
  var plyEdge = canvasTex(64, 64, function (g, w, h) { var cols = ['#d8c39a', '#c9b285', '#dcc8a0', '#bfa775', '#d4bd92', '#c6ad7e', '#d9c59c']; for (var i = 0; i < 14; i++) { g.fillStyle = cols[i % 7]; g.fillRect(0, i * h / 14, w, h / 14); } g.fillStyle = '#141416'; g.fillRect(0, 0, w, 3); g.fillRect(0, h / 2 - 2, w, 4); g.fillRect(0, h - 3, w, 3); });
  var leatherTex = speckle('#5a131b', ['rgba(30,0,5,0.35)', 'rgba(120,40,50,0.25)'], 5, 5000);
  var badgeTex = canvasTex(880, 520, function (g) {
    var gr = g.createLinearGradient(0, 0, 880, 520); gr.addColorStop(0, '#d9b66b'); gr.addColorStop(0.5, '#c39a4d'); gr.addColorStop(1, '#a8823d'); g.fillStyle = gr; g.fillRect(0, 0, 880, 520);
    var r = rng(3); for (var k = 0; k < 900; k++) { g.strokeStyle = 'rgba(255,255,255,' + (0.03 + r() * 0.05) + ')'; var y = r() * 520; g.beginPath(); g.moveTo(0, y); g.lineTo(880, y); g.stroke(); }
    g.strokeStyle = '#4c3714'; g.lineWidth = 8; g.strokeRect(24, 24, 832, 472); g.lineWidth = 2.5; g.strokeRect(40, 40, 800, 440);
    g.fillStyle = '#2e2210'; g.textAlign = 'center'; g.setLineDash([10, 8]); g.strokeStyle = '#2e2210'; g.strokeRect(335, 72, 210, 180); g.setLineDash([]);
    g.font = '600 24px Inter, Arial'; g.fillText('OFFICIAL CLIENT', 440, 152); g.fillText('LOGO ARTWORK', 440, 184);
    g.font = '600 31px Georgia, serif'; g.fillText('CLIENT NAME', 440, 328);
    g.font = '500 26px Inter, Arial'; g.fillText('CEREMONIAL CHAIR  ·  01 OF 08', 440, 388); g.font = '500 19px Inter, Arial'; g.fillText('HANDLE WITH CARE  ·  THIS WAY UP  ·  DO NOT STACK', 440, 440);
  });

  var MAT = {
    hexa: std({ color: 0xffffff, map: hexMap, bumpMap: hexBump, bumpScale: 0.35, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.9 }),
    alu: std({ color: 0xd2d5d8, map: brushed('#c9ccd0', 11), roughness: 0.32, metalness: 0.95 }),
    chrome: std({ color: 0xf2f3f5, roughness: 0.08, metalness: 1.0 }),
    zinc: std({ color: 0xc0c5c8, map: speckle('#c6cacd', ['rgba(255,255,255,0.25)', 'rgba(120,125,130,0.25)'], 7, 3000), roughness: 0.38, metalness: 0.9 }),
    blackSteel: std({ color: 0x18181a, roughness: 0.45, metalness: 0.6 }),
    rubber: std({ color: 0x0f0f10, roughness: 0.85 }),
    blueWheel: std({ color: 0xc23a2a, roughness: 0.42 }),
    greyHub: std({ color: 0x7c8186, roughness: 0.45, metalness: 0.5 }),
    epe: std({ color: 0xffffff, map: speckle('#2a2a2c', ['rgba(80,80,84,0.45)', 'rgba(10,10,10,0.5)'], 9, 9000), roughness: 0.95 }),
    eva: std({ color: 0xffffff, map: speckle('#1c1c1e', ['rgba(60,60,64,0.35)'], 13, 2500), roughness: 0.8 }),
    formply: std({ color: 0x2a1f18, roughness: 0.38 }),
    pine: std({ color: 0xd8b888, roughness: 0.75 }),
    plyEdge: std({ color: 0xffffff, map: plyEdge, roughness: 0.7 }),
    satinBlack: std({ color: 0x1b1b1c, roughness: 0.55 }),
    asa: std({ color: 0x2a2b2e, roughness: 0.72, metalness: 0.0 }),
    brass: std({ color: 0xd2ad62, map: brushed('#c9a35a', 17), roughness: 0.3, metalness: 1.0 }),
    badge: std({ color: 0xffffff, map: badgeTex, roughness: 0.32, metalness: 0.75 }),
    walnut: std({ color: 0xa88566, map: img('walnut_diff', true), normalMap: img('walnut_nor'), roughness: 0.5 }),
    leather: std({ color: 0xffffff, map: leatherTex, roughness: 0.42, side: THREE.DoubleSide }),
    floor: std({ color: 0xffffff, map: speckle('#b9b5ae', ['rgba(90,86,80,0.18)', 'rgba(255,255,255,0.22)', 'rgba(60,58,54,0.12)'], 21, 14000), roughness: 0.92 }),
    dark: std({ color: 0x050505, roughness: 0.9 }),
  };
  MAT.walnut.side = THREE.DoubleSide;

  /* ---------- scene graph per part ---------- */
  var groups = {}, all = [], pickables = [];
  function G(name) { if (!groups[name]) { groups[name] = new THREE.Group(); scene.add(groups[name]); } return groups[name]; }
  function boxMesh(x0, y0, z0, x1, y1, z1, mat, tile, longAx) {
    var g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0));
    if (tile) planarUV(g, tile, longAx);
    var m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); m.castShadow = m.receiveShadow = true; return m;
  }
  function cyl(r0, r1, h, mat, seg) { var m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 24), mat); m.castShadow = m.receiveShadow = true; return m; }
  function center() { return [0, ED / 2, Z0 + EH / 2]; }
  function outerSide(b, a) { var c = center()[a], lo = b[a], hi = b[a + 3]; return Math.abs(hi - c) > Math.abs(lo - c) ? 1 : -1; }

  // L-profile edge (single angle 30 x 30 x 1.2, or hybrid joiner shown as 25 mm L + inner lip)
  function lProfile(p, leg, t, hybrid) {
    var b = p.b, e = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], ax = e.indexOf(Math.max.apply(null, e)), o = [0, 1, 2].filter(function (a) { return a !== ax; });
    var grp = new THREE.Group(), s = {};
    o.forEach(function (a) { s[a] = outerSide(b, a); });
    var corner = [0, 0, 0]; o.forEach(function (a) { corner[a] = s[a] > 0 ? b[a + 3] : b[a]; });
    o.forEach(function (a) {  // leg lying on the face normal to axis a
      var other = o[0] === a ? o[1] : o[0], lo = [0, 0, 0], hi = [0, 0, 0];
      lo[ax] = b[ax]; hi[ax] = b[ax + 3];
      lo[a] = corner[a]; hi[a] = corner[a] + s[a] * t;
      lo[other] = corner[other]; hi[other] = corner[other] - s[other] * leg;
      grp.add(boxMesh(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], MAT.alu, 400, ax === 1 ? 2 : ax === 2 ? 1 : 0));
      if (hybrid) { // inner channel wall + shadow groove
        var l2 = lo.slice(), h2 = hi.slice(); l2[a] = corner[a] - s[a] * 10; h2[a] = corner[a] - s[a] * 11.2; l2[other] = corner[other] - s[other] * 4; h2[other] = corner[other] - s[other] * 16;
        grp.add(boxMesh(l2[0], l2[1], l2[2], h2[0], h2[1], h2[2], MAT.alu, 400));
      }
    });
    if (hybrid) { // dark split line between body and door halves, on both outer faces
      var mid = (b[1] + b[4]) / 2;
      o.forEach(function (a) { if (a === 1) return; var other = o[0] === a ? o[1] : o[0], lo3 = [0, 0, 0], hi3 = [0, 0, 0];
        lo3[ax] = b[ax]; hi3[ax] = b[ax + 3]; lo3[1] = P.LID - 0.8; hi3[1] = P.LID + 0.8; lo3[a] = corner[a] + s[a] * 0.05; hi3[a] = corner[a] + s[a] * 0.3;
        if (other !== 1) { lo3[other] = corner[other]; hi3[other] = corner[other] - s[other] * 25; }
        grp.add(boxMesh(lo3[0], lo3[1], lo3[2], hi3[0], hi3[1], hi3[2], MAT.dark)); });
    }
    return grp;
  }
  function ballCorner(p) {
    var b = p.b, grp = new THREE.Group(), s = [outerSide(b, 0), outerSide(b, 1), outerSide(b, 2)];
    var c = [s[0] > 0 ? HX : -HX, s[1] > 0 ? ED : 0, s[2] > 0 ? ZT : Z0], L = 40, t = 1.5;
    [0, 1, 2].forEach(function (a) { var lo = c.slice(), hi = c.slice(); [0, 1, 2].forEach(function (k) { if (k === a) { lo[k] = c[k]; hi[k] = c[k] + s[k] * t; } else { lo[k] = c[k]; hi[k] = c[k] - s[k] * L; } });
      grp.add(boxMesh(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], MAT.chrome)); });
    var ball = new THREE.Mesh(new THREE.SphereGeometry(15, 24, 16), MAT.chrome); ball.position.copy(V(c[0] - s[0] * 4, c[1] - s[1] * 4, c[2] - s[2] * 4)); ball.castShadow = true; grp.add(ball);
    return grp;
  }
  function flatCorner(p) {  // on the door face (y = 0): L of two 80 x 25 legs + wrap onto the side/top
    var b = p.b, grp = new THREE.Group(), sx = outerSide(b, 0), sz = outerSide(b, 2), cx = sx > 0 ? HX : -HX, cz = sz > 0 ? ZT : Z0, t = 1.5;
    grp.add(boxMesh(cx, -t, cz, cx - sx * 80, 0, cz - sz * 25, MAT.zinc));
    grp.add(boxMesh(cx, -t, cz, cx - sx * 25, 0, cz - sz * 80, MAT.zinc));
    grp.add(boxMesh(cx, 0, cz, cx + sx * t, 25, cz - sz * 80, MAT.zinc));
    grp.add(boxMesh(cx, 0, cz, cx - sx * 80, 25, cz + sz * t, MAT.zinc));
    return grp;
  }
  // 90 degree brace plate folded over an edge: a 38 mm leg on each of the two outer faces the box touches
  function lBrace(p) {
    var b = p.b, grp = new THREE.Group(), outer = [[-HX, HX], [0, ED], [Z0, ZT]], touch = [];
    [0, 1, 2].forEach(function (a) { if (Math.abs(b[a] - outer[a][0]) < 4) touch.push([a, -1, outer[a][0]]); else if (Math.abs(b[a + 3] - outer[a][1]) < 4) touch.push([a, 1, outer[a][1]]); });
    touch.forEach(function (tc) { var lo = [b[0], b[1], b[2]], hi = [b[3], b[4], b[5]]; lo[tc[0]] = tc[2]; hi[tc[0]] = tc[2] + tc[1] * 1.6;
      touch.forEach(function (o) { if (o[0] !== tc[0]) { lo[o[0]] = o[2]; hi[o[0]] = o[2] - o[1] * 38; } });
      grp.add(boxMesh(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], MAT.chrome)); });
    return grp;
  }
  // recessed butterfly latch, medium: 110 x 105 dish, cut-out 75 x 80, on a side/top/bottom face across the door split
  function latch(p) {
    var b = p.b, grp = new THREE.Group(), lidG = new THREE.Group(), e = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], na = e.indexOf(Math.min.apply(null, e)), s = outerSide(b, na);
    var c = [(b[0] + b[3]) / 2, P.LID, (b[2] + b[5]) / 2]; var face = s > 0 ? (na === 0 ? HX : ZT) : (na === 0 ? -HX : Z0);
    var along = na === 0 ? 2 : 0;  // in-face axis perpendicular to y
    function rect(y0, y1, w2, d0, d1, mat) { var lo = [0, 0, 0], hi = [0, 0, 0]; lo[1] = y0; hi[1] = y1; lo[along] = c[along] - w2 / 2; hi[along] = c[along] + w2 / 2; lo[na] = face + s * d0; hi[na] = face + s * d1; return boxMesh(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], mat); }
    var L = P.LID;
    // body half: dish with the butterfly
    grp.add(rect(L + 0.6, L + 52, 110, 0, 1.4, MAT.chrome)); grp.add(rect(L + 0.6, L + 39, 80, 0.2, 1.6, MAT.dark));
    grp.add(rect(L + 6, L + 34, 54, 1.0, 4.0, MAT.chrome)); grp.add(rect(L + 15, L + 25, 10, 1.0, 7.0, MAT.chrome));
    // lid half: dish with the catch (lifts off with the lid)
    lidG.add(rect(L - 52, L - 0.6, 110, 0, 1.4, MAT.chrome)); lidG.add(rect(L - 39, L - 0.6, 80, 0.2, 1.6, MAT.dark)); lidG.add(rect(L - 20, L - 4, 22, 1.0, 4.5, MAT.chrome));
    var ud = Object.assign({}, p, { name: p.name + ' (catch half, on the door)' });
    lidG.traverse(function (m) { if (m.isMesh) { m.userData = ud; pickables.push(m); } }); lidG.userData = ud; G('door').add(lidG); all.push(lidG);
    return grp;
  }
  // recessed spring handle 160 x 108, cut-out 130 x 75, rubber-sleeved steel grip
  function handle(p) {
    var b = p.b, grp = new THREE.Group(), e = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], na = e.indexOf(Math.min.apply(null, e)), s = outerSide(b, na);
    var c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]; var face = na === 0 ? (s > 0 ? HX : -HX) : (s > 0 ? ED : 0); var lax = na === 0 ? 1 : 0;
    function rect(l, h, d0, d1, mat) { var lo = [0, 0, 0], hi = [0, 0, 0]; lo[lax] = c[lax] - l / 2; hi[lax] = c[lax] + l / 2; lo[2] = c[2] - h / 2; hi[2] = c[2] + h / 2; lo[na] = face + s * d0; hi[na] = face + s * d1; return boxMesh(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], mat); }
    grp.add(rect(160, 108, 0, 1.4, MAT.blackSteel)); grp.add(rect(130, 75, 0.1, 1.6, MAT.dark));
    var grip = cyl(7, 7, 118, MAT.rubber, 14); var gp = c.slice(); gp[na] = face + s * 6; gp[2] = c[2] + 22; grip.position.copy(V(gp[0], gp[1], gp[2]));
    if (lax === 0) grip.rotation.z = Math.PI / 2; else grip.rotation.x = Math.PI / 2; grp.add(grip);
    return grp;
  }
  function castorPlate(p) {
    var b = p.b, grp = new THREE.Group(), cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, top = b[5];
    grp.add(boxMesh(cx - 47.5, cy - 32.5, top - 4, cx + 47.5, cy + 32.5, top, MAT.zinc));
    var sw = cyl(30, 30, 14, MAT.zinc, 28); sw.position.copy(V(cx, cy, top - 11)); grp.add(sw);
    [-1, 1].forEach(function (k) { grp.add(boxMesh(cx + k * 20, cy - 26, 50, cx + k * 22.5, cy + 6, top - 18, MAT.zinc)); });
    [[-37, -22], [37, -22], [-37, 22], [37, 22]].forEach(function (q) { var bolt = cyl(6.5, 6.5, 6, MAT.zinc, 12); bolt.position.copy(V(cx + q[0], cy + q[1], top - 7)); grp.add(bolt); });
    if (/braked/.test(p.name)) { var ped = boxMesh(cx - 14, cy + 6, 70, cx + 14, cy + 38, 80, MAT.rubber); grp.add(ped); }
    return grp;
  }
  function castorWheel(p) { var b = p.b, grp = new THREE.Group(), cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2 - 10;
    var w = cyl(50, 50, 32, MAT.blueWheel, 36); w.rotation.z = Math.PI / 2; w.position.copy(V(cx, cy, 50)); grp.add(w);
    var hub = cyl(22, 22, 36, MAT.greyHub, 24); hub.rotation.z = Math.PI / 2; hub.position.copy(V(cx, cy, 50)); grp.add(hub); return grp; }
  function turnButton(p) { var b = p.b, grp = new THREE.Group(); grp.add(boxMesh(b[0], b[1], b[2], b[3], b[4], b[5], MAT.zinc));
    var sc = cyl(4, 4, 2, MAT.zinc, 10); sc.position.copy(V((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5] + 1)); grp.add(sc); return grp; }
  function badge(p) { var b = p.b; var g = new THREE.BoxGeometry(b[3] - b[0], b[5] - b[2], 3); var mats = [MAT.brass, MAT.brass, MAT.brass, MAT.brass, MAT.badge, MAT.brass];
    var m = new THREE.Mesh(g, mats); m.position.copy(V((b[0] + b[3]) / 2, -1.5, (b[2] + b[5]) / 2)); m.castShadow = true; return m; }
  function simple(p) {
    var b = p.b, k = p.kind, mat = MAT.satinBlack, tile = null;
    if (k === 'panel') { mat = MAT.hexa; tile = 60; }
    else if (k === 'foam') { mat = MAT.epe; tile = 300; }
    else if (k === 'eva') { mat = MAT.eva; tile = 300; }
    else if (k === 'base') { mat = [MAT.satinBlack, MAT.satinBlack, MAT.formply, MAT.formply, MAT.satinBlack, MAT.satinBlack]; }
    else if (k === 'pine') mat = MAT.pine;
    else if (k === 'cleat') { mat = MAT.plyEdge; tile = 20; }
    else if (k === 'bar') mat = MAT.satinBlack;
    var m = boxMesh(b[0], b[1], b[2], b[3], b[4], b[5], mat, tile);
    if (k === 'cleat') { var g = m.geometry, uv = g.attributes.uv, n = g.attributes.normal; for (var i = 0; i < uv.count; i++) { if (Math.abs(n.getY(i)) > 0.5) { uv.setXY(i, 0.02, 0.02); } } }
    return m;
  }
  var BUILD = { angle: function (p) { return lProfile(p, 30, 1.2, false); }, hybrid: function (p) { return lProfile(p, 25, 1.2, true); }, ball_corner: ballCorner, flat_corner: flatCorner,
    brace: lBrace, latch: latch, handle: handle, castor_plate: castorPlate, castor_wheel: castorWheel, turnbutton: turnButton, badge: badge };

  // Rev H: ASA printed parts use the real STL geometry, placed with the matrix from gen.py (case = R p + t; viewer = (x, z, -y))
  var asaGeo = {};
  function asaMesh(p) {
    var g0 = asaGeo[p.stl];
    if (!g0) { var d = M.asaMeshes[p.stl]; g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(d.v, 3)); g0.setIndex(d.i); asaGeo[p.stl] = g0 = g0.toNonIndexed(); }
    var R = p.R, t = p.t, m4 = new THREE.Matrix4();
    m4.set(R[0][0], R[0][1], R[0][2], t[0],  R[2][0], R[2][1], R[2][2], t[2],  -R[1][0], -R[1][1], -R[1][2], -t[1],  0, 0, 0, 1);
    var g = g0.clone(); g.applyMatrix4(m4); g.computeVertexNormals();
    var mesh = new THREE.Mesh(g, p.mat === 'asa' ? MAT.asa : p.mat === 'eva' ? MAT.rubber : MAT.satinBlack); mesh.castShadow = mesh.receiveShadow = true; return mesh;
  }
  M.parts.forEach(function (p) {
    var grpName = (p.group === 'door' || p.lid) ? 'door' : p.group;
    var o = p.stl ? asaMesh(p) : (BUILD[p.kind] || simple)(p);
    o.traverse(function (c) { if (c.isMesh) { c.userData = p; c.castShadow = c.receiveShadow = true; pickables.push(c); } });
    o.userData = p; G(grpName).add(o); all.push(o);
  });

  /* rivets: 4.8 x 19 aluminium with washers, 150 mm pitch, both legs. Split body / lid so they lift off with the lid. */
  (function () {
    var LIDD = P.LID || 90, sets = { door: [], extrusion: [] };
    M.rivets.forEach(function (r) { sets[r[6] ? 'door' : 'extrusion'].push(r); });
    Object.keys(sets).forEach(function (gname) {
      var list = sets[gname]; if (!list.length) return;
      var geo = new THREE.CylinderGeometry(5.5, 6, 2.2, 14), im = new THREE.InstancedMesh(geo, MAT.alu, list.length), d = new THREE.Object3D();
      list.forEach(function (r, i) { var n = [r[3], r[4], r[5]]; d.position.copy(V(r[0] + n[0] * 2.3, r[1] + n[1] * 2.3, r[2] + n[2] * 2.3));
        d.rotation.set(0, 0, 0); if (n[0]) d.rotation.z = Math.PI / 2; if (n[1]) d.rotation.x = Math.PI / 2; d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.castShadow = true; im.userData = { name: 'Rivets (' + (gname === 'door' ? 'door' : 'body') + ')', kind: 'rivet', step: 7, desc: M.rivets.length + ' extrusion fixings in all at 150 mm pitch, both legs, 40 mm from each end: 4.8 x 19 aluminium rivets with backing washers into the 9 mm ply, 8g x 16 wafer screws where the angle lands on the 17 mm base. Latches, handles and corners take more.', supplier: 'Titan AV' };
      G(gname).add(im); pickables.push(im); all.push(im);
    });
  })();

  /* chair from maker's STEP */
  var chairG = G('chair');
  if (M.chairMesh) {
    var cm = { walnut: MAT.walnut, brass: MAT.brass, leather: MAT.leather, leather_back: MAT.leather };
    Object.keys(M.chairMesh).forEach(function (k) { var d = M.chairMesh[k], v = d.v, pos = new Float32Array(v.length);
      for (var i = 0; i < v.length; i += 3) { pos[i] = v[i]; pos[i + 1] = v[i + 2]; pos[i + 2] = -v[i + 1]; }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(d.f); g.computeVertexNormals(); planarUV(g, k === 'walnut' ? 420 : 160);
      var m = new THREE.Mesh(g, cm[k]); m.castShadow = m.receiveShadow = true;
      m.userData = { name: 'Chair, ' + k.replace('_back', ' back') + " (maker's STEP)", kind: 'chair', step: 12, desc: "maker's STEP model: 927 W x 920 D x 1547 H, about 48 kg (estimate)", supplier: '' };
      chairG.add(m); pickables.push(m); });
    chairG.userData = { step: 12 }; all.push(chairG);
  }

  /* studio floor + person for scale */
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), MAT.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  (function () { var g = floor.geometry, uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 40); })();
  scene.add(floor);
  var personG = G('person');
  // simple 1.80 m figure for scale (built here, no external model file)
  (function () {
    var body = std({ color: 0xa9b3ba, roughness: 0.6 }), o = new THREE.Group();
    function cap(r, len, x, y, z, rz) { var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18), body); m.position.set(x, y, z); if (rz) m.rotation.z = rz; m.castShadow = true; o.add(m);
      [-1, 1].forEach(function (k) { var s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), body); s.position.set(x + (rz ? -Math.sin(rz) * k * len / 2 : 0), y + Math.cos(rz || 0) * k * len / 2, z); s.castShadow = true; o.add(s); }); }
    cap(62, 780, -100, 450, 0); cap(62, 780, 100, 450, 0);            // legs
    cap(170, 420, 0, 1150, 0);                                           // torso
    cap(45, 560, -245, 1180, 0, 0.08); cap(45, 560, 245, 1180, 0, -0.08); // arms
    var head = new THREE.Mesh(new THREE.SphereGeometry(105, 24, 18), body); head.scale.y = 1.2; head.position.set(0, 1675, 0); head.castShadow = true; o.add(head);
    o.position.copy(V(-HX - 1150, ED * 0.55, 0)); o.rotation.y = Math.PI / 2.2;
    personG.add(o); personG.userData = { name: 'Person, 1.80 m', step: 0 };
  })();

  /* ---------- overall sizes ---------- */
  (function () {
    var g = G('dims'), col = 0x9b1c2e, lm = new THREE.LineBasicMaterial({ color: col });
    function label(txt, pos) { var c = document.createElement('canvas'), x = c.getContext('2d'); x.font = '600 56px Inter, Arial'; var w = Math.ceil(x.measureText(txt).width) + 48; c.width = w; c.height = 96;
      x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,0.94)'; x.fillRect(0, 0, w, 96); x.fillStyle = '#9b1c2e'; x.font = '600 56px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, 50);
      var tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false })); sp.scale.set(w * 0.85, 82, 1); sp.position.copy(pos); sp.renderOrder = 10; g.add(sp); }
    function dim(a, b, off, txt) { var A = V(a[0], a[1], a[2]).add(off), B = V(b[0], b[1], b[2]).add(off), pts = [V(a[0], a[1], a[2]), A, B, V(b[0], b[1], b[2])];
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm)); label(txt, A.clone().add(B).multiplyScalar(0.5)); }
    dim([-HX, 0, Z0 + 700], [HX, 0, Z0 + 700], new THREE.Vector3(0, 0, 120), P.EW + ' wide');
    dim([HX, 0, Z0 + 700], [HX, ED, Z0 + 700], new THREE.Vector3(120, 0, 0), ED + ' deep');
    dim([HX, 0, 0], [HX, 0, ZT], new THREE.Vector3(140, 0, 140), P.overall_H + ' high');
    dim([-HX, 0, Z0 + 300], [-HX, P.LID, Z0 + 300], new THREE.Vector3(-150, 0, 0), 'door ' + P.LID);
  })();

  /* ---------- state: toggles, x-ray, build steps ---------- */
  var state = { door: true, lidOut: false, dims: false, lining: true, restraint: true, chair: true, person: true, xray: false, step: 0 };
  var baseMats = new Map();
  function forMeshes(fn) { all.forEach(function (o) { o.traverse(function (c) { if (c.isMesh || c.isInstancedMesh) fn(c, o); }); }); }
  forMeshes(function (c) { baseMats.set(c, c.material); });
  var ghost = std({ color: 0x8fa2b8, transparent: true, opacity: 0.12, depthWrite: false, roughness: 1 });
  var hiMat = new Map();
  function highlight(mat) { if (Array.isArray(mat)) return mat.map(highlight); if (!hiMat.has(mat)) { var m = mat.clone(); m.emissive = new THREE.Color(0xff7a00); m.emissiveIntensity = 0.55; hiMat.set(mat, m); } return hiMat.get(mat); }
  function apply() {
    G('door').visible = state.door; (function () { var g = G('door'), a = state.lidOut ? -(P.OPEN_MAX || 95) * Math.PI / 180 * (P.HINGE_SX < 0 ? 1 : -1) : 0, px = P.HINGE_AX ? P.HINGE_AX[0] : -HX, pz = -(P.HINGE_AX ? P.HINGE_AX[1] : P.LID), c = Math.cos(a), s = Math.sin(a); g.rotation.y = a; g.position.set(px - (px * c + pz * s), 0, pz - (-px * s + pz * c)); })(); G('dims').visible = state.dims; G('lining').visible = state.lining; G('restraint').visible = state.restraint; chairG.visible = state.chair; personG.visible = state.person && !(state.lidOut && state.door);
    forMeshes(function (c, o) {
      var p = c.userData || {}, st = p.step || (o.userData && o.userData.step) || 0, m = baseMats.get(c);
      c.visible = true;
      if (state.step) { if (st > state.step) c.visible = false; else if (st === state.step) m = highlight(m); }
      if (state.xray && (p.kind === 'panel')) m = ghost;
      c.material = m;
    });
    renderNow();
  }

  /* ---------- UI ---------- */
  var tools = document.getElementById('tools');
  function btn(label, on, fn) { var b = document.createElement('button'); b.textContent = label; if (on) b.className = 'on'; b.onclick = function () { fn(b); }; tools.appendChild(b); return b; }
  [['door', 'Door'], ['lidOut', 'Door open'], ['lining', 'Foam'], ['restraint', 'Restraints'], ['chair', 'Chair'], ['person', 'Person'], ['dims', 'Sizes'], ['xray', 'X-ray']].forEach(function (t) {
    btn(t[1], state[t[0]], function (b) { state[t[0]] = !state[t[0]]; b.className = state[t[0]] ? 'on' : ''; apply(); });
  });
  var VIEWS = { '3/4': [[2700, 1650, 2600], [0, 880, -504]], Front: [[0, 950, 3900], [0, 900, -504]], Side: [[3900, 950, -504], [0, 900, -504]], Back: [[-1800, 1500, -3600], [0, 900, -504]], Top: [[0, 4700, -505], [0, 0, -504]], Under: [[1600, -900, 1400], [0, 150, -504]], Detail: [[900, 1900, 900], [420, 1650, -60]] };
  Object.keys(VIEWS).forEach(function (k) { btn(k, false, function () { setView(k); }); });
  function setView(k) { var v = VIEWS[k]; cam.position.set(v[0][0], v[0][1], v[0][2]); ctl.target.set(v[1][0], v[1][1], v[1][2]); ctl.update(); renderNow(); }
  window.__setView = setView; window.__state = state; window.__apply = apply;

  // build-step bar
  var sb = document.getElementById('stepbar');
  if (sb) {
    var first = 5, last = 13;
    sb.innerHTML = '<button id="sPrev">◀</button><div id="sTxt"><b>Build along</b> Step through the build from the closed box to the badge.</div><button id="sNext">▶</button><button id="sAll">All</button>';
    function showStep() { var t = document.getElementById('sTxt'); if (!state.step) { t.innerHTML = '<b>Build along</b> Press ▶ to step through the build, part by part.'; } else { var s = STEPS[state.step - 1] || ['', '']; t.innerHTML = '<b>Step ' + state.step + ' · ' + s[0] + '</b> ' + s[1]; } apply(); }
    document.getElementById('sPrev').onclick = function () { state.step = state.step <= first ? 0 : state.step - 1; showStep(); };
    document.getElementById('sNext').onclick = function () { state.step = !state.step ? first : Math.min(last, state.step + 1); showStep(); };
    document.getElementById('sAll').onclick = function () { state.step = 0; showStep(); };
    window.__step = function (n) { state.step = n; showStep(); };
  }

  // picking
  var ray = new THREE.Raycaster(), mv = new THREE.Vector2(), down = null, info = document.getElementById('info');
  canvas.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', function (e) {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; down = null;
    var r = canvas.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mv, cam);
    var hs = ray.intersectObjects(pickables, false).filter(function (h) { var v = h.object.visible; h.object.traverseAncestors(function (a) { if (!a.visible) v = false; }); return v && !(state.xray && h.object.userData.kind === 'panel'); });
    if (!hs.length) { info.innerHTML = '<h3>Tap any part</h3><p>Name, size, build step and where to buy it.</p>'; return; }
    var d = hs[0].object.userData, b = d.b, sz = b ? [Math.round(b[3] - b[0]), Math.round(b[4] - b[1]), Math.round(b[5] - b[2])] : null, st = d.step ? STEPS[d.step - 1] : null;
    info.innerHTML = '<h3>' + d.name + '</h3><p>' + (d.desc || '') + '</p>' + (sz && d.kind !== 'chair' ? '<p><span class="k">Envelope</span> ' + sz[0] + ' W × ' + sz[1] + ' D × ' + sz[2] + ' H mm</p>' : '') +
      (st ? '<p><span class="k">Build step ' + d.step + '</span> ' + st[0] + '</p>' : '') + (d.supplier ? '<p><span class="k">Source</span> ' + d.supplier + '</p>' : '');
  });

  function resize() { var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); renderNow(); }
  window.__resize = resize; window.addEventListener('resize', resize);
  function renderNow() { renderer.render(scene, cam); }
  (function loop() { requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam); })();
  window.__cam = cam; window.__ctl = ctl;
  setView('3/4'); apply(); resize();
})();
