/**
 * storage.js — chrome.storage.local wrapper for settings persistence
 */

const DEFAULT_SETTINGS = {
  slots: [
    {
      id: 'MARKET_BUY',
      label: '시장가 매수',
      hotkey: { key: '1', ctrl: true, shift: true, alt: false },
      percentage: 5,
      enabled: true
    },
    {
      id: 'MARKET_SELL',
      label: '시장가 매도',
      hotkey: { key: '2', ctrl: true, shift: true, alt: false },
      percentage: 5,
      enabled: true
    },
    {
      id: 'LIMIT_BUY',
      label: '지정가 매수',
      hotkey: { key: '3', ctrl: true, shift: true, alt: false },
      percentage: 5,
      enabled: true
    },
    {
      id: 'LIMIT_SELL',
      label: '지정가 매도',
      hotkey: { key: '4', ctrl: true, shift: true, alt: false },
      percentage: 5,
      enabled: true
    },
    {
      id: 'TICK_BUY',
      label: '틱 매수',
      hotkey: { key: 'q', ctrl: true, shift: true, alt: false },
      percentage: 5,
      enabled: true
    },
    {
      id: 'TICK_SELL',
      label: '틱 매도',
      hotkey: { key: 'w', ctrl: true, shift: true, alt: false },
      percentage: 5,
      enabled: true
    },
    {
      id: 'PARTIAL_CLOSE',
      label: '부분 청산',
      hotkey: { key: 'z', ctrl: true, shift: true, alt: false },
      percentage: 50,
      enabled: true
    },
    {
      id: 'CLOSE_PAIR',
      label: '페어 청산',
      hotkey: { key: 'x', ctrl: true, shift: true, alt: false },
      percentage: 100,
      enabled: true
    },
    {
      id: 'CLOSE_ALL',
      label: '전체 청산',
      hotkey: { key: 'c', ctrl: true, shift: true, alt: false },
      percentage: 100,
      enabled: true
    },
    {
      id: 'FLIP',
      label: '포지션 반전',
      hotkey: { key: 'f', ctrl: true, shift: true, alt: false },
      percentage: 100,
      enabled: true
    },
    {
      id: 'CANCEL_LAST',
      label: '마지막 주문 취소',
      hotkey: { key: 'a', ctrl: true, shift: true, alt: false },
      percentage: 0,
      enabled: true
    },
    {
      id: 'CANCEL_ALL',
      label: '전체 주문 취소',
      hotkey: { key: 's', ctrl: true, shift: true, alt: false },
      percentage: 0,
      enabled: true
    },
    {
      id: 'CHASE_ORDER',
      label: '주문 체이스',
      hotkey: { key: 'd', ctrl: true, shift: true, alt: false },
      percentage: 0,
      enabled: true
    }
  ],
  general: {
    soundEnabled: true,
    confirmDangerous: true,
    overlayDuration: 2000,
    seedCap: 0
  }
};

const Storage = {
  /**
   * Load settings. Returns defaults merged with saved settings.
   * @returns {Promise<object>}
   */
  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[OKX Hotkey] Storage load error:', chrome.runtime.lastError);
          resolve(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
          return;
        }
        if (!result.settings) {
          resolve(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
          return;
        }
        // Merge: preserve defaults for any missing slots
        const saved = result.settings;
        const merged = {
          slots: DEFAULT_SETTINGS.slots.map((defaultSlot) => {
            const savedSlot = saved.slots && saved.slots.find(s => s.id === defaultSlot.id);
            return savedSlot ? { ...defaultSlot, ...savedSlot } : { ...defaultSlot };
          }),
          general: { ...DEFAULT_SETTINGS.general, ...(saved.general || {}) }
        };
        resolve(merged);
      });
    });
  },

  /**
   * Save settings object.
   * @param {object} settings
   * @returns {Promise<void>}
   */
  async save(settings) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Reset to factory defaults.
   * @returns {Promise<object>} The defaults
   */
  async reset() {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    await this.save(defaults);
    return defaults;
  },

  /**
   * Expose defaults for reference.
   */
  defaults: DEFAULT_SETTINGS
};

// Export for both popup context (via script tag) and content script context
if (typeof module !== 'undefined') {
  module.exports = { Storage, DEFAULT_SETTINGS };
}
