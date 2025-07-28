// Background script for Unlock Copy Paste extension

// Debug logging function
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[UnlockCopyPaste-BG ${timestamp}] ${message}`, data || '');
}

debugLog('Background script initializing...');

// Initialize extension state
chrome.runtime.onInstalled.addListener(function(details) {
    debugLog(`Extension installed/updated. Reason: ${details.reason}`);
    if (details.reason === 'install') {
        // Set default state to enabled
        chrome.storage.sync.set({ extensionEnabled: true });
        
        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Unlock Copy Paste Installed',
            message: 'Extension is now active. Visit any website to unlock keyboard shortcuts!'
        });
    } else if (details.reason === 'update') {
        // Handle extension updates
        console.log('Unlock Copy Paste extension updated');
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
    // This will open the popup, no additional action needed
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    debugLog(`Received message: ${request.action}`, {
        action: request.action,
        sender: sender.tab ? sender.tab.url : 'popup',
        data: request
    });
    
    if (request.action === 'getExtensionState') {
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            const enabled = result && result.extensionEnabled !== false;
            debugLog(`Returning extension state: ${enabled}`);
            sendResponse({ enabled: enabled });
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'toggleExtension') {
        debugLog(`Toggling extension to: ${request.enabled}`);
        chrome.storage.sync.set({ extensionEnabled: request.enabled }, function() {
            // Update badge text
            updateBadge(request.enabled);
            
            // Notify all tabs about the state change
            chrome.tabs.query({}, function(tabs) {
                debugLog(`Notifying ${tabs.length} tabs about state change`);
                tabs.forEach(function(tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'extensionStateChanged',
                        enabled: request.enabled
                    }).catch((error) => {
                        debugLog(`Failed to notify tab ${tab.id}: ${error.message}`);
                    });
                });
            });
            
            sendResponse({ success: true });
        });
        return true;
    }
    
    if (request.action === 'reportBlocked') {
        // Log when shortcuts are being blocked by websites
        debugLog('Blocked shortcut detected', {
            url: sender.tab.url,
            key: request.key,
            details: request
        });
    }
});

// Update extension badge based on state (without icon switching)
function updateBadge(enabled) {
    debugLog(`Updating badge. Enabled: ${enabled}`);
    
    // 只更新徽章和标题，不切换图标
    if (enabled) {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#27ae60' });
        chrome.action.setTitle({ title: '解锁复制粘贴 - 已启用' });
    } else {
        chrome.action.setBadgeText({ text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
        chrome.action.setTitle({ title: '解锁复制粘贴 - 已禁用' });
    }
}

// Initialize badge on startup
chrome.storage.sync.get(['extensionEnabled'], function(result) {
    const isEnabled = result && result.extensionEnabled !== false;
    debugLog(`Initializing badge on startup. Enabled: ${isEnabled}`);
    updateBadge(isEnabled);
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        debugLog(`Tab updated: ${tab.url}`);
        
        // Check if extension is enabled
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            const isEnabled = result && result.extensionEnabled !== false;
            debugLog(`Extension enabled: ${isEnabled} for tab: ${tabId}`);
            
            if (isEnabled) {
                // Send state to content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'extensionStateChanged',
                    enabled: true
                }).catch((error) => {
                    debugLog(`Failed to send state to tab ${tabId}: ${error.message}`);
                });
            }
        });
    }
});

// Context menu for quick access (optional)
chrome.contextMenus.create({
    id: 'toggleExtension',
    title: 'Toggle Unlock Copy Paste',
    contexts: ['page']
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === 'toggleExtension') {
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            const currentState = result && result.extensionEnabled !== false;
            const newState = !currentState;
            
            chrome.storage.sync.set({ extensionEnabled: newState }, function() {
                updateBadge(newState);
                
                // Notify the tab
                chrome.tabs.sendMessage(tab.id, {
                    action: 'extensionStateChanged',
                    enabled: newState
                }).catch(() => {
                    // Ignore errors
                });
                
                // Show notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'Unlock Copy Paste',
                    message: newState ? 'Extension Enabled' : 'Extension Disabled'
                });
            });
        });
    }
});

// Handle keyboard shortcuts (if defined in manifest)
if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(function(command) {
        debugLog(`Keyboard command received: ${command}`);
        if (command === 'toggle-extension') {
            chrome.storage.sync.get(['extensionEnabled'], function(result) {
                const currentState = result && result.extensionEnabled !== false;
                const newState = !currentState;
                
                chrome.storage.sync.set({ extensionEnabled: newState }, function() {
                    updateBadge(newState);
                    
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon48.png',
                        title: 'Unlock Copy Paste',
                        message: newState ? 'Extension Enabled' : 'Extension Disabled'
                    });
                });
            });
        }
    });
} else {
    debugLog('chrome.commands API not available');
}