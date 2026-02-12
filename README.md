# 桥梁BIM 3D查看器

## 📋 项目说明
这是一个基于Web的BIM模型查看器，用于加载和展示桥梁三维模型。

## 🔧 技术栈
- **Three.js**: 3D图形渲染
- **@thatopen/components**: BIM组件库
- **Vite**: 开发服务器和构建工具

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

## 📦 模型格式说明

### RVT 转 IFC
你的模型文件是 `.rvt` 格式（Revit格式），需要转换为 `.ifc` 格式才能在Web中加载。

**转换步骤：**
1. 在 Autodesk Revit 中打开 `主桥模型.rvt`
2. 点击 **文件 > 导出 > IFC**
3. 选择IFC版本（推荐IFC 2x3或IFC 4）
4. 保存为 `主桥模型.ifc`
5. 将IFC文件放在 `public` 文件夹下

### 加载模型
- **方式1**: 点击左上角的"加载IFC模型"按钮，选择IFC文件
- **方式2**: 直接拖放IFC文件到浏览器窗口

## 🎮 操作说明
- **旋转**: 鼠标左键拖动
- **平移**: 鼠标右键拖动
- **缩放**: 鼠标滚轮

## 📁 项目结构
```
3d_bridge/
├── index.html          # 入口HTML
├── package.json        # 项目配置
├── public/             # 静态资源
│   └── 主桥模型.rvt   # 原始Revit模型（需转换）
└── src/
    └── main.js         # 主程序入口
```

## ⚠️ 注意事项
1. IFC文件需要是合法的IFC 2x3或IFC 4格式
2. 大型模型可能需要较长加载时间
3. 建议使用现代浏览器（Chrome, Edge, Firefox）

## 🔗 替代方案：使用Autodesk Forge
如果需要直接加载RVT文件，可以使用Autodesk Forge Viewer（需要申请API密钥）。
