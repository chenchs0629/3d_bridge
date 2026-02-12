// 属性面板模块
let propertiesPanel = null;

export function setupPropertiesPanel() {
    propertiesPanel = document.createElement('div');
    propertiesPanel.style.cssText = `
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
    propertiesPanel.innerHTML = '<h3>构件属性</h3><div id="props-content"></div>';
    document.body.appendChild(propertiesPanel);

    // 阻止面板事件冒泡到3D容器
    propertiesPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
    propertiesPanel.addEventListener('click', (e) => e.stopPropagation());
    propertiesPanel.addEventListener('mousemove', (e) => e.stopPropagation());
    propertiesPanel.addEventListener('wheel', (e) => e.stopPropagation());
}

export function hidePropertiesPanel() {
    if (propertiesPanel) propertiesPanel.style.display = 'none';
}

export async function displayProperties(fragmentID, expressID, { loadedModel, ifcLoader, fragments }) {
    if (!propertiesPanel) return;
    
    const content = propertiesPanel.querySelector('#props-content');
    content.innerHTML = '正在读取属性...';
    propertiesPanel.style.display = 'block';

    try {
        let html = `<p><b>Express ID:</b> ${expressID}</p>`;
        let html2 = '';

        if (loadedModel) {
            // 1. getProperties
            if (typeof loadedModel.getProperties === 'function') {
                try {
                    const props = await loadedModel.getProperties(expressID);
                    if (props) html2 += formatProperties(props);
                } catch (e) { console.warn('getProperties failed:', e); }
            }

            // 2. data
            if (!html2 && loadedModel.data) {
                try {
                    const allProps = loadedModel.data;
                    if (allProps && allProps[expressID]) html2 += formatProperties(allProps[expressID]);
                } catch (e) { console.warn('data read failed:', e); }
            }

            // 3. webIfc
            if (!html2 && ifcLoader && ifcLoader.webIfc) {
                try {
                    const webIfc = ifcLoader.webIfc;
                    const modelID = 0; // 假设第一个模型
                    const props = webIfc.GetLine(modelID, expressID);
                    if (props) html2 += formatProperties(props);
                } catch (e) { console.warn('webIfc GetLine failed:', e); }
            }
        }

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

function formatProperties(props) {
    if (!props) return '';
    let html = '<div style="margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">';
    if (typeof props === 'object') {
        for (const [key, value] of Object.entries(props)) {
            if (value !== null && value !== undefined && key !== 'expressID') {
                let displayValue = value;
                if (typeof value === 'object') {
                    if (value.value !== undefined) displayValue = value.value;
                    else displayValue = JSON.stringify(value);
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
