/**
 * detector.js — Detect OKX page type and trading mode
 *
 * Page types:
 *   - spot:    /trade-spot/
 *   - swap:    /trade-swap/
 *   - futures: /trade-futures/
 *
 * Trading modes (futures/swap only):
 *   - one-way: direction tabs show "Buy" / "Sell"
 *   - hedge:   direction tabs show "Open" / "Close"
 */

window.OKXDetector = (() => {
  const S = window.OKX_SELECTORS;

  /**
   * Detect the page type from the URL pathname.
   * Verified: OKX uses these stable path segments.
   * @returns {'spot'|'futures'|'unknown'}
   */
  function detectPageType() {
    const path = window.location.pathname;
    if (path.includes('/trade-spot/')) return 'spot';
    if (path.includes('/trade-swap/') || path.includes('/trade-futures/')) return 'futures';
    return 'unknown';
  }

  /**
   * Detect trading mode by inspecting direction tab text content.
   *
   * Verified DOM: direction tabs use .okui-tabs-pane-segmented[role="tab"].
   *   - Hedge mode:   tabs read "Open" and "Close"
   *   - One-way mode: tabs read "Buy" and "Sell"
   *
   * This is more reliable than checking for a hedge-mode indicator element
   * because OKX does not expose a dedicated hedge-mode class at the form level.
   *
   * @returns {'hedge'|'one-way'|'unknown'}
   */
  function detectTradingMode() {
    const directionTabs = document.querySelectorAll(S.directionTab);
    if (!directionTabs.length) return 'unknown';

    for (const tab of directionTabs) {
      const text = tab.textContent.trim().toLowerCase();
      if (text === 'open' || text === 'close') return 'hedge';
      if (text === 'buy' || text === 'sell') return 'one-way';
    }

    return 'unknown';
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
