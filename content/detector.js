/**
 * detector.js — Detect OKX page type and trading mode
 *
 * Page types:
 *   - spot:    /trade-spot/
 *   - swap:    /trade-swap/
 *   - futures: /trade-futures/
 *
 * Trading modes (futures/swap only):
 *   - one-way: single position per instrument
 *   - hedge:   separate long/short positions
 */

window.OKXDetector = (() => {
  /**
   * Detect the page type from the URL.
   * @returns {'spot'|'futures'|'unknown'}
   */
  function detectPageType() {
    const path = window.location.pathname;
    if (path.includes('/trade-spot/')) return 'spot';
    if (path.includes('/trade-swap/') || path.includes('/trade-futures/')) return 'futures';
    return 'unknown';
  }

  /**
   * Detect trading mode by checking for hedge-mode-specific DOM elements.
   * Hedge mode shows "Open Long" / "Open Short" / "Close Long" / "Close Short" tabs.
   * One-way mode shows simple "Buy" / "Sell".
   *
   * @returns {'hedge'|'one-way'|'unknown'}
   */
  function detectTradingMode() {
    // TODO: verify hedge mode indicator selector on live OKX page
    const hedgeEl = document.querySelector(window.OKX_SELECTORS.common.hedgeModeIndicator);
    if (hedgeEl) return 'hedge';

    // Fallback: check for open-long tab by text content
    const allButtons = document.querySelectorAll('button, [role="tab"]');
    for (const btn of allButtons) {
      const text = btn.textContent.trim().toLowerCase();
      if (text === 'open long' || text === 'open short' || text === '开多' || text === '开空') {
        return 'hedge';
      }
    }

    return 'one-way';
  }

  /**
   * Get full detection state.
   * @returns {{ pageType: string, tradingMode: string, ready: boolean }}
   */
  function getState() {
    const pageType = detectPageType();
    const tradingMode = pageType === 'spot' ? 'n/a' : detectTradingMode();
    const ready = pageType !== 'unknown';
    return { pageType, tradingMode, ready };
  }

  return { detectPageType, detectTradingMode, getState };
})();
