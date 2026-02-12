# 桥梁BIM 3D查看器

## 📋 项目说明
这是一个基于Web的BIM模型查看器，用于加载和展示桥梁三维模型。项目支持IFC格式模型的加载、浏览、组件属性查看以及简单的力学模拟演示。

## 🔧 技术栈
- **Three.js**: 3D图形渲染引擎
- **@thatopen/components**: BIM组件库 (Open BIM Components)
- **Vite**: 现代前端构建工具

## ✨ 主要功能
- **模型浏览**: 支持 IFC 文件的加载与三维展示
- **交互操作**: 支持旋转、平移、缩放等基本视角控制
- **属性查看**: 点击构件查看详细属性信息
- **组件列表**: 查看模型中包含的组件列表
- **力学模拟**: 简单的力学效果模拟演示 (Force Simulation)
- **模型转换**: 内置 IFC 转 .frag (Fragments) 转换工具

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 访问应用
浏览器会自动打开 `http://localhost:5173`

### 4. 加载模型
- **方式1**: 点击左上角的 "加载IFC模型" 按钮，选择本地 `.ifc` 文件
- **方式2**: 直接拖放 `.ifc` 文件到浏览器窗口区域

## 🛠️ IFC 转换工具 (ifc_converter)

项目包含通过 Node.js 处理大模型转换的工具，可将 IFC 转换为更高效的 `.frag` 格式（如需）。

### 设置转换工具
```bash
cd ifc_converter
npm install
```

### 运行转换
将你的 IFC 文件放入 `ifc_converter` 目录，修改 `ifc2frag.js` 中的文件名配置，然后运行：
```bash
node ifc2frag.js
```

## 📦 模型格式指南

### 从 Revit 导出 IFC
如果原始模型是 `.rvt` (Revit) 格式，主要遵循以下步骤：
1. 在 Autodesk Revit 中打开项目
2. 点击 **文件 > 导出 > IFC**
3. 推荐选择 **IFC 2x3 Coordination View 2.0** 或 **IFC 4**
4. 导出后的文件即可直接在查看器中加载

## 🎮 操作说明
- **旋转**: 鼠标左键拖动
- **平移**: 鼠标右键拖动
- **缩放**: 鼠标滚轮滚动
- **选中构件**: 鼠标左键点击模型构件（双击聚焦）

## 📁 项目结构
```
3d_bridge/
├── index.html                # 入口 HTML 文件
├── package.json              # 项目依赖配置
├── README.md                 # 项目说明文档
├── public/                   # 静态资源文件
├── ifc_converter/            # 模型格式转换工具 (Node.js)
│   ├── ifc2frag.js           # 转换脚本
│   └── ...
└── src/                      # 源代码目录
    ├── main.js               # 应用主入口
    ├── core/                 # 核心系统初始化 (Three.js/Components)
    ├── features/             # 功能模块 (如力学模拟)
    ├── ui/                   # 用户界面组件 (工具栏、属性面板等)
    └── utils/                # 通用工具函数 (材质处理等)
```
