// Unlock Copy Paste - Content Script
// 使用更有效的方法阻断网站的复制限制

(function() {
    'use strict';
    
    // 扩展状态和防重复标志
    let extensionEnabled = true;
    let copyInProgress = false;
    
    // Toast 提示函数
    function showToast(message, type = 'success') {
        // 移除已存在的 toast
        const existingToast = document.querySelector('.unlock-copy-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = 'unlock-copy-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
            pointer-events: none;
        `;
        toast.textContent = message;
        
        // 添加动画样式
        if (!document.querySelector('#unlock-copy-toast-style')) {
            const style = document.createElement('style');
            style.id = 'unlock-copy-toast-style';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // 3秒后移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }
    
    // 执行复制操作
    function performCopy(text) {
        if (copyInProgress || !text) return;
        
        copyInProgress = true;
        console.log('[UnlockCopy] 执行复制:', text.length + '字符');
        
        // 使用 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('[UnlockCopy] ✅ 复制成功');
                showToast(`✅ 已复制 ${text.length} 个字符`);
                copyInProgress = false;
            }).catch(() => {
                // 备用方法
                fallbackCopy(text);
                copyInProgress = false;
            });
        } else {
            fallbackCopy(text);
            copyInProgress = false;
        }
    }
    
    // 备用复制方法
    function fallbackCopy(text) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (success) {
                console.log('[UnlockCopy] ✅ 备用复制成功');
                showToast(`✅ 已复制 ${text.length} 个字符`);
            } else {
                console.log('[UnlockCopy] ❌ 复制失败');
                showToast('❌ 复制失败', 'error');
            }
        } catch (err) {
            console.log('[UnlockCopy] ❌ 复制失败');
            showToast('❌ 复制失败', 'error');
        }
    }
    
    // 关键代码：在 document 上添加一个捕获阶段的 copy 事件监听器
    // 阻断网站原有的 copy 事件处理
    document.addEventListener('copy', function(e) {
        // 检查扩展是否启用
        if (!extensionEnabled) {
            return; // 如果禁用，不做任何处理，让网站正常工作
        }
        
        // 阻止网站的自定义复制行为
        e.stopImmediatePropagation();
        console.log('[UnlockCopy] 🚫 网站的自定义复制行为已被阻止');
        
        // 获取选中的文本并执行我们自己的复制逻辑
        const selectedText = window.getSelection().toString();
        if (selectedText) {
            performCopy(selectedText);
        }
    }, true); // 捕获阶段执行，确保比页面脚本先运行
    
    // 监听 Ctrl+C 按键，作为额外保障
    document.addEventListener('keydown', function(e) {
        if (!extensionEnabled) {
            return; // 如果禁用，不处理
        }
        
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.keyCode === 67)) {
            console.log('[UnlockCopy] 检测到 Ctrl+C');
            
            const selectedText = window.getSelection().toString();
            if (selectedText) {
                // 让浏览器的原生 copy 事件触发，我们在 copy 事件中处理
                // 这样可以确保复制操作的完整性
            }
        }
    }, true);
    
    // 监听来自 popup 和 background 的消息
    if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.action === 'toggleExtension' || request.action === 'extensionStateChanged') {
                extensionEnabled = request.enabled;
                console.log('[UnlockCopy] 扩展状态变更:', extensionEnabled ? '启用' : '禁用');
                
                // 根据状态控制CSS样式
                updateTextSelectionStyle(extensionEnabled);
                
                // 只有来自popup的消息才显示toast（避免重复通知）
                if (request.action === 'toggleExtension') {
                    if (extensionEnabled) {
                        showToast('🔓 解锁复制已启用');
                    } else {
                        showToast('🔒 解锁复制已禁用', 'error');
                    }
                }
            }
        });
    }
    
    // 初始化时获取扩展状态
    if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            extensionEnabled = result.extensionEnabled !== false; // 默认启用
            console.log('[UnlockCopy] 初始状态:', extensionEnabled ? '启用' : '禁用');
            
            // 根据初始状态控制CSS样式
            updateTextSelectionStyle(extensionEnabled);
        });
    } else {
        // 如果无法访问存储，默认启用
        extensionEnabled = true;
        updateTextSelectionStyle(extensionEnabled);
    }
    
    // 全局样式元素引用
    let textSelectionStyle = null;
    
    // 启用文本选择
    function enableTextSelection() {
        if (textSelectionStyle) return; // 避免重复添加
        
        textSelectionStyle = document.createElement('style');
        textSelectionStyle.id = 'unlock-copy-text-selection';
        textSelectionStyle.textContent = `
            * {
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                user-select: text !important;
            }
        `;
        
        if (document.head) {
            document.head.appendChild(textSelectionStyle);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.head && textSelectionStyle) {
                    document.head.appendChild(textSelectionStyle);
                }
            });
        }
        console.log('[UnlockCopy] ✅ 文本选择样式已启用');
    }
    
    // 禁用文本选择
    function disableTextSelection() {
        if (textSelectionStyle && textSelectionStyle.parentNode) {
            textSelectionStyle.parentNode.removeChild(textSelectionStyle);
            textSelectionStyle = null;
            console.log('[UnlockCopy] ❌ 文本选择样式已禁用');
        }
    }
    
    // 根据扩展状态控制文本选择样式
    function updateTextSelectionStyle(enabled) {
        if (enabled) {
            enableTextSelection();
        } else {
            disableTextSelection();
        }
    }
    
    // 初始化已移至状态获取后执行，确保样式控制与扩展状态同步
    
    console.log('[UnlockCopy] 扩展已加载 - 使用增强的 copy 事件拦截');
})();