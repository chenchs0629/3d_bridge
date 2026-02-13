import * as THREE from 'three';

export async function createTriplanarMaterial() {
    // 创建一个纯白、不接受顶点颜色的标准材质
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,      // 纯白
        side: THREE.DoubleSide,
        roughness: 0.6,       // 稍微调低粗糙度，让光影更清晰
        metalness: 0.1,       
        vertexColors: false,  // 【关键】强制忽略几何体自带的顶点颜色
        flatShading: false
    });
    return material;
}

export async function applyMaterialToModel(model, material, progressUI, startTime) {
    if (!model) {
        console.warn('applyMaterialToModel: Model is undefined');
        return 0;
    }

    const root = model.object ? model.object : model;
    
    if (!root.traverse) {
        return 0;
    }

    let meshCount = 0;
    const meshes = [];
    
    // 1. 先收集所有 Mesh
    root.traverse((child) => {
        if (child.isMesh) {
            meshes.push(child);
            meshCount++;
        }
    });

    if(progressUI) progressUI.update(`发现 ${meshCount} 个构件，正在重置颜色...`, 60, startTime);

    if (meshes.length === 0) return 0;

    const batchSize = 1000; // 稍微加大批处理量
    for (let i = 0; i < meshes.length; i += batchSize) {
        const batch = meshes.slice(i, i + batchSize);
        
        for (const child of batch) {
            // 开启阴影
            child.castShadow = true;
            child.receiveShadow = true;

            // --- 【关键修改：资源清理】 ---
            // 替换前，先销毁旧材质，释放内存 (避免显存溢出)
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }

            // --- 【关键修改：强制覆盖】 ---
            // 1. 替换为统一的白色材质
            child.material = material;

            // 2. 移除几何体顶点颜色 (Attribute)
            // 很多 BIM 模型会在几何体里硬编码颜色，必须删掉
            if (child.geometry.attributes.color) {
                child.geometry.deleteAttribute('color');
                child.geometry.attributes.color = null; // 确保引用断开
                child.geometry.needsUpdate = true;
            }

            // 3. 重置 InstancedMesh 的实例颜色
            // 如果是大量重复构件（如柱子、梁），颜色通常存储在这里
            if (child.isInstancedMesh && child.instanceColor) {
                // 将颜色缓冲区全部填为 1.0 (RGB均为1即白色)
                // 这样既保留了缓冲区结构(供后续交互高亮使用)，又重置了视觉颜色
                child.instanceColor.array.fill(1.0);
                child.instanceColor.needsUpdate = true;
            }
        }

        if(progressUI) {
            const progress = 60 + Math.floor((i / meshes.length) * 30);
            progressUI.update(`全白处理中... (${i + batch.length}/${meshCount})`, progress, startTime);
        }
        
        // 让出主线程，防止 UI 卡死
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return meshCount;
}