import * as THREE from 'three';

let componentList = [];
let componentListPanel = null;

export function setupComponentListPanel(onItemClickCallback) {
    componentListPanel = document.createElement('div');
    componentListPanel.style.cssText = `
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

    // ... (HTML结构保持不变) ...
    componentListPanel.innerHTML = `
      <div style="padding: 15px; background: rgba(0,123,255,0.15); border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 16px; font-weight: bold;">🧩 构件列表</span>
        <span id="component-count" style="font-size: 12px; color: #aaa;">0 个构件</span>
      </div>
      <div style="padding: 8px 15px; border-bottom: 1px solid #333;">
        <input id="component-search" type="text" placeholder="🔍 搜索构件..." style="width: 100%; padding: 8px 10px; border: 1px solid #555; border-radius: 4px; background: #222; color: #eee; font-size: 13px; outline: none; box-sizing: border-box;" />
      </div>
      <div id="component-list-content" style="flex: 1; overflow-y: auto; padding: 5px 0;"></div>
    `;

    document.body.appendChild(componentListPanel);

    // 阻止冒泡
    componentListPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
    componentListPanel.addEventListener('click', (e) => e.stopPropagation());
    componentListPanel.addEventListener('mousemove', (e) => e.stopPropagation());
    componentListPanel.addEventListener('wheel', (e) => e.stopPropagation());

    const searchInput = componentListPanel.querySelector('#component-search');
    searchInput.addEventListener('input', (e) => {
        filterComponentList(e.target.value.trim().toLowerCase(), onItemClickCallback);
    });
    
    // 保存回调引用以供后续重绘使用
    componentListPanel.dataset.callback = "true"; 
    // 注意：这里这是个hack，最好将onItemClickCallback存在模块级变量，下面我将使用模块变量修复这个问题
    _onItemClickCallback = onItemClickCallback;
}

// 新增模块级变量存储回调
let _onItemClickCallback = null;

export function toggleComponentListPanel() {
    if (!componentListPanel) return;
    componentListPanel.style.display = (componentListPanel.style.display === 'none') ? 'flex' : 'none';
}

export async function buildComponentList(model, onItemClickCallback) {
    _onItemClickCallback = onItemClickCallback; // 更新回调
    componentList = [];
    try {
        const localIds = await model.getItemsIdsWithGeometry();
        if (localIds.length === 0) {
            renderComponentList(componentList, _onItemClickCallback);
            return;
        }

        let categories = [];
        try { categories = await model.getItemsWithGeometryCategories(); } catch (e) {}

        const batchSize = 200;
        for (let i = 0; i < localIds.length; i += batchSize) {
            const batchIds = localIds.slice(i, i + batchSize);
            let batchData = [];
            try { batchData = await model.getItemsData(batchIds); } catch (e) {}

            for (let j = 0; j < batchIds.length; j++) {
                const localId = batchIds[j];
                const globalIdx = i + j;
                const category = categories[globalIdx] || '';
                const data = batchData[j] || {};

                let name = '';
                if (data.Name && data.Name.value !== undefined) name = String(data.Name.value);
                else if (data.Name) name = String(data.Name);
                if (!name) name = category ? `${category} #${localId}` : `构件 #${localId}`;

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
    renderComponentList(componentList, _onItemClickCallback);
}

function renderComponentList(list, onItemClickCallback) {
    const content = document.getElementById('component-list-content');
    const countEl = document.getElementById('component-count');
    if (!content) return;

    if (countEl) countEl.textContent = `${list.length} 个构件`;

    if (list.length === 0) {
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">暂无构件数据</div>';
        return;
    }

    // 性能优化：使用 DocumentFragment 或者简单的 HTML 字符串拼接
    let html = '';
    for (const item of list) {
        html += `
        <div class="comp-item" data-index="${item.index}" data-localid="${item.localId}" style="padding: 8px 15px; cursor: pointer; border-bottom: 1px solid #2a2a35; display: flex; align-items: center; gap: 10px; transition: background 0.15s;">
            <span style="display: inline-block; min-width: 32px; text-align: center; padding: 2px 6px; background: rgba(0,123,255,0.2); border-radius: 3px; font-size: 11px; color: #6cb4ff;">${item.index}</span>
            <div style="flex:1; overflow: hidden;">
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px;">${item.name}</div>
            <div style="font-size: 11px; color: #888; margin-top: 2px;">${item.type} (ID: ${item.localId})</div>
            </div>
        </div>`;
    }

    content.innerHTML = html;

    // 重新绑定事件
    content.querySelectorAll('.comp-item').forEach((el) => {
        el.addEventListener('click', () => {
            const localId = parseInt(el.getAttribute('data-localid'), 10);
            if(onItemClickCallback) onItemClickCallback(localId);
        });
        el.onmouseover = () => { if(!el.classList.contains('comp-active')) el.style.background='rgba(255,255,255,0.08)'; };
        el.onmouseout = () => { if(!el.classList.contains('comp-active')) el.style.background='transparent'; };
    });
}

function filterComponentList(keyword, onItemClickCallback) {
    if (!keyword) {
        renderComponentList(componentList, onItemClickCallback);
        return;
    }
    const filtered = componentList.filter(item =>
        item.name.toLowerCase().includes(keyword) ||
        item.type.toLowerCase().includes(keyword) ||
        String(item.index).includes(keyword)
    );
    renderComponentList(filtered, onItemClickCallback);
}

// ==========================================
// 核心修改：列表高亮逻辑
// ==========================================
export function highlightComponentInList(idToFind, forceShow = true) {
    clearComponentListHighlight();
    const content = document.getElementById('component-list-content');
    if (!content) return;
    
    // 逻辑：如果需要强制显示面板且面板当前是隐藏的
    if (forceShow && componentListPanel && componentListPanel.style.display === 'none') {
        componentListPanel.style.display = 'flex'; // 强制打开
    }

    let el = content.querySelector(`[data-localid="${idToFind}"]`);
    
    // 3. 如果没找到，可能是因为当前有“搜索过滤”导致该项被隐藏了
    if (!el) {
        const searchInput = componentListPanel.querySelector('#component-search');
        // 如果有搜索词，且当前 DOM 里找不到该 ID，说明被过滤掉了
        if (searchInput && searchInput.value.trim() !== '') {
            console.log("目标构件被过滤隐藏，正在清除搜索...");
            searchInput.value = ''; // 清空搜索框
            // 重新渲染完整列表，注意这里需要正确的 callback 引用，如果 _onItemClickCallback 不在作用域内则可能报错
            // 为了安全，我们假设 renderComponentList 第一个参数 list 是对的，但 callback 可能丢失
            // 简单处理：触发一次 input 事件让它自己重置，或者重新 render
            // 这里 componentList 是模块级变量，可以用
            const event = new Event('input');
            searchInput.dispatchEvent(event); // 触发清空过滤
            
            // 重新获取 DOM
            el = content.querySelector(`[data-localid="${idToFind}"]`);
        }
    }
    
    // 4. 如果还是没找到（可能是字符串/数字类型不匹配），尝试容错查找
    if (!el) {
        const found = componentList.find(item => String(item.localId) === String(idToFind));
        if (found) {
            el = content.querySelector(`[data-localid="${found.localId}"]`);
        }
    }
    
    // 5. 执行高亮和滚动
    if (el) {
        el.classList.add('comp-active');
        el.style.background = 'rgba(255, 165, 0, 0.3)';
        
        // 只有面板可见时滚动才有意义
        if (componentListPanel && componentListPanel.style.display !== 'none') {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

export function clearComponentListHighlight() {
    const content = document.getElementById('component-list-content');
    if (!content) return;
    content.querySelectorAll('.comp-active').forEach((el) => {
        el.classList.remove('comp-active');
        el.style.background = 'transparent';
    });
}