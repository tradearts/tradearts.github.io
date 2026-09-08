(() => {
  const MODEL_PATH = "/assets/work/flybuys/flybuys-robot.glb";
  const THREE_RUNTIME = "/assets/work/flybuys/three/three.module.min.js";
  const ORBIT_PATH = "/assets/work/flybuys/three/examples/jsm/controls/OrbitControls.js";
  const GLTF_PATH = "/assets/work/flybuys/three/examples/jsm/loaders/GLTFLoader.js";

  const root = document.getElementById("flybuys-3d-viewer");
  if (!root) return;

  const stage = root.querySelector(".flybuys-3d-stage");
  const canvas = stage?.querySelector("canvas");
  const placeholder = root.querySelector(".flybuys-3d-placeholder");
  const loadButton = root.querySelector(".flybuys-3d-load-button");
  const controlsPanel = root.querySelector(".flybuys-3d-controls");
  const slider = root.querySelector(".flybuys-3d-explode");
  const statusText = root.querySelector(".flybuys-3d-controls__status");
  const resetButton = root.querySelector(".flybuys-3d-reset");
  const statusBox = root.querySelector(".flybuys-3d-status");
  const errorBox = root.querySelector(".flybuys-3d-error");
  const controlLabel = root.querySelector('label[for="flybuys-explode"]');
  const controlsHint = root.querySelector(".flybuys-3d-controls__hint");

  if (!stage || !canvas || !placeholder || !loadButton || !controlsPanel || !slider || !statusText || !resetButton || !statusBox || !errorBox || !controlLabel || !controlsHint) return;

  controlLabel.textContent = "Exploded view";
  controlsHint.textContent = "Assembled — Exploded";
  resetButton.textContent = "↺";
  resetButton.setAttribute("aria-label", "Reset 3D view");
  resetButton.setAttribute("title", "Reset 3D view");

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const smallViewport = window.matchMedia("(max-width: 767px)");

  let runtimePromise = null;
  let runtimeReady = false;
  let sceneReady = false;
  let isRuntimeLoading = false;
  let isControllerRunning = false;
  let rafId = 0;
  let visibilityStop = false;
  let viewportStop = false;
  let startRequested = false;

  const state = {
    target: 0,
    current: 0,
    parts: [],
    explodeScale: 0.6,
  };

  function clampPercent(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, num));
  }

  function setBusy(value) {
    stage.setAttribute("aria-busy", String(Boolean(value)));
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("is-visible");
    stage.style.display = "block";
    controlsPanel.style.display = "none";
    placeholder.style.display = "none";
    loadButton.style.display = "none";
    loadButton.disabled = false;
    loadButton.textContent = "Load 3D model";
    statusBox.textContent = "Static preview";
    statusText.textContent = "0%";
    stage.removeAttribute("data-state");
    setBusy(false);
  }

  function showLoaded() {
    statusBox.textContent = "Interactive 3D loaded";
    placeholder.style.display = "none";
    stage.style.display = "block";
    controlsPanel.style.display = "grid";
    loadButton.style.display = "none";
    errorBox.classList.remove("is-visible");
    stage.setAttribute("data-state", "ready");
  }

  function pauseLoop() {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    isControllerRunning = false;
    setBusy(false);
  }

  function canRender() {
    return sceneReady && !viewportStop && !visibilityStop;
  }

  function startLoop(context) {
    if (!canRender()) return;

    const speed = reduceMotionQuery.matches ? 1 : 0.2;
    const camera = context.camera;
    const renderer = context.renderer;
    const controls = context.controls;
    const scene = context.scene;
    const parts = state.parts;
    if (isControllerRunning) return;

    function tick() {
      if (!canRender()) {
        isControllerRunning = false;
        rafId = 0;
        return;
      }

      rafId = requestAnimationFrame(tick);
      isControllerRunning = true;

      state.current += (state.target - state.current) * speed;
      if (Math.abs(state.target - state.current) < 0.001) {
        state.current = state.target;
      }

      if (Math.abs(state.current - Number(statusText.textContent.replace("%", "")) / 100) > 0.001) {
        statusText.textContent = `${Math.round(state.current * 100)}%`;
      }

      setBusy(state.target !== state.current);

      for (const part of parts) {
        part.mesh.position.lerpVectors(part.homeLocal, part.explodedLocal, state.current);
      }

      controls.update();
      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(tick);
    isControllerRunning = true;
  }

  function updateLayout(context) {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);

    const camera = context.camera;
    const renderer = context.renderer;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function buildViewer({ THREE, OrbitControls, GLTFLoader }) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !smallViewport.matches,
      alpha: false,
      powerPreference: smallViewport.matches ? "low-power" : "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallViewport.matches ? 1.4 : 2));
    renderer.setClearColor(0xefefef, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.01, 240);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x273449, 1.5);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    const fill = new THREE.DirectionalLight(0x9ec8ff, 1.1);
    const rim = new THREE.DirectionalLight(0xffd8bd, 1.25);
    key.position.set(1, 2, 1.6);
    fill.position.set(-0.9, 0.7, -1.4);
    rim.position.set(-1.4, 1.6, 1);
    scene.add(ambient, key, fill, rim);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    function centreAndPrepareModel(model) {
      const modelBounds = new THREE.Box3().setFromObject(model);
      const modelCenter = modelBounds.getCenter(new THREE.Vector3());
      const modelSize = modelBounds.getSize(new THREE.Vector3());
      const modelRadius = Math.max(0.001, Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.5);

      model.position.sub(modelCenter);
      modelRoot.updateWorldMatrix(true, true);

      const targetDistance = modelRadius * 0.95;
      const centredBounds = new THREE.Box3().setFromObject(modelRoot);
      const modelWorldCenter = centredBounds.getCenter(new THREE.Vector3());
      const meshWorldCenter = new THREE.Vector3();
      const worldPos = new THREE.Vector3();
      const worldTarget = new THREE.Vector3();
      const direction = new THREE.Vector3();

      state.parts = [];
      state.explodeScale = targetDistance;

      model.traverse((mesh) => {
        if (!mesh.isMesh) return;

        const bounds = new THREE.Box3().setFromObject(mesh);
        bounds.getCenter(meshWorldCenter);

        const parent = mesh.parent || modelRoot;
        const homeWorld = mesh.getWorldPosition(worldPos);
        const normalised = direction
          .subVectors(meshWorldCenter, modelWorldCenter)
          .normalize();

        if (!Number.isFinite(normalised.lengthSq()) || normalised.lengthSq() === 0) {
          normalised.set(0, 1, 0);
        }

        parent.worldToLocal(worldTarget.copy(homeWorld).addScaledVector(normalised, targetDistance));

        state.parts.push({
          mesh,
          homeLocal: mesh.position.clone(),
          explodedLocal: worldTarget.clone(),
        });
      });

      const distance = (modelRadius / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) * 1.7;
      const viewTarget = modelWorldCenter.clone();
      viewTarget.y -= modelRadius * 0.18;
      controls.target.copy(viewTarget);
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 5;

      camera.position.set(modelWorldCenter.x, modelWorldCenter.y, modelWorldCenter.z + distance);
      camera.near = Math.max(0.001, modelRadius * 0.02);
      camera.far = Math.max(10, distance * 20);
      camera.updateProjectionMatrix();
      controls.update();
      controls.saveState();

      return modelRadius;
    }

    const context = {
      scene,
      camera,
      renderer,
      controls,
      resizeObserver: null,
      intersectionObserver: null,
      modelRadius: 1,
    };

    function loadModel() {
      statusBox.textContent = "Loading model…";
      stage.setAttribute("data-state", "loading");
      sceneReady = false;
      setBusy(true);

      const loader = new GLTFLoader();
      loader.load(MODEL_PATH, (gltf) => {
        const model = gltf.scene;
        modelRoot.clear();
        modelRoot.add(model);
        modelRoot.updateMatrixWorld(true, true);

        const radius = centreAndPrepareModel(model);
        context.modelRadius = radius;

        state.target = 0;
        state.current = 0;
        slider.value = "0";
        statusText.textContent = "0%";

        updateLayout(context);
        showLoaded();
        sceneReady = true;
        setBusy(false);
        controls.update();
        startLoop(context);
      }, undefined, (error) => {
        console.error(error);
        sceneReady = false;
        setBusy(false);
        showError("Unable to load the 3D model right now. Please refresh the page to try again.");
      });
    }

    function connectControls() {
      let lastSet = 0;

      slider.addEventListener("input", (event) => {
        const value = clampPercent(event.currentTarget.value);
        state.target = value / 100;
        statusText.textContent = `${value}%`;
        stage.setAttribute("data-state", "ready");

        const now = performance.now();
        if (now - lastSet > 16) {
          startLoop(context);
          lastSet = now;
        }
      });

      slider.addEventListener("change", () => {
        stage.setAttribute("data-state", "ready");
        statusText.textContent = `${Math.round(state.current * 100)}%`;
      });

      resetButton.addEventListener("click", () => {
        statusText.textContent = "0%";
        slider.value = "0";
        state.target = 0;
        controls.reset();
        modelRoot.rotation.set(0, 0, 0);
        state.current = 0;
        stage.setAttribute("data-state", "ready");
        startLoop(context);
      });

      canvas.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 0.2 : 0.1;
        if (event.key === "ArrowLeft") modelRoot.rotation.y -= step;
        else if (event.key === "ArrowRight") modelRoot.rotation.y += step;
        else if (event.key === "ArrowUp") modelRoot.rotation.x -= step;
        else if (event.key === "ArrowDown") modelRoot.rotation.x += step;
        else return;

        event.preventDefault();
        startLoop(context);
      });

      const onResize = () => {
        updateLayout(context);
      };

      window.addEventListener("resize", onResize);
      context.windowResizeCleanup = onResize;

      context.resizeObserver = new ResizeObserver(onResize);
      context.resizeObserver.observe(stage);
    }

    function bindVisibilityPause() {
      const handleVisibility = () => {
        visibilityStop = document.hidden;
        if (visibilityStop) {
          pauseLoop();
        } else if (canRender()) {
          startLoop(context);
        }
      };

      const rootObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          viewportStop = !entry.isIntersecting;
          if (viewportStop) {
            pauseLoop();
          } else if (canRender()) {
            startLoop(context);
          }
        }
      }, {
        rootMargin: "200px 0px",
      });

      document.addEventListener("visibilitychange", handleVisibility);
      context.visibilityCleanup = handleVisibility;
      context.intersectionObserver = rootObserver;
      rootObserver.observe(root);
    }

    connectControls();
    bindVisibilityPause();
    loadModel();
  }

  async function loadRuntime() {
    if (runtimeReady) return runtimeReady;
    if (runtimePromise) return runtimePromise;
    if (isRuntimeLoading) return runtimePromise;

    isRuntimeLoading = true;
    runtimePromise = Promise.all([
      import(THREE_RUNTIME),
      import(ORBIT_PATH),
      import(GLTF_PATH),
    ]).then(([THREE, orbitControls, gltfLoader]) => {
      runtimeReady = {
        THREE,
        OrbitControls: orbitControls.OrbitControls,
        GLTFLoader: gltfLoader.GLTFLoader,
      };
      return runtimeReady;
    }).finally(() => {
      isRuntimeLoading = false;
    });

    return runtimePromise;
  }

  async function startViewer() {
    if (sceneReady || isRuntimeLoading || startRequested) return;

    startRequested = true;
    loadButton.disabled = true;
    loadButton.textContent = "Loading 3D…";
    setBusy(true);

    try {
      const runtime = await loadRuntime();
      setBusy(false);
      runtimeReady = runtime;
      buildViewer(runtime);
      loadButton.disabled = false;
      statusBox.textContent = "Loading model…";
    } catch (error) {
      console.error(error);
      startRequested = false;
      setBusy(false);
      loadButton.disabled = false;
      loadButton.textContent = "Load 3D model";
      showError("The interactive model failed to load. Please refresh the page to try again.");
    }
  }

  placeholder.style.display = "none";
  loadButton.style.display = "none";
  stage.style.display = "block";
  stage.setAttribute("data-state", "loading");
  statusBox.textContent = "Loading model…";
  statusText.textContent = "0%";

  const autoLoadObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        autoLoadObserver.disconnect();
        startViewer();
        break;
      }
    }
  }, {
    rootMargin: "400px 0px",
  });
  autoLoadObserver.observe(root);
})();
