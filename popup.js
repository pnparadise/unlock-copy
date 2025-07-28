// Popup script for Unlock Copy Paste extension
// 支持开关功能和图标同步

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const statusSection = document.getElementById('statusSection');
    const domainTags = document.getElementById('domainTags');
    
    // 检查必要的DOM元素是否存在
    if (!toggleBtn || !statusIndicator || !statusText || !statusSection || !domainTags) {
        console.error('Required DOM elements not found');
        return;
    }
    
    let currentDomain = '';
    
    // 检查 Chrome APIs 是否可用
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('Chrome APIs not available');
        updateUI(true); // 默认启用状态
        return;
    }
    
    // 加载域名配置和扩展状态
    loadDomainTags();
    
    // 获取当前标签页并检查域名匹配状态 - 简化版本
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && tabs[0].url) {
            // 直接从地址栏URL获取域名
            currentDomain = extractDomain(tabs[0].url);
            console.log('[UnlockCopy] 当前域名:', currentDomain);
            
            // 检查当前域名是否匹配配置
            chrome.storage.sync.get(['domainConfig'], function(result) {
                const config = result.domainConfig || [];
                const isMatched = config.some(pattern => matchDomain(currentDomain, pattern));
                
                console.log('[UnlockCopy] 域名匹配结果:', isMatched, '配置:', config);
                
                // 根据域名匹配结果设置扩展状态
                chrome.storage.sync.set({ extensionEnabled: isMatched }, function() {
                    updateUI(isMatched);
                });
            });
        } else {
            // 如果无法获取标签页信息，使用存储的状态
            chrome.storage.sync.get(['extensionEnabled'], function(result) {
                const isEnabled = result.extensionEnabled === true;
                updateUI(isEnabled);
            });
        }
    });
    
    // 开关按钮点击处理
    toggleBtn.addEventListener('click', function() {
        if (!chrome.storage) {
            console.error('Chrome storage API not available');
            return;
        }
        
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            const currentState = result.extensionEnabled === true; // Default to false
            const newState = !currentState;
            
            // 如果启用扩展且当前域名不为空，自动添加到配置
            if (newState && currentDomain && isDomainValid(currentDomain)) {
                addDomainTag(currentDomain);
            }
            // 如果禁用扩展且当前域名不为空，自动从配置中删除
            else if (!newState && currentDomain && isDomainValid(currentDomain)) {
                removeDomainTag(currentDomain);
            }
            
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
            statusIndicator.className = 'status-indicator active';
            statusText.textContent = '扩展已激活';
            statusSection.className = 'status';
        } else {
            toggleBtn.className = 'toggle-btn-small inactive';
            statusIndicator.className = 'status-indicator inactive';
            statusText.textContent = '扩展已禁用';
            statusSection.className = 'status disabled';
        }
    }
    
    // 直接获取hostname，不进行域名解析
    function extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            return '';
        }
    }
    
    // 验证域名是否有效
    function isDomainValid(domain) {
        return domain && !domain.startsWith('chrome://') && !domain.startsWith('chrome-extension://') && domain.includes('.');
    }
    
    // 加载域名标签
    function loadDomainTags() {
        chrome.storage.sync.get(['domainConfig'], function(result) {
            const config = result.domainConfig || [];
            renderDomainTags(config);
        });
    }
    
    // 渲染域名标签
    function renderDomainTags(domains) {
        domainTags.innerHTML = '';
        
        if (domains.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'domain-tags-empty';
            emptyMessage.textContent = '暂无配置域名';
            domainTags.appendChild(emptyMessage);
            return;
        }
        
        domains.forEach(domain => {
            const tag = createDomainTag(domain);
            domainTags.appendChild(tag);
        });
    }
    
    // 创建域名标签
    function createDomainTag(domain) {
        const tag = document.createElement('div');
        tag.className = 'domain-tag';
        
        const text = document.createElement('span');
        text.className = 'domain-tag-text';
        text.textContent = domain;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'domain-tag-remove';
        removeBtn.textContent = '×';
        removeBtn.title = '移除域名';
        removeBtn.addEventListener('click', () => removeDomainTag(domain));
        
        tag.appendChild(text);
        tag.appendChild(removeBtn);
        
        return tag;
    }
    
    // 添加域名标签
    function addDomainTag(domain) {
        chrome.storage.sync.get(['domainConfig'], function(result) {
            const config = result.domainConfig || [];
            
            if (!config.includes(domain)) {
                config.push(domain);
                chrome.storage.sync.set({ domainConfig: config }, function() {
                    renderDomainTags(config);
                    checkDomainMatch();
                });
            }
        });
    }
    
    // 删除域名标签
    function removeDomainTag(domain) {
        chrome.storage.sync.get(['domainConfig'], function(result) {
            const config = result.domainConfig || [];
            const filteredConfig = config.filter(d => d !== domain);
            
            chrome.storage.sync.set({ domainConfig: filteredConfig }, function() {
                renderDomainTags(filteredConfig);
                
                // 如果删除的是当前域名，需要禁用扩展并更新UI
                if (currentDomain && matchDomain(currentDomain, domain)) {
                    chrome.storage.sync.set({ extensionEnabled: false }, function() {
                        updateUI(false);
                        
                        // 发送消息到 background script 更新徽章
                        if (chrome.runtime && chrome.runtime.sendMessage) {
                            chrome.runtime.sendMessage({
                                action: 'toggleExtension',
                                enabled: false
                            }).catch(() => {
                                // 忽略错误
                            });
                        }
                        
                        // 发送消息到 content script 禁用复制拦截
                        if (chrome.tabs) {
                            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                                if (tabs[0]) {
                                    chrome.tabs.sendMessage(tabs[0].id, {
                                        action: 'extensionStateChanged',
                                        enabled: false
                                    }).catch(() => {
                                        // 忽略错误
                                    });
                                }
                            });
                        }
                    });
                } else {
                    checkDomainMatch();
                }
            });
        });
    }
    
    // 检查当前域名是否匹配配置
    function checkDomainMatch() {
        if (!currentDomain) return;
        
        chrome.storage.sync.get(['domainConfig'], function(result) {
            const config = result.domainConfig || [];
            const isMatched = config.some(pattern => matchDomain(currentDomain, pattern));
            
            if (isMatched) {
                // 如果匹配，自动启用扩展
                chrome.storage.sync.set({ extensionEnabled: true }, function() {
                    updateUI(true);
                });
            }
        });
    }
    
    // 域名匹配函数（支持简单通配符）
    function matchDomain(domain, pattern) {
        if (!domain || !pattern) return false;
        
        // 如果包含通配符 *
        if (pattern.includes('*')) {
            const regexPattern = pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
            try {
                const regex = new RegExp('^' + regexPattern + '$');
                return regex.test(domain);
            } catch (e) {
                return false;
            }
        }
        
        // 精确匹配
        return domain === pattern;
    }
    
    // updateIcon 函数已移除，不再自动切换图标
    
    // showNotification 函数已移除，popup 内部切换不显示通知
    
    console.log('[UnlockCopy] Popup loaded with domain configuration functionality');
});