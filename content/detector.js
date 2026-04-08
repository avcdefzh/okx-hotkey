/**
 * detector.js — Detect OKX page type and trading mode
 *
 * Page types:
 *   - spot:    /trade-spot/
 *   - swap:    /trade-swap/
 *   - futures: /trade-futures/
 *
 * Trading modes (futures/swap only):
 *   - one-way: Buy/Sell submit buttons exist (button.okui-positivebutton / .okui-negativebutton)
 *   - hedge:   Open/Close segmented direction tabs exist (.okui-tabs-pane-segmented[role="tab"])
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
   * Detect trading mode by inspecting the form for direction tabs or submit buttons.
   *
   * Verified DOM:
   *   - Hedge mode:   .okui-tabs-pane-segmented[role="tab"] with text "Open"/"Close" exist
   *   - One-way mode: button.okui-positivebutton / button.okui-negativebutton exist in form
   *
   * In one-way mode there are NO direction tabs. The Buy/Sell buttons ARE the direction.
   *
   * @returns {'hedge'|'one-way'|'unknown'}
   */
  function detectTradingMode() {
    // Scope all checks to the order form to avoid false matches in other panels
    const form = document.querySelector(S.orderForm);

    // Check for hedge mode: segmented Open/Close tabs inside the order form
    const segmentedTabs = form ? form.querySelectorAll(S.directionTab) : [];
    if (segmentedTabs.length > 0) {
      for (const tab of segmentedTabs) {
        const text = tab.textContent.trim().toLowerCase();
        if (text === 'open' || text === 'close') return 'hedge';
      }
    }

    // Check for one-way mode: Buy/Sell submit buttons exist in the order form
    if (form) {
      const buyBtn = form.querySelector(S.submitBuy);
      const sellBtn = form.querySelector(S.submitSell);
      if (buyBtn || sellBtn) return 'one-way';
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
