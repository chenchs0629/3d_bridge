import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import fragmentsWorkerUrl from '@thatopen/fragments/dist/Worker/worker.mjs?url';
import webIfcWasmUrl from 'web-ifc/web-ifc.wasm?url';

export async function initSystem(container) {
  console.log('正在初始化组件...');
  
  // 1. 初始化组件管理器
  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create();

  // 2. 配置 World (场景、相机、渲染器)
  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);

  // 启用阴影
  world.renderer.three.shadowMap.enabled = true;
  world.renderer.three.shadowMap.type = THREE.PCFSoftShadowMap;

  // 3. 启动并配置场景基础
  await components.init();
  world.scene.setup();

  // 4. 网格地面
  const grids = components.get(OBC.Grids);
  grids.create(world);

  // 5. 灯光设置
  setupLights(world);

  // 6. 碎片管理器
  const fragments = components.get(OBC.FragmentsManager);
  fragments.init(fragmentsWorkerUrl);
  // 相机更新时刷新裁剪
  world.camera.controls.addEventListener('update', () => fragments.core.update());

  // 全局相机距离约束：防止缩放过小导致模型消失，或过远看不到
  world.camera.controls.minDistance = 5;
  world.camera.controls.maxDistance = 5000;

  // 7. IFC加载器配置
  const ifcLoader = components.get(OBC.IfcLoader);
  const wasmDir = webIfcWasmUrl.slice(0, webIfcWasmUrl.lastIndexOf('/') + 1);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: { path: wasmDir, absolute: true },
    customLocateFileHandler: () => webIfcWasmUrl,
  });

  // 8. 高亮器配置
  const highlighter = components.get(OBCF.Highlighter);
  highlighter.setup({ world });
  highlighter.zoomToSelection = false;

  // 自定义高亮样式
  const selectionMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffa500, 
    depthTest: false, 
    opacity: 0.5, 
    transparent: true 
  });
  highlighter.add('selection', selectionMaterial);
  highlighter.add('hover', new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    depthTest: false, 
    opacity: 0.3, 
    transparent: true 
  }));

  console.log('系统初始化完成');
  
  return { components, world, fragments, ifcLoader, highlighter };
}

function setupLights(world) {
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
  
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), shadowMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.01;
    shadowPlane.receiveShadow = true;
    world.scene.three.add(shadowPlane);
}
