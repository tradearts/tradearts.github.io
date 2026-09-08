(() => {
  const MODEL_PATH = "/assets/work/flybuys/flybuys-robot.glb";
  const THREE_RUNTIME = "/assets/work/flybuys/three/three.module.min.js";
  const ORBIT_PATH = "/assets/work/flybuys/three/examples/jsm/controls/OrbitControls.js";
  const GLTF_PATH = "/assets/work/flybuys/three/examples/jsm/loaders/GLTFLoader.js";

  const root = document.getElementById("flybuys-3d-viewer");
  if (!root) return;
  document.body.classList.add("flybuys-3d-page");
  root.closest(".info_about-media-wrapper")?.classList.add("flybuys-3d-wrapper");

  root.innerHTML = `
    <div class="flybuys-3d-stage" aria-live="polite" aria-busy="true">
      <canvas role="application" tabindex="0" aria-label="Interactive Flybuys robot model. Drag to rotate, scroll or pinch to zoom. Use the slider to arrange the robot into a parts inventory."></canvas>
      <div class="flybuys-3d-stage__loading">Loading 3D model…</div>
    </div>
    <div class="flybuys-3d-meta" aria-hidden="true">
      <div class="flybuys-3d-meta__identity">
        <span class="flybuys-3d-eyebrow">Interactive model</span>
        <strong>Flybuys robot</strong>
      </div>
      <span class="flybuys-3d-part-count">Preparing digital model</span>
    </div>
    <div class="flybuys-3d-views" aria-label="Camera views">
      <button class="flybuys-3d-view-button is-active" type="button" data-flybuys-view="front" aria-label="Front view" title="Front view">F</button>
      <button class="flybuys-3d-view-button" type="button" data-flybuys-view="side" aria-label="Side view" title="Side view">S</button>
      <button class="flybuys-3d-view-button" type="button" data-flybuys-view="back" aria-label="Back view" title="Back view">B</button>
    </div>
    <div class="flybuys-3d-help" aria-hidden="true">Drag to rotate · Scroll to zoom</div>
    <div class="flybuys-3d-controls">
      <div class="flybuys-3d-controls__label">
        <label for="flybuys-explode">Explode model</label>
        <span class="flybuys-3d-mode">Assembled</span>
      </div>
      <span class="flybuys-3d-controls__status" id="flybuys-explode-value">0%</span>
      <input id="flybuys-explode" type="range" min="0" max="100" step="1" value="0" class="flybuys-3d-explode" aria-label="Explode model" aria-describedby="flybuys-explode-value">
      <div class="flybuys-3d-controls__ends" aria-hidden="true"><span>Assembled</span><span>Every part</span></div>
      <button class="flybuys-3d-reset" type="button" aria-label="Reset model and camera" title="Reset model and camera">↺</button>
    </div>
    <div class="flybuys-3d-error" role="status"></div>
  `;

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
  const state = {
    target: 0,
    current: 0,
    parts: [],
    inventory: { width: 1, height: 1, center: null },
    homeCamera: null,
    homeTarget: null,
    inventoryCamera: null,
    inventoryTarget: null,
    guidingCamera: false,
    activeView: "front",
  };

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function ease(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function setProgress(text) {
    progress.textContent = text;
  }

  function setMode(value) {
    const percent = Math.round(clamp01(value) * 100);
    valueText.textContent = `${percent}%`;
    slider.style.setProperty("--explode-progress", `${percent}%`);
    modeText.textContent = percent < 8 ? "Assembled" : percent > 92 ? "Parts inventory" : "Separating";
    viewButtons.forEach((button) => {
      button.disabled = percent > 8;
    });
  }

  function showError() {
    stage.removeAttribute("aria-busy");
    stage.setAttribute("data-state", "error");
    errorBox.textContent = "The interactive model could not load. Please refresh the page to try again.";
    errorBox.classList.add("is-visible");
    setProgress("3D model unavailable");
  }

  async function start() {
    stage.setAttribute("aria-busy", "true");
    root.setAttribute("data-state", "loading");

    try {
      const [THREE, orbitModule, loaderModule] = await Promise.all([
        import(THREE_RUNTIME),
        import(ORBIT_PATH),
        import(GLTF_PATH),
      ]);
      buildViewer(THREE, orbitModule.OrbitControls, loaderModule.GLTFLoader);
    } catch (error) {
      console.error(error);
      showError();
    }
  }

  function buildViewer(THREE, OrbitControls, GLTFLoader) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !smallViewport.matches,
      alpha: false,
      powerPreference: smallViewport.matches ? "low-power" : "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallViewport.matches ? 1.35 : 1.8));
    renderer.setClearColor(0xefefef, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !smallViewport.matches;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb4bac2, 2.15));

    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(3, 5, 5);
    key.castShadow = !smallViewport.matches;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xb9d4ff, 1.25);
    fill.position.set(-4, 2, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffe4ce, 1.45);
    rim.position.set(2, 4, -4);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    const platformRoot = new THREE.Group();
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.035, 96),
      new THREE.MeshStandardMaterial({ color: 0xe7e8e9, roughness: 0.92, metalness: 0, transparent: true })
    );
    platform.receiveShadow = true;
    platformRoot.add(platform);

    const contact = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshBasicMaterial({ color: 0x7e848b, transparent: true, opacity: 0.095, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.scale.set(0.76, 0.76, 0.76);
    contact.position.y = 0.021;
    platformRoot.add(contact);
    scene.add(platformRoot);

    let modelRadius = 1;
    let rafId = 0;
    let framesAfterChange = 0;
    let sceneReady = false;
    let viewportPaused = false;
    let documentPaused = document.hidden;

    function render() {
      renderer.render(scene, camera);
    }

    function layoutParts() {
      if (!state.parts.length) return;

      modelRoot.updateWorldMatrix(true, true);
      const gap = modelRadius * (smallViewport.matches ? 0.055 : 0.042);
      const minCell = modelRadius * 0.035;
      const boxes = state.parts.map((part, index) => {
        const box = new THREE.Box3().setFromObject(part.mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const origin = part.mesh.getWorldPosition(new THREE.Vector3());
        return {
          part,
          index,
          center,
          originOffset: center.clone().sub(origin),
          width: Math.max(size.x, minCell),
          height: Math.max(size.y, minCell),
        };
      });

      const totalArea = boxes.reduce((sum, item) => sum + (item.width + gap) * (item.height + gap), 0);
      const aspect = Math.max(0.72, Math.min(1.9, stage.clientWidth / Math.max(1, stage.clientHeight)));
      const targetWidth = Math.sqrt(totalArea * aspect) * 1.22;
      const sorted = boxes.slice().sort((a, b) => b.height - a.height || b.width - a.width || a.index - b.index);

      let cursorX = 0;
      let cursorY = 0;
      let rowHeight = 0;
      let packedWidth = 0;

      for (const item of sorted) {
        if (cursorX > 0 && cursorX + item.width > targetWidth) {
          cursorX = 0;
          cursorY += rowHeight + gap;
          rowHeight = 0;
        }
        item.x = cursorX + item.width * 0.5;
        item.y = -(cursorY + item.height * 0.5);
        cursorX += item.width + gap;
        rowHeight = Math.max(rowHeight, item.height);
        packedWidth = Math.max(packedWidth, cursorX - gap);
      }

      const packedHeight = cursorY + rowHeight;
      const centerX = packedWidth * 0.5;
      const centerY = -packedHeight * 0.5;
      const planeZ = 0;
      const desiredOrigin = new THREE.Vector3();

      for (const item of boxes) {
        desiredOrigin.set(
          item.x - centerX - item.originOffset.x,
          item.y - centerY - item.originOffset.y,
          planeZ - item.originOffset.z
        );
        const parent = item.part.mesh.parent || modelRoot;
        item.part.explodedLocal.copy(parent.worldToLocal(desiredOrigin.clone()));
      }

      state.inventory.width = packedWidth;
      state.inventory.height = packedHeight;
      state.inventory.center = new THREE.Vector3(0, 0, 0);
      updateInventoryCamera();
    }

    function updateInventoryCamera() {
      const aspect = Math.max(0.1, camera.aspect);
      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const verticalDistance = state.inventory.height / (2 * Math.tan(halfFov));
      const horizontalDistance = state.inventory.width / (2 * Math.tan(halfFov) * aspect);
      const distance = Math.max(verticalDistance, horizontalDistance) * (smallViewport.matches ? 1.16 : 1.1);
      state.inventoryTarget = new THREE.Vector3(0, 0, 0);
      state.inventoryCamera = new THREE.Vector3(0, 0, Math.max(distance, modelRadius * 2.4));
    }

    function prepareModel(model) {
      const initialBounds = new THREE.Box3().setFromObject(model);
      const initialCenter = initialBounds.getCenter(new THREE.Vector3());
      model.position.sub(initialCenter);
      modelRoot.updateWorldMatrix(true, true);

      const bounds = new THREE.Box3().setFromObject(modelRoot);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      modelRadius = Math.max(size.x, size.y, size.z) * 0.5;

      const meshes = [];
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = !smallViewport.matches;
        object.receiveShadow = true;
        meshes.push(object);
      });

      state.parts = meshes.map((mesh) => ({
        mesh,
        homeLocal: mesh.position.clone(),
        explodedLocal: mesh.position.clone(),
      }));

      partCount.textContent = `${state.parts.length}-part digital model`;

      const distance = (modelRadius / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) * (smallViewport.matches ? 1.95 : 2);
      const target = center.clone();
      target.y -= modelRadius * 0.08;
      state.homeTarget = target.clone();
      state.homeCamera = new THREE.Vector3(center.x + modelRadius * 0.12, center.y + modelRadius * 0.18, center.z + distance);

      camera.position.copy(state.homeCamera);
      controls.target.copy(state.homeTarget);
      controls.minDistance = distance * 0.42;
      controls.maxDistance = Math.max(distance * 5, modelRadius * 12);
      camera.near = Math.max(0.001, modelRadius * 0.01);
      camera.far = Math.max(50, distance * 25);
      camera.updateProjectionMatrix();

      const platformY = bounds.min.y - modelRadius * 0.045;
      platformRoot.position.set(center.x, platformY, center.z);
      platformRoot.scale.set(modelRadius * 1.12, modelRadius * 0.14, modelRadius * 0.88);

      layoutParts();
      controls.saveState();
    }

    function guideCamera(value) {
      if (!state.homeCamera || !state.inventoryCamera) return;
      const t = ease(value);
      camera.position.lerpVectors(state.homeCamera, state.inventoryCamera, t);
      controls.target.lerpVectors(state.homeTarget, state.inventoryTarget, t);
      controls.enableRotate = value < 0.9;
      controls.enablePan = value > 0.78;
    }

    function updateScene() {
      const speed = reduceMotion.matches ? 1 : 0.115;
      state.current += (state.target - state.current) * speed;
      if (Math.abs(state.target - state.current) < 0.0008) {
        state.current = state.target;
        state.guidingCamera = false;
      }

      const t = ease(state.current);
      for (const part of state.parts) {
        part.mesh.position.lerpVectors(part.homeLocal, part.explodedLocal, t);
      }

      platformRoot.visible = t < 0.985;
      platform.material.opacity = Math.max(0, 1 - t * 1.15);
      contact.material.opacity = Math.max(0, 0.095 * (1 - t * 1.3));
      if (state.guidingCamera) guideCamera(state.current);
      setMode(state.current);
      controls.update();
      render();
    }

    function tick() {
      if (!sceneReady || viewportPaused || documentPaused) {
        rafId = 0;
        return;
      }
      updateScene();
      const isAnimating = Math.abs(state.target - state.current) >= 0.0008 || state.guidingCamera;
      if (isAnimating || framesAfterChange > 0) {
        framesAfterChange = Math.max(0, framesAfterChange - 1);
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    }

    function startLoop() {
      if (!rafId && sceneReady && !viewportPaused && !documentPaused) rafId = requestAnimationFrame(tick);
    }

    function resize() {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallViewport.matches ? 1.35 : 1.8));
      renderer.setSize(width, height, false);
      if (sceneReady) {
        layoutParts();
        if (state.current > 0.9) guideCamera(state.current);
        render();
      }
    }

    function setView(view) {
      if (!state.homeCamera || state.current > 0.08) return;
      const distance = state.homeCamera.distanceTo(state.homeTarget);
      const positions = {
        front: new THREE.Vector3(0, modelRadius * 0.16, distance),
        side: new THREE.Vector3(distance, modelRadius * 0.16, 0),
        back: new THREE.Vector3(0, modelRadius * 0.16, -distance),
      };
      state.activeView = view;
      camera.position.copy(positions[view] || positions.front);
      controls.target.copy(state.homeTarget);
      controls.update();
      viewButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.flybuysView === view));
      render();
    }

    slider.addEventListener("input", (event) => {
      state.target = clamp01(Number(event.currentTarget.value) / 100);
      state.guidingCamera = true;
      setMode(state.target);
      startLoop();
    });

    resetButton.addEventListener("click", () => {
      slider.value = "0";
      state.target = 0;
      state.current = 0;
      state.guidingCamera = false;
      for (const part of state.parts) part.mesh.position.copy(part.homeLocal);
      camera.position.copy(state.homeCamera);
      controls.target.copy(state.homeTarget);
      controls.enableRotate = true;
      controls.enablePan = false;
      controls.update();
      setMode(0);
      setView("front");
      startLoop();
    });

    viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.flybuysView)));
    controls.addEventListener("change", () => {
      framesAfterChange = 8;
      startLoop();
    });

    canvas.addEventListener("keydown", (event) => {
      if (event.key === "Home") {
        resetButton.click();
        event.preventDefault();
      } else if (event.key === "End") {
        slider.value = "100";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        event.preventDefault();
      }
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    window.addEventListener("resize", resize, { passive: true });

    const visibilityObserver = new IntersectionObserver((entries) => {
      viewportPaused = !entries.some((entry) => entry.isIntersecting);
      if (viewportPaused && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else {
        startLoop();
      }
    }, { rootMargin: "160px 0px" });
    visibilityObserver.observe(root);

    document.addEventListener("visibilitychange", () => {
      documentPaused = document.hidden;
      if (documentPaused && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else {
        startLoop();
      }
    });

    resize();
    setProgress("Loading 3D model…");

    new GLTFLoader().load(
      MODEL_PATH,
      (gltf) => {
        modelRoot.add(gltf.scene);
        modelRoot.updateMatrixWorld(true);
        prepareModel(gltf.scene);
        sceneReady = true;
        root.setAttribute("data-state", "ready");
        stage.setAttribute("data-state", "ready");
        stage.removeAttribute("aria-busy");
        setMode(0);
        resize();
        controls.update();
        render();
        startLoop();
      },
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          setProgress(`Loading 3D model · ${Math.min(99, Math.round((event.loaded / event.total) * 100))}%`);
        }
      },
      (error) => {
        console.error(error);
        showError();
      }
    );
  }

  setMode(0);
  start();
})();
