import * as THREE from 'three';
import { initSystem } from './core/setup.js';
import { createTriplanarMaterial, applyMaterialToModel } from './utils/materials.js';
import { showLoadingProgress } from './ui/loading-screen.js';
import { createLoadingUI } from './ui/toolbar.js';
import { setupPropertiesPanel, displayProperties, hidePropertiesPanel } from './ui/properties-panel.js';
import { setupComponentListPanel, toggleComponentListPanel, buildComponentList, highlightComponentInList, clearComponentListHighlight } from './ui/component-list-panel.js';
import { setupModelListPanel, updateModelListUI } from './ui/model-list-panel.js';
import { setupForceSimulationUI, collectTargetMeshes } from './features/force-simulation.js';

// 全局状态
const state = {
  models: [],     // 存储所有加载的模型
  loadedModel: null, // 当前“主要”模型，用于兼容现有单模型逻辑 (力学模拟等)
};

async function main() {
  const container = document.getElementById('container');

  // 1. 系统初始化
  const { components, world, fragments, ifcLoader, highlighter } = await initSystem(container);

  // 2. 初始化UI组件
  setupPropertiesPanel();
  setupComponentListPanel((localId) => onComponentListItemClick(localId)); // 传递列表点击回调
  
  // 初始化模型管理列表面板
  const modelListPanel = setupModelListPanel(
      (model) => removeModel(model),
      () => removeAllModels(),
      (model) => selectModel(model)
  );

  // 初始化力学模拟面板，但先隐藏，等模型加载后显示
  const simPanel = setupForceSimulationUI(
      container, 
      () => state.loadedModel, 
      () => state.loadedModel ? (state.loadedModel.object || state.loadedModel) : null
  );
  
  createLoadingUI(
      container, 
      (file) => loadModel(file), 
      () => toggleComponentListPanel(),
      () => { // 切换模型列表面板显示
          modelListPanel.style.display = (modelListPanel.style.display === 'none') ? 'flex' : 'none';
      }
  );

  // 3. 交互事件处理
  setupInteractions(container, highlighter);

  // ==========================================
  // 核心功能函数
  // ==========================================

  // 切换查看的模型
  function selectModel(model) {
      if (state.loadedModel === model) return;
      console.log('切换查看模型:', model.name);
      
      state.loadedModel = model;
      
      // 清除旧的高亮
      try { if (highlighter) highlighter.clear(); } catch(e) {}
      
      // 刷新构件列表
      buildComponentList(state.loadedModel, (localId) => onComponentListItemClick(localId));
      
      // 确保力学面板显示
      try { if (simPanel) simPanel.show(); } catch(e) {}

      // 更新模型列表UI高亮
      updateModelListUI(state.models, state.loadedModel, removeModel, selectModel);
  }

  // 移除单个模型
  function removeModel(model) {
      try {
          console.log('移除模型:', model.name);
          
          // 1. 先清理高亮（在 dispose 资源之前进行）
          try { if (highlighter) highlighter.clear(); } catch(e) { console.warn('清理高亮失败:', e); }
          hidePropertiesPanel();
          
          // 2. 从场景移除
          const modelObject = model.object || model;
          if (modelObject && modelObject.parent) {
              modelObject.parent.remove(modelObject);
          }
          
          // 3. 资源释放 - 使用 try/catch 包裹每个步骤，防止一个失败导致全部阻塞
          try {
              if (modelObject && modelObject.traverse) {
                  modelObject.traverse((child) => {
                      try {
                          if (child.geometry) child.geometry.dispose();
                          if (child.material) {
                              if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                              else child.material.dispose();
                          }
                      } catch(e) { /* 忽略单个子节点清理错误 */ }
                  });
              }
          } catch(e) { console.warn('Traverse dispose error:', e); }

          // 4. 更新状态
          state.models = state.models.filter(m => m !== model);
          if (state.loadedModel === model) {
              // 切换到下一个可用的模型 (如果有的话)
              state.loadedModel = state.models.length > 0 ? state.models[state.models.length - 1] : null;
              
              if (!state.loadedModel) {
                  try { if (simPanel) simPanel.hide(); } catch(e) {}
              }
          }

          // 不管是否切换了 loadedModel，只要 current loadedModel 发生了变化 或者 为空，都应该重新构建列表
          // 如果删除了非 loadedModel，其实列表不需要变。但如果删除了 loadedModel，列表需要变为新的 loadedModel 或者清空
          // 为简单起见，我们总是基于当前的 state.loadedModel 刷新列表
          buildComponentList(state.loadedModel, (localId) => onComponentListItemClick(localId));

          // 5. 更新UI
          updateModelListUI(state.models, state.loadedModel, removeModel, selectModel);
          
          // 6. 刷新场景 - 需要在 dispose 之后进行
          try { fragments.core.update(true); } catch(e) { console.warn('Scene update error:', e); }
          
      } catch(e) {
          console.error('移除模型时发生错误:', e);
      }
  }

  // 移除所有模型
  function removeAllModels() {
      try {
          // 先清理高亮
          try { if (highlighter) highlighter.clear(); } catch(e) {}
          hidePropertiesPanel();
          
          // 从场景移除所有模型并释放资源
          for (const model of state.models) {
              try {
                  const modelObject = model.object || model;
                  if (modelObject && modelObject.parent) {
                      modelObject.parent.remove(modelObject);
                  }
                  if (modelObject && modelObject.traverse) {
                      modelObject.traverse((child) => {
                          try {
                              if (child.geometry) child.geometry.dispose();
                              if (child.material) {
                                  if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                                  else child.material.dispose();
                              }
                          } catch(e) { /* 忽略 */ }
                      });
                  }
              } catch(e) { console.warn('移除模型失败:', model.name, e); }
          }
          
          // 清空状态
          state.models = [];
          state.loadedModel = null;
          
          // 更新UI
          try { if (simPanel) simPanel.hide(); } catch(e) {}
          updateModelListUI(state.models, state.loadedModel, removeModel, selectModel);
          // 清空构件列表
          buildComponentList(null, (localId) => onComponentListItemClick(localId));
          
          // 刷新场景
          try { fragments.core.update(true); } catch(e) { console.warn('Scene update error:', e); }
          
      } catch(e) {
          console.error('清空模型时发生错误:', e);
      }
  }

  // 加载模型主逻辑
  async function loadModel(file) {
    try {
      console.log(`开始加载模型: ${file.name}`);
      const startTime = Date.now();
      const progressUI = showLoadingProgress();
      
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const modelName = file.name || 'model'; // 保留扩展名，或者 file.name
      
      progressUI.update('正在读取文件...', 20, startTime);
  
      let model;
      if (file.name.endsWith('.frag')) {
          console.log('检测到 .frag 格式，使用 FragmentsManager 加载...');
          // 尝试恢复之前传递配置对象的方式，以修复可能的 modelId 错误
          // 如果新版本不需要，可能是库的特定要求
          // 假设是 openbim-components 的 FragmentsManager，load 方法通常签名是 load(data, config?)
          try {
             model = await fragments.core.load(data, { modelId: modelName });
          } catch (loadError) {
             console.warn("带 modelId 加载失败，尝试不带参数加载...", loadError);
             model = await fragments.core.load(data);
          }
          
          // 附加快捷属性
          if(model) {
              model.name = modelName;
              model.isFragment = true;
          }
      } else {
          console.log('检测到 IFC 格式，使用 IfcLoader 加载...');
          // ifcLoader.load 可能返回 mesh
          model = await ifcLoader.load(data, true, modelName);
          if (!model.name) model.name = modelName;
      }
      
      progressUI.update('正在处理几何体...', 50, startTime);
      
      if (!model) {
        throw new Error("模型加载返回空值");
      }

      // 调试相机构造
      const threeCamera = world.camera.three;
      if (!threeCamera) {
          console.warn("World camera.three is undefined");
      } else {
          // 仅当方法存在时调用
          if (typeof model.useCamera === 'function') {
             try {
               model.useCamera(threeCamera);
             } catch (e) {
               console.warn("useCamera call failed:", e);
             }
          }
      }
  
      // 应用纹理
      const material = await createTriplanarMaterial();
      await applyMaterialToModel(model, material, progressUI, startTime); // 传入 startTime
  
      progressUI.update('正在添加到场景...', 95, startTime);
      
      // 添加到场景，兼容 model.object 或 model 本身
      const modelObject = model.object || model;
      if (modelObject) {
         world.scene.three.add(modelObject);
      } else {
         throw new Error("无法获取模型几何体对象 (model.object is undefined)");
      }

      fragments.core.update(true);
  
      // 更新状态
      state.models.push(model);
      state.loadedModel = model;
      updateModelListUI(state.models, state.loadedModel, removeModel, selectModel);
      
      // 采集前15个 mesh 用于力学模拟 (仅针对新加载的)
      collectTargetMeshes(modelObject);
      
      // 构建构件列表 - 不使用 await，使其在后台运行，避免增加加载时间计数
      // 注意：这里还是只构建最新加载模型的列表
      buildComponentList(model, (localId) => onComponentListItemClick(localId));
      
      // 显示力学模拟面板
      if (simPanel) simPanel.show();
      
      if (world.camera.controls && modelObject) {
          try {
            // 计算模型包围盒球体
            const sphere = new THREE.Sphere();
            if (modelObject.geometry && modelObject.geometry.boundingBox) {
               modelObject.geometry.boundingBox.getBoundingSphere(sphere);
            } else {
               // 兜底：如果没有 boundingBox，尝试计算一个
               const box = new THREE.Box3().setFromObject(modelObject);
               box.getBoundingSphere(sphere);
            }
             
            // 调整相机适应球体，保持一定距离防止过近
            world.camera.controls.fitToSphere(sphere, true);
            
            // 设置最小/最大距离，防止缩放过小或过大导致模型消失
            // 根据 sphere 半径动态调整 minDistance 可能更好，这里先给固定值保护
            world.camera.controls.minDistance = 10; 
            world.camera.controls.maxDistance = 5000;
            
          } catch(e) { console.warn("Fit to sphere failed:", e); }
      }
      
      const elapsedTime = Date.now() - startTime;
      progressUI.update(`加载完成！耗时 ${(elapsedTime / 1000).toFixed(2)}s`, 100, startTime);
      setTimeout(() => progressUI.hide(), 2000);
      
      console.log('模型加载成功');
    } catch (error) {
      console.error('模型加载失败:', error);
      alert('模型加载失败: ' + error.message);
    }
  }

  // 交互事件监听
  function setupInteractions(container, highlighter) {
    // 缓存当前选中的 expressID，供双击使用
    let lastSelectedExpressID = null;

    // 1. 鼠标悬停高亮
    container.addEventListener('mousemove', () => {
      if (highlighter) highlighter.highlight('hover');
    });

    // 2. 左键单击：3D高亮 + 显示属性面板（不操作列表）
    container.addEventListener('click', async (event) => {
      const selection = await highlighter.highlight('selection');
      
      if (selection && Object.keys(selection).length > 0) {
        const fragmentID = Object.keys(selection)[0];
        const expressIDs = selection[fragmentID];
        if (expressIDs && expressIDs.size > 0) {
            const expressID = [...expressIDs][0];
            lastSelectedExpressID = expressID; // 缓存选中ID
            
            // 显示属性
            displayProperties(fragmentID, expressID, { loadedModel: state.loadedModel, ifcLoader, fragments });
        }
      } else {
        lastSelectedExpressID = null;
        highlighter.clear('selection');
        hidePropertiesPanel();
        clearComponentListHighlight();
      }
    });

    // 3. 左键双击：强制弹出构件列表 + 自动滚动高亮对应构件
    container.addEventListener('dblclick', () => {
      if (lastSelectedExpressID !== null) {
        console.log(`双击定位构件 ID: ${lastSelectedExpressID}`);
        highlightComponentInList(lastSelectedExpressID, true); // forceShow=true，强制弹出面板
      }
    });

    // 4. 右键：阻止默认菜单（保留以后扩展）
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
  }
  
  // 列表点击处理函数
  async function onComponentListItemClick(localId) {
    if (!state.loadedModel) return;

    // 清除列表高亮样式
    clearComponentListHighlight();

    // 清除鼠标交互的高亮状态，避免冲突
    if (highlighter) highlighter.clear();

    // 3D高亮
    try {
      // 先重置当前模型的所有颜色
      await state.loadedModel.resetColor();
      // 设置为显眼的亮黄色
      await state.loadedModel.setColor([localId], { r: 1, g: 1, b: 0, a: 1 });
    } catch (e) {
      console.warn('高亮构件失败:', e);
    }

    highlightComponentInList(localId);

    // 相机定位
    try {
      const box = await state.loadedModel.getMergedBox([localId]);
      if (box && !box.isEmpty()) {
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        
        // 使用 fitToSphere 定位，且保持一定距离
        world.camera.controls.fitToSphere(sphere, true);
        
        // 再次确保 distance 限制生效（有些控件实现可能重置）
        world.camera.controls.minDistance = 10;
        world.camera.controls.maxDistance = 1000;
      }
    } catch (e) {
      console.warn('定位构件失败:', e);
    }
  }
}

// 启动程序
main().catch(err => {
    console.error("Critical initialization error:", err);
    document.body.innerHTML = `<h3 style="color:red; padding:20px;">System Error: ${err.message}</h3>`;
});
