# 3D Bridge BIM Viewer (桥梁三维可视化系统)

这是一个基于 Web 技术构建的高性能 3D 桥梁模型可视化与模拟系统。项目利用 Three.js 和 @thatopen (Open BIM) 生态组件，实现了在浏览器端加载解析大型 IFC 格式模型，并提供了构件属性查看、模型结构管理以及基础的力学模拟可视化演示功能。

## ✨ 核心功能

*   **高性能模型加载**:
    *   支持通用 `.ifc` 格式文件直接加载。
    *   **推荐**: 支持优化后的 `.frag` (Fragments) 二进制格式，极大提升大场景加载速度。
*   **交互式漫游**:
    *   基于 OrbitControls 的自由视角控制（平移、旋转、缩放）。
    *   支持双击聚焦构件。
*   **BIM 信息查看**:
    *   **属性面板**: 点击构件自动提取并显示 IFC 属性数据（包括材质、尺寸、分类等）。
    *   **构件列表**: 树状/列表形式展示模型内部层级结构，支持高亮定位。
*   **力学模拟演示 (Force Simulation)**:
    *   内置力学模拟控制台（加载模型后可见）。
    *   支持施加全局载荷，实时模拟并可视化构件的受力位移与应力变化（基于材质刚度计算）。
*   **模型管理**: 支持同时加载多个模型，并独立控制显示/隐藏。

## 🛠️ 技术架构

*   **核心引擎**: [Three.js](https://threejs.org/) (r160+)
*   **BIM 核心库**: 
    *   `@thatopen/components`: 组件化 BIM 功能封装
    *   `@thatopen/fragments`: 高效几何数据处理
    *   `web-ifc`: WASM 驱动的 IFC 解析器
*   **开发工具**: Vite (构建与热更新) / Node.js (转换脚本)

## 📂 项目结构说明

```text
e:\3d_bridge\
├── ifc_converter/       # [独立模块] IFC 格式转换工具 (Node.js)
│   ├── ifc2frag.js      # 核心转换脚本
│   ├── convert.js       # 旧版转换脚本
│   └── package.json     # 转换器独立依赖配置
├── public/              # 静态资源存放 (如默认模型/图标)
├── src/                 # 前端应用源码
│   ├── core/            # 核心场景搭建 (Scene, Camera, Renderer, World)
│   ├── features/        # 独立功能特性
│   │   └── force-simulation.js # 力学模拟逻辑
│   ├── ui/              # 界面组件 (HTML/CSS/JS)
│   │   ├── component-list-panel.js # 构件列表面板
│   │   ├── loading-screen.js       # 加载进度条
│   │   ├── model-list-panel.js     # 模型管理列表
│   │   ├── properties-panel.js     # 属性面板
│   │   └── toolbar.js              # 顶部工具栏
│   ├── utils/           # 通用工具库
│   │   └── materials.js # 材质生成与管理
│   └── main.js          # 应用主入口逻辑
├── index.html           # 网页入口文件
└── package.json         # 主项目依赖配置
```

## 🚀 环境配置与安装步骤

请分别配置**主应用**和**转换工具**的环境。

### 前置要求
*   **Node.js**: 推荐版本 **v18.0.0** 或更高 (涉及 WASM 支持)。
*   **npm**: 包含在 Node.js 中。

### 1. 主应用运行 (用于浏览)

1.  **进入项目根目录**:
    ```powershell
    cd e:\3d_bridge
    ```
2.  **安装依赖**:
    ```powershell
    npm install
    ```
3.  **启动开发服务器**:
    ```powershell
    npm run dev
    ```
4.  **访问**: 打开终端显示的本地地址（尚未推送至公网，后续将补充推进）。

### 2. 模型转换工具配置 (用于优化大模型)

为了获得流畅的体验，建议将 `.ifc` 文件转换为 `.frag` 格式。

1.  **进入转换器目录**:
    ```powershell
    cd ifc_converter
    ```
2.  **安装工具依赖** (注意：这里有独立的 package.json):
    ```powershell
    npm install
    ```

## 📖 使用指南

### A. 如何加载模型

1.  **直接加载**: 启动网页后，直接将 `.ifc` 或 `.frag` 文件拖入浏览器窗口。
2.  **按钮加载**: 点击左上角的 📂 (文件夹) 图标，选择本地文件。
3.  *提示*: `.frag` 文件加载速度比 `.ifc` 快 10 倍以上。

### B. 如何使用转换工具 (IFC 转 Frag)

1.  将你的源文件（如 `bridge.ifc`）放入 `ifc_converter/` 文件夹。
2.  用编辑器打开 `ifc_converter/ifc2frag.js`。
3.  修改第 15 行左右的文件名变量：
    ```javascript
    const inputFileName = 'bridge.ifc'; // 改为你的文件名
    ```
4.  在 `ifc_converter/` 目录下运行终端命令：
    ```powershell
    node ifc2frag.js
    ```
5.  转换完成后，同级目录下会生成 `bridge.frag`。将其用于网页加载。

### C. 力学模拟功能

1.  加载模型成功后。
2.  观察左下角的 **"力学模拟控制台"** 面板。
3.  **应用力**: 点击 "Apply Force" 按钮，模型将根据当前参数产生形变动画。
4.  **显示应力**: 勾选 "Show Stress" (如有) 或通过颜色观察受力分布（默认开启）。
5.  **调整参数**: 拖动 Slider 调整模拟的力大小或材质刚度。

---
*Last Updated: 2026-02-14*

