/* ============================================================
   DGX SPARK — interface orchestration
   ============================================================ */

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const radToDeg = (radians) => (radians * 180) / Math.PI;
  const normalizeDegrees = (degrees) => (((degrees % 360) + 540) % 360) - 180;

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = reduceMotionQuery.matches;

  /* ------------------------------------------------------------
     content model
     ------------------------------------------------------------ */

  const MODULES = [
    {
      id: "gb10",
      num: "01",
      icon: "chip",
      en: "GB10 SUPERCHIP",
      zh: "GB10 超级芯片",
      tag: "CORE SILICON",
      focus: "compute",
      desc: "Grace CPU 与 Blackwell GPU 以 NVLink-C2C 连接，集成在 2.5D 封装中。一颗芯片同时承担 AI 推理、模型微调与本地开发工作流。",
      specs: [["CPU", "20 核 Arm"], ["GPU", "6,144 CUDA"], ["算力", "1 PFLOPS FP4"]],
      view: { yaw: -10, pitch: 10, zoom: 1.05 },
      action: { label: "X-RAY 透视内部", type: "mode", mode: "xray" },
      hotspot: { point: [0.004, 0.0262, 0.018], label: "GB10", sub: "SUPERCHIP" }
    },
    {
      id: "memory",
      num: "02",
      icon: "memory",
      en: "UNIFIED MEMORY · 128 GB",
      zh: "统一内存",
      tag: "UNIFIED MEMORY",
      focus: "memory",
      desc: "八颗 LPDDR5X 环绕 GB10 放置，构成 128 GB 统一内存池。CPU 与 GPU 共享寻址，减少数据搬移，也装得下更大的上下文。",
      specs: [["容量", "128 GB"], ["带宽", "273 GB/s"], ["位宽", "256-bit"]],
      view: { yaw: 8, pitch: 4, zoom: 1.04 },
      action: { label: "X-RAY 查看内存阵列", type: "mode", mode: "xray" },
      hotspot: { point: [-0.048, 0.0262, 0.034], label: "LPDDR5X", sub: "128 GB" }
    },
    {
      id: "network",
      num: "03",
      icon: "network",
      en: "CONNECTX-7 · 200 GB/S",
      zh: "高速互联",
      tag: "SCALE-OUT FABRIC",
      focus: "network",
      desc: "ConnectX-7 提供双 QSFP、最高 200 Gb/s 的节点间互联。两台 DGX Spark 直连，可覆盖 405B 参数级模型的推理空间。",
      specs: [["端口", "2× QSFP"], ["速率", "200 Gb/s"], ["双机", "405B"]],
      view: { yaw: 154, pitch: -1, zoom: 1.04 },
      action: { label: "转向后置接口", type: "rear" },
      hotspot: { point: [0.042, 0.0262, -0.056], label: "CX-7", sub: "200 Gb/s" }
    },
    {
      id: "storage",
      num: "04",
      icon: "storage",
      en: "NVME STORAGE · 4 TB",
      zh: "本地存储",
      tag: "LOCAL STORAGE",
      focus: "storage",
      desc: "4 TB NVMe M.2 自加密固态硬盘，快拆维护口位于机身底部，为模型权重、数据集与本地工作区提供高速空间。",
      specs: [["容量", "4 TB"], ["规格", "M.2 2242"], ["加密", "自加密"]],
      view: { yaw: -12, pitch: 2, zoom: 1.04 },
      action: { label: "X-RAY 查看主板", type: "mode", mode: "xray" },
      hotspot: { point: [0.048, 0.0262, 0.053], label: "NVMe", sub: "4 TB" }
    },
    {
      id: "cooling",
      num: "05",
      icon: "cooling",
      en: "THERMAL SYSTEM",
      zh: "散热系统",
      tag: "THERMAL DESIGN",
      focus: "physical",
      desc: "均热板直接覆盖 GB10，双风扇与独立热管分别为网络芯片和供电模块散热。140 W SoC 在 150 mm 机身中持续释放。",
      specs: [["散热", "双风扇 + 均热板"], ["SoC TDP", "140 W"], ["电源", "240 W"]],
      view: { yaw: -16, pitch: 7, zoom: 1.04 },
      action: { label: "CUTAWAY 取下上盖", type: "mode", mode: "cutaway" },
      hotspot: { point: [-0.052, 0.0262, -0.028], label: "THERMAL", sub: "VAPOR CHAMBER" }
    },
    {
      id: "io",
      num: "06",
      icon: "io",
      en: "REAR I/O ARRAY",
      zh: "后置接口",
      tag: "CONNECTIVITY",
      focus: "io",
      desc: "后置接口包含 4× USB-C（其中一个负责 240 W 供电）、HDMI 2.1a、10 GbE 与双 QSFP 200 Gb/s。一根 USB-C 就能点亮整机。",
      specs: [["USB-C", "4×"], ["显示", "HDMI 2.1a"], ["网络", "10 GbE + QSFP"]],
      view: { yaw: 158, pitch: -1, zoom: 1.05 },
      action: { label: "旋转至后置接口", type: "rear" },
      hotspot: { point: [0.008, 0.0262, -0.0735], label: "I/O", sub: "REAR PANEL" }
    },
    {
      id: "os",
      num: "07",
      icon: "os",
      en: "NVIDIA DGX OS",
      zh: "AI 软件栈",
      tag: "SOFTWARE STACK",
      focus: "",
      desc: "预装 NVIDIA DGX OS 与完整 AI 软件栈：CUDA、PyTorch、TensorRT-LLM、NIM 微服务、JupyterLab 与容器运行时，启动后即可投入开发。",
      specs: [["系统", "DGX OS"], ["框架", "PyTorch"], ["生态", "NGC / NIM"]],
      view: { yaw: -9, pitch: 1.5, zoom: 1 },
      action: { label: "查看完整技术规格", type: "spec" }
    },
    {
      id: "wifi",
      num: "08",
      icon: "wifi",
      en: "WI-FI 7 · BLUETOOTH 5.4",
      zh: "无线连接",
      tag: "WIRELESS",
      focus: "wireless",
      desc: "Wi-Fi 7 与蓝牙 5.4 由独立无线模块提供，天线集成在机身内部。桌面部署无需额外布线，同时保留 10 GbE 有线网络。",
      specs: [["无线", "Wi-Fi 7"], ["蓝牙", "5.4"], ["有线", "10 GbE"]],
      view: { yaw: 135, pitch: 0, zoom: 1.02 },
      action: { label: "查看完整技术规格", type: "spec" }
    }
  ];

  const MODE_META = {
    exterior: {
      label: "EXTERIOR / 完整机身",
      caption: "拖拽环绕；点击左侧模块或机身热点，展开对应硬件档案。"
    },
    cutaway: {
      label: "CUTAWAY / 上盖剖视",
      caption: "移除上盖，直接查看 GB10 主板、LPDDR5X 阵列与连接器布局。"
    },
    xray: {
      label: "X-RAY / 结构透视",
      caption: "机身透明度降至 8%，主板、芯片与后置接口结构同时可见。"
    },
    thermal: {
      label: "THERMAL / 热力仿真",
      caption: "颜色表示热量分布概念，非实时传感器数据。"
    }
  };

  const MODE_VIEWS = {
    exterior: { yaw: -9, pitch: 1.5, zoom: 1 },
    cutaway: { yaw: -14, pitch: 8, zoom: 1.045 },
    xray: { yaw: -16, pitch: 2, zoom: 1.03 },
    thermal: { yaw: -10, pitch: 3, zoom: 1.015 }
  };

  const THERMAL_POINTS = {
    gb10: [0.006, 0.0264, 0.018],
    memory: [-0.046, 0.0264, 0.03],
    storage: [0.044, 0.0264, 0.048]
  };

  /* ------------------------------------------------------------
     DOM
     ------------------------------------------------------------ */

  const stage = $("#stage");
  const viewport = $("#viewport");
  const componentList = $("#componentList");
  const hotspotsLayer = $("#hotspots");
  const componentCard = $("#componentCard");
  const cardClose = $("#cardClose");
  const cardAction = $("#cardAction");
  const cardIndex = $("#cardIndex");
  const cardTag = $("#cardTag");
  const cardEn = $("#cardEn");
  const cardTitle = $("#cardTitle");
  const cardDesc = $("#cardDesc");
  const cardSpecs = $("#cardSpecs");
  const rotationReadout = $("#rotationReadout");
  const zoomReadout = $("#zoomReadout");
  const modeNote = $("#modeNote");
  const modeButtons = $$(".mode-btn");
  const autoRotateBtn = $("#autoRotateBtn");
  const resetBtn = $("#resetBtn");
  const resetViewBtn = $("#resetViewBtn");
  const fullscreenBtn = $("#fullscreenBtn");
  const clock = $("#clock");
  const toast = $("#toast");
  const specDialog = $("#specDialog");
  const specClose = $("#specClose");
  const sceneLoader = $("#sceneLoader");
  const sceneFallback = $("#sceneFallback");
  const thermalTags = $("#thermalTags");
  const canvas = $("#sparkCanvas");
  const ambientCanvas = $("#ambient");

  const state = {
    mode: "exterior",
    activeId: null,
    autoRotate: !reduceMotion,
    dragging: false,
    hasInteracted: false,
    viewerReady: false
  };

  let viewer = null;
  let activePointer = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let dragDistance = 0;
  let lastReadoutTime = 0;
  let toastTimer = 0;

  /* ------------------------------------------------------------
     UI construction
     ------------------------------------------------------------ */

  function iconMarkup(icon) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${icon}"/></svg>`;
  }

  function renderComponents() {
    const fragment = document.createDocumentFragment();
    MODULES.forEach((module) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "component";
      button.dataset.id = module.id;
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `
        <span class="component__num">${module.num}</span>
        <span class="component__glyph">${iconMarkup(module.icon)}</span>
        <span class="component__copy">
          <span class="component__en">${module.en}</span>
          <span class="component__zh">${module.zh}</span>
        </span>
        <span class="component__state"><i></i><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow"/></svg></span>
      `;
      button.addEventListener("click", () => selectModule(module.id));
      item.appendChild(button);
      fragment.appendChild(item);
    });
    componentList.replaceChildren(fragment);
  }

  function renderHotspots() {
    const fragment = document.createDocumentFragment();
    MODULES.filter((module) => module.hotspot).forEach((module) => {
      const hotspot = module.hotspot;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.dataset.id = module.id;
      button.setAttribute("aria-label", `${module.zh} · 查看组件详情`);
      button.setAttribute("aria-pressed", "false");
      button.style.left = "0px";
      button.style.top = "0px";
      button.innerHTML = `
        <span class="hotspot__dot">${module.num}</span>
        <span class="hotspot__label">
          <b>${hotspot.label}</b>
          <small>${hotspot.sub}</small>
        </span>
      `;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selectModule(module.id, { fromHotspot: true });
      });
      fragment.appendChild(button);
    });
    hotspotsLayer.replaceChildren(fragment);
  }

  /* ------------------------------------------------------------
     viewer
     ------------------------------------------------------------ */

  function initViewer() {
    if (!window.SparkViewer) {
      showFallback();
      return;
    }

    try {
      viewer = new window.SparkViewer(canvas, {
        onReady: handleViewerReady,
        onError: showFallback,
        onFrame: updateSceneOverlays
      });
    } catch (error) {
      console.error(error);
      showFallback();
    }
  }

  function handleViewerReady() {
    state.viewerReady = true;
    viewport.classList.add("is-ready");
    if (sceneLoader) sceneLoader.classList.add("is-hidden");
    if (sceneFallback) sceneFallback.hidden = true;

    viewer.setMode(state.mode);
    viewer.setAuto(!reduceMotion);
    setMode(state.mode, { fromUser: false, skipView: true });
    setAutoRotate(!reduceMotion);
    updateSceneOverlays(viewer.getView());
  }

  function showFallback() {
    if (sceneLoader) sceneLoader.classList.add("is-hidden");
    if (sceneFallback) sceneFallback.hidden = false;
    hotspotsLayer.style.opacity = "0";
    state.viewerReady = false;
  }

  function updateSceneOverlays(view) {
    if (!viewer || !view) return;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const hotspots = hotspotsLayer.children;

    for (const button of hotspots) {
      const module = getModule(button.dataset.id);
      if (!module || !module.hotspot) continue;
      const projected = viewer.project(module.hotspot.point);
      if (!projected || !projected.visible) {
        button.classList.add("is-offscreen");
        continue;
      }

      const visible = projected.x > -40 && projected.x < width + 40 && projected.y > -30 && projected.y < height + 30;
      button.classList.toggle("is-offscreen", !visible);
      button.style.transform = `translate3d(${projected.x.toFixed(2)}px, ${projected.y.toFixed(2)}px, 0) translate(-50%, -50%)`;

      if (projected.x < width * 0.45) {
        button.classList.add("is-left");
      } else if (projected.x > width * 0.55) {
        button.classList.remove("is-left");
      }
      if (projected.x > width - 150) button.classList.add("is-left");
      else if (projected.x < 150) button.classList.remove("is-left");
    }

    if (thermalTags) {
      for (const tag of thermalTags.children) {
        const point = THERMAL_POINTS[tag.dataset.tag];
        if (!point) continue;
        const projected = viewer.project(point);
        if (!projected || !projected.visible) {
          tag.classList.add("is-offscreen");
          continue;
        }
        tag.classList.remove("is-offscreen");
        tag.style.transform = `translate3d(${projected.x.toFixed(2)}px, ${projected.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      }
    }

    const now = performance.now();
    if (now - lastReadoutTime > 90) {
      lastReadoutTime = now;
      const yaw = normalizeDegrees(radToDeg(view.yaw));
      const pitch = radToDeg(view.pitch);
      const signYaw = yaw < 0 ? "−" : "+";
      const signPitch = pitch < 0 ? "−" : "+";
      rotationReadout.textContent =
        `YAW ${signYaw}${String(Math.abs(yaw).toFixed(1)).padStart(4, "0")}° · ` +
        `PITCH ${signPitch}${String(Math.abs(pitch).toFixed(1)).padStart(4, "0")}°`;
      zoomReadout.textContent = view.zoom.toFixed(2);
    }
  }

  /* ------------------------------------------------------------
     selection
     ------------------------------------------------------------ */

  function getModule(id) {
    return MODULES.find((module) => module.id === id) || null;
  }

  function clearSelection() {
    state.activeId = null;
    $$(".component", componentList).forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    $$(".hotspot", hotspotsLayer).forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    $$(".spec-row").forEach((row) => row.classList.remove("is-focused"));
    componentCard.hidden = true;
  }

  function selectModule(id, options = {}) {
    const module = getModule(id);
    if (!module) return;

    if (state.activeId === id) {
      clearSelection();
      return;
    }

    state.activeId = id;
    $$(".component", componentList).forEach((button) => {
      const selected = button.dataset.id === id;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $$(".hotspot", hotspotsLayer).forEach((button) => {
      const selected = button.dataset.id === id;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    let focusedRow = null;
    $$(".spec-row").forEach((row) => {
      const focused = Boolean(module.focus) && row.dataset.focus === module.focus;
      row.classList.toggle("is-focused", focused);
      if (focused) focusedRow = row;
    });

    const compactLayout = window.matchMedia("(max-width: 1119px)").matches;
    if (focusedRow && !compactLayout) {
      focusedRow.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }

    cardIndex.textContent = `${module.num} / 08`;
    cardTag.textContent = module.tag;
    cardEn.textContent = module.en;
    cardTitle.textContent = module.zh;
    cardDesc.textContent = module.desc;
    cardSpecs.innerHTML = module.specs
      .map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`)
      .join("");
    cardAction.querySelector("span").textContent = module.action.label;

    componentCard.hidden = false;
    componentCard.style.animation = "none";
    void componentCard.offsetWidth;
    componentCard.style.animation = "";

    if (viewer && module.view) viewer.setTargetView(module.view);
    setAutoRotate(false);
    markInteracted();

    if (!options.fromHotspot && compactLayout && state.viewerReady) {
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.top < 50 || stageRect.bottom > window.innerHeight) {
        window.scrollTo({
          top: window.scrollY + stageRect.top - 62,
          behavior: reduceMotion ? "auto" : "smooth"
        });
      }
    }
  }

  function runCardAction() {
    const module = getModule(state.activeId);
    if (!module) return;

    if (module.action.type === "mode") {
      setMode(module.action.mode, { fromUser: true });
    } else if (module.action.type === "rear") {
      setMode("exterior", { fromUser: true, skipView: true });
      if (viewer) viewer.setTargetView(module.view);
      clearSelection();
    } else if (module.action.type === "spec") {
      openSpecDialog();
    }
  }

  /* ------------------------------------------------------------
     modes / auto rotate / reset
     ------------------------------------------------------------ */

  function setMode(mode, options = {}) {
    if (!MODE_META[mode]) return;
    const { fromUser = false, skipView = false } = options;

    state.mode = mode;
    stage.dataset.mode = mode;

    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    const meta = MODE_META[mode];
    modeNote.innerHTML = `<i></i><span>${meta.label}</span><p>${meta.caption}</p>`;

    if (viewer) viewer.setMode(mode);

    if (fromUser) {
      markInteracted();
      setAutoRotate(false);
      clearSelection();
      if (!skipView && viewer) viewer.setTargetView(MODE_VIEWS[mode]);
    }
  }

  function setAutoRotate(enabled) {
    state.autoRotate = Boolean(enabled);
    autoRotateBtn.setAttribute("aria-pressed", String(state.autoRotate));
    autoRotateBtn.title = state.autoRotate ? "暂停自动旋转 (A)" : "开启自动旋转 (A)";
    if (viewer) viewer.setAuto(state.autoRotate);
  }

  function resetExperience() {
    clearSelection();
    setMode("exterior", { fromUser: false, skipView: true });
    if (viewer) {
      viewer.setMode("exterior");
      viewer.setTargetView(MODE_VIEWS.exterior);
    }
    setAutoRotate(!reduceMotion);
    viewport.classList.remove("has-interacted");
    state.hasInteracted = false;
  }

  function markInteracted() {
    if (state.hasInteracted) return;
    state.hasInteracted = true;
    viewport.classList.add("has-interacted");
  }

  /* ------------------------------------------------------------
     pointer / gesture controls
     ------------------------------------------------------------ */

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest("button, a, .component-card, .thermal-legend")) return;

    markInteracted();
    setAutoRotate(false);

    activePointer = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    dragDistance = 0;
    state.dragging = true;
    viewport.classList.add("is-dragging");
    if (viewer) viewer.setDragging(true);

    try {
      viewport.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is best-effort.
    }

    if (event.pointerType !== "touch") event.preventDefault();
  }

  function onPointerMove(event) {
    if (!state.dragging || activePointer !== event.pointerId || !viewer) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    if (dragDistance > 4) markInteracted();
    viewer.rotateBy(dx, dy);
  }

  function finishPointer(event) {
    if (!state.dragging) return;
    if (event && event.pointerId !== undefined && event.pointerId !== activePointer) return;

    state.dragging = false;
    activePointer = null;
    viewport.classList.remove("is-dragging");
    if (viewer) viewer.setDragging(false);

    try {
      if (event && viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      // Ignore capture release errors.
    }
  }

  function onWheel(event) {
    event.preventDefault();
    markInteracted();
    setAutoRotate(false);
    if (!viewer) return;
    viewer.zoomBy(event.deltaY > 0 ? 0.94 : 1.06);
  }

  function onDoubleClick(event) {
    if (event.target.closest("button, .component-card")) return;
    resetExperience();
  }

  /* ------------------------------------------------------------
     dialog / fullscreen / clock / toast
     ------------------------------------------------------------ */

  function openSpecDialog() {
    if (!specDialog) return;
    if (typeof specDialog.showModal === "function") {
      if (!specDialog.open) specDialog.showModal();
    } else {
      specDialog.setAttribute("open", "");
    }
  }

  function closeSpecDialog() {
    if (!specDialog) return;
    if (typeof specDialog.close === "function" && specDialog.open) specDialog.close();
    else specDialog.removeAttribute("open");
  }

  function updateFullscreenButton() {
    if (!fullscreenBtn) return;
    const isFullscreen = Boolean(document.fullscreenElement);
    const use = $("use", fullscreenBtn);
    if (use) use.setAttribute("href", isFullscreen ? "#i-collapse" : "#i-expand");
    fullscreenBtn.setAttribute("aria-label", isFullscreen ? "退出全屏" : "切换全屏");
    fullscreenBtn.title = isFullscreen ? "退出全屏" : "全屏 (F)";
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      showToast("当前环境不支持全屏模式");
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function updateClock() {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
    clock.setAttribute("datetime", now.toISOString());
  }

  /* ------------------------------------------------------------
     keyboard
     ------------------------------------------------------------ */

  function onKeyDown(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (specDialog && specDialog.open) return;

    const key = event.key;
    const target = event.target instanceof Element ? event.target : null;

    if (key === "Escape") {
      if (state.activeId) clearSelection();
      return;
    }
    if (key.toLowerCase() === "r") {
      resetExperience();
      return;
    }
    if (key.toLowerCase() === "a") {
      setAutoRotate(!state.autoRotate);
      return;
    }
    if (key.toLowerCase() === "f") {
      toggleFullscreen();
      return;
    }
    if (["1", "2", "3", "4"].includes(key)) {
      setMode(["exterior", "cutaway", "xray", "thermal"][Number(key) - 1], { fromUser: true });
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
      if (target && target.closest(".panel")) return;
      event.preventDefault();
      markInteracted();
      setAutoRotate(false);
      if (!viewer) return;
      if (key === "ArrowLeft") viewer.rotateBy(-34, 0);
      if (key === "ArrowRight") viewer.rotateBy(34, 0);
      if (key === "ArrowUp") viewer.rotateBy(0, 28);
      if (key === "ArrowDown") viewer.rotateBy(0, -28);
    }
  }

  /* ------------------------------------------------------------
     ambient background particles
     ------------------------------------------------------------ */

  const ambientContext = ambientCanvas ? ambientCanvas.getContext("2d") : null;
  let particles = [];
  let ambientWidth = 0;
  let ambientHeight = 0;
  let ambientDpr = 1;

  function seedParticles() {
    const count = ambientWidth < 720 ? 22 : 42;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * ambientWidth,
      y: Math.random() * ambientHeight,
      vx: (Math.random() - 0.5) * 4.5,
      vy: -(2.5 + Math.random() * 7),
      radius: 0.35 + Math.random() * 1.3,
      alpha: 0.035 + Math.random() * 0.16,
      color: Math.random() > 0.68 ? "219, 197, 154" : "182, 242, 74"
    }));
  }

  function resizeAmbient() {
    if (!ambientContext) return;
    ambientWidth = window.innerWidth;
    ambientHeight = window.innerHeight;
    ambientDpr = Math.min(2, window.devicePixelRatio || 1);
    ambientCanvas.width = Math.max(1, Math.floor(ambientWidth * ambientDpr));
    ambientCanvas.height = Math.max(1, Math.floor(ambientHeight * ambientDpr));
    ambientCanvas.style.width = `${ambientWidth}px`;
    ambientCanvas.style.height = `${ambientHeight}px`;
    ambientContext.setTransform(ambientDpr, 0, 0, ambientDpr, 0, 0);
    seedParticles();
  }

  function ambientLoop(now) {
    if (!ambientContext) return;
    const delta = reduceMotion ? 0 : 0.016;
    ambientContext.clearRect(0, 0, ambientWidth, ambientHeight);
    ambientContext.globalCompositeOperation = "lighter";
    for (const particle of particles) {
      if (!reduceMotion) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        if (particle.y < -10) {
          particle.y = ambientHeight + 10;
          particle.x = Math.random() * ambientWidth;
        }
        if (particle.x < -10) particle.x = ambientWidth + 10;
        if (particle.x > ambientWidth + 10) particle.x = -10;
      }
      ambientContext.beginPath();
      ambientContext.fillStyle = `rgba(${particle.color}, ${particle.alpha})`;
      ambientContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ambientContext.fill();
    }
    ambientContext.globalCompositeOperation = "source-over";
    window.requestAnimationFrame(ambientLoop);
  }

  /* ------------------------------------------------------------
     events / boot
     ------------------------------------------------------------ */

  function bindEvents() {
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", finishPointer);
    viewport.addEventListener("pointercancel", finishPointer);
    viewport.addEventListener("lostpointercapture", () => {
      if (state.dragging) finishPointer();
    });
    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("dblclick", onDoubleClick);
    viewport.addEventListener("pointerenter", () => viewer && viewer.setHovering(true));
    viewport.addEventListener("pointerleave", () => {
      if (viewer) viewer.setHovering(false);
      if (state.dragging) finishPointer();
    });

    modeButtons.forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.mode, { fromUser: true }));
    });

    autoRotateBtn.addEventListener("click", () => setAutoRotate(!state.autoRotate));
    resetBtn.addEventListener("click", resetExperience);
    resetViewBtn.addEventListener("click", resetExperience);
    fullscreenBtn.addEventListener("click", toggleFullscreen);
    cardClose.addEventListener("click", clearSelection);
    cardAction.addEventListener("click", runCardAction);

    $$(".js-open-spec").forEach((button) => button.addEventListener("click", openSpecDialog));
    specClose.addEventListener("click", closeSpecDialog);
    specDialog.addEventListener("click", (event) => {
      const rect = specDialog.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) closeSpecDialog();
    });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    window.addEventListener("resize", resizeAmbient);

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", (event) => {
        reduceMotion = event.matches;
        if (reduceMotion) setAutoRotate(false);
      });
    }
  }

  function boot() {
    renderComponents();
    renderHotspots();
    bindEvents();
    resizeAmbient();
    if (ambientContext) window.requestAnimationFrame(ambientLoop);
    updateClock();
    window.setInterval(updateClock, 1000);
    updateFullscreenButton();
    initViewer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
