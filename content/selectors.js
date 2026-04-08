/**
 * selectors.js — Centralized OKX DOM selector config
 *
 * ALL selectors are placeholders pending verification on live OKX page.
 * Update this file when OKX changes their DOM — no other files need changing.
 *
 * Inspection tips:
 *   1. Open DevTools on https://www.okx.com/trade-spot/btc-usdt
 *   2. Use "Inspect element" on target UI components
 *   3. Prefer data-testid > aria-label > class-based (in that order for stability)
 */

// Expose as global since content scripts can't use ES module imports
window.OKX_SELECTORS = {
  // ── SPOT ────────────────────────────────────────────────────────────────────
  spot: {
    // Available balance display (USDT for buy side, asset for sell side)
    // TODO: verify on live OKX spot page
    availableBalance: '[class*="tradePanel"] [class*="available"] [class*="value"]',

    // Order type tabs
    // TODO: verify on live OKX spot page
    limitTab: '[data-testid="limit-order-tab"], [class*="orderType"] [class*="limit"]',
    marketTab: '[data-testid="market-order-tab"], [class*="orderType"] [class*="market"]',

    // Price input (for limit orders)
    // TODO: verify on live OKX spot page
    priceInput: '[class*="tradePanel"] [class*="priceInput"] input, [placeholder*="Price"]',

    // Quantity/amount input
    // TODO: verify on live OKX spot page
    amountInput: '[class*="tradePanel"] [class*="amountInput"] input, [class*="sizeInput"] input',

    // Buy / Sell submit buttons
    // TODO: verify on live OKX spot page
    buyButton: '[class*="tradePanel"] [class*="buyBtn"], button[class*="buy"][class*="submit"]',
    sellButton: '[class*="tradePanel"] [class*="sellBtn"], button[class*="sell"][class*="submit"]',

    // Percentage slider quick-select buttons (25%, 50%, etc.)
    // TODO: verify on live OKX spot page
    percentageStepper: '[class*="tradePanel"] [class*="slider"] [class*="step"]',
  },

  // ── FUTURES / SWAP ───────────────────────────────────────────────────────────
  futures: {
    // Available margin / balance
    // TODO: verify on live OKX futures page
    availableBalance: '[class*="tradePanel"] [class*="available"] [class*="value"], [class*="availableMargin"]',

    // Current position size (quantity in contracts or coins)
    // TODO: verify on live OKX futures page
    positionSize: '[class*="positionTable"] [class*="positionSize"], [class*="positions"] [class*="size"]',

    // Position direction (long/short) — look for text content "long" / "short"
    // TODO: verify on live OKX futures page
    positionDirection: '[class*="positionTable"] [class*="side"], [class*="positions"] [class*="direction"]',

    // Hedge mode: tab selectors for open/close long/short
    // TODO: verify on live OKX futures hedge-mode page
    openLongTab: '[data-testid="open-long-tab"], [class*="openLong"], [aria-label*="Open Long"]',
    openShortTab: '[data-testid="open-short-tab"], [class*="openShort"], [aria-label*="Open Short"]',
    closeLongTab: '[data-testid="close-long-tab"], [class*="closeLong"], [aria-label*="Close Long"]',
    closeShortTab: '[data-testid="close-short-tab"], [class*="closeShort"], [aria-label*="Close Short"]',

    // One-way mode: simple buy/sell
    // TODO: verify on live OKX futures one-way page
    buyTab: '[data-testid="buy-tab"], [class*="tradeDirection"] [class*="buy"]',
    sellTab: '[data-testid="sell-tab"], [class*="tradeDirection"] [class*="sell"]',

    // Order type tabs
    // TODO: verify on live OKX futures page
    limitTab: '[data-testid="limit-order-tab"], [class*="orderType"] [class*="limit"]',
    marketTab: '[data-testid="market-order-tab"], [class*="orderType"] [class*="market"]',

    // Price input
    // TODO: verify on live OKX futures page
    priceInput: '[class*="tradePanel"] [class*="priceInput"] input',

    // Quantity input
    // TODO: verify on live OKX futures page
    amountInput: '[class*="tradePanel"] [class*="amountInput"] input, [class*="sizeInput"] input',

    // Submit buttons (hedge mode uses one confirm button after tab selection)
    // TODO: verify on live OKX futures page
    confirmButton: '[class*="tradePanel"] [class*="confirmBtn"], [class*="tradePanel"] button[type="submit"]',
    buyButton: '[class*="tradePanel"] [class*="buyBtn"]',
    sellButton: '[class*="tradePanel"] [class*="sellBtn"]',
  },

  // ── COMMON (applies to all trade pages) ────────────────────────────────────
  common: {
    // Best bid price (top of order book, buy side)
    // TODO: verify on live OKX page
    bestBid: '[class*="orderBook"] [class*="bid"]:first-child [class*="price"], [class*="bestBid"] [class*="price"]',

    // Best ask price (top of order book, sell side)
    // TODO: verify on live OKX page
    bestAsk: '[class*="orderBook"] [class*="ask"]:first-child [class*="price"], [class*="bestAsk"] [class*="price"]',

    // Tick size / min price increment — often in trading pair info
    // TODO: verify on live OKX page
    tickSize: '[class*="instrumentInfo"] [class*="tickSize"], [data-testid="tick-size"]',

    // Open orders table rows
    // TODO: verify on live OKX page
    orderRow: '[class*="openOrders"] [class*="orderRow"], [class*="currentOrders"] tr[class*="row"]',

    // Cancel button within an order row
    // TODO: verify on live OKX page
    cancelButton: '[class*="cancelBtn"], button[aria-label*="Cancel"]',

    // Cancel all orders button
    // TODO: verify on live OKX page
    cancelAllButton: '[data-testid="cancel-all-orders"], button[class*="cancelAll"]',

    // Chase button on unfilled limit order rows (moves order to best bid/ask)
    // TODO: verify on live OKX page
    chaseButton: '[data-testid="chase-order"], button[class*="chase"], [aria-label*="Chase"]',

    // Hedge mode indicator: unique element only present in hedge mode
    // TODO: verify on live OKX page
    hedgeModeIndicator: '[class*="openLong"], [data-testid="hedge-mode"], [class*="hedgeMode"]',

    // Current instrument price / last trade price
    // TODO: verify on live OKX page
    lastPrice: '[class*="lastPrice"] [class*="value"], [class*="indexPrice"]',
  }
};
