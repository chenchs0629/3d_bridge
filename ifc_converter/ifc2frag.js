import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ==========================================
// Node.js 环境下 IFC → .frag 转换器
// ==========================================
// 关键发现：@thatopen/fragments 的 IfcImporter 是一个独立的类，
// 它内部自带 web-ifc，不需要 Components、FragmentsManager、Worker。
// 直接调用 IfcImporter.process() 即可在 Node.js 中完成转换。

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFileName = '主桥模型.ifc';

async function convert() {
    console.log("🚀 IFC → Fragment 转换器");
    console.log("================================================");

    // 动态导入 @thatopen/fragments（仅需要 IfcImporter）
    const FRAGS = await import('@thatopen/fragments');
    const { IfcImporter } = FRAGS;

    // 创建 IfcImporter 实例（独立运行，不依赖 Components/Worker）
    const importer = new IfcImporter();

    // 设置 WASM 路径（指向本地 node_modules 中的 web-ifc）
    const wasmPath = path.join(__dirname, 'node_modules', 'web-ifc') + '/';
    importer.wasm = {
        path: wasmPath,
        absolute: true
    };

    console.log(`⚙️  WASM 路径: ${wasmPath}`);

    // 读取 IFC 文件
    const filePath = path.join(__dirname, inputFileName);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 找不到文件: ${inputFileName}`);
        return;
    }

    console.log(`📂 正在读取: ${inputFileName}`);
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`📊 文件大小: ${fileSize} MB`);

    console.log("⏳ 正在转换 IFC → Fragment (可能需要几分钟)...");

    // 调用 IfcImporter.process() 进行转换
    // 支持 readFromCallback (适合 Node.js 大文件流式读取)
    // 也支持直接传入 bytes
    const fragData = await importer.process({
        bytes: new Uint8Array(fileBuffer),
        // raw: true 会生成未压缩的数据（更大但加载更快）
        // raw: false 会用 deflate 压缩（更小但需要解压）
        raw: false,
        progressCallback: (progress, data) => {
            const pct = (progress * 100).toFixed(0);
            process.stdout.write(`\r⏳ 进度: ${pct}% [${data.process}] ${data.state}${data.class ? ' - ' + data.class : ''}        `);
        }
    });

    console.log('\n');

    // 保存 .frag 文件
    const outputName = inputFileName.replace('.ifc', '.frag');
    const outputPath = path.join(__dirname, outputName);
    fs.writeFileSync(outputPath, fragData);

    const outputSize = (fragData.length / 1024 / 1024).toFixed(2);

    console.log("================================================");
    console.log(`✅ 转换成功！`);
    console.log(`📄 输出文件: ${outputName}`);
    console.log(`📊 IFC 原始: ${fileSize} MB`);
    console.log(`📦 Fragment:  ${outputSize} MB`);
    console.log("================================================");
}

convert().catch(err => {
    console.error("❌ 转换失败:", err);
    if (err.stack) console.error(err.stack);
});