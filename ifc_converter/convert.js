import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. 必不可少的环境模拟 (Node.js 伪装浏览器)
// ==========================================
// 必须在导入 @thatopen/components 之前设置好这些全局变量

global.THREE = THREE;
global.window = {
    innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
    addEventListener: () => {}, removeEventListener: () => {},
    // 模拟 crypto用于生成UUID等
    crypto: {
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }
    }
};

global.document = {
    createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
    createTextNode: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
};

global.element = { clientWidth: 1024, clientHeight: 768 };

global.File = class { constructor(parts, name) { this.name = name; } };

// 不覆盖 Node.js 原生的 performance，以免破坏 internal/deps/undici
if (!global.performance) {
    global.performance = { 
        now: () => Date.now(), 
        mark: () => {}, 
        measure: () => {} 
    };
}


// 模拟 Worker 防止 fragments.init() 报错
// 注意：真正的多线程 Worker 在 Node 环境很难模拟，这里提供一个空壳
// 如果库尝试 postMessage 并等待回复，这里可能会导致挂起
global.Worker = class {
    constructor(stringUrl) { this.url = stringUrl; }
    postMessage(msg) {
        // 简单的 Mock 无法真正处理 Worker 消息
        // 如果转换过程非常依赖 Worker 返回数据，这里会是卡点
    }
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
};

// ==========================================
// 2. 转换逻辑
// ==========================================
const inputFileName = '主桥模型.ifc';

async function convert() {
    console.log("🚀 初始化环境模拟...");

    // 使用动态导入，确保在导入库之前全局变量已经就绪
    const OBC = await import('@thatopen/components');
    const { Components, FragmentsManager, IfcLoader } = OBC;
    
    console.log("🚀 初始化转换器...");
    
    // 初始化无界面的组件管理器
    const components = new Components();
    
    const fragments = components.get(FragmentsManager);
    const loader = components.get(IfcLoader);

    // 初始化 fragments 组件
    // 在浏览器中这里通常传入 worker 的 URL，这里传 null 或不传，依靠 Mock Worker
    fragments.init(); 

    // 配置 WASM 路径
    // 注意：web-ifc 的 .wasm 文件必须存在于该路径下
    const wasmPath = path.join(__dirname, 'node_modules', 'web-ifc') + '/';
    
    console.log(`⚙️  设置 WASM 路径: ${wasmPath}`);

    // 关键：autoSetWasm 必须设为 false！
    // 否则库会 fetch unpkg.com 拿版本号，再把 WASM 路径设成一个 https URL，
    // 而 Node.js 环境下 web-ifc-api-node 会把 URL 当本地路径去 open()，导致 ENOENT。
    await loader.setup({ 
        autoSetWasm: false,
        wasm: { 
            path: wasmPath,
            absolute: true 
        },
        webIfc: {
            COORDINATE_TO_ORIGIN: true,
        }
    });

    // 读取文件
    const filePath = path.join(__dirname, inputFileName);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 找不到文件: ${inputFileName}`);
        return;
    }

    console.log(`📂 正在读取: ${inputFileName}`);
    const fileBuffer = fs.readFileSync(filePath);
    const bufferArray = new Uint8Array(fileBuffer);

    console.log("⏳ 正在解析 IFC (由于禁用了 Worker，这可能需要一些时间)...");
    
    // 在 Node 环境下，loader.load 可能会尝试使用 worker
    // 如果它内部检测到有 Worker 类，就会尝试 spawn。
    // 我们的 Mock Worker 不会回复，所以可能会卡在这里。
    // 唯一的希望是 loader 在 Node 模式下能降级运行。
    
    try {
        const model = await loader.load(bufferArray);
        console.log("✅ IFC 解析完成");

        console.log("💾 正在导出为 .frag 二进制格式...");
        // 导出 frag 数据
        const binaryData = fragments.export(model);
    
        // 保存
        const outputName = inputFileName.replace('.ifc', '.frag');
        const outputPath = path.join(__dirname, outputName);
        fs.writeFileSync(outputPath, binaryData);
    
        const outputSize = (binaryData.length / 1024 / 1024).toFixed(2);
    
        console.log("------------------------------------------------");
        console.log(`✅ 转换成功！`);
        console.log(`📄 生成文件: ${outputName}`);
        console.log(`📦 文件大小: ${outputSize} MB`);
        console.log("------------------------------------------------");

    } catch (err) {
        console.error("❌ 转换过程中发生错误:", err);
    } finally {
        // 清理
        fragments.dispose();
        components.dispose();
    }
}

convert().catch(e => console.error(e)); 