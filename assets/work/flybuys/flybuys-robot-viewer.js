(() => {
  const THREE_RUNTIME = "/assets/work/flybuys/three/three.module.min.js";
  const ORBIT_PATH = "/assets/work/flybuys/three/examples/jsm/controls/OrbitControls.js";
  const root = document.getElementById("flybuys-3d-viewer");
  if (!root) return;

  document.body.classList.add("flybuys-3d-page");
  root.closest(".info_about-media-wrapper")?.classList.add("flybuys-3d-wrapper");
  root.innerHTML = `
    <div class="flybuys-3d-stage" aria-live="polite" aria-busy="true">
      <canvas role="application" tabindex="0" aria-label="Interactive digital replica of the Flybuys robot. Drag to rotate, scroll or pinch to zoom. Use the slider to separate the salvaged objects used in the build."></canvas>
      <div class="flybuys-3d-stage__loading">Building digital replica…</div>
    </div>
    <div class="flybuys-3d-meta" aria-hidden="true">
      <div class="flybuys-3d-meta__identity"><span class="flybuys-3d-eyebrow">Interactive build study</span><strong>Flybuys robot</strong></div>
      <span class="flybuys-3d-part-count">Preparing object study</span>
    </div>
    <div class="flybuys-3d-views" aria-label="Camera views">
      <button class="flybuys-3d-view-button is-active" type="button" data-flybuys-view="front" aria-label="Front view" title="Front view">F</button>
      <button class="flybuys-3d-view-button" type="button" data-flybuys-view="three-quarter" aria-label="Three-quarter view" title="Three-quarter view">¾</button>
      <button class="flybuys-3d-view-button" type="button" data-flybuys-view="back" aria-label="Back view" title="Back view">B</button>
    </div>
    <div class="flybuys-3d-help" aria-hidden="true">Drag to rotate · Scroll to zoom</div>
    <div class="flybuys-3d-controls">
      <div class="flybuys-3d-controls__label"><label for="flybuys-explode">Separate the build</label><span class="flybuys-3d-mode">Assembled</span></div>
      <span class="flybuys-3d-controls__status" id="flybuys-explode-value">0%</span>
      <input id="flybuys-explode" type="range" min="0" max="100" step="1" value="0" class="flybuys-3d-explode" aria-label="Separate the salvaged objects" aria-describedby="flybuys-explode-value">
      <div class="flybuys-3d-controls__ends" aria-hidden="true"><span>Robot</span><span>Salvaged objects</span></div>
      <button class="flybuys-3d-reset" type="button" aria-label="Reset model and camera" title="Reset model and camera">↺</button>
    </div>
    <div class="flybuys-3d-error" role="status"></div>`;

  const stage = root.querySelector(".flybuys-3d-stage");
  const canvas = stage?.querySelector("canvas");
  const slider = root.querySelector(".flybuys-3d-explode");
  const valueText = root.querySelector(".flybuys-3d-controls__status");
  const resetButton = root.querySelector(".flybuys-3d-reset");
  const progress = root.querySelector(".flybuys-3d-stage__loading");
  const partCount = root.querySelector(".flybuys-3d-part-count");
  const modeText = root.querySelector(".flybuys-3d-mode");
  const errorBox = root.querySelector(".flybuys-3d-error");
  const viewButtons = [...root.querySelectorAll("[data-flybuys-view]")];
  if (!stage || !canvas || !slider || !valueText || !resetButton || !progress || !partCount || !modeText || !errorBox) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const smallViewport = window.matchMedia("(max-width: 767px)");
  const state = { target: 0, current: 0, parts: [], inventory: { width: 1, height: 1 }, homeCamera: null, homeTarget: null, inventoryCamera: null, inventoryTarget: null, guidingCamera: false };
  const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const ease = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

  function setMode(value) {
    const percent = Math.round(clamp01(value) * 100);
    valueText.textContent = `${percent}%`;
    slider.style.setProperty("--explode-progress", `${percent}%`);
    root.classList.toggle("is-separated", percent > 8);
    modeText.textContent = percent < 8 ? "Assembled" : percent > 92 ? "Object inventory" : "Separating";
    viewButtons.forEach((button) => { button.disabled = percent > 8; });
  }

  function showError(error) {
    console.error(error);
    stage.removeAttribute("aria-busy");
    stage.setAttribute("data-state", "error");
    errorBox.textContent = "The interactive model could not load. Please refresh the page to try again.";
    errorBox.classList.add("is-visible");
    progress.textContent = "3D model unavailable";
  }

  async function start() {
    stage.setAttribute("aria-busy", "true");
    root.setAttribute("data-state", "loading");
    try {
      const [THREE, orbitModule] = await Promise.all([import(THREE_RUNTIME), import(ORBIT_PATH)]);
      buildViewer(THREE, orbitModule.OrbitControls);
    } catch (error) { showError(error); }
  }

  function buildViewer(THREE, OrbitControls) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !smallViewport.matches, alpha: false, powerPreference: smallViewport.matches ? "low-power" : "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallViewport.matches ? 1.35 : 1.8));
    renderer.setClearColor(0xefefef, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !smallViewport.matches;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.screenSpacePanning = true;

    const environmentCanvas = document.createElement("canvas");
    environmentCanvas.width = 512;
    environmentCanvas.height = 256;
    const environmentContext = environmentCanvas.getContext("2d");
    const environmentGradient = environmentContext.createLinearGradient(0, 0, 0, 256);
    environmentGradient.addColorStop(0, "#ffffff");
    environmentGradient.addColorStop(0.38, "#dce2e5");
    environmentGradient.addColorStop(0.62, "#faf7ef");
    environmentGradient.addColorStop(1, "#798086");
    environmentContext.fillStyle = environmentGradient;
    environmentContext.fillRect(0, 0, 512, 256);
    environmentContext.fillStyle = "rgba(255,255,255,.78)";
    environmentContext.fillRect(45, 25, 86, 190);
    environmentContext.fillRect(332, 52, 118, 150);
    const environmentTexture = new THREE.CanvasTexture(environmentCanvas);
    environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
    environmentTexture.colorSpace = THREE.SRGBColorSpace;
    scene.environment = environmentTexture;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x747b7f, 1.85));
    const key = new THREE.DirectionalLight(0xffffff, 2.75);
    key.position.set(4, 7, 7);
    key.castShadow = !smallViewport.matches;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5dded, 1.15);
    fill.position.set(-5, 3, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffddb8, 1.25);
    rim.position.set(3, 5, -5);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const platformRoot = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.035, 96), new THREE.MeshStandardMaterial({ color: 0xe4e5e6, roughness: 0.94, transparent: true }));
    platform.receiveShadow = true;
    platformRoot.add(platform);
    const contact = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0x697176, transparent: true, opacity: 0.095, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.021;
    platformRoot.add(contact);
    scene.add(platformRoot);

    const brushedCanvas = document.createElement("canvas");
    brushedCanvas.width = 128;
    brushedCanvas.height = 128;
    const brushedContext = brushedCanvas.getContext("2d");
    const brushedData = brushedContext.createImageData(128, 128);
    for (let y = 0; y < 128; y += 1) {
      const band = 112 + Math.round(Math.sin(y * 0.85) * 24);
      for (let x = 0; x < 128; x += 1) {
        const value = Math.max(54, Math.min(205, band + ((x * 17 + y * 29) % 21) - 10));
        const offset = (y * 128 + x) * 4;
        brushedData.data[offset] = value;
        brushedData.data[offset + 1] = value;
        brushedData.data[offset + 2] = value;
        brushedData.data[offset + 3] = 255;
      }
    }
    brushedContext.putImageData(brushedData, 0, 0);
    const brushedTexture = new THREE.CanvasTexture(brushedCanvas);
    brushedTexture.wrapS = brushedTexture.wrapT = THREE.RepeatWrapping;
    brushedTexture.repeat.set(2, 5);

    const materials = {
      steel: new THREE.MeshPhysicalMaterial({ color: 0x929a9c, metalness: 0.78, roughness: 0.34, roughnessMap: brushedTexture, bumpMap: brushedTexture, bumpScale: 0.008, clearcoat: 0.25, clearcoatRoughness: 0.3 }),
      darkSteel: new THREE.MeshPhysicalMaterial({ color: 0x343b3d, metalness: 0.76, roughness: 0.38, roughnessMap: brushedTexture, bumpMap: brushedTexture, bumpScale: 0.006, clearcoat: 0.16 }),
      blueShell: new THREE.MeshPhysicalMaterial({ color: 0x3f6876, metalness: 0.34, roughness: 0.46, bumpMap: brushedTexture, bumpScale: 0.004, clearcoat: 0.28, clearcoatRoughness: 0.32 }),
      cream: new THREE.MeshPhysicalMaterial({ color: 0xc9c2ad, metalness: 0.06, roughness: 0.42, clearcoat: 0.28, clearcoatRoughness: 0.32 }),
      black: new THREE.MeshPhysicalMaterial({ color: 0x111416, metalness: 0.18, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.36 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.82 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x162026, metalness: 0.18, roughness: 0.15, transmission: 0.3, transparent: true, opacity: 0.84, clearcoat: 1 }),
      clearGlass: new THREE.MeshPhysicalMaterial({ color: 0xc9e1e5, roughness: 0.08, transmission: 0.72, transparent: true, opacity: 0.52, depthWrite: false }),
      orangeGlow: new THREE.MeshStandardMaterial({ color: 0xff9b36, emissive: 0xf36b16, emissiveIntensity: 1.8, roughness: 0.5 }),
      white: new THREE.MeshStandardMaterial({ color: 0xe5e4dc, roughness: 0.52 }),
    };

    const geometryCache = new Map();
    function roundedBoxGeometry(width, height, depth, radius = 0.08) {
      const keyName = [width, height, depth, radius].join("|");
      if (geometryCache.has(keyName)) return geometryCache.get(keyName);
      const x = -width / 2;
      const y = -height / 2;
      const r = Math.min(radius, width / 4, height / 4);
      const shape = new THREE.Shape();
      shape.moveTo(x + r, y);
      shape.lineTo(x + width - r, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + r);
      shape.lineTo(x + width, y + height - r);
      shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      shape.lineTo(x + r, y + height);
      shape.quadraticCurveTo(x, y + height, x, y + height - r);
      shape.lineTo(x, y + r);
      shape.quadraticCurveTo(x, y, x + r, y);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: Math.min(r * 0.45, depth * 0.12), bevelThickness: Math.min(r * 0.45, depth * 0.12), curveSegments: 5 });
      geometry.translate(0, 0, -depth / 2);
      geometry.computeVertexNormals();
      geometryCache.set(keyName, geometry);
      return geometry;
    }

    function addMesh(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.castShadow = !smallViewport.matches;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }
    const addBox = (group, size, position, material, radius = 0.07) => addMesh(group, roundedBoxGeometry(...size, radius), material, position);
    const addKnob = (group, position, radius = 0.1, material = materials.steel) => addMesh(group, new THREE.CylinderGeometry(radius, radius, 0.07, 24), material, position, [Math.PI / 2, 0, 0]);
    const addScrew = (group, position) => addMesh(group, new THREE.CylinderGeometry(0.025, 0.025, 0.025, 12), materials.darkSteel, position, [Math.PI / 2, 0, 0]);
    function addRidges(group, count, width, height, z, material) {
      const span = width * 0.84;
      for (let index = 0; index < count; index += 1) {
        const x = count === 1 ? 0 : -span / 2 + (span * index) / (count - 1);
        addBox(group, [width * 0.025, height, 0.035], [x, 0, z], material, 0.015);
      }
    }
    function addFan(group, radius, position, material = materials.black) {
      const fan = new THREE.Group();
      fan.position.set(...position);
      group.add(fan);
      addMesh(fan, new THREE.TorusGeometry(radius, radius * 0.09, 10, 48), material);
      addMesh(fan, new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, 0.08, 24), materials.darkSteel, [0, 0, 0.02], [Math.PI / 2, 0, 0]);
      for (let index = 0; index < 9; index += 1) {
        const angle = (index / 9) * Math.PI * 2;
        const blade = addBox(fan, [radius * 0.09, radius * 0.56, 0.025], [Math.cos(angle) * radius * 0.28, Math.sin(angle) * radius * 0.28, 0.045], material, 0.025);
        blade.rotation.z = angle - 0.35;
      }
      return fan;
    }
    function createPart(name, position) {
      const part = new THREE.Group();
      part.name = name;
      part.position.set(...position);
      return part;
    }
    function addPart(robot, parts, part) { robot.add(part); parts.push(part); return part; }
    function createGlove(name, position, mirror = 1) {
      const glove = createPart(name, position);
      addBox(glove, [0.52, 0.38, 0.38], [0, 0, 0], materials.rubber, 0.16);
      for (let index = 0; index < 4; index += 1) addMesh(glove, new THREE.CapsuleGeometry(0.07, 0.24, 5, 10), materials.rubber, [mirror * (0.29 + index * 0.075), 0.02 - index * 0.02, 0.04], [0, 0, Math.PI / 2]);
      addMesh(glove, new THREE.CapsuleGeometry(0.08, 0.23, 5, 10), materials.rubber, [mirror * 0.12, -0.22, 0.06], [0, 0, mirror * 0.7]);
      return glove;
    }

    function createRobot() {
      const robot = new THREE.Group();
      robot.name = "Flybuys robot replica";
      const parts = [];
      let part;

      part = addPart(robot, parts, createPart("Left rubber appliance foot", [-0.64, 0.28, 0.02]));
      addBox(part, [0.8, 0.5, 0.9], [0, 0, 0], materials.rubber, 0.22);
      addBox(part, [0.62, 0.11, 0.72], [0.04, 0.18, 0.03], materials.black, 0.06);
      part = addPart(robot, parts, createPart("Right rubber appliance foot", [0.64, 0.28, 0.02]));
      addBox(part, [0.8, 0.5, 0.9], [0, 0, 0], materials.rubber, 0.22);
      addBox(part, [0.62, 0.11, 0.72], [-0.04, 0.18, 0.03], materials.black, 0.06);

      part = addPart(robot, parts, createPart("Blue hard-shell suitcase leg", [-0.67, 1.17, 0]));
      addBox(part, [0.9, 1.35, 0.68], [0, 0, 0], materials.blueShell, 0.13);
      addRidges(part, 7, 0.9, 1.02, 0.37, materials.darkSteel);
      addBox(part, [0.38, 0.1, 0.08], [0, 0.59, 0.38], materials.black, 0.03);
      addScrew(part, [-0.32, -0.53, 0.37]); addScrew(part, [0.32, -0.53, 0.37]);
      part = addPart(robot, parts, createPart("Portable fan knee", [-0.67, 1.72, 0.43]));
      addBox(part, [0.76, 0.72, 0.18], [0, 0, -0.07], materials.white, 0.14);
      addFan(part, 0.31, [0, 0, 0.06], materials.white);
      part = addPart(robot, parts, createPart("Black speaker leg", [0.67, 1.16, 0]));
      addBox(part, [0.85, 1.34, 0.7], [0, 0, 0], materials.black, 0.14);
      addFan(part, 0.27, [0, 0.2, 0.37], materials.black);
      addFan(part, 0.18, [0, -0.35, 0.38], materials.black);

      part = addPart(robot, parts, createPart("Computer chassis hip", [0, 2.18, 0]));
      addBox(part, [1.95, 0.72, 0.72], [0, 0, 0], materials.steel, 0.1);
      addBox(part, [0.55, 0.42, 0.06], [-0.4, 0, 0.39], materials.black, 0.04);
      addFan(part, 0.19, [-0.4, 0, 0.425], materials.black);
      addBox(part, [0.65, 0.22, 0.05], [0.42, 0.11, 0.4], materials.darkSteel, 0.03);
      addKnob(part, [0.62, -0.15, 0.42], 0.07);

      part = addPart(robot, parts, createPart("Blue suitcase body", [0, 3.3, 0]));
      addBox(part, [2.15, 1.55, 0.78], [0, 0, 0], materials.blueShell, 0.14);
      addRidges(part, 13, 2.15, 1.25, 0.42, materials.darkSteel);
      addBox(part, [0.38, 0.1, 0.08], [0, 0.68, 0.42], materials.black, 0.03);
      part = addPart(robot, parts, createPart("Cream microwave chest", [0, 3.38, 0.47]));
      addBox(part, [1.9, 0.98, 0.34], [0, 0, 0], materials.cream, 0.12);
      addBox(part, [1.15, 0.61, 0.035], [-0.19, 0.02, 0.19], materials.glass, 0.1);
      addBox(part, [0.08, 0.68, 0.08], [0.55, 0.02, 0.2], materials.steel, 0.035);
      addKnob(part, [0.75, 0.2, 0.2], 0.1);
      for (let index = 0; index < 5; index += 1) addKnob(part, [0.68 + (index % 2) * 0.16, -0.08 - Math.floor(index / 2) * 0.13, 0.2], 0.035, materials.darkSteel);

      part = addPart(robot, parts, createPart("Stainless control deck", [0, 4.45, 0.02]));
      addBox(part, [1.95, 0.68, 0.76], [0, 0, 0], materials.steel, 0.1);
      addBox(part, [0.75, 0.3, 0.035], [0, 0, 0.41], materials.glass, 0.04);
      addKnob(part, [-0.72, 0, 0.42], 0.12); addKnob(part, [0.72, 0, 0.42], 0.12);
      for (let index = 0; index < 3; index += 1) { addKnob(part, [-0.38, 0.1 - index * 0.1, 0.42], 0.035); addKnob(part, [0.38, 0.1 - index * 0.1, 0.42], 0.035); }
      part = addPart(robot, parts, createPart("Countertop oven head", [0, 5.18, 0.02]));
      addBox(part, [1.72, 0.9, 0.84], [0, 0, 0], materials.steel, 0.11);
      addBox(part, [1.35, 0.56, 0.035], [0, 0.05, 0.45], materials.glass, 0.06);
      addBox(part, [1.18, 0.38, 0.025], [0, 0.05, 0.46], materials.orangeGlow, 0.05);
      addBox(part, [1.2, 0.065, 0.07], [0, -0.33, 0.48], materials.darkSteel, 0.025);
      for (const x of [-0.62, 0.62]) for (const y of [-0.39, 0.39]) addBox(part, [0.13, 0.08, 0.13], [x, y, -0.4], materials.black, 0.03);

      part = addPart(robot, parts, createPart("Coffee machine shoulder", [-1.46, 4.28, 0.02]));
      addBox(part, [0.72, 1.15, 0.72], [0, 0, 0], materials.black, 0.13);
      addBox(part, [0.42, 0.92, 0.38], [0.03, 0.02, 0.24], materials.steel, 0.1);
      addMesh(part, new THREE.TorusGeometry(0.24, 0.05, 12, 40), materials.darkSteel, [0, -0.12, 0.43]);
      part = addPart(robot, parts, createPart("Stainless hot-water urn arm", [-1.55, 3.2, 0.02]));
      addMesh(part, new THREE.CylinderGeometry(0.37, 0.37, 1.22, 36), materials.steel);
      addMesh(part, new THREE.TorusGeometry(0.4, 0.045, 10, 48), materials.darkSteel, [0, 0.48, 0], [Math.PI / 2, 0, 0]);
      addMesh(part, new THREE.TorusGeometry(0.4, 0.045, 10, 48), materials.darkSteel, [0, -0.48, 0], [Math.PI / 2, 0, 0]);
      addBox(part, [0.12, 0.18, 0.24], [0.31, -0.25, 0.22], materials.black, 0.03);
      addPart(robot, parts, createGlove("Left work glove", [-1.62, 2.48, 0.12], -1));

      part = addPart(robot, parts, createPart("Chrome control-panel shoulder", [1.45, 4.24, 0.02]));
      addBox(part, [0.68, 1.28, 0.68], [0, 0, 0], materials.steel, 0.12);
      addBox(part, [0.31, 0.24, 0.035], [0.05, 0.32, 0.37], materials.glass, 0.04);
      addBox(part, [0.31, 0.24, 0.035], [0.05, -0.3, 0.37], materials.glass, 0.04);
      addKnob(part, [-0.16, 0.34, 0.38], 0.085); addKnob(part, [-0.16, -0.28, 0.38], 0.085);
      for (let index = 0; index < 8; index += 1) addKnob(part, [-0.15 + (index % 3) * 0.12, 0.08 - Math.floor(index / 3) * 0.12, 0.38], 0.027, materials.black);
      part = addPart(robot, parts, createPart("Blender arm", [1.52, 3.25, 0.02]));
      addBox(part, [0.68, 0.58, 0.7], [0, -0.35, 0], materials.steel, 0.12);
      addKnob(part, [0, -0.35, 0.38], 0.12, materials.darkSteel);
      addMesh(part, new THREE.CylinderGeometry(0.31, 0.25, 0.72, 24), materials.clearGlass, [0, 0.28, 0]);
      addMesh(part, new THREE.TorusGeometry(0.34, 0.045, 10, 36), materials.black, [0, 0.63, 0], [Math.PI / 2, 0, 0]);
      const handle = addMesh(part, new THREE.TorusGeometry(0.26, 0.05, 10, 36, Math.PI * 1.25), materials.black, [0.29, 0.26, 0], [0, Math.PI / 2, -0.5]);
      handle.rotation.z = -0.5;
      addPart(robot, parts, createGlove("Right work glove", [1.62, 2.48, 0.12], 1));

      part = addPart(robot, parts, createPart("Television aerial", [0, 5.72, -0.1]));
      addBox(part, [0.42, 0.15, 0.3], [0, 0, 0], materials.black, 0.06);
      for (const side of [-1, 1]) addMesh(part, new THREE.CylinderGeometry(0.018, 0.018, 0.95, 10), materials.darkSteel, [side * 0.18, 0.45, 0], [0, 0, side * 0.28]);
      part = addPart(robot, parts, createPart("Black appliance canister", [0.76, 1.78, -0.16]));
      addMesh(part, new THREE.CylinderGeometry(0.31, 0.35, 0.72, 28), materials.black, [0, 0, 0], [0, 0, Math.PI / 2]);
      robot.scale.z = 1.7;
      return { robot, parts };
    }

    let modelRadius = 1;
    let rafId = 0;
    let framesAfterChange = 0;
    let sceneReady = false;
    let viewportPaused = false;
    let documentPaused = document.hidden;
    const render = () => renderer.render(scene, camera);

    function layoutParts() {
      if (!state.parts.length) return;
      modelRoot.updateWorldMatrix(true, true);
      const gap = modelRadius * (smallViewport.matches ? 0.1 : 0.08);
      const minCell = modelRadius * 0.1;
      const boxes = state.parts.map((part, index) => {
        const box = new THREE.Box3().setFromObject(part.mesh);
        const size = box.getSize(new THREE.Vector3());
        const origin = part.mesh.getWorldPosition(new THREE.Vector3());
        return { part, index, originOffset: box.getCenter(new THREE.Vector3()).sub(origin), width: Math.max(size.x, minCell), height: Math.max(size.y, minCell) };
      });
      const totalArea = boxes.reduce((sum, item) => sum + (item.width + gap) * (item.height + gap), 0);
      const aspect = Math.max(0.72, Math.min(1.9, stage.clientWidth / Math.max(1, stage.clientHeight)));
      const targetWidth = Math.sqrt(totalArea * aspect) * 1.18;
      const sorted = boxes.slice().sort((a, b) => b.height - a.height || b.width - a.width || a.index - b.index);
      let cursorX = 0; let cursorY = 0; let rowHeight = 0; let packedWidth = 0;
      for (const item of sorted) {
        if (cursorX > 0 && cursorX + item.width > targetWidth) { cursorX = 0; cursorY += rowHeight + gap; rowHeight = 0; }
        item.x = cursorX + item.width / 2; item.y = -(cursorY + item.height / 2);
        cursorX += item.width + gap; rowHeight = Math.max(rowHeight, item.height); packedWidth = Math.max(packedWidth, cursorX - gap);
      }
      const packedHeight = cursorY + rowHeight;
      for (const item of boxes) {
        const desiredOrigin = new THREE.Vector3(item.x - packedWidth / 2 - item.originOffset.x, item.y + packedHeight / 2 - item.originOffset.y, -item.originOffset.z);
        item.part.explodedLocal.copy((item.part.mesh.parent || modelRoot).worldToLocal(desiredOrigin));
      }
      state.inventory.width = packedWidth; state.inventory.height = packedHeight;
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const distance = Math.max(packedHeight / (2 * Math.tan(halfFov)), packedWidth / (2 * Math.tan(halfFov) * Math.max(0.1, camera.aspect))) * (smallViewport.matches ? 1.44 : 1.32);
      const verticalOffset = packedHeight * 0.075;
      state.inventoryTarget = new THREE.Vector3(0, verticalOffset, 0);
      state.inventoryCamera = new THREE.Vector3(0, verticalOffset, Math.max(distance, modelRadius * 2.4));
    }

    function prepareModel(model, logicalParts) {
      const initialBounds = new THREE.Box3().setFromObject(model);
      model.position.sub(initialBounds.getCenter(new THREE.Vector3()));
      modelRoot.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(modelRoot);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      modelRadius = Math.max(size.x, size.y, size.z) / 2;
      state.parts = logicalParts.map((mesh) => ({ mesh, homeLocal: mesh.position.clone(), explodedLocal: mesh.position.clone() }));
      partCount.textContent = `${state.parts.length} salvaged objects`;
      const distance = (modelRadius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (smallViewport.matches ? 1.58 : 1.42);
      state.homeTarget = center.clone(); state.homeTarget.y -= modelRadius * 0.2;
      state.homeCamera = new THREE.Vector3(center.x + modelRadius * 0.08, center.y + modelRadius * 0.1, center.z + distance);
      camera.position.copy(state.homeCamera); controls.target.copy(state.homeTarget);
      controls.minDistance = distance * 0.46; controls.maxDistance = Math.max(distance * 4, modelRadius * 10);
      camera.near = Math.max(0.001, modelRadius * 0.01); camera.far = Math.max(50, distance * 25); camera.updateProjectionMatrix();
      platformRoot.position.set(center.x, bounds.min.y - modelRadius * 0.045, center.z);
      platformRoot.scale.set(modelRadius * 0.86, modelRadius * 0.11, modelRadius * 0.68);
      layoutParts(); controls.saveState();
    }

    function guideCamera(value) {
      if (!state.homeCamera || !state.inventoryCamera) return;
      const t = ease(value);
      camera.position.lerpVectors(state.homeCamera, state.inventoryCamera, t);
      controls.target.lerpVectors(state.homeTarget, state.inventoryTarget, t);
      controls.enableRotate = value < 0.9; controls.enablePan = value > 0.78;
    }
    function updateScene() {
      state.current += (state.target - state.current) * (reduceMotion.matches ? 1 : 0.115);
      if (Math.abs(state.target - state.current) < 0.0008) { state.current = state.target; state.guidingCamera = false; }
      const t = ease(state.current);
      for (const part of state.parts) part.mesh.position.lerpVectors(part.homeLocal, part.explodedLocal, t);
      platformRoot.visible = t < 0.985; platform.material.opacity = Math.max(0, 1 - t * 1.15); contact.material.opacity = Math.max(0, 0.095 * (1 - t * 1.3));
      if (state.guidingCamera) guideCamera(state.current);
      setMode(state.current); controls.update(); render();
    }
    function tick() {
      if (!sceneReady || viewportPaused || documentPaused) { rafId = 0; return; }
      updateScene();
      if (Math.abs(state.target - state.current) >= 0.0008 || state.guidingCamera || framesAfterChange > 0) { framesAfterChange = Math.max(0, framesAfterChange - 1); rafId = requestAnimationFrame(tick); } else rafId = 0;
    }
    const startLoop = () => { if (!rafId && sceneReady && !viewportPaused && !documentPaused) rafId = requestAnimationFrame(tick); };
    function resize() {
      const width = Math.max(1, stage.clientWidth); const height = Math.max(1, stage.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallViewport.matches ? 1.35 : 1.8)); renderer.setSize(width, height, false);
      if (sceneReady) { layoutParts(); if (state.current > 0.9) guideCamera(state.current); render(); }
    }
    function setView(view) {
      if (!state.homeCamera || state.current > 0.08) return;
      const distance = state.homeCamera.distanceTo(state.homeTarget);
      const positions = { front: new THREE.Vector3(0, modelRadius * 0.08, distance), "three-quarter": new THREE.Vector3(distance * 0.68, modelRadius * 0.08, distance * 0.68), back: new THREE.Vector3(0, modelRadius * 0.08, -distance) };
      camera.position.copy(positions[view] || positions.front); controls.target.copy(state.homeTarget); controls.update();
      viewButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.flybuysView === view)); render();
    }

    slider.addEventListener("input", (event) => { state.target = clamp01(Number(event.currentTarget.value) / 100); state.guidingCamera = true; setMode(state.target); startLoop(); });
    resetButton.addEventListener("click", () => {
      slider.value = "0"; state.target = 0; state.current = 0; state.guidingCamera = false;
      for (const part of state.parts) part.mesh.position.copy(part.homeLocal);
      camera.position.copy(state.homeCamera); controls.target.copy(state.homeTarget); controls.enableRotate = true; controls.enablePan = false; controls.update(); setMode(0); setView("front"); startLoop();
    });
    viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.flybuysView)));
    controls.addEventListener("change", () => { framesAfterChange = 8; startLoop(); });
    canvas.addEventListener("keydown", (event) => { if (event.key === "Home") { resetButton.click(); event.preventDefault(); } else if (event.key === "End") { slider.value = "100"; slider.dispatchEvent(new Event("input", { bubbles: true })); event.preventDefault(); } });
    new ResizeObserver(resize).observe(stage);
    window.addEventListener("resize", resize, { passive: true });
    new IntersectionObserver((entries) => { viewportPaused = !entries.some((entry) => entry.isIntersecting); if (viewportPaused && rafId) { cancelAnimationFrame(rafId); rafId = 0; } else startLoop(); }, { rootMargin: "160px 0px" }).observe(root);
    document.addEventListener("visibilitychange", () => { documentPaused = document.hidden; if (documentPaused && rafId) { cancelAnimationFrame(rafId); rafId = 0; } else startLoop(); });

    resize();
    const { robot, parts } = createRobot();
    modelRoot.add(robot); modelRoot.updateMatrixWorld(true); prepareModel(robot, parts);
    sceneReady = true; root.setAttribute("data-state", "ready"); stage.setAttribute("data-state", "ready"); stage.removeAttribute("aria-busy"); setMode(0); resize(); controls.update(); render(); startLoop();
  }

  setMode(0);
  start();
})();
