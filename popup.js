// Popup script for Unlock Copy Paste extension
// 支持开关功能和图标同步

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleBtn');
    const toggleText = document.getElementById('toggleText');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const statusSection = document.getElementById('statusSection');
    
    // 检查 Chrome APIs 是否可用
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('Chrome APIs not available');
        updateUI(true); // 默认启用状态
        return;
    }
    
    // 加载当前扩展状态
    chrome.storage.sync.get(['extensionEnabled'], function(result) {
        const isEnabled = result.extensionEnabled !== false; // 默认启用
        updateUI(isEnabled);
    });
    
    // 开关按钮点击处理
    toggleBtn.addEventListener('click', function() {
        if (!chrome.storage) {
            console.error('Chrome storage API not available');
            return;
        }
        
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            const currentState = result.extensionEnabled !== false;
            const newState = !currentState;
            
            // 保存新状态
            chrome.storage.sync.set({ extensionEnabled: newState }, function() {
                updateUI(newState);
                
                // 发送消息到 background script 更新徽章
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: 'toggleExtension',
                        enabled: newState
                    }).catch(() => {
                        // 忽略错误
                    });
                }
                
                // 发送消息到 content script
                if (chrome.tabs) {
                    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: 'toggleExtension',
                                enabled: newState
                            }).catch(() => {
                                // 忽略错误
                            });
                        }
                    });
                }
                
                // popup 内部切换不显示 toast 通知
            });
        });
    });
    
    // 更新 UI 状态
    function updateUI(isEnabled) {
        if (isEnabled) {
            toggleBtn.className = 'toggle-btn-small active';
            toggleText.textContent = '禁用';
            statusIndicator.className = 'status-indicator active';
            statusText.textContent = '扩展已激活';
            statusSection.className = 'status';
        } else {
            toggleBtn.className = 'toggle-btn-small inactive';
            toggleText.textContent = '启用';
            statusIndicator.className = 'status-indicator inactive';
            statusText.textContent = '扩展已禁用';
            statusSection.className = 'status disabled';
        }
    }
    
    // updateIcon 函数已移除，不再自动切换图标
    
    // showNotification 函数已移除，popup 内部切换不显示通知
    
    console.log('[UnlockCopy] Popup loaded with toggle functionality');
});