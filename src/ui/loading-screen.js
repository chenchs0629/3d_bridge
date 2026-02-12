export function showLoadingProgress() {
    let overlay = document.getElementById('loading-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
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
