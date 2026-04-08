/**
 * reader.js — Read live trading data from OKX DOM
 *
 * Reads:
 *   - Available balance (USDT or asset)
 *   - Current position size + direction (futures)
 *   - Best bid / best ask from order book
 *   - Tick size for the instrument
 *   - Open orders list
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
   * Read available balance for the current order side.
   * On spot: USDT balance for buy, asset balance for sell.
   * On futures: available margin.
   *
   * @param {string} pageType — 'spot' | 'futures'
   * @returns {number} Available balance, NaN on failure
   */
  function readAvailableBalance(pageType) {
    const selectors = pageType === 'spot' ? S.spot : S.futures;
    const value = parseNumericEl(selectors.availableBalance);
    if (isNaN(value)) {
      console.warn('[OKX Hotkey] readAvailableBalance: element not found or NaN', selectors.availableBalance);
    }
    return value;
  }

  /**
   * Read current position data (futures only).
   * @returns {{ size: number, direction: 'long'|'short'|null }}
   */
  function readPosition() {
    const sizeEl = document.querySelector(S.futures.positionSize);
    const dirEl = document.querySelector(S.futures.positionDirection);

    if (!sizeEl) {
      return { size: 0, direction: null };
    }

    const size = parseFloat(sizeEl.textContent.trim().replace(/,/g, '').replace(/[^\d.-]/g, ''));
    const dirText = dirEl ? dirEl.textContent.trim().toLowerCase() : '';
    let direction = null;

    if (dirText.includes('long') || dirText.includes('매수') || dirText.includes('多')) {
      direction = 'long';
    } else if (dirText.includes('short') || dirText.includes('매도') || dirText.includes('空')) {
      direction = 'short';
    }

    return { size: isNaN(size) ? 0 : Math.abs(size), direction };
  }

  /**
   * Read best bid price from order book.
   * @returns {number} Best bid price, NaN on failure
   */
  function readBestBid() {
    return parseNumericEl(S.common.bestBid);
  }

  /**
   * Read best ask price from order book.
   * @returns {number} Best ask price, NaN on failure
   */
  function readBestAsk() {
    return parseNumericEl(S.common.bestAsk);
  }

  /**
   * Attempt to read tick size from instrument info.
   * Falls back to deriving it from order book price precision.
   * @returns {number} Tick size (e.g. 0.01), NaN on failure
   */
  function readTickSize() {
    const el = document.querySelector(S.common.tickSize);
    if (el) {
      const val = parseFloat(el.textContent.trim().replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
    // Fallback: derive from best bid decimal places
    const bidEl = document.querySelector(S.common.bestBid);
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
   * @returns {Element[]} Array of order row DOM elements
   */
  function readOrderRows() {
    return Array.from(document.querySelectorAll(S.common.orderRow));
  }

  /**
   * Read current price input value (for limit order price field).
   * @param {string} pageType
   * @returns {number}
   */
  function readPriceInput(pageType) {
    const sel = pageType === 'spot' ? S.spot.priceInput : S.futures.priceInput;
    const el = document.querySelector(sel);
    if (!el) return NaN;
    return parseFloat(el.value.replace(/,/g, ''));
  }

  return {
    readAvailableBalance,
    readPosition,
    readBestBid,
    readBestAsk,
    readTickSize,
    readOrderRows,
    readPriceInput
  };
})();
