import * as THREE from 'three';

export async function createTriplanarMaterial() {
    const textureLoader = new THREE.TextureLoader();
    let modelTexture = null;
    try {
        modelTexture = await textureLoader.loadAsync('/texture.jpg');
        modelTexture.colorSpace = THREE.SRGBColorSpace;
        modelTexture.wrapS = THREE.RepeatWrapping;
        modelTexture.wrapT = THREE.RepeatWrapping;
        console.log('纹理贴图加载成功');
    } catch (e) {
        console.warn('纹理贴图加载失败，将使用纯色:', e);
    }

    const textureScale = 0.05;
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.2,
    });

    if (modelTexture) {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTexture = { value: modelTexture };
            shader.uniforms.uScale = { value: textureScale };

            shader.vertexShader = `
                varying vec3 vWorldPosition;
                ${shader.vertexShader}
            `;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                `
                vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
                #include <project_vertex>
                `
            );

            shader.fragmentShader = `
                uniform sampler2D uTexture;
                uniform float uScale;
                varying vec3 vWorldPosition;
                ${shader.fragmentShader}
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                vec3 dx = dFdx(vWorldPosition);
                vec3 dy = dFdy(vWorldPosition);
                vec3 worldNormal = normalize(cross(dx, dy));
                
                vec3 blending = abs(worldNormal);
                blending = normalize(max(blending, 0.00001));
                float b = (blending.x + blending.y + blending.z);
                blending /= vec3(b, b, b);

                vec3 xaxis = texture2D(uTexture, vWorldPosition.yz * uScale).rgb;
                vec3 yaxis = texture2D(uTexture, vWorldPosition.xz * uScale).rgb;
                vec3 zaxis = texture2D(uTexture, vWorldPosition.xy * uScale).rgb;

                vec4 texColor = vec4(xaxis * blending.x + yaxis * blending.y + zaxis * blending.z, 1.0);
                
                diffuseColor *= texColor;
                `
            );
        };
    }
    return material;
}

export async function applyMaterialToModel(model, material, progressUI, startTime) {
    if (!model) {
        console.warn('applyMaterialToModel: Model is undefined');
        return 0;
    }

    // 兼容处理：检查 .object，如果不存在则假设 model 本身就是 Object3D
    const root = model.object ? model.object : model;
    
    if (!root.traverse) {
        console.warn('applyMaterialToModel: Model root object has no traverse method', root);
        return 0;
    }

    let meshCount = 0;
    const meshes = [];
    root.traverse((child) => {
        if (child.isMesh) {
            meshes.push(child);
            meshCount++;
        }
    });

    if(progressUI) progressUI.update(`发现 ${meshCount} 个构件，正在应用纹理...`, 60, startTime);

    // 避免没有mesh的情况
    if (meshes.length === 0) {
        return 0;
    }

    // 增加批处理大小以减少 setTimeout 的调用频率，提高加载速度
    const batchSize = 500;
    for (let i = 0; i < meshes.length; i += batchSize) {
        const batch = meshes.slice(i, i + batchSize);
        for (const child of batch) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = material;
        }

        if(progressUI) {
            const progress = 60 + Math.floor((i / meshes.length) * 30);
            // 传入 startTime 以便 UI 正确显示耗时
            progressUI.update(`应用纹理中... (${i + batch.length}/${meshCount})`, progress, startTime);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return meshCount;
}
