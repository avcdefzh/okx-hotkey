/**
 * executor.js — Execute DOM actions on OKX trading UI
 *
 * OKX uses React, so plain .value = '...' assignments won't trigger re-renders.
 * We must use the native input value setter + dispatch synthetic events.
 */

window.OKXExecutor = (() => {
  const S = window.OKX_SELECTORS;

  // ── React-compatible input setter ─────────────────────────────────────────

  /**
   * Set an input's value in a way React will detect.
   * @param {HTMLInputElement} input
   * @param {string|number} value
   */
  function setInputValue(input, value) {
    // Use native setter to bypass React's value tracking
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, String(value));
    // Dispatch events React listens to
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Small async delay helper.
   * @param {number} ms
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Click a DOM element, logging a warning if not found.
   * @param {string|Element} selectorOrEl
   * @returns {boolean} true if clicked
   */
  function clickEl(selectorOrEl) {
    const el = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (!el) {
      console.warn('[OKX Hotkey] clickEl: element not found', selectorOrEl);
      return false;
    }
    el.click();
    return true;
  }

  // ── Tab selectors ─────────────────────────────────────────────────────────

  /**
   * Click a tab by trying multiple selectors (comma-separated) or text content.
   * @param {string} multiSelector — CSS selector (may include commas for fallbacks)
   * @returns {Promise<boolean>}
   */
  async function clickTab(multiSelector) {
    const selectors = multiSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        await delay(80);
        return true;
      }
    }
    console.warn('[OKX Hotkey] clickTab: none of the selectors matched', multiSelector);
    return false;
  }

  // ── Order type selection ──────────────────────────────────────────────────

  /**
   * Switch to Market order type tab.
   * @param {string} pageType
   */
  async function selectMarketOrder(pageType) {
    const sel = pageType === 'spot' ? S.spot.marketTab : S.futures.marketTab;
    await clickTab(sel);
    await delay(80);
  }

  /**
   * Switch to Limit order type tab.
   * @param {string} pageType
   */
  async function selectLimitOrder(pageType) {
    const sel = pageType === 'spot' ? S.spot.limitTab : S.futures.limitTab;
    await clickTab(sel);
    await delay(80);
  }

  // ── Direction/side selection ───────────────────────────────────────────────

  /**
   * Select the correct trading tab based on action direction and mode.
   *
   * @param {'buy'|'sell'|'open_long'|'open_short'|'close_long'|'close_short'} direction
   * @param {string} pageType
   * @param {string} tradingMode — 'one-way' | 'hedge'
   */
  async function selectDirection(direction, pageType, tradingMode) {
    if (pageType === 'spot') {
      // Spot: just ensure buy or sell panel is active (OKX usually keeps both visible)
      if (direction === 'buy') {
        await clickTab(S.spot.buyButton); // some layouts use tabs
      } else if (direction === 'sell') {
        await clickTab(S.spot.sellButton);
      }
      return;
    }

    // Futures
    if (tradingMode === 'hedge') {
      const tabMap = {
        open_long: S.futures.openLongTab,
        open_short: S.futures.openShortTab,
        close_long: S.futures.closeLongTab,
        close_short: S.futures.closeShortTab
      };
      const sel = tabMap[direction];
      if (sel) await clickTab(sel);
    } else {
      // One-way mode
      const sel = (direction === 'buy') ? S.futures.buyTab : S.futures.sellTab;
      if (sel) await clickTab(sel);
    }
    await delay(80);
  }

  // ── Quantity input ────────────────────────────────────────────────────────

  /**
   * Fill in the quantity/amount input field.
   * @param {string} pageType
   * @param {number} amount
   */
  async function fillAmount(pageType, amount) {
    const sel = pageType === 'spot' ? S.spot.amountInput : S.futures.amountInput;
    const input = document.querySelector(sel);
    if (!input) {
      throw new Error(`Amount input not found: ${sel}`);
    }
    input.focus();
    setInputValue(input, amount);
    await delay(50);
  }

  /**
   * Fill in the price input field (limit orders).
   * @param {string} pageType
   * @param {number} price
   */
  async function fillPrice(pageType, price) {
    const sel = pageType === 'spot' ? S.spot.priceInput : S.futures.priceInput;
    const input = document.querySelector(sel);
    if (!input) {
      throw new Error(`Price input not found: ${sel}`);
    }
    input.focus();
    setInputValue(input, price);
    await delay(50);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  /**
   * Click the Buy submit button.
   * @param {string} pageType
   */
  async function submitBuy(pageType) {
    const sel = pageType === 'spot' ? S.spot.buyButton : S.futures.buyButton;
    const fallbackSel = pageType === 'futures' ? S.futures.confirmButton : null;

    let clicked = clickEl(sel.split(',')[0].trim());
    if (!clicked && fallbackSel) {
      clicked = clickEl(fallbackSel.split(',')[0].trim());
    }
    if (!clicked) throw new Error(`Buy button not found: ${sel}`);
    await delay(100);
  }

  /**
   * Click the Sell submit button.
   * @param {string} pageType
   */
  async function submitSell(pageType) {
    const sel = pageType === 'spot' ? S.spot.sellButton : S.futures.sellButton;
    const fallbackSel = pageType === 'futures' ? S.futures.confirmButton : null;

    let clicked = clickEl(sel.split(',')[0].trim());
    if (!clicked && fallbackSel) {
      clicked = clickEl(fallbackSel.split(',')[0].trim());
    }
    if (!clicked) throw new Error(`Sell button not found: ${sel}`);
    await delay(100);
  }

  /**
   * Cancel a specific order row's cancel button.
   * @param {Element} orderRowEl
   */
  async function cancelOrderRow(orderRowEl) {
    const cancelBtn = orderRowEl.querySelector(S.common.cancelButton.split(',')[0].trim())
      || orderRowEl.querySelector('[class*="cancel"]')
      || orderRowEl.querySelector('button:last-child');
    if (!cancelBtn) throw new Error('Cancel button not found in order row');
    cancelBtn.click();
    await delay(100);
  }

  /**
   * Click the "Cancel All" button.
   */
  async function cancelAllOrders() {
    const clicked = clickEl(S.common.cancelAllButton.split(',')[0].trim());
    if (!clicked) {
      // Fallback: find button with "cancel all" text
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('cancel all') || text.includes('전체 취소')) {
          btn.click();
          await delay(100);
          return;
        }
      }
      throw new Error('Cancel All button not found');
    }
    await delay(100);
  }

  return {
    setInputValue,
    delay,
    clickEl,
    clickTab,
    selectMarketOrder,
    selectLimitOrder,
    selectDirection,
    fillAmount,
    fillPrice,
    submitBuy,
    submitSell,
    cancelOrderRow,
    cancelAllOrders
  };
})();
