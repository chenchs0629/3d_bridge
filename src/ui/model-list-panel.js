export function setupModelListPanel(onRemoveModel, onRemoveAll, onSelectModel) {
    const panel = document.createElement('div');
    panel.id = 'model-list-panel';
    panel.style.cssText = `
        position: absolute;
        top: 395px; /* 模型管理按钮下方 */
        left: 20px; /* 左对齐 */
        width: 250px;
        background: rgba(30, 30, 40, 0.95);
        color: #eee;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        display: none;
        flex-direction: column;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        max-height: 250px;
    `;

    panel.innerHTML = `
        <div style="padding: 10px; border-bottom: 1px solid #444; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
            <span>📚 模型列表</span>
            <span id="model-count" style="font-size: 11px; color: #aaa; font-weight: normal;">0 个模型</span>
        </div>
        <div id="model-list-content" style="flex: 1; overflow-y: auto; max-height: 300px;">
            <div style="padding: 15px; text-align: center; color: #666; font-style: italic;">暂无模型</div>
        </div>
        <div style="padding: 10px; border-top: 1px solid #444; text-align: center;">
            <button id="btn-remove-all" style="width: 100%; padding: 6px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ 清空所有模型</button>
        </div>
    `;

    document.body.appendChild(panel);

    // 绑定清空事件
    panel.querySelector('#btn-remove-all').onclick = () => {
        if (confirm('确定要移除所有模型吗？')) {
            onRemoveAll();
        }
    };
    
    // 阻止冒泡
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('wheel', (e) => e.stopPropagation());

    return panel;
}

export function updateModelListUI(models, currentModel, onRemoveModel, onSelectModel) {
    const listContent = document.getElementById('model-list-content');
    const countLabel = document.getElementById('model-count');
    
    if (!listContent) return;

    countLabel.innerText = `${models.length} 个模型`;

    if (models.length === 0) {
        listContent.innerHTML = `<div style="padding: 15px; text-align: center; color: #666; font-style: italic;">暂无模型</div>`;
        return;
    }

    listContent.innerHTML = '';
    models.forEach((model, index) => {
        const isSelected = model === currentModel;
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 8px 10px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: ${isSelected ? 'rgba(0, 123, 255, 0.2)' : 'rgba(255,255,255,0.02)'};
            border-left: ${isSelected ? '3px solid #007bff' : '3px solid transparent'};
            cursor: pointer;
            transition: background 0.2s;
        `;
        
        // 点击整个行也可以选择模型
        item.onclick = () => {
            if (onSelectModel && !isSelected) {
                onSelectModel(model);
            }
        };

        item.onmouseover = () => { 
            if(!isSelected) item.style.background = 'rgba(255,255,255,0.05)'; 
        };
        item.onmouseout = () => { 
            if(!isSelected) item.style.background = 'rgba(255,255,255,0.02)'; 
        };

        // 左侧信息区
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = "display: flex; align-items: center; flex: 1; overflow: hidden; margin-right: 10px;";

        const icon = document.createElement('span');
        icon.innerHTML = isSelected ? '👁️' : '📄';
        icon.style.marginRight = '8px';
        icon.style.opacity = isSelected ? '1' : '0.5';
        icon.title = isSelected ? '当前选中的模型' : '点击切换到此模型';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = model.name || `Model ${index + 1}`;
        nameSpan.title = model.name || `Model ${index + 1}`;
        nameSpan.style.cssText = `
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: ${isSelected ? 'bold' : 'normal'};
            color: ${isSelected ? '#fff' : '#ccc'};
        `;

        infoDiv.appendChild(icon);
        infoDiv.appendChild(nameSpan);

        // 右侧操作区
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.alignItems = 'center';

        // 查看构件按钮 (如果未选中)
        if (!isSelected) {
            const selectBtn = document.createElement('button');
            selectBtn.innerHTML = '选择';
            selectBtn.title = '切换到此模型并查看构件';
            selectBtn.style.cssText = `
                background: none;
                border: 1px solid #555;
                color: #aaa;
                border-radius: 3px;
                margin-right: 8px;
                cursor: pointer;
                font-size: 11px;
                padding: 1px 6px;
                height: 20px;
            `;
            selectBtn.onmouseover = () => { selectBtn.style.borderColor = '#888'; selectBtn.style.color = '#eee'; };
            selectBtn.onmouseout = () => { selectBtn.style.borderColor = '#555'; selectBtn.style.color = '#aaa'; };
            selectBtn.onclick = (e) => {
                e.stopPropagation();
                onSelectModel(model);
            };
            actionsDiv.appendChild(selectBtn);
        }

        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '✕';
        delBtn.title = '移除此模型';
        delBtn.style.cssText = `
            background: transparent;
            color: #ff6b6b;
            border: 1px solid transparent; /* 默认无边框更整洁 */
            border-radius: 3px;
            cursor: pointer;
            width: 20px;
            height: 20px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        delBtn.onmouseover = () => { delBtn.style.background = '#ff6b6b'; delBtn.style.color = 'white'; };
        delBtn.onmouseout = () => { delBtn.style.background = 'transparent'; delBtn.style.color = '#ff6b6b'; };
        
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`确定要移除 "${model.name}" 吗？`)) {
                onRemoveModel(model);
            }
        };

        actionsDiv.appendChild(delBtn);

        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        listContent.appendChild(item);
    });
}
