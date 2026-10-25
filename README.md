# DGX SPARK · 交互式硬件档案

一个围绕 **NVIDIA DGX Spark** 制作的深色科技风产品交互页。中央是真实 DGX Spark 外观的实时 3D 模型：香槟金机身、多孔烧结金属前面板、双侧握把、后置接口与 NVIDIA 绿色标识都来自实际产品模型。

无需构建工具、无需联网、无第三方 CDN。直接打开 `index.html` 即可运行（需要支持 WebGL 2 的现代浏览器）。

## 预览

- `preview-desktop.png` — 桌面预览
- `preview-mobile.png` — 手机预览
- 在浏览器中打开 `index.html` 获得完整交互体验

## 交互一览

| 操作 | 效果 |
| --- | --- |
| 拖拽模型 | 环绕旋转（自动暂停） |
| 滚轮 / 双指触控板 | 拉近、拉远 |
| 双击舞台空白处 | 复位视图 |
| 点击左侧模块 / 机身上的编号热点 | 聚焦组件、同步详情卡与技术档案 |
| 外观 / 结构 / 透视 / 热力 | 外壳、开盖、透明壳体、热力覆盖四种模式 |
| 自动旋转 | 鼠标离开舞台后缓慢环绕 |
| 数字键 `1`–`4` | 切换四种模式 |
| 方向键 | 微调模型朝向 |
| `A` | 开关自动旋转 |
| `R` | 复位视图 |
| `F` | 全屏 |
| `Esc` | 关闭详情卡或规格弹窗 |

## 页面结构

- **系统清单**：8 个模块条目，附带 GB10 的 CPU / GPU / 统一内存速览。
- **3D 舞台**：真实 3D 外壳与程序化内部主板（GB10、LPDDR5X、ConnectX-7、NVMe、供电模块），由 Three.js 实时渲染。
- **技术档案**：核心指标、系统配置、双机 405B 扩展卡片与完整规格弹窗。
- **响应式布局**：桌面三栏、平板双栏、手机单栏；移动端点击清单模块会自动滚回舞台。

## 文件

```text
index.html                    页面结构、HUD、完整规格弹窗
styles.css                    设计系统、场景氛围、响应式与动效
app.js                        组件清单、热点、模式、详情卡与键盘交互
viewer.js                     Three.js 场景、真实模型、内部主板、剖切与热力覆盖
vendor/spark3d-libs.js        Three.js + GLTFLoader 的本地打包版本
assets/dgx-spark-model.js     嵌入的 DGX Spark GLB 模型（Base64）
assets/dgx-spark-optimized.glb  可编辑的源模型（页面运行时不请求）
preview-desktop.png
preview-mobile.png
README.md
```

## 实现说明

- 中央模型使用了 [Wendy Labs 的免费 DGX Spark 可视化模型](https://wendy.dev/blog/free-nvidia-dgx-spark-3d-model)，经 Draco 解压、网格简化与量化后内嵌到 `assets/dgx-spark-model.js`，这样从本地文件打开也能离线加载。
- 内部主板、芯片标签、电路走线与热力图均为程序化 Three.js 几何 / CanvasTexture 插画，不是产品拆解实拍。
- 热点通过相机投影把 3D 局部坐标实时换算到页面坐标，因此会跟随旋转与缩放。
- 相机适配、剖切面跟随与自动旋转都按视口尺寸和模式动态计算。
- 支持 `prefers-reduced-motion`：自动旋转与页面动效会降级。
- 完整规格使用原生 `<dialog>`；所有主要控件支持键盘与 ARIA 状态。

## 数据与素材来源

- [NVIDIA DGX Spark User Guide — Hardware Overview](https://docs.nvidia.com/dgx/dgx-spark/hardware.html)
- [NVIDIA DGX Spark 产品页](https://www.nvidia.com/en-us/products/workstations/dgx-spark/)
- [Wendy Labs — Free NVIDIA DGX Spark 3D model](https://wendy.dev/blog/free-nvidia-dgx-spark-3d-model)
- [ChargerLAB — Teardown of NVIDIA DGX Spark 4TB](https://www.chargerlab.com/teardown-of-nvidia-dgx-spark-4tb/)（内部结构与 SSD 规格参考）
- [Three.js](https://threejs.org/)（MIT License）

> 本页面为前端交互概念演示，与 NVIDIA 无隶属关系，非官方页面。热力视图中的温度为示意数据。
