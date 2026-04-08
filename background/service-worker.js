/**
 * service-worker.js — Extension lifecycle and message relay
 *
 * MV3 service worker:
 * - Listens for extension install/update
 * - Relays messages between popup and content scripts
 * - Handles tab detection for status queries
 */

'use strict';

// ── Install / Update ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[OKX Hotkey] Extension installed');
  } else if (reason === 'update') {
    console.log('[OKX Hotkey] Extension updated to', chrome.runtime.getManifest().version);
  }
});

// ── Message relay ─────────────────────────────────────────────────────────────

/**
 * Relay messages from popup to the active OKX tab's content script.
 * Popup cannot directly message content scripts — goes through background.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Message from popup asking for page status
  if (msg.type === 'QUERY_STATUS') {
    getActiveOKXTab().then(tab => {
      if (!tab) {
        sendResponse({ ready: false, error: 'No active OKX trade tab found' });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ready: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response || { ready: false, error: 'No response from content script' });
        }
      });
    });
    return true; // async response
  }

  // Message from content script (informational, no relay needed)
  return false;
});

// ── Tab helpers ───────────────────────────────────────────────────────────────

/**
 * Get the active tab if it's an OKX trade page.
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function getActiveOKXTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      const tab = tabs[0];
      const isOKX = tab.url && tab.url.includes('okx.com/trade-');
      resolve(isOKX ? tab : null);
    });
  });
}
