/* ============================================================
   DGX SPARK — real-time 3D viewer
   Built on Three.js + the free DGX Spark visualisation model by
   Wendy Labs (wendy.dev). The GLB is embedded by the page so that
   index.html also works when opened directly from disk.
   ============================================================ */

(function () {
  "use strict";

  const { THREE, GLTFLoader } = window.Spark3D || {};
  if (!THREE || !GLTFLoader) {
    throw new Error("Three.js runtime is unavailable");
  }

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const radToDeg = (rad) => (rad * 180) / Math.PI;
  const degToRad = (deg) => (deg * Math.PI) / 180;

  function decodeBase64(base64) {
    const binary = window.atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function makeCanvasTexture(width, height, draw, colorSpace = true) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  function makeLabelTexture(text, sub, options = {}) {
    const width = options.w || 512;
    const height = options.h || 256;
    return makeCanvasTexture(width, height, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = options.color || "rgba(25,31,25,.8)";
      ctx.font = `600 ${options.size || 88}px "Bahnschrift","Segoe UI",sans-serif`;
      ctx.fillText(text, w / 2, sub ? h * 0.42 : h / 2);
      if (sub) {
        ctx.fillStyle = options.subColor || "rgba(25,31,25,.48)";
        ctx.font = `500 ${options.subSize || 24}px "Cascadia Mono","Consolas",monospace`;
        ctx.fillText(sub, w / 2, h * 0.62);
      }
    });
  }

  class SparkViewer {
    constructor(canvas, options = {}) {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("SparkViewer requires a canvas element");
      }

      this.canvas = canvas;
      this.viewport = canvas.parentElement;
      this.onReady = typeof options.onReady === "function" ? options.onReady : () => {};
      this.onError = typeof options.onError === "function" ? options.onError : () => {};
      this.onFrame = typeof options.onFrame === "function" ? options.onFrame : () => {};

      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.state = {
        yaw: degToRad(-9),
        pitch: degToRad(1.5),
        zoom: 1,
        targetYaw: degToRad(-9),
        targetPitch: degToRad(1.5),
        targetZoom: 1,
        auto: !this.reduceMotion,
        hovering: false,
        dragging: false,
        mode: "exterior",
        loaded: false
      };

      this.viewDirection = new THREE.Vector3(0.47, 0.30, 0.82).normalize();
      this.baseDistance = 0.38;
      this.localBounds = new THREE.Box3(
        new THREE.Vector3(-0.075, -0.02525, -0.075),
        new THREE.Vector3(0.075, 0.02525, 0.075)
      );

      this.shellMaterials = [];
      this.cutY = 0.026;
      this.cutTarget = 0.026;
      this.lastTime = performance.now();
      this.lastReadoutUpdate = 0;
      this._resizeObserver = null;

      this._initRenderer();
      this._initScene();
      this._initGroup();
      this._initLights();
      this._buildInternals();
      this._buildHeat();
      this._initResize();
      this._loadModel();
      this._loop = this._loop.bind(this);
      this._raf = window.requestAnimationFrame(this._loop);
    }

    /* ----------------------------------------------------------
       setup
       ---------------------------------------------------------- */

    _initRenderer() {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.02;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.localClippingEnabled = true;
      this.renderer.setSize(1, 1, false);
    }

    _initScene() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(26, 1.5, 0.005, 10);
      this.camera.position.copy(this.viewDirection).multiplyScalar(0.38);
      this.camera.lookAt(0, 0, 0);

      this.scene.environment = this._createEnvironment();
      this.scene.environmentIntensity = 0.92;

      this.cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.02);
    }

    _initGroup() {
      this.group = new THREE.Group();
      this.scene.add(this.group);

      this.cutLine = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.0755, 0, -0.0755),
          new THREE.Vector3(0.0755, 0, -0.0755),
          new THREE.Vector3(0.0755, 0, 0.0755),
          new THREE.Vector3(-0.0755, 0, 0.0755)
        ]),
        new THREE.LineBasicMaterial({
          color: 0xb6f24a,
          transparent: true,
          opacity: 0.55,
          depthWrite: false
        })
      );
      this.cutLine.visible = false;
      this.cutLine.renderOrder = 4;
      this.group.add(this.cutLine);
    }

    _initLights() {
      this.scene.add(new THREE.HemisphereLight(0xc9ead7, 0x06100b, 0.42));

      this.keyLight = new THREE.DirectionalLight(0xfff1d3, 2.9);
      this.keyLight.position.set(-0.5, 0.9, 0.7);
      this.scene.add(this.keyLight);

      this.rimLight = new THREE.DirectionalLight(0xbaffdf, 2.5);
      this.rimLight.position.set(0.8, 0.3, -0.8);
      this.scene.add(this.rimLight);

      this.fillLight = new THREE.DirectionalLight(0xffd29b, 1.0);
      this.fillLight.position.set(-0.7, 0.15, -0.4);
      this.scene.add(this.fillLight);

      this.insideLight = new THREE.PointLight(0x99ffd0, 0.22, 0.24, 2);
      this.insideLight.position.set(0.008, 0.028, 0.008);
      this.scene.add(this.insideLight);
    }

    _createEnvironment() {
      const texture = makeCanvasTexture(1024, 512, (ctx, w, h) => {
        const base = ctx.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0, "#07100d");
        base.addColorStop(0.32, "#17261f");
        base.addColorStop(0.53, "#67776a");
        base.addColorStop(0.66, "#18231d");
        base.addColorStop(1, "#030706");
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);

        // warm main softbox
        const key = ctx.createLinearGradient(80, 100, 460, 320);
        key.addColorStop(0, "rgba(255,248,232,1)");
        key.addColorStop(0.5, "rgba(255,236,201,0.6)");
        key.addColorStop(1, "rgba(255,236,201,0)");
        ctx.fillStyle = key;
        ctx.beginPath();
        ctx.ellipse(260, 205, 300, 85, -0.08, 0, TAU);
        ctx.fill();

        // green rim light
        const cool = ctx.createLinearGradient(780, 120, 1000, 300);
        cool.addColorStop(0, "rgba(159,255,209,0.55)");
        cool.addColorStop(0.5, "rgba(104,220,170,0.14)");
        cool.addColorStop(1, "rgba(72,160,122,0)");
        ctx.fillStyle = cool;
        ctx.beginPath();
        ctx.ellipse(880, 190, 180, 48, 0.1, 0, TAU);
        ctx.fill();

        // champagne bounce at the horizon
        const bounce = ctx.createLinearGradient(0, 330, 0, h);
        bounce.addColorStop(0, "rgba(214,178,112,0)");
        bounce.addColorStop(0.72, "rgba(214,178,112,0.18)");
        bounce.addColorStop(1, "rgba(214,178,112,0.32)");
        ctx.fillStyle = bounce;
        ctx.fillRect(0, 330, w, h - 330);
        ctx.fillStyle = "rgba(210,255,230,0.09)";
        ctx.fillRect(0, 320, w, 2);
      });

      texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const env = pmrem.fromEquirectangular(texture).texture;
      texture.dispose();
      pmrem.dispose();
      return env;
    }

    _initResize() {
      this._resize = () => this.resize();
      if (typeof ResizeObserver === "function") {
        this._resizeObserver = new ResizeObserver(this._resize);
        this._resizeObserver.observe(this.viewport);
      }
      window.addEventListener("resize", this._resize);
      this.resize();
    }

    resize() {
      if (!this.viewport) return;
      const width = Math.max(1, Math.floor(this.viewport.clientWidth));
      const height = Math.max(1, Math.floor(this.viewport.clientHeight));
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      if (this.modelRoot) this._fitCamera();
    }

    /* ----------------------------------------------------------
       model load + camera
       ---------------------------------------------------------- */

    _loadModel() {
      const loader = new GLTFLoader();
      const onError = (error) => {
        console.error("DGX Spark model could not be loaded", error);
        this.onError(error);
      };

      const parse = (buffer) => {
        loader.parse(buffer, "", (gltf) => {
          try {
            this._onModelLoaded(gltf);
          } catch (error) {
            onError(error);
          }
        }, onError);
      };

      try {
        if (window.DGX_SPARK_GLB_BASE64) {
          parse(decodeBase64(window.DGX_SPARK_GLB_BASE64));
        } else {
          fetch("assets/dgx-spark-optimized.glb")
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.arrayBuffer();
            })
            .then(parse)
            .catch(onError);
        }
      } catch (error) {
        onError(error);
      }
    }

    _onModelLoaded(gltf) {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      model.position.sub(center);
      this.localBounds = new THREE.Box3(
        new THREE.Vector3(-size.x / 2, -size.y / 2, -size.z / 2),
        new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2)
      );

      this.shellMaterials = [];
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        object.castShadow = false;
        object.receiveShadow = false;

        const cloneMaterial = (source) => {
          const material = source.clone();
          material.envMapIntensity = 1.2;
          material.needsUpdate = true;
          this.shellMaterials.push({
            material,
            original: {
              transparent: source.transparent,
              opacity: source.opacity,
              depthWrite: source.depthWrite,
              metalness: source.metalness,
              roughness: source.roughness,
              envMapIntensity: material.envMapIntensity,
              clippingPlanes: source.clippingPlanes,
              side: source.side
            }
          });
          return material;
        };

        if (Array.isArray(object.material)) {
          object.material = object.material.map(cloneMaterial);
        } else {
          object.material = cloneMaterial(object.material);
        }
      });

      this.modelRoot = model;
      this.group.add(model);
      this.group.rotation.set(this.state.pitch, this.state.yaw, 0);
      this.group.updateMatrixWorld(true);

      this._fitCamera();
      this._applyMode(this.state.mode, true);
      this.state.loaded = true;
      this.onReady();
    }

    _fitCamera() {
      if (!this.viewport || !this.modelRoot) return;
      const width = Math.max(1, this.viewport.clientWidth);
      const height = Math.max(1, this.viewport.clientHeight);
      const mobile = width < 700;
      const targetX = mobile ? 0.93 : 0.75;
      const targetY = mobile ? 0.63 : 0.77;

      let distance = 0.4;
      const corners = [];
      for (const x of [this.localBounds.min.x, this.localBounds.max.x]) {
        for (const y of [this.localBounds.min.y, this.localBounds.max.y]) {
          for (const z of [this.localBounds.min.z, this.localBounds.max.z]) {
            corners.push(new THREE.Vector3(x, y, z));
          }
        }
      }

      for (let iteration = 0; iteration < 4; iteration += 1) {
        this.camera.position.copy(this.viewDirection).multiplyScalar(distance);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateMatrixWorld(true);

        let maxX = 0;
        let maxY = 0;
        for (const corner of corners) {
          const projected = corner.clone().applyMatrix4(this.group.matrixWorld).project(this.camera);
          maxX = Math.max(maxX, Math.abs(projected.x));
          maxY = Math.max(maxY, Math.abs(projected.y));
        }

        const ratio = Math.max(maxX / targetX, maxY / targetY, 0.001);
        distance *= ratio;
        if (Math.abs(ratio - 1) < 0.015) break;
      }

      this.baseDistance = clamp(distance, 0.17, 1.4);
      this._applyCameraPosition();
    }

    _applyCameraPosition() {
      this.camera.position.copy(this.viewDirection).multiplyScalar(this.baseDistance / this.state.zoom);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld(true);
    }

    /* ----------------------------------------------------------
       procedural internals
       ---------------------------------------------------------- */

    _buildInternals() {
      const internals = new THREE.Group();
      internals.visible = false;
      this.internals = internals;

      const PCB_SIZE = 0.136;
      const boardMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a1d13,
        roughness: 0.48,
        metalness: 0.24
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(PCB_SIZE, 0.0024, PCB_SIZE), boardMaterial);
      board.position.y = 0.0028;
      internals.add(board);

      const pcbTexture = makeCanvasTexture(1024, 1024, (ctx, w, h) => {
        ctx.fillStyle = "#081910";
        ctx.fillRect(0, 0, w, h);
        const glow = ctx.createRadialGradient(512, 512, 30, 512, 512, 730);
        glow.addColorStop(0, "rgba(57,112,75,.24)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        let seed = 47;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return seed / 2147483647;
        };

        ctx.strokeStyle = "rgba(180,150,82,.3)";
        ctx.lineWidth = 1.1;
        for (let i = 0; i < 150; i += 1) {
          let x = Math.floor((rand() * w) / 16) * 16;
          let y = Math.floor((rand() * h) / 16) * 16;
          ctx.beginPath();
          ctx.moveTo(x, y);
          const steps = 2 + Math.floor(rand() * 4);
          for (let step = 0; step < steps; step += 1) {
            if (rand() > 0.5) x += (rand() > 0.5 ? 1 : -1) * (16 + Math.floor(rand() * 5) * 16);
            else y += (rand() > 0.5 ? 1 : -1) * (16 + Math.floor(rand() * 5) * 16);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          if (i % 9 === 0) {
            ctx.fillStyle = "rgba(214,178,90,.5)";
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, TAU);
            ctx.fill();
          }
        }

        ctx.strokeStyle = "rgba(195,220,190,.18)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 46; i += 1) {
          const x = rand() * 940;
          const y = rand() * 940;
          ctx.strokeRect(x, y, 12 + rand() * 42, 8 + rand() * 22);
        }

        ctx.font = '500 18px "Cascadia Mono","Consolas",monospace';
        ctx.fillStyle = "rgba(189,220,178,.42)";
        ctx.fillText("NVIDIA DGX SPARK · P4242", 38, 988);
        ctx.fillText("GB10 / LPDDR5X / CX-7", 718, 988);
      }, true);

      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(PCB_SIZE - 0.002, PCB_SIZE - 0.002),
        new THREE.MeshStandardMaterial({
          map: pcbTexture,
          roughness: 0.55,
          metalness: 0.14
        })
      );
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.00405;
      internals.add(top);

      const silver = new THREE.MeshStandardMaterial({ color: 0xc4cbbf, roughness: 0.27, metalness: 0.95 });
      const silverDark = new THREE.MeshStandardMaterial({ color: 0x5f6a5f, roughness: 0.35, metalness: 0.82 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x101510, roughness: 0.42, metalness: 0.42 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xb38a35, roughness: 0.26, metalness: 0.95 });
      const connector = new THREE.MeshStandardMaterial({ color: 0x3d3c33, roughness: 0.3, metalness: 0.74 });

      const gbFrame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.0014, 0.038), gold);
      gbFrame.position.set(0, 0.0055, 0.002);
      internals.add(gbFrame);

      const gb = new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.004, 0.033), silver);
      gb.position.set(0, 0.0079, 0.002);
      internals.add(gb);

      const gbTop = new THREE.Mesh(
        new THREE.PlaneGeometry(0.039, 0.029),
        new THREE.MeshStandardMaterial({
          map: makeLabelTexture("GB10", "GRACE BLACKWELL", {
            size: 96,
            subSize: 20,
            color: "rgba(21,28,21,.8)",
            subColor: "rgba(21,28,21,.42)"
          }),
          roughness: 0.4,
          metalness: 0.62
        })
      );
      gbTop.rotation.x = -Math.PI / 2;
      gbTop.position.set(0, 0.00995, 0.002);
      internals.add(gbTop);

      for (let row = 0; row < 4; row += 1) {
        const z = -0.028 + row * 0.019;
        [-1, 1].forEach((side) => {
          const memory = new THREE.Mesh(new THREE.BoxGeometry(0.0125, 0.0022, 0.0105), dark);
          memory.position.set(side * 0.0355, 0.0065, z);
          internals.add(memory);

          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.0128, 0.0004, 0.0108), silverDark);
          edge.position.set(side * 0.0355, 0.00775, z);
          internals.add(edge);
        });
      }

      const cx7 = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.0028, 0.014), silverDark);
      cx7.position.set(0.026, 0.0066, -0.049);
      internals.add(cx7);

      const cx7Top = new THREE.Mesh(
        new THREE.PlaneGeometry(0.017, 0.012),
        new THREE.MeshStandardMaterial({
          map: makeLabelTexture("CX-7", "CONNECTX-7", {
            size: 120,
            subSize: 24,
            color: "rgba(22,28,22,.74)",
            subColor: "rgba(22,28,22,.4)"
          }),
          roughness: 0.4,
          metalness: 0.55
        })
      );
      cx7Top.rotation.x = -Math.PI / 2;
      cx7Top.position.set(0.026, 0.00815, -0.049);
      internals.add(cx7Top);

      const ssd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.0022, 0.012), dark);
      ssd.position.set(-0.032, 0.0064, 0.044);
      internals.add(ssd);

      const ssdTop = new THREE.Mesh(
        new THREE.PlaneGeometry(0.025, 0.0075),
        new THREE.MeshStandardMaterial({
          map: makeLabelTexture("4 TB NVMe", "M.2 2242", {
            w: 512,
            h: 220,
            size: 64,
            subSize: 24,
            color: "rgba(181,212,172,.75)",
            subColor: "rgba(181,212,172,.36)"
          }),
          roughness: 0.55,
          metalness: 0.3
        })
      );
      ssdTop.rotation.x = -Math.PI / 2;
      ssdTop.position.set(-0.032, 0.0076, 0.044);
      internals.add(ssdTop);

      for (let i = 0; i < 18; i += 1) {
        const part = new THREE.Mesh(
          new THREE.BoxGeometry(0.005 + (i % 3) * 0.002, 0.0022, 0.006),
          i % 4 === 0 ? connector : dark
        );
        part.position.set(-0.064 + ((i * 0.013) % 0.128), 0.0062, -0.061 + (i % 3) * 0.012);
        internals.add(part);
      }

      for (let i = 0; i < 12; i += 1) {
        const capacitor = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.003), connector);
        capacitor.position.set(-0.06 + i * 0.011, 0.0066, 0.06);
        internals.add(capacitor);
      }

      const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.005, 0.007), connector);
      rearBlock.position.set(0.012, 0.007, -0.063);
      internals.add(rearBlock);

      internals.traverse((object) => {
        if (object.isMesh) {
          object.renderOrder = 1;
          object.frustumCulled = false;
        }
      });

      this.group.add(internals);
    }

    _buildHeat() {
      const heatTexture = makeCanvasTexture(512, 512, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,74,22,0.1)";
        ctx.fillRect(0, 0, w, h);
        const spots = [
          [256, 226, 190, 0.95],
          [146, 292, 128, 0.58],
          [370, 296, 122, 0.5],
          [318, 398, 88, 0.32],
          [220, 382, 78, 0.28]
        ];
        ctx.globalCompositeOperation = "lighter";
        for (const [x, y, radius, alpha] of spots) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, `rgba(255,48,16,${alpha})`);
          gradient.addColorStop(0.34, `rgba(255,114,21,${alpha * 0.78})`);
          gradient.addColorStop(0.65, `rgba(255,193,47,${alpha * 0.32})`);
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, TAU);
          ctx.fill();
        }
      }, true);

      this.heatMaterial = new THREE.MeshBasicMaterial({
        map: heatTexture,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.heat = new THREE.Mesh(new THREE.PlaneGeometry(0.148, 0.148), this.heatMaterial);
      this.heat.rotation.x = -Math.PI / 2;
      this.heat.position.y = 0.02555;
      this.heat.visible = false;
      this.heat.renderOrder = 3;
      this.group.add(this.heat);

      this.heatGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.153, 0.153),
        new THREE.MeshBasicMaterial({
          map: heatTexture,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      this.heatGlow.rotation.x = -Math.PI / 2;
      this.heatGlow.position.y = 0.02565;
      this.heatGlow.visible = false;
      this.heatGlow.renderOrder = 4;
      this.group.add(this.heatGlow);
    }

    /* ----------------------------------------------------------
       modes and materials
       ---------------------------------------------------------- */

    _applyMode(mode, immediate = false) {
      const isXray = mode === "xray";
      const isCutaway = mode === "cutaway";
      const showInternals = isXray || isCutaway;

      this.internals.visible = showInternals;
      this.heat.visible = mode === "thermal";
      this.heatGlow.visible = mode === "thermal";
      this.cutLine.visible = isCutaway;

      for (const entry of this.shellMaterials) {
        const { material, original } = entry;
        material.clippingPlanes = isCutaway ? [this.cutPlane] : [];
        material.clipShadows = false;
        material.colorWrite = true;

        if (isXray) {
          material.transparent = true;
          material.opacity = 0.082;
          material.depthWrite = false;
          material.metalness = 0.32;
          material.roughness = 0.3;
          material.envMapIntensity = 1.35;
        } else {
          material.transparent = original.transparent;
          material.opacity = original.opacity;
          material.depthWrite = original.depthWrite;
          material.metalness = original.metalness;
          material.roughness = original.roughness;
          material.envMapIntensity = original.envMapIntensity;
        }
        material.needsUpdate = true;
      }

      if (isCutaway) {
        if (this.state.mode !== "cutaway" || immediate) {
          this.cutY = 0.0262;
          this.cutTarget = 0.0128;
        }
        this.cutLine.material.opacity = 0.6;
      } else {
        this.cutTarget = 0.0262;
        this.cutLine.material.opacity = 0;
      }

      this.insideLight.intensity = showInternals ? 0.55 : 0.22;
      this.insideLight.color.set(isXray ? 0x9dffd1 : 0xffc873);
    }

    setMode(mode) {
      if (!["exterior", "cutaway", "xray", "thermal"].includes(mode)) return;
      if (this.state.mode === mode) return;
      this.state.mode = mode;
      this._applyMode(mode);
      if (mode === "cutaway" && this.state.loaded) {
        this.cutY = 0.0262;
        this.cutTarget = 0.0128;
      }
    }

    /* ----------------------------------------------------------
       view + interaction API
       ---------------------------------------------------------- */

    setTargetView(view) {
      if (!view) return;
      const targetYaw = degToRad(view.yaw ?? radToDeg(this.state.targetYaw));
      let delta = targetYaw - this.state.targetYaw;
      delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
      this.state.targetYaw += delta;
      this.state.targetPitch = degToRad(view.pitch ?? 0);
      this.state.targetZoom = clamp(view.zoom ?? 1, 0.72, 1.6);
    }

    rotateBy(dx, dy) {
      this.state.targetYaw += dx * 0.0062;
      this.state.targetPitch = clamp(
        this.state.targetPitch - dy * 0.0032,
        degToRad(-16),
        degToRad(28)
      );
    }

    zoomBy(factor) {
      this.state.targetZoom = clamp(this.state.targetZoom * factor, 0.72, 1.6);
    }

    setAuto(enabled) {
      this.state.auto = Boolean(enabled);
    }

    setHovering(hovering) {
      this.state.hovering = Boolean(hovering);
    }

    setDragging(dragging) {
      this.state.dragging = Boolean(dragging);
    }

    resetView() {
      this.setTargetView({ yaw: -9, pitch: 1.5, zoom: 1 });
    }

    getView() {
      return {
        yaw: this.state.yaw,
        pitch: this.state.pitch,
        zoom: this.state.zoom,
        mode: this.state.mode,
        ready: this.state.loaded
      };
    }

    project(point) {
      if (!this.state.loaded) return null;
      const vector = new THREE.Vector3(point[0], point[1], point[2]);
      vector.applyMatrix4(this.group.matrixWorld).project(this.camera);
      const rect = this.viewport.getBoundingClientRect();
      return {
        x: (vector.x * 0.5 + 0.5) * rect.width,
        y: (-vector.y * 0.5 + 0.5) * rect.height,
        z: vector.z,
        visible: vector.z < 1 && Math.abs(vector.x) < 1.25 && Math.abs(vector.y) < 1.25
      };
    }

    /* ----------------------------------------------------------
       frame loop
       ---------------------------------------------------------- */

    _loop(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (this.state.loaded && this.state.auto && !this.state.dragging && !this.state.hovering && !this.reduceMotion) {
        this.state.targetYaw += 0.045 * dt;
      }

      const ease = 1 - Math.exp(-9 * dt);
      this.state.yaw += (this.state.targetYaw - this.state.yaw) * ease;
      this.state.pitch += (this.state.targetPitch - this.state.pitch) * ease;
      this.state.zoom += (this.state.targetZoom - this.state.zoom) * (1 - Math.exp(-7.5 * dt));

      if (this.state.loaded) {
        this.group.rotation.set(this.state.pitch, this.state.yaw, 0);
        this.group.updateMatrixWorld(true);
        this._applyCameraPosition();

        if (this.state.mode === "cutaway") {
          this.cutY += (this.cutTarget - this.cutY) * (1 - Math.exp(-5 * dt));
          const localPoint = new THREE.Vector3(0, this.cutY, 0).applyMatrix4(this.group.matrixWorld);
          this.cutPlane.normal.copy(new THREE.Vector3(0, -1, 0).applyQuaternion(this.group.quaternion)).normalize();
          this.cutPlane.constant = -this.cutPlane.normal.dot(localPoint);
          this.cutLine.position.y = this.cutY;
          this.cutLine.material.opacity = 0.4 + Math.sin(now * 0.0023) * 0.2;
        }

        if (this.state.mode === "thermal") {
          const pulse = 0.76 + Math.sin(now * 0.0018) * 0.08;
          this.heatMaterial.opacity = pulse;
          this.heatGlow.material.opacity = 0.13 + Math.sin(now * 0.0021) * 0.045;
        }

        this.renderer.render(this.scene, this.camera);
        this.onFrame(this.getView());
      }

      this._raf = window.requestAnimationFrame(this._loop);
    }
  }

  window.SparkViewer = SparkViewer;
})();
