/**
 * executor.js — Execute DOM actions on OKX trading UI
 *
 * OKX uses React, so plain .value = '...' assignments won't trigger re-renders.
 * We must use the native input value setter + dispatch synthetic events.
 *
 * Tab and button selection uses text-content matching against verified DOM structure:
 *   - Direction tabs: .okui-tabs-pane-segmented[role="tab"], text "Buy"/"Sell"/"Open"/"Close"
 *   - Order type tabs: .okui-tabs-pane-underline[role="tab"], text "Limit"/"Market"/"TP/SL"
 *   - Submit buttons: <button> inside #leftPoForm, text includes "buy"/"sell"/"long"/"short"
 */

window.OKXExecutor = (() => {
  const S = window.OKX_SELECTORS;

  // ── React-compatible input setter ─────────────────────────────────────────

  /**
   * Set an input's value in a way React will detect.
   * OKX uses React controlled inputs; plain assignment is ignored by React's reconciler.
   * Using the native HTMLInputElement setter bypasses React's value tracking,
   * then the dispatched "input" event causes React to pick up the new value.
   * @param {HTMLInputElement} input
   * @param {string|number} value
   */
  function setInputValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, String(value));
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

  // ── Text-content tab clicker ──────────────────────────────────────────────

  /**
   * Find and click a tab element matching the given CSS class and text content.
   *
   * Verified strategy: OKX tabs use role="tab" and stable okui-* class names.
   * Text content is the most reliable identifier since OKX does not provide
   * data-testid on individual tab items.
   *
   * @param {string} tabClass — CSS selector for the tab group (e.g. S.directionTab)
   * @param {string} text — Tab text to match (case-insensitive)
   * @returns {Promise<boolean>}
   */
  async function clickTabByText(tabClass, text) {
    const tabs = document.querySelectorAll(tabClass);
    for (const tab of tabs) {
      if (tab.textContent.trim().toLowerCase() === text.toLowerCase()) {
        tab.click();
        await delay(80);
        return true;
      }
    }
    console.warn('[OKX Hotkey] clickTabByText: no tab matched', { tabClass, text });
    return false;
  }

  // ── Order type selection ──────────────────────────────────────────────────

  /**
   * Switch to Market order type.
   * Verified tab class: .okui-tabs-pane-underline[role="tab"], text "Market".
   */
  async function selectMarketOrder() {
    const ok = await clickTabByText(S.orderTypeTab, 'Market');
    if (!ok) throw new Error('[OKX Hotkey] selectMarketOrder: Market tab not found');
    await delay(80);
  }

  /**
   * Switch to Limit order type.
   * Verified tab class: .okui-tabs-pane-underline[role="tab"], text "Limit".
   */
  async function selectLimitOrder() {
    const ok = await clickTabByText(S.orderTypeTab, 'Limit');
    if (!ok) throw new Error('[OKX Hotkey] selectLimitOrder: Limit tab not found');
    await delay(80);
  }

  // ── Direction / side selection ────────────────────────────────────────────

  /**
   * Select the correct direction tab based on action and mode.
   *
   * Verified DOM: direction tabs are .okui-tabs-pane-segmented[role="tab"].
   *
   * Spot (one-way):
   *   direction = 'buy'  → click tab with text "Buy"
   *   direction = 'sell' → click tab with text "Sell"
   *
   * Futures one-way mode:
   *   direction = 'buy'  → click "Buy"
   *   direction = 'sell' → click "Sell"
   *
   * Futures hedge mode:
   *   direction = 'open_long'   → click "Open" tab (then buy/long is implied by the tab selection)
   *   direction = 'open_short'  → click "Open", then the form side is short
   *   direction = 'close_long'  → click "Close"
   *   direction = 'close_short' → click "Close"
   *
   * Note: In OKX hedge mode the tab only shows "Open" / "Close". The long/short
   * direction inside each mode is a separate sub-control not yet verified from
   * logged-in scraping. Using "Open"/"Close" tab click is the verified first step.
   *
   * @param {'buy'|'sell'|'open_long'|'open_short'|'close_long'|'close_short'} direction
   * @param {'one-way'|'hedge'|'n/a'} tradingMode
   */
  async function selectDirection(direction, tradingMode) {
    if (tradingMode === 'hedge') {
      const tabText = direction.startsWith('open') ? 'Open' : 'Close';
      const ok = await clickTabByText(S.directionTab, tabText);
      if (!ok) throw new Error(`[OKX Hotkey] selectDirection: "${tabText}" tab not found (hedge mode)`);
    } else {
      // spot or futures one-way
      const isBuy = direction === 'buy' || direction === 'open_long';
      const tabText = isBuy ? 'Buy' : 'Sell';
      const ok = await clickTabByText(S.directionTab, tabText);
      if (!ok) throw new Error(`[OKX Hotkey] selectDirection: "${tabText}" tab not found`);
    }
    await delay(80);
  }

  // ── Input helpers ─────────────────────────────────────────────────────────

  /**
   * Find a specific input inside the order form by accessibility label text.
   *
   * Verified strategy: OKX uses .okui-a11y-text labels inside .okui-input containers.
   * The price input label reads " price"; the size input label reads " size".
   * Matching is done case-insensitively and trims the leading space.
   *
   * @param {Element} formEl
   * @param {string} labelText — "price" or "size"
   * @returns {HTMLInputElement|null}
   */
  function findInputByLabel(formEl, labelText) {
    const labels = formEl.querySelectorAll(S.inputLabel);
    for (const label of labels) {
      if (label.textContent.trim().toLowerCase() === labelText.toLowerCase()) {
        const container = label.closest('.okui-input');
        if (container) {
          return container.querySelector(S.inputField);
        }
      }
    }
    return null;
  }

  /**
   * Get the order form element.
   * @returns {Element|null}
   */
  function getOrderForm() {
    return document.querySelector(S.orderForm);
  }

  // ── Fill inputs ──────────────────────────────────────────────────────────

  /**
   * Fill in the price input field (limit orders).
   *
   * Verified: price input is identified by .okui-a11y-text label with text " price"
   * inside the #leftPoForm container. Input has class .okui-input-input.
   *
   * @param {number} price
   */
  async function fillPrice(price) {
    const form = getOrderForm();
    if (!form) throw new Error('[OKX Hotkey] fillPrice: order form (#leftPoForm) not found');
    const input = findInputByLabel(form, 'price');
    if (!input) throw new Error('[OKX Hotkey] fillPrice: price input not found by label');
    input.focus();
    setInputValue(input, price);
    await delay(50);
  }

  /**
   * Fill in the amount/size input field.
   *
   * Verified: size input is identified by .okui-a11y-text label with text " size"
   * inside the #leftPoForm container. Input has class .okui-input-input.
   *
   * @param {number} amount
   */
  async function fillAmount(amount) {
    const form = getOrderForm();
    if (!form) throw new Error('[OKX Hotkey] fillAmount: order form (#leftPoForm) not found');
    const input = findInputByLabel(form, 'size');
    if (!input) throw new Error('[OKX Hotkey] fillAmount: size input not found by label');
    input.focus();
    setInputValue(input, amount);
    await delay(50);
  }

  // ── Percentage slider ──────────────────────────────────────────────────────

  /**
   * Click a percentage slider node by its text value.
   *
   * Verified DOM: slider nodes are .okui-slider-mark-node with a child
   * .okui-slider-mark-node-text containing a <span> with text like "25%".
   *
   * @param {number} percent — 0, 25, 50, 75, or 100
   * @returns {Promise<boolean>}
   */
  async function clickSliderPercent(percent) {
    const nodes = document.querySelectorAll(S.sliderNode);
    const target = String(percent) + '%';
    for (const node of nodes) {
      const textEl = node.querySelector(S.sliderNodeText);
      if (textEl && textEl.textContent.trim() === target) {
        node.click();
        await delay(80);
        return true;
      }
    }
    console.warn('[OKX Hotkey] clickSliderPercent: no node found for', target);
    return false;
  }

  // ── Submit buttons ────────────────────────────────────────────────────────

  /**
   * Find the submit button inside the order form by text content.
   *
   * Submit buttons are not in logged-in scraped data, so we use text-content matching.
   * OKX button text patterns:
   *   Buy side:  "Buy BTC", "Buy/Long", "Open Long", "Long"
   *   Sell side: "Sell BTC", "Sell/Short", "Open Short", "Close Long", "Close Short", "Short"
   *
   * @param {Element} formEl
   * @param {'buy'|'sell'} side
   * @returns {HTMLButtonElement|null}
   */
  function findSubmitButton(formEl, side) {
    const buttons = formEl.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent.trim().toLowerCase();
      if (side === 'buy') {
        if (text.includes('buy') || text.includes('long') || text.includes('open long')) {
          return btn;
        }
      } else {
        if (
          text.includes('sell') ||
          text.includes('short') ||
          text.includes('open short') ||
          text.includes('close long') ||
          text.includes('close short')
        ) {
          return btn;
        }
      }
    }
    return null;
  }

  /**
   * Click the Buy submit button.
   * Uses text-content matching inside #leftPoForm (verified form container).
   */
  async function submitBuy() {
    const form = getOrderForm();
    if (!form) throw new Error('[OKX Hotkey] submitBuy: order form (#leftPoForm) not found');
    const btn = findSubmitButton(form, 'buy');
    if (!btn) throw new Error('[OKX Hotkey] submitBuy: buy button not found in form');
    btn.click();
    await delay(100);
  }

  /**
   * Click the Sell submit button.
   * Uses text-content matching inside #leftPoForm (verified form container).
   */
  async function submitSell() {
    const form = getOrderForm();
    if (!form) throw new Error('[OKX Hotkey] submitSell: order form (#leftPoForm) not found');
    const btn = findSubmitButton(form, 'sell');
    if (!btn) throw new Error('[OKX Hotkey] submitSell: sell button not found in form');
    btn.click();
    await delay(100);
  }

  // ── Order management ──────────────────────────────────────────────────────

  /**
   * Cancel a specific order row by clicking its cancel button.
   * Needs logged-in session to fully verify exact cancel button selector.
   * Falls back to text-content search within the row.
   * @param {Element} orderRowEl
   */
  async function cancelOrderRow(orderRowEl) {
    // Try selector-based first, then text-content fallback
    let cancelBtn = orderRowEl.querySelector(S.cancelButton.split(',')[0].trim());
    if (!cancelBtn) {
      const buttons = orderRowEl.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent.trim().toLowerCase();
        if (text === 'cancel' || text.includes('cancel')) {
          cancelBtn = btn;
          break;
        }
      }
    }
    if (!cancelBtn) throw new Error('[OKX Hotkey] cancelOrderRow: cancel button not found in order row');
    cancelBtn.click();
    await delay(100);
  }

  /**
   * Click the "Cancel All" button.
   * Falls back to text-content search if data-testid selector misses.
   */
  async function cancelAllOrders() {
    // Try data-testid first (stable)
    let clicked = clickEl('[data-testid="cancel-all-orders"]');
    if (!clicked) {
      // Text-content fallback
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('cancel all') || text === 'cancel all') {
          btn.click();
          await delay(100);
          return;
        }
      }
      throw new Error('[OKX Hotkey] cancelAllOrders: Cancel All button not found');
    }
    await delay(100);
  }

  return {
    setInputValue,
    delay,
    clickEl,
    clickTabByText,
    findInputByLabel,
    findSubmitButton,
    getOrderForm,
    selectMarketOrder,
    selectLimitOrder,
    selectDirection,
    fillPrice,
    fillAmount,
    clickSliderPercent,
    submitBuy,
    submitSell,
    cancelOrderRow,
    cancelAllOrders,
  };
})();
