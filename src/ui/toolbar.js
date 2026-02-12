export function createLoadingUI(container, loadCallback, toggleListCallback) {
    // 1. 加载按钮
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
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ifc,.frag';
    fileInput.style.display = 'none';
    
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) loadCallback(file);
    };
    
    uploadBtn.onclick = () => fileInput.click();
    
    // 2. 构件列表按钮
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
    listBtn.onclick = toggleListCallback;
  
    // 3. 说明文字
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
  
    // 4. 拖放逻辑
    setupDragAndDrop(container, loadCallback);
  
    document.body.appendChild(uploadBtn);
    document.body.appendChild(fileInput);
    document.body.appendChild(listBtn);
    document.body.appendChild(instructions);
  }
  
  function setupDragAndDrop(container, loadCallback) {
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
        loadCallback(file);
      } else {
        alert('请拖放 IFC 或 Frag 格式的文件！');
      }
    };
  }
