import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import fragmentsWorkerUrl from '@thatopen/fragments/dist/Worker/worker.mjs?url';
import webIfcWasmUrl from 'web-ifc/web-ifc.wasm?url';

// 1. 获取容器
const container = document.getElementById('container');

// 2. 初始化组件管理器
const components = new OBC.Components();

// 3. 创建 World (管理场景、相机、渲染器的核心)
const worlds = components.get(OBC.Worlds);
const world = worlds.create();

// 4. 配置 World 的基础组件
world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

// 启用阴影渲染
world.renderer.three.shadowMap.enabled = true;
world.renderer.three.shadowMap.type = THREE.PCFSoftShadowMap;

// 5. 初始化并启动
// 定义全局变量，供其他函数使用
let fragments, ifcLoader, highlighter;
// 存储已加载的模型，用于属性查询
let loadedModel = null;
// 构件列表数据 [{index, expressID, fragmentID, name, type}]
let componentList = [];
// 构件列表面板
let componentListPanel = null;

try {
  console.log('正在初始化组件...');
  await components.init();
  console.log('组件初始化完成');

  // 6. 场景设置 (添加灯光等默认配置)
  world.scene.setup();
  console.log('场景设置完成');

  // 7. 添加一个网格地面 (作为参照物，证明场景跑起来了)
  const grids = components.get(OBC.Grids);
  grids.create(world);
  console.log('网格地面创建完成');

  // 创建主方向光和柔和环境光，增强模型阴影效果
  const keyLight = new THREE.DirectionalLight(0xffffff, 2);
  keyLight.position.set(120, 200, 120);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 800;
  keyLight.shadow.camera.left = -300;
  keyLight.shadow.camera.right = 300;
  keyLight.shadow.camera.top = 300;
  keyLight.shadow.camera.bottom = -300;
  world.scene.three.add(keyLight);

  const fillLight = new THREE.HemisphereLight(0xffffff, 0x777777, 0.6);
  world.scene.three.add(fillLight);

  // 添加接收阴影的地面
  const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), shadowMaterial);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.01;
  shadowPlane.receiveShadow = true;
  world.scene.three.add(shadowPlane);
  console.log('灯光与地面设置完成');

  // 8. 初始化碎片管理器
  fragments = components.get(OBC.FragmentsManager);
  // indexer = components.get(OBC.IfcRelationsIndexer); // 暂时注释掉，避免 undefined 错误
  console.log('碎片管理器获取完成');

  // 初始化碎片 worker，驱动模型的后台处理
  fragments.init(fragmentsWorkerUrl);
  console.log('碎片Worker初始化完成');

  // 当相机移动时刷新碎片裁剪
  world.camera.controls.addEventListener('update', () => fragments.core.update());

  // 9. 加载IFC模型
  ifcLoader = components.get(OBC.IfcLoader);
  console.log('IFC加载器获取完成');

  // 初始化高亮器 (Select, Hover)
  highlighter = components.get(OBCF.Highlighter);
  console.log('高亮器获取完成');
  
  // 必须确保 world 已经准备好
  highlighter.setup({ world });
  console.log('高亮器Setup完成');
  
  highlighter.zoomToSelection = false; // 禁用自动缩放，只进行高亮

  // 配置高亮样式
  // 定义一个名为 'selection' 的高亮样式，颜色为半透明的橙色
  const selectionMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500, depthTest: false, opacity: 0.5, transparent: true });
  highlighter.add('selection', selectionMaterial);
  highlighter.add('hover', new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, opacity: 0.3, transparent: true }));
  console.log('高亮样式配置完成');

  // 配置IFC加载器（指定 web-ifc 的 WASM 来源）
  const wasmDir = webIfcWasmUrl.slice(0, webIfcWasmUrl.lastIndexOf('/') + 1);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: wasmDir,
      absolute: true,
    },
    customLocateFileHandler: () => webIfcWasmUrl,
  });
  console.log('IFC加载器配置完成');

  // 添加模型加载按钮和拖放区域
  createLoadingUI();
  console.log('UI创建完成，系统就绪');

} catch (error) {
  console.error("初始化失败详细信息:", error);
  // Stack trace usually helps
  if (error.stack) console.error(error.stack);
  
  const errDiv = document.createElement('div');
  errDiv.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:red; background:white; padding:20px; z-index:9999; border: 2px solid red;";
  errDiv.innerHTML = "<h3>系统初始化失败</h3><p>" + error.message + "</p><p style='font-size:10px'>" + (error.stack || '') + "</p>";
  document.body.appendChild(errDiv);
}

// 加载模型的函数 - 支持渐进式加载
async function loadModel(file) {
  try {
    console.log(`开始加载模型: ${file.name}`);
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 显示加载进度UI
    const progressUI = showLoadingProgress();
    
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const modelName = file.name?.replace(/\.[^/.]+$/, '') || 'model';
    
    progressUI.update('正在读取文件...', 20, startTime);

    let model;
    
    // 检查文件扩展名
    if (file.name.endsWith('.frag')) {
        console.log('检测到 .frag 格式，使用 FragmentsManager 加载...');
        // 直接加载二进制 Fragment 数据
        // 注意：FragmentsManager 封装了 FragmentsModels，核心方法在 core 属性上
        model = await fragments.core.load(data, {
            modelId: modelName,
        });
        console.log('Frag 加载完成');
    } else {
        console.log('检测到 IFC 格式，使用 IfcLoader 加载...');
        // 加载模型 - 使用流式加载选项
        model = await ifcLoader.load(data, true, modelName);
    }
    
    progressUI.update('正在处理几何体...', 50, startTime);
    
    model.useCamera(world.camera.three);

    // ===== 加载纹理贴图并应用 Triplanar 映射 =====
    progressUI.update('正在加载纹理贴图...', 55, startTime);

    const textureLoader = new THREE.TextureLoader();
    let modelTexture = null;
    try {
      // 加载纹理，确保路径正确 (相对于 public 根目录)
      modelTexture = await textureLoader.loadAsync('/texture.jpg');
      modelTexture.colorSpace = THREE.SRGBColorSpace;
      modelTexture.wrapS = THREE.RepeatWrapping;
      modelTexture.wrapT = THREE.RepeatWrapping;
      console.log('纹理贴图加载成功');
    } catch (e) {
      console.warn('纹理贴图加载失败，将使用纯色:', e);
    }

    // 创建 Triplanar 映射材质
    // textureScale 控制纹理密度，值越大纹理越密
    const textureScale = 0.05;
    
    // 使用 MeshStandardMaterial 并通过 onBeforeCompile 注入 Triplanar 逻辑
    // 这样可以保留 Instancing、Shadows 等原生特性
    const triplanarMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.2,
    });

    if (modelTexture) {
      triplanarMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uTexture = { value: modelTexture };
        shader.uniforms.uScale = { value: textureScale };
        
        shader.vertexShader = `
            varying vec3 vWorldPosition;
            ${shader.vertexShader}
        `;
        
        // 在 project_vertex 之前，transformed 变量包含了经过 instancing/morphing/skinning 处理后的局部坐标
        // 我们将其转换为世界坐标传给 Fragment Shader
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

        // 在 map_fragment 位置注入纹理采样逻辑
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            // 计算面法线 (World Space) 用于 Triplanar Blending
            // 使用 dFdx/dFdy 获取几何面法线，适用于硬表面模型，且无需手动处理法线变换
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

    // 收集所有 mesh 并替换材质
    let meshCount = 0;
    const meshes = [];
    model.object.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
        meshCount++;
      }
    });

    progressUI.update(`发现 ${meshCount} 个构件，正在应用纹理...`, 60, startTime);

    // 分批处理材质，避免阻塞主线程
    const batchSize = 50;
    for (let i = 0; i < meshes.length; i += batchSize) {
      const batch = meshes.slice(i, i + batchSize);

      for (const child of batch) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 替换原始材质为 Triplanar 纹理材质，去除原始颜色
        child.material = triplanarMaterial;
      }

      // 更新进度
      const progress = 60 + Math.floor((i / meshes.length) * 30);
      progressUI.update(`应用纹理中... (${i + batch.length}/${meshCount})`, progress, startTime);

      // 让出主线程，保持UI响应
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    progressUI.update('正在添加到场景...', 95, startTime);
    
    world.scene.three.add(model.object);
    fragments.core.update(true);

    // 保存模型引用，用于后续属性查询
    loadedModel = model;
    
    // 收集构件列表
    buildComponentList(model);
    
    // 调整相机视角以适应模型
    world.camera.controls.fitToSphere(model.object, true);
    
    // 计算加载耗时
    const elapsedTime = Date.now() - startTime;
    const elapsedSec = (elapsedTime / 1000).toFixed(2);
    
    progressUI.update(`加载完成！耗时 ${elapsedSec}s`, 100, startTime);
    
    // 2秒后隐藏进度条
    setTimeout(() => progressUI.hide(), 2000);
    
    console.log(`模型加载成功！共 ${meshCount} 个构件，耗时 ${elapsedSec}s`);
  } catch (error) {
    console.error('模型加载失败:', error);
    alert('模型加载失败: ' + error.message);
  }
}

// 显示加载进度UI
function showLoadingProgress() {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 2000;
    `;
    
    overlay.innerHTML = `
      <div style="color: white; font-size: 18px; margin-bottom: 20px;" id="loading-text">加载中...</div>
      <div style="width: 300px; height: 20px; background: #333; border-radius: 10px; overflow: hidden;">
        <div id="loading-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #007bff, #00d4ff); transition: width 0.3s;"></div>
      </div>
      <div style="color: #aaa; font-size: 12px; margin-top: 10px;" id="loading-percent">0%</div>
      <div style="color: #aaa; font-size: 12px; margin-top: 5px;" id="loading-time">耗时: 0.0s</div>
    `;
    
    document.body.appendChild(overlay);
  }
  
  overlay.style.display = 'flex';
  
  return {
    update: (text, percent, startTime) => {
      const textEl = document.getElementById('loading-text');
      const barEl = document.getElementById('loading-bar');
      const percentEl = document.getElementById('loading-percent');
      const timeEl = document.getElementById('loading-time');
      if (textEl) textEl.textContent = text;
      if (barEl) barEl.style.width = percent + '%';
      if (percentEl) percentEl.textContent = percent + '%';
      // 实时显示加载耗时
      if (timeEl && startTime) {
        const elapsedTime = Date.now() - startTime;
        const elapsedSec = (elapsedTime / 1000).toFixed(1);
        timeEl.textContent = `耗时: ${elapsedSec}s`;
      }
    },
    hide: () => {
      overlay.style.display = 'none';
    }
  };
}

// 创建属性面板
function createPropertiesPanel() {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    width: 300px;
    max-height: 500px;
    background: rgba(255, 255, 255, 0.9);
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    display: none;
    overflow-y: auto;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #333;
    z-index: 1000;
  `;
  panel.innerHTML = '<h3>构件属性</h3><div id="props-content"></div>';
  document.body.appendChild(panel);
  return panel;
}

const propertiesPanel = createPropertiesPanel();

// 交互逻辑：鼠标悬浮高亮
container.addEventListener('mousemove', () => {
  if (highlighter) {
    highlighter.highlight('hover');
  }
});

container.addEventListener('click', async () => {
  const selection = await highlighter.highlight('selection');
  if (selection && Object.keys(selection).length > 0) {
    const fragmentID = Object.keys(selection)[0];
    const expressIDs = selection[fragmentID];
    if (expressIDs && expressIDs.size > 0) {
        const expressID = [...expressIDs][0];
        displayProperties(fragmentID, expressID);
        // 同步高亮构件列表
        highlightComponentInList(expressID);
    }
  } else {
    // 点击空白处取消选中
    highlighter.clear('selection');
    propertiesPanel.style.display = 'none';
    clearComponentListHighlight();
  }
});

// 显示属性函数
async function displayProperties(fragmentID, expressID) {
  const content = propertiesPanel.querySelector('#props-content');
  content.innerHTML = '正在读取属性...';
  propertiesPanel.style.display = 'block';

  try {
    let html = `<p><b>Express ID:</b> ${expressID}</p>`;
    let html2 = '';

    // 尝试从 loadedModel 获取属性
    if (loadedModel) {
      // 方法1: 尝试使用 getProperties (如果可用)
      if (typeof loadedModel.getProperties === 'function') {
        try {
          const props = await loadedModel.getProperties(expressID);
          if (props) {
            html2 += formatProperties(props);
          }
        } catch (e) {
          console.warn('getProperties failed:', e);
        }
      }

      // 方法2: 尝试从 model.data 直接读取 (Fragments 内部结构)
      if (!html2 && loadedModel.data) {
        try {
          // FragmentsGroup 可能有 data 属性包含原始IFC数据
          const allProps = loadedModel.data;
          if (allProps && allProps[expressID]) {
            html2 += formatProperties(allProps[expressID]);
          }
        } catch (e) {
          console.warn('data read failed:', e);
        }
      }

      // 方法3: 尝试从 ifcLoader 获取属性 (如果 loader 保持了 web-ifc 实例)
      if (!html2 && ifcLoader && ifcLoader.webIfc) {
        try {
          const webIfc = ifcLoader.webIfc;
          const modelID = 0; // 默认第一个模型
          const props = webIfc.GetLine(modelID, expressID);
          if (props) {
            html2 += formatProperties(props);
          }
        } catch (e) {
          console.warn('webIfc GetLine failed:', e);
        }
      }
    }

    // 如果没有获取到属性，尝试从 fragment 获取基本信息
    if (!html2) {
      const fragment = fragments.list.get(fragmentID);
      if (fragment) {
        html += `<p><b>Fragment ID:</b> ${fragmentID.substring(0, 8)}...</p>`;
        if (fragment.mesh && fragment.mesh.name) {
          html += `<p><b>名称:</b> ${fragment.mesh.name}</p>`;
        }
        html2 = '<p style="color: #888;">详细属性暂不可用</p>';
      }
    }

    content.innerHTML = html + html2;
  } catch (error) {
    console.error('属性读取错误:', error);
    content.innerHTML = `<p style="color: red;">读取属性失败: ${error.message}</p>`;
  }
}

// 格式化属性对象为HTML
function formatProperties(props) {
  if (!props) return '';
  
  let html = '<div style="margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">';
  
  if (typeof props === 'object') {
    for (const [key, value] of Object.entries(props)) {
      if (value !== null && value !== undefined && key !== 'expressID') {
        let displayValue = value;
        if (typeof value === 'object') {
          if (value.value !== undefined) {
            displayValue = value.value;
          } else {
            displayValue = JSON.stringify(value);
          }
        }
        html += `<p style="margin: 3px 0; font-size: 12px;"><b>${key}:</b> ${displayValue}</p>`;
      }
    }
  } else {
    html += `<pre style="font-size: 11px; overflow-x: auto;">${JSON.stringify(props, null, 2)}</pre>`;
  }
  
  html += '</div>';
  return html;
}

// ==========================================
// 构件列表面板
// ==========================================

// 创建构件列表面板
function createComponentListPanel() {
  const panel = document.createElement('div');
  panel.id = 'component-list-panel';
  panel.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 320px;
    height: 100%;
    background: rgba(30, 30, 40, 0.95);
    color: #eee;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    display: none;
    flex-direction: column;
    z-index: 1500;
    box-shadow: 3px 0 15px rgba(0,0,0,0.5);
    transition: transform 0.3s ease;
  `;

  panel.innerHTML = `
    <div style="padding: 15px; background: rgba(0,123,255,0.15); border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 16px; font-weight: bold;">🧩 构件列表</span>
      <span id="component-count" style="font-size: 12px; color: #aaa;">0 个构件</span>
    </div>
    <div style="padding: 8px 15px; border-bottom: 1px solid #333;">
      <input id="component-search" type="text" placeholder="🔍 搜索构件..." style="
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #555;
        border-radius: 4px;
        background: #222;
        color: #eee;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
      " />
    </div>
    <div id="component-list-content" style="flex: 1; overflow-y: auto; padding: 5px 0;"></div>
  `;

  document.body.appendChild(panel);

  // 搜索过滤
  const searchInput = panel.querySelector('#component-search');
  searchInput.addEventListener('input', (e) => {
    filterComponentList(e.target.value.trim().toLowerCase());
  });

  return panel;
}

componentListPanel = createComponentListPanel();

// 收集模型中所有构件
async function buildComponentList(model) {
  componentList = [];

  try {
    // Fragments 模型使用异步 API 获取构件列表
    // 获取所有带几何体的构件 ID
    const localIds = await model.getItemsIdsWithGeometry();
    console.log(`模型包含 ${localIds.length} 个带几何体的构件`);

    if (localIds.length === 0) {
      console.warn('未找到带几何体的构件');
      renderComponentList(componentList);
      return;
    }

    // 获取构件的分类/类别信息
    let categories = [];
    try {
      categories = await model.getItemsWithGeometryCategories();
    } catch (e) {
      console.warn('无法获取构件分类:', e);
    }

    // 逐批获取构件的详细属性数据
    const batchSize = 200;
    for (let i = 0; i < localIds.length; i += batchSize) {
      const batchIds = localIds.slice(i, i + batchSize);
      let batchData = [];
      try {
        batchData = await model.getItemsData(batchIds);
      } catch (e) {
        // 如果批量获取失败，逐个跳过
      }

      for (let j = 0; j < batchIds.length; j++) {
        const localId = batchIds[j];
        const globalIdx = i + j;
        const category = categories[globalIdx] || '';
        const data = batchData[j] || {};

        // 尝试提取名称
        let name = '';
        if (data.Name && data.Name.value !== undefined) {
          name = String(data.Name.value);
        } else if (data.Name) {
          name = String(data.Name);
        }
        if (!name) {
          name = category ? `${category} #${localId}` : `构件 #${localId}`;
        }

        componentList.push({
          index: globalIdx + 1,
          localId,
          name,
          type: category || 'Unknown',
        });
      }
    }
  } catch (err) {
    console.error('构建构件列表失败:', err);
  }

  console.log(`构件列表已构建，共 ${componentList.length} 个构件`);
  renderComponentList(componentList);
}

// 渲染构件列表到面板
function renderComponentList(list) {
  const content = document.getElementById('component-list-content');
  const countEl = document.getElementById('component-count');
  if (!content) return;

  if (countEl) countEl.textContent = `${list.length} 个构件`;

  if (list.length === 0) {
    content.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">暂无构件数据<br>请先加载模型</div>';
    return;
  }

  let html = '';
  for (const item of list) {
    html += `
      <div class="comp-item" data-index="${item.index}" data-localid="${item.localId}" style="
        padding: 8px 15px;
        cursor: pointer;
        border-bottom: 1px solid #2a2a35;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: background 0.15s;
      " onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="if(!this.classList.contains('comp-active'))this.style.background='transparent'">
        <span style="
          display: inline-block;
          min-width: 32px;
          text-align: center;
          padding: 2px 6px;
          background: rgba(0,123,255,0.2);
          border-radius: 3px;
          font-size: 11px;
          color: #6cb4ff;
        ">${item.index}</span>
        <div style="flex:1; overflow: hidden;">
          <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px;">${item.name}</div>
          <div style="font-size: 11px; color: #888; margin-top: 2px;">${item.type} (ID: ${item.localId})</div>
        </div>
      </div>
    `;
  }

  content.innerHTML = html;

  // 绑定点击事件
  content.querySelectorAll('.comp-item').forEach((el) => {
    el.addEventListener('click', () => {
      const localId = parseInt(el.getAttribute('data-localid'), 10);
      onComponentListItemClick(localId);
    });
  });
}

// 搜索过滤
function filterComponentList(keyword) {
  if (!keyword) {
    renderComponentList(componentList);
    return;
  }
  const filtered = componentList.filter(item =>
    item.name.toLowerCase().includes(keyword) ||
    item.type.toLowerCase().includes(keyword) ||
    String(item.index).includes(keyword)
  );
  renderComponentList(filtered);
}

// 点击列表项 → 3D高亮对应构件
async function onComponentListItemClick(localId) {
  if (!loadedModel) return;

  // 清除旧高亮
  clearComponentListHighlight();

  // 在3D场景中高亮该构件
  try {
    // 先重置之前的高亮
    await loadedModel.resetColor(undefined);
    // 用橙色高亮选中的构件
    await loadedModel.setColor([localId], { r: 1, g: 0.65, b: 0, a: 1 });
    // 半透明化其他构件
    // await loadedModel.setOpacity(undefined, 0.3);
    // await loadedModel.setOpacity([localId], 1);
  } catch (e) {
    console.warn('高亮构件失败:', e);
  }

  // 高亮列表项
  highlightComponentInListByLocalId(localId);

  // 将相机对准该构件
  try {
    const box = await loadedModel.getMergedBox([localId]);
    if (box && !box.isEmpty()) {
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      world.camera.controls.fitToSphere(sphere, true);
    }
  } catch (e) {
    console.warn('定位构件失败:', e);
  }
}

// 根据 expressID / localId 高亮列表项（从3D点击触发）
function highlightComponentInList(expressID) {
  clearComponentListHighlight();
  const content = document.getElementById('component-list-content');
  if (!content) return;

  // 在构件列表中查找匹配的 localId
  const item = componentList.find(c => c.localId === expressID);
  if (item) {
    highlightComponentInListByLocalId(item.localId);
  }
}

// 根据 localId 高亮列表项（从列表点击触发）
function highlightComponentInListByLocalId(localId) {
  clearComponentListHighlight();
  const content = document.getElementById('component-list-content');
  if (!content) return;
  const el = content.querySelector(`[data-localid="${localId}"]`);
  if (el) {
    el.classList.add('comp-active');
    el.style.background = 'rgba(255, 165, 0, 0.3)';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// 清除列表高亮
function clearComponentListHighlight() {
  const content = document.getElementById('component-list-content');
  if (!content) return;
  content.querySelectorAll('.comp-active').forEach((el) => {
    el.classList.remove('comp-active');
    el.style.background = 'transparent';
  });
}

// 切换构件列表面板的显示
function toggleComponentListPanel() {
  if (!componentListPanel) return;
  if (componentListPanel.style.display === 'none') {
    componentListPanel.style.display = 'flex';
  } else {
    componentListPanel.style.display = 'none';
  }
}

// 创建加载界面
function createLoadingUI() {
  const uploadBtn = document.createElement('button');
  uploadBtn.innerHTML = '📁 加载模型 (IFC/Frag)';
  uploadBtn.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    z-index: 1000;
  `;
  
  uploadBtn.onmouseover = () => uploadBtn.style.background = '#0056b3';
  uploadBtn.onmouseout = () => uploadBtn.style.background = '#007bff';
  
  // 创建隐藏的文件输入
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.ifc,.frag';
  fileInput.style.display = 'none';
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      loadModel(file);
    }
  };
  
  uploadBtn.onclick = () => fileInput.click();
  
  // 添加拖放功能
  container.ondragover = (e) => {
    e.preventDefault();
    container.style.border = '3px dashed #007bff';
  };
  
  container.ondragleave = () => {
    container.style.border = 'none';
  };
  
  container.ondrop = (e) => {
    e.preventDefault();
    container.style.border = 'none';
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.ifc') || file.name.endsWith('.frag'))) {
      loadModel(file);
    } else {
      alert('请拖放 IFC 或 Frag 格式的文件！');
    }
  };
  
  document.body.appendChild(uploadBtn);
  document.body.appendChild(fileInput);
  
  // 构件列表按钮
  const listBtn = document.createElement('button');
  listBtn.innerHTML = '🧩 构件列表';
  listBtn.style.cssText = `
    position: absolute;
    top: 20px;
    left: 250px;
    padding: 10px 20px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    z-index: 1000;
  `;
  listBtn.onmouseover = () => listBtn.style.background = '#1e7e34';
  listBtn.onmouseout = () => listBtn.style.background = '#28a745';
  listBtn.onclick = () => toggleComponentListPanel();
  document.body.appendChild(listBtn);
  
  // 添加说明文字
  const instructions = document.createElement('div');
  instructions.innerHTML = `
    <p>🏗️ 桥梁BIM查看器</p>
    <p style="font-size: 12px; margin-top: 5px;">支持拖放或点击按钮加载模型</p>
    <p style="font-size: 12px; margin-top: 5px;">支持 .ifc 和 .frag 格式</p>
    <p style="font-size: 12px; margin-top: 5px;">🖱️ 鼠标悬浮：预览高亮</p>
    <p style="font-size: 12px; margin-top: 5px;">🖱️ 左键点击：选中构件并查看属性</p>
    <p style="font-size: 12px; margin-top: 5px;">🖱️ 滚轮：缩放视图</p>
    <p style="font-size: 12px; margin-top: 5px;">🖱️ 右键拖动：旋转视图</p>
  `;
  instructions.style.cssText = `
    position: absolute;
    top: 70px;
    left: 20px;
    color: white;
    background: rgba(0,0,0,0.7);
    padding: 15px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    z-index: 1000;
  `;
  document.body.appendChild(instructions);
}