import * as THREE from 'three';

let panel = null;
let currentForce = 500; // 当前全局施加力

// 存储所有可用于模拟的构件引用
let allTargetMeshes = []; // [{mesh, originalMaterial}]

// 存储当前正在受力的构件数据
// 结构: { index: number, mesh: Mesh, stiffness: number, originalMaterial: Material }
let activeSimulationMeshes = []; 

// 当前选中的受力构件索引 (用于显示详情)
let selectedSimulationIndex = -1;

export function setupForceSimulationUI(container, getModel, getModelRoot) {
    if (document.getElementById('force-sim-panel')) return;

    panel = document.createElement('div');
    panel.id = 'force-sim-panel';
    panel.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 280px;
        background: rgba(30, 30, 40, 0.95);
        color: #eee;
        padding: 15px;
        border-radius: 8px;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        z-index: 1000;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        display: none;
        transition: transform 0.3s ease;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; color: #ffab40; display: flex; align-items: center; gap: 6px;">
                <span>💥</span> 力学模拟控制台
            </h3>
            <span style="font-size: 10px; background: rgba(255,171,64,0.2); color: #ffab40; padding: 2px 6px; border-radius: 4px;">LIVE</span>
        </div>

        <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <label style="font-weight: bold; color: #ccc;">全局施加力 (Global Force)</label>
                <span id="force-val" style="color: #ffab40; font-family: monospace; font-size: 14px;">500 kN</span>
            </div>
            <input type="range" id="force-slider" min="0" max="3000" step="10" value="500" style="width: 100%; cursor: ew-resize; accent-color: #ffab40;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 4px;">
                <span>0 kN</span>
                <span>3000 kN</span>
            </div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 15px;">
            <button id="apply-force-btn" style="
                flex: 1; 
                padding: 10px; 
                background: linear-gradient(135deg, #e65100, #ff6d00); 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;
                font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                transition: transform 0.1s, box-shadow 0.2s;
            ">🎲 生成随机受力点</button>
            <button id="reset-force-btn" style="
                width: 70px; 
                padding: 10px; 
                background: #444; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;
                transition: background 0.2s;
            ">🔄 重置</button>
        </div>

        <div id="simulation-info" style="
            padding-top: 10px; 
            border-top: 1px solid rgba(255,255,255,0.1);
            min-height: 80px;
        ">
            <div style="color: #888; text-align: center; margin-top: 20px; font-style: italic;">
                点击 "生成随机受力点" 开始<br>拖动滑块实时观察形变
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // 事件绑定
    const slider = panel.querySelector('#force-slider');
    const label = panel.querySelector('#force-val');
    const applyBtn = panel.querySelector('#apply-force-btn');
    const resetBtn = panel.querySelector('#reset-force-btn');

    // 交互特效
    applyBtn.onmousedown = () => applyBtn.style.transform = 'scale(0.97)';
    applyBtn.onmouseup = () => applyBtn.style.transform = 'scale(1)';

    // 滑块实时控制
    slider.oninput = (e) => {
        currentForce = parseInt(e.target.value);
        label.textContent = `${currentForce} kN`;
        // 实时更新所有受力构件的颜色
        updateSimulationVisuals();
    };
    
    applyBtn.onclick = () => {
        const root = getModelRoot();
        if (root) {
            initRandomSimulation(root);
        } else {
            alert("请先加载模型！");
        }
    };

    resetBtn.onclick = () => {
        resetSimulation();
        slider.value = 500;
        currentForce = 500;
        label.textContent = "500 kN";
    };

    return {
        show: () => panel.style.display = 'block',
        hide: () => panel.style.display = 'none',
        // 暴露一个方法供外部(如main.js的点击事件)调用，用于选中特定的受力构件
        selectMesh: (mesh) => highlightSimulationInfo(mesh)
    };
}

// 采集模型中可用的构件
export function collectTargetMeshes(modelRoot) {
    allTargetMeshes = [];
    activeSimulationMeshes = [];
    
    const candidates = [];
    modelRoot.traverse((child) => {
        if (child.isMesh && child.geometry) {
            candidates.push(child);
        }
    });

    // 限制数量，防止性能问题
    const count = Math.min(30, candidates.length);
    for (let i = 0; i < count; i++) {
        allTargetMeshes.push({
            mesh: candidates[i],
            originalMaterial: candidates[i].material
        });
    }
    console.log(`力学模拟：已索引 ${allTargetMeshes.length} 个潜在受力构件`);
}

// 初始化随机模拟（点击按钮触发）
function initRandomSimulation(modelRoot) {
    if (allTargetMeshes.length === 0) {
        collectTargetMeshes(modelRoot);
    }
    if (allTargetMeshes.length === 0) return;

    // 1. 清理旧的模拟状态
    resetSimulation();

    // 2. 随机选取 1 个构件进行模拟 (修复：只选中一个)
    const simulationCount = 1; 
    const indices = new Set();
    while(indices.size < simulationCount && indices.size < allTargetMeshes.length) {
        indices.add(Math.floor(Math.random() * allTargetMeshes.length));
    }

    // 3. 初始化这些构件的数据
    indices.forEach(idx => {
        const target = allTargetMeshes[idx];
        
        // 赋予随机物理属性
        const stiffness = 0.5 + Math.random() * 1.5; // 刚度 0.5 ~ 2.0

        // 准备克隆材质（用于变色）
        let newMaterial;
        if (Array.isArray(target.originalMaterial)) {
            newMaterial = target.originalMaterial.map(m => m.clone());
        } else if (target.originalMaterial) {
            newMaterial = target.originalMaterial.clone();
        } else {
            newMaterial = new THREE.MeshStandardMaterial();
        }
        
        // 应用新材质
        target.mesh.material = newMaterial;

        activeSimulationMeshes.push({
            index: idx,
            mesh: target.mesh,
            originalMaterial: target.originalMaterial,
            stiffness: stiffness,
            currentMaterial: newMaterial
        });
    });

    // 4. 默认选中第一个受力构件用于展示详情
    if (activeSimulationMeshes.length > 0) {
        selectedSimulationIndex = 0;
    }

    // 5. 立即执行一次渲染
    updateSimulationVisuals();
}

// 核心：根据当前 Force 和 Stiffness 更新颜色
function updateSimulationVisuals() {
    if (activeSimulationMeshes.length === 0) return;

    activeSimulationMeshes.forEach((data, i) => {
        // 物理公式：形变 = 力 / 刚度
        const deformation = (currentForce / 10) / data.stiffness;
        const maxVisualDeformation = 150; // 假设150mm为最大可视化形变
        const t = Math.min(deformation / maxVisualDeformation, 1.0);

        // 计算颜色
        const color = calculateStressColor(t);
        
        // 应用颜色到材质
        const mats = Array.isArray(data.currentMaterial) ? data.currentMaterial : [data.currentMaterial];
        mats.forEach(m => {
            m.color.copy(color.diffuse);
            m.emissive.copy(color.emissive);
            m.needsUpdate = true;
        });

        // 如果是被选中的构件，更新面板详情
        if (i === selectedSimulationIndex) {
            updateInfoPanel(data, currentForce, deformation, t, color.css);
        }
    });
}

function calculateStressColor(t) {
    // 0.0 (安全/绿) -> 0.5 (警告/黄) -> 1.0 (危险/红)
    const safe = new THREE.Color(0x4caf50); // Green
    const warn = new THREE.Color(0xffeb3b); // Yellow
    const danger = new THREE.Color(0xf44336); // Red

    let r, g, b;
    if (t < 0.5) {
        // Green to Yellow
        const alpha = t * 2.0;
        r = safe.r + (warn.r - safe.r) * alpha;
        g = safe.g + (warn.g - safe.g) * alpha;
        b = safe.b + (warn.b - safe.b) * alpha;
    } else {
        // Yellow to Red
        const alpha = (t - 0.5) * 2.0;
        r = warn.r + (danger.r - warn.r) * alpha;
        g = warn.g + (danger.g - warn.g) * alpha;
        b = warn.b + (danger.b - warn.b) * alpha;
    }

    const diffuse = new THREE.Color(r, g, b);
    // 发光强度随危险程度增加
    const emissive = new THREE.Color(r * 0.4 * t, g * 0.2 * t, b * 0.1 * t); 
    
    return {
        diffuse: diffuse,
        emissive: emissive,
        css: `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`
    };
}

// 外部调用：当用户在3D场景中点击模型时，检查是否点击了受力构件
function highlightSimulationInfo(clickedMesh) {
    const foundIndex = activeSimulationMeshes.findIndex(item => item.mesh === clickedMesh);
    if (foundIndex !== -1) {
        selectedSimulationIndex = foundIndex;
        // 强制刷新一下UI显示当前选中的数据
        updateSimulationVisuals();
        return true; // 告知外部已处理
    }
    return false;
}

function resetSimulation() {
    // 恢复所有受力构件的原始材质
    activeSimulationMeshes.forEach(data => {
        if (data.mesh) {
            data.mesh.material = data.originalMaterial;
            
            // 销毁临时材质
            const tempMats = Array.isArray(data.currentMaterial) ? data.currentMaterial : [data.currentMaterial];
            tempMats.forEach(m => m.dispose());
        }
    });
    
    activeSimulationMeshes = [];
    selectedSimulationIndex = -1;
    
    const infoEl = document.getElementById('simulation-info');
    if (infoEl) infoEl.innerHTML = '<div style="color: #888; text-align: center; margin-top: 20px;">系统就绪</div>';
}

function updateInfoPanel(data, force, deformation, intensity, colorCss) {
    const infoEl = document.getElementById('simulation-info');
    if (!infoEl) return;

    let status = "正常";
    let statusColor = "#4caf50";
    
    if (intensity > 0.4) { status = "注意"; statusColor = "#ffeb3b"; }
    if (intensity > 0.7) { status = "警告"; statusColor = "#ff9800"; }
    if (intensity > 0.9) { status = "⚠ 危险"; statusColor = "#f44336"; }

    const meshName = data.mesh.name || `构件 #${data.index + 1}`;

    infoEl.innerHTML = `
        <div style="font-size: 11px; margin-bottom: 5px; color: #aaa; display: flex; justify-content: space-between;">
            <span>当前选中受力构件详情:</span>
            <span style="color: ${colorCss}">●</span>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border-left: 3px solid ${colorCss};">
            <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: #fff; font-size: 13px;">${meshName}</strong>
                <span style="background: ${statusColor}; color: #000; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">${status}</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                <div>
                    <div style="color: #888;">受力 (Force)</div>
                    <div style="color: #ddd;">${force} kN</div>
                </div>
                <div>
                    <div style="color: #888;">刚度 (Stiffness)</div>
                    <div style="color: #ddd;">${data.stiffness.toFixed(2)}</div>
                </div>
                <div style="grid-column: span 2; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #888;">形变量 (Deformation)</span>
                        <span style="color: ${intensity > 0.8 ? '#ff5252' : '#fff'}; font-weight: bold;">${deformation.toFixed(1)} mm</span>
                    </div>
                    <div style="width: 100%; height: 4px; background: #333; margin-top: 4px; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${Math.min(intensity * 100, 100)}%; height: 100%; background: ${colorCss}; transition: width 0.1s;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}