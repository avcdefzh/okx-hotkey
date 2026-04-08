/**
 * reader.js — Read live trading data from OKX DOM
 *
 * Reads:
 *   - Available balance (USDT or asset)
 *   - Current position size + direction (futures)
 *   - Best bid / best ask from order book
 *   - Tick size for the instrument
 *   - Open orders list
 *   - Current price input value
 */

window.OKXReader = (() => {
  const S = window.OKX_SELECTORS;

  /**
   * Parse a numeric string from DOM text, stripping commas and non-numeric chars.
   * Returns NaN if the element is missing or unparseable.
   * @param {string} selector
   * @returns {number}
   */
  function parseNumericEl(selector) {
    const el = document.querySelector(selector);
    if (!el) return NaN;
    const text = el.textContent.trim().replace(/,/g, '').replace(/[^\d.-]/g, '');
    return parseFloat(text);
  }

  /**
   * Find a specific input inside the order form by its accessibility label text.
   *
   * OKX uses .okui-a11y-text labels to identify inputs semantically.
   * The price input has label text " price"; the size input has " size".
   * The label sits inside the same .okui-input container as the actual input.
   *
   * @param {Element} formEl — The order form root element
   * @param {string} labelText — Exact label text to match (e.g. "price" or "size")
   * @returns {HTMLInputElement|null}
   */
  function findInputByLabel(formEl, labelText) {
    const labels = formEl.querySelectorAll(S.inputLabel);
    for (const label of labels) {
      if (label.textContent.trim().toLowerCase() === labelText.toLowerCase()) {
        // The input lives in the closest .okui-input ancestor of the label
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

  /**
   * Read available balance from [data-testid="max-asset"].
   *
   * Verified DOM text format: "Available 1,234.56 USDT"
   * We strip everything non-numeric (except decimal/negative) to parse the number.
   *
   * @returns {number} Available balance, NaN on failure
   */
  function readAvailableBalance() {
    const el = document.querySelector(S.availableBalance);
    if (!el) {
      console.warn('[OKX Hotkey] readAvailableBalance: [data-testid="max-asset"] not found');
      return NaN;
    }
    const text = el.textContent.trim().replace(/,/g, '').replace(/[^\d.-]/g, '');
    const value = parseFloat(text);
    if (isNaN(value)) {
      console.warn('[OKX Hotkey] readAvailableBalance: could not parse number from', el.textContent);
    }
    return value;
  }

  /**
   * Read max trade amount from [data-testid="max-trade"].
   *
   * Spot DOM text: "Max buy -- BTC"
   * Futures DOM text: "Max long -- Contracts" / "Max short -- Contracts"
   * Returns the numeric value parsed from the text.
   *
   * @returns {number} Max trade amount, NaN on failure
   */
  function readMaxTrade() {
    const el = document.querySelector(S.maxTrade);
    if (!el) {
      console.warn('[OKX Hotkey] readMaxTrade: [data-testid="max-trade"] not found');
      return NaN;
    }
    const text = el.textContent.trim().replace(/,/g, '').replace(/[^\d.-]/g, '');
    return parseFloat(text);
  }

  /**
   * Read current position data (futures only).
   *
   * Position table needs a logged-in session to fully verify.
   * Uses structural selectors from S.positionSize / S.positionDirection.
   * Direction is inferred from text content of the side column.
   *
   * @returns {{ size: number, direction: 'long'|'short'|null }}
   */
  function readPosition() {
    const sizeEl = document.querySelector(S.positionSize);
    const dirEl = document.querySelector(S.positionDirection);

    if (!sizeEl) {
      return { size: 0, direction: null };
    }

    const size = parseFloat(sizeEl.textContent.trim().replace(/,/g, '').replace(/[^\d.-]/g, ''));
    const dirText = dirEl ? dirEl.textContent.trim().toLowerCase() : '';
    let direction = null;

    if (dirText.includes('long') || dirText.includes('buy') || dirText.includes('多')) {
      direction = 'long';
    } else if (dirText.includes('short') || dirText.includes('sell') || dirText.includes('空')) {
      direction = 'short';
    }

    return { size: isNaN(size) ? 0 : Math.abs(size), direction };
  }

  /**
   * Read best bid price from order book.
   * Needs logged-in session to fully verify; uses structural selector fallback.
   * @returns {number} Best bid price, NaN on failure
   */
  function readBestBid() {
    return parseNumericEl(S.bestBid);
  }

  /**
   * Read best ask price from order book.
   * Needs logged-in session to fully verify; uses structural selector fallback.
   * @returns {number} Best ask price, NaN on failure
   */
  function readBestAsk() {
    return parseNumericEl(S.bestAsk);
  }

  /**
   * Attempt to read tick size from instrument info.
   * Falls back to deriving it from order book price decimal precision.
   * @returns {number} Tick size (e.g. 0.01), NaN on failure
   */
  function readTickSize() {
    const el = document.querySelector(S.tickSize);
    if (el) {
      const val = parseFloat(el.textContent.trim().replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
    // Fallback: derive from best bid decimal places
    const bidEl = document.querySelector(S.bestBid);
    if (bidEl) {
      const text = bidEl.textContent.trim();
      const dotIdx = text.indexOf('.');
      if (dotIdx !== -1) {
        const decimals = text.length - dotIdx - 1;
        return Math.pow(10, -decimals);
      }
    }
    return NaN;
  }

  /**
   * Read all open order rows from the orders table.
   * Needs logged-in session to fully verify.
   * @returns {Element[]} Array of order row DOM elements
   */
  function readOrderRows() {
    return Array.from(document.querySelectorAll(S.orderRow));
  }

  /**
   * Read current price input value (for limit orders).
   *
   * Uses findInputByLabel to locate the price input by its accessibility label.
   * The price input has label text " price" (with leading space, as scraped).
   *
   * @returns {number}
   */
  function readPriceInput() {
    const form = getOrderForm();
    if (!form) return NaN;
    // OKX label text is " price" (with leading space from the span content)
    const input = findInputByLabel(form, 'price');
    if (!input) return NaN;
    return parseFloat(input.value.replace(/,/g, ''));
  }

  /**
   * Read current amount/size input value.
   *
   * Uses findInputByLabel to locate the size input by its accessibility label.
   * The size input has label text " size" (with leading space, as scraped).
   *
   * @returns {number}
   */
  function readAmountInput() {
    const form = getOrderForm();
    if (!form) return NaN;
    const input = findInputByLabel(form, 'size');
    if (!input) return NaN;
    return parseFloat(input.value.replace(/,/g, ''));
  }

  return {
    findInputByLabel,
    getOrderForm,
    readAvailableBalance,
    readMaxTrade,
    readPosition,
    readBestBid,
    readBestAsk,
    readTickSize,
    readOrderRows,
    readPriceInput,
    readAmountInput,
  };
})();
