/**
 * selectors.js — Centralized OKX DOM selector config
 *
 * Selectors verified via headless Chrome scraping of live OKX pages.
 * OKX uses the okui-* design system. Key stability notes:
 *   - okui-* class names are stable (design system, not build artifacts)
 *   - data-testid attributes are stable
 *   - Hash-suffixed IDs like #_r_4o_ are NOT stable — never use them
 *   - Hash-suffixed classes like index_availableRow__H1d0q are NOT stable — use data-testid
 *   - Inputs are identified by accessibility label text, not IDs
 *
 * Update this file when OKX changes their DOM — no other files need changing.
 */

// Expose as global since content scripts can't use ES module imports
window.OKX_SELECTORS = {
  // ── FORM CONTAINER ──────────────────────────────────────────────────────────
  // The main order form. #leftPoForm is stable; .common-form-box is fallback.
  orderForm: '#leftPoForm, .common-form-box',

  // ── INPUT IDENTIFICATION ────────────────────────────────────────────────────
  // OKX uses okui-a11y-text labels to identify inputs semantically.
  // Text content " price" identifies the price input's label.
  // Text content " size" identifies the amount/size input's label.
  // Use findInputByLabel() in reader.js / executor.js to locate the actual input.
  inputLabel: '.okui-a11y-text',   // label element — check textContent for " price" or " size"
  inputField: '.okui-input-input', // the actual <input> element inside .okui-input

  // ── DIRECTION TABS (Buy/Sell or Open/Close) ─────────────────────────────────
  // Segmented control tabs for trade direction.
  // Text content determines which: "Buy"/"Sell" (one-way) or "Open"/"Close" (hedge).
  // Use text-content matching to click the correct tab.
  directionTab: '.okui-tabs-pane-segmented[role="tab"]',
  activeDirectionTab: '.okui-tabs-pane-segmented-active',

  // ── ORDER TYPE TABS (Limit / Market / TP-SL) ────────────────────────────────
  // Underline-style tabs for order type.
  // Text content: "Limit", "Market", "TP/SL"
  // Use text-content matching to click the correct tab.
  orderTypeTab: '.okui-tabs-pane-underline[role="tab"]',
  activeOrderTypeTab: '.okui-tabs-pane-underline-active',

  // ── BALANCE ─────────────────────────────────────────────────────────────────
  // data-testid is stable and preferred over hash-suffixed class names.
  // "max-asset" element text: "Available 1,234.56 USDT" — parse the number.
  availableBalance: '[data-testid="max-asset"]',
  // "max-trade" element text: "Max buy -- BTC" (spot) or "Max long -- Contracts" (futures).
  // Inner spans: .index_text__* for label, .index_value__* for value — but class hashes are NOT stable.
  // Parse the numeric portion from maxTrade.textContent directly.
  maxTrade: '[data-testid="max-trade"]',

  // ── PERCENTAGE SLIDER ───────────────────────────────────────────────────────
  // Slider percentage quick-select nodes (0%, 25%, 50%, 75%, 100%).
  // Click the node container; text content is inside the nested span.
  sliderNode: '.okui-slider-mark-node',
  sliderNodeText: '.okui-slider-mark-node-text',

  // ── ORDER BOOK ──────────────────────────────────────────────────────────────
  // Best bid/ask selectors need a logged-in session to fully verify.
  // Using structural best-guess; update after verifying on logged-in page.
  // Strategy: find order book container, then first bid/ask price row.
  bestBid: '[class*="orderBook"] [class*="bid"]:first-child [class*="price"]',
  bestAsk: '[class*="orderBook"] [class*="ask"]:first-child [class*="price"]',

  // ── OPEN ORDERS ─────────────────────────────────────────────────────────────
  // Order table rows — needs logged-in session to fully verify.
  // Strategy: find rows in the current orders / open orders panel.
  orderRow: '[class*="openOrders"] [class*="orderRow"], [class*="currentOrders"] tr[class*="row"]',

  // Cancel button within an order row — needs logged-in session to verify.
  // Fallback: find button with text "Cancel" within the row.
  cancelButton: '[class*="cancelBtn"], button[aria-label*="Cancel"]',

  // Cancel all orders button — needs logged-in session to verify.
  // Fallback: text-content search for "Cancel All" in cancelAllOrders().
  cancelAllButton: '[data-testid="cancel-all-orders"], button[class*="cancelAll"]',

  // Chase button on unfilled limit orders — needs logged-in session to verify.
  chaseButton: '[data-testid="chase-order"], button[class*="chase"], [aria-label*="Chase"]',

  // ── POSITION (futures) ──────────────────────────────────────────────────────
  // Position panel — needs logged-in session to fully verify.
  // Strategy: find rows in the position table, match side column text for long/short.
  positionSize: '[class*="positionTable"] [class*="positionSize"], [class*="positions"] [class*="size"]',
  positionDirection: '[class*="positionTable"] [class*="side"], [class*="positions"] [class*="direction"]',

  // ── LAST PRICE / TICK SIZE ──────────────────────────────────────────────────
  // These need verification on logged-in page; structural selectors used as fallback.
  lastPrice: '[class*="lastPrice"] [class*="value"], [class*="indexPrice"]',
  tickSize: '[class*="instrumentInfo"] [class*="tickSize"], [data-testid="tick-size"]',
};
