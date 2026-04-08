/**
 * main.js — Entry point for OKX Hotkey Trading extension
 *
 * Responsibilities:
 * 1. Init: load settings, set up hotkey listeners
 * 2. Hotkey dispatch: match key combo to slot, execute action
 * 3. SPA navigation: MutationObserver re-detects page type on URL change
 * 4. Graceful error handling with overlay feedback
 */

;(async function OKXHotkeyMain() {
  'use strict';

  // Guard: prevent double-init on SPA re-renders
  if (window.__okxHotkeyInitialized) return;
  window.__okxHotkeyInitialized = true;

  // ── State ──────────────────────────────────────────────────────────────────

  let settings = null;
  let detectorState = { pageType: 'unknown', tradingMode: 'unknown', ready: false };
  let hotkeyListener = null;

  // ── Settings loading ──────────────────────────────────────────────────────

  async function loadSettings() {
    try {
      settings = await chrome.storage.local.get(['settings']).then(r => {
        if (!r.settings) return getDefaultSettings();
        return mergeWithDefaults(r.settings);
      });

      // Apply overlay duration
      OKXOverlay.setDuration(settings.general.overlayDuration);
    } catch (err) {
      console.error('[OKX Hotkey] Failed to load settings:', err);
      settings = getDefaultSettings();
    }
  }

  function getDefaultSettings() {
    return {
      slots: [
        { id: 'MARKET_BUY',    label: '시장가 매수',       hotkey: { key: '1', ctrl: true,  shift: true,  alt: false }, percentage: 5,   enabled: true },
        { id: 'MARKET_SELL',   label: '시장가 매도',       hotkey: { key: '2', ctrl: true,  shift: true,  alt: false }, percentage: 5,   enabled: true },
        { id: 'LIMIT_BUY',     label: '지정가 매수',       hotkey: { key: '3', ctrl: true,  shift: true,  alt: false }, percentage: 5,   enabled: true },
        { id: 'LIMIT_SELL',    label: '지정가 매도',       hotkey: { key: '4', ctrl: true,  shift: true,  alt: false }, percentage: 5,   enabled: true },
        { id: 'TICK_BUY',      label: '틱 매수',           hotkey: { key: 'q', ctrl: true,  shift: true,  alt: false }, percentage: 5,   enabled: true },
        { id: 'TICK_SELL',     label: '틱 매도',           hotkey: { key: 'w', ctrl: true,  shift: true,  alt: false }, percentage: 5,   enabled: true },
        { id: 'PARTIAL_CLOSE', label: '부분 청산',         hotkey: { key: 'z', ctrl: true,  shift: true,  alt: false }, percentage: 50,  enabled: true },
        { id: 'CLOSE_PAIR',    label: '페어 청산',         hotkey: { key: 'x', ctrl: true,  shift: true,  alt: false }, percentage: 100, enabled: true },
        { id: 'CLOSE_ALL',     label: '전체 청산',         hotkey: { key: 'c', ctrl: true,  shift: true,  alt: false }, percentage: 100, enabled: true },
        { id: 'FLIP',          label: '포지션 반전',       hotkey: { key: 'f', ctrl: true,  shift: true,  alt: false }, percentage: 100, enabled: true },
        { id: 'CANCEL_LAST',   label: '마지막 주문 취소',  hotkey: { key: 'a', ctrl: true,  shift: true,  alt: false }, percentage: 0,   enabled: true },
        { id: 'CANCEL_ALL',    label: '전체 주문 취소',    hotkey: { key: 's', ctrl: true,  shift: true,  alt: false }, percentage: 0,   enabled: true },
        { id: 'CHASE_ORDER',   label: '주문 체이스',       hotkey: { key: 'd', ctrl: true,  shift: true,  alt: false }, percentage: 0,   enabled: true },
      ],
      general: {
        soundEnabled: true,
        confirmDangerous: true,
        overlayDuration: 2000,
        seedCap: 0
      }
    };
  }

  function mergeWithDefaults(saved) {
    const defaults = getDefaultSettings();
    return {
      slots: defaults.slots.map(def => {
        const s = saved.slots && saved.slots.find(sl => sl.id === def.id);
        return s ? { ...def, ...s } : { ...def };
      }),
      general: { ...defaults.general, ...(saved.general || {}) }
    };
  }

  // ── Hotkey matching ───────────────────────────────────────────────────────

  /**
   * Normalize a key from KeyboardEvent.
   * Returns lowercase letter/digit or special key name.
   * @param {KeyboardEvent} e
   * @returns {string}
   */
  function normalizeKey(e) {
    // Digits/letters: use e.key.toLowerCase()
    // Function keys: F1–F12 etc.
    return e.key.toLowerCase();
  }

  /**
   * Check if a keyboard event matches a saved hotkey config.
   * @param {KeyboardEvent} e
   * @param {{ key: string, ctrl: boolean, shift: boolean, alt: boolean }} hotkey
   * @returns {boolean}
   */
  function matchesHotkey(e, hotkey) {
    if (!hotkey || !hotkey.key) return false;
    return (
      normalizeKey(e) === hotkey.key.toLowerCase() &&
      !!e.ctrlKey === !!hotkey.ctrl &&
      !!e.shiftKey === !!hotkey.shift &&
      !!e.altKey === !!hotkey.alt &&
      !e.metaKey // don't match with Meta/Cmd key
    );
  }

  // ── Dangerous action confirmation ─────────────────────────────────────────

  const DANGEROUS_ACTIONS = new Set(['CLOSE_ALL', 'FLIP', 'CANCEL_ALL']);

  async function confirmIfDangerous(slot) {
    if (!settings.general.confirmDangerous) return true;
    if (!DANGEROUS_ACTIONS.has(slot.id)) return true;

    return new Promise(resolve => {
      // Show a confirm overlay with countdown
      const toast = OKXOverlay.show(
        `${slot.label} — 다시 누르면 실행 (2초 내)`,
        'info',
        0 // no auto-dismiss
      );

      let confirmed = false;

      const confirmHandler = (e) => {
        if (matchesHotkey(e, slot.hotkey)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          confirmed = true;
          document.removeEventListener('keydown', confirmHandler, true);
          OKXOverlay.dismiss(toast);
          resolve(true);
        }
      };

      document.addEventListener('keydown', confirmHandler, true);

      setTimeout(() => {
        if (!confirmed) {
          document.removeEventListener('keydown', confirmHandler, true);
          OKXOverlay.dismiss(toast);
          resolve(false);
        }
      }, 2000);
    });
  }

  // ── Hotkey handler ────────────────────────────────────────────────────────

  async function handleKeydown(e) {
    if (!settings) return;

    // Don't intercept if user is typing in an input (other than OKX's own inputs)
    const target = e.target;
    const isTextInput = (
      (target.tagName === 'INPUT' && !target.closest('[class*="tradePanel"]')) ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
    if (isTextInput) return;

    for (const slot of settings.slots) {
      if (!slot.enabled) continue;
      if (!matchesHotkey(e, slot.hotkey)) continue;

      e.preventDefault();
      e.stopImmediatePropagation();

      await executeSlot(slot);
      break;
    }
  }

  // ── Action execution ──────────────────────────────────────────────────────

  async function executeSlot(slot) {
    // Re-detect page state fresh on each execution
    detectorState = OKXDetector.getState();

    if (!detectorState.ready) {
      OKXOverlay.error('OKX 트레이딩 페이지를 인식하지 못했습니다');
      return;
    }

    // Confirm dangerous actions
    const proceed = await confirmIfDangerous(slot);
    if (!proceed) {
      OKXOverlay.show('취소됨', 'info');
      return;
    }

    // Show loading toast
    const toast = OKXOverlay.loading(`${slot.label} ${slot.percentage > 0 ? slot.percentage + '%' : ''} 실행 중...`);

    try {
      const ctx = {
        pageType: detectorState.pageType,
        tradingMode: detectorState.tradingMode,
        percentage: slot.percentage,
        seedCap: settings.general.seedCap || 0,
        overlay: OKXOverlay
      };

      const result = await OKXActions.execute(slot.id, ctx);
      OKXOverlay.update(toast, result || `${slot.label} 완료`, 'success');
    } catch (err) {
      console.error(`[OKX Hotkey] Action ${slot.id} failed:`, err);
      OKXOverlay.update(toast, `오류: ${err.message}`, 'error');
    }
  }

  // ── Listener management ───────────────────────────────────────────────────

  function attachKeyListener() {
    if (hotkeyListener) {
      document.removeEventListener('keydown', hotkeyListener, true);
    }
    hotkeyListener = handleKeydown;
    document.addEventListener('keydown', hotkeyListener, true);
  }

  // ── Settings change listener (from popup) ─────────────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      const saved = changes.settings.newValue;
      settings = mergeWithDefaults(saved);
      OKXOverlay.setDuration(settings.general.overlayDuration);
      console.log('[OKX Hotkey] Settings reloaded from popup');
    }
  });

  // ── SPA navigation detection ──────────────────────────────────────────────
  // OKX is a SPA — URL changes without full page reload

  let lastUrl = window.location.href;

  const navObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('[OKX Hotkey] SPA navigation detected, re-detecting page...');
      detectorState = OKXDetector.getState();
    }
  });

  navObserver.observe(document.body, { childList: true, subtree: true });

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    console.log('[OKX Hotkey] Initializing...');
    await loadSettings();

    detectorState = OKXDetector.getState();
    console.log('[OKX Hotkey] Detected:', detectorState);

    attachKeyListener();

    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'GET_STATUS') {
        sendResponse({
          ready: detectorState.ready,
          pageType: detectorState.pageType,
          tradingMode: detectorState.tradingMode
        });
      }
      return false;
    });

    console.log('[OKX Hotkey] Ready. Page:', detectorState.pageType, '/ Mode:', detectorState.tradingMode);
  }

  init().catch(err => {
    console.error('[OKX Hotkey] Init failed:', err);
  });

})();
