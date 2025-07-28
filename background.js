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
        // Set default state to disabled with empty domain config
        chrome.storage.sync.set({
            extensionEnabled: false,
            domainConfig: []
        });
        
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
            const enabled = result && result.extensionEnabled === true; // Default to false
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
                    sendMessageToContentScript(tab.id, {
                        action: 'extensionStateChanged',
                        enabled: request.enabled
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
    
    if (request.action === 'updateIconFromContent') {
        // Handle icon state update from content script
        debugLog(`Content script updating icon: ${request.enabled} for domain: ${request.domain}`);
        
        // Update global state and badge directly
        chrome.storage.sync.set({ extensionEnabled: request.enabled }, function() {
            debugLog(`Updated badge from content script for domain ${request.domain}, enabled: ${request.enabled}`);
            updateBadge(request.enabled);
        });
    }
    
});

// Update extension badge and icon based on state
function updateBadge(enabled) {
    debugLog(`Updating badge and icon. Enabled: ${enabled}`);
    
    if (enabled) {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#27ae60' });
        chrome.action.setTitle({ title: '解锁复制粘贴 - 已启用' });
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16.png",
                "32": "icons/icon32.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
    } else {
        chrome.action.setBadgeText({ text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
        chrome.action.setTitle({ title: '解锁复制粘贴 - 已禁用' });
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16.png",
                "32": "icons/icon32.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
    }
}

// Initialize badge on startup
chrome.storage.sync.get(['extensionEnabled'], function(result) {
    const isEnabled = result && result.extensionEnabled === true; // Default to false
    debugLog(`Initializing badge on startup. Enabled: ${isEnabled}`);
    updateBadge(isEnabled);
});



// Handle tab activation (switching between tabs) - request state from content script
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        if (tab.url && !tab.url.startsWith('chrome://')) {
            debugLog(`Tab activated: ${tab.url}`);
            requestStateFromContentScript(activeInfo.tabId);
        }
    });
});

// Function to request current state from content script
function requestStateFromContentScript(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'getCurrentState' }).then((response) => {
        if (response && typeof response.enabled === 'boolean') {
            debugLog(`Received state from content script - enabled: ${response.enabled}, domain: ${response.domain}`);
            
            // Update global state and badge based on content script response
            chrome.storage.sync.set({ extensionEnabled: response.enabled }, function() {
                debugLog(`Updated badge from content script state, enabled: ${response.enabled}`);
                updateBadge(response.enabled);
            });
        } else {
            debugLog('No valid response from content script');
        }
    }).catch((error) => {
        debugLog(`Failed to get state from content script: ${error.message}`);
        // Fallback: content script might not be ready yet, ignore error
    });
}

// Context menu for quick access (optional)
chrome.contextMenus.create({
    id: 'toggleExtension',
    title: 'Toggle Unlock Copy Paste',
    contexts: ['page']
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === 'toggleExtension') {
        chrome.storage.sync.get(['extensionEnabled'], function(result) {
            const currentState = result && result.extensionEnabled === true; // Default to false
            const newState = !currentState;
            
            chrome.storage.sync.set({ extensionEnabled: newState }, function() {
                updateBadge(newState);
                
                // Notify the tab
                sendMessageToContentScript(tab.id, {
                    action: 'extensionStateChanged',
                    enabled: newState
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
                const currentState = result && result.extensionEnabled === true; // Default to false
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