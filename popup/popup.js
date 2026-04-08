/**
 * popup.js — Settings UI logic for OKX Hotkey extension
 *
 * Handles:
 * - Loading/saving settings from chrome.storage.local
 * - Rendering 13 slot rows with enable toggle, hotkey recorder, pct input
 * - General settings section (overlayDuration, seedCap, confirmDangerous, soundEnabled)
 * - Querying content script for page detection status
 */

'use strict';

// ── Default settings (mirrors lib/storage.js) ─────────────────────────────────

const DEFAULT_SLOTS = [
  { id: 'MARKET_BUY',    label: '시장가 매수',       hotkey: { key: '1', ctrl: true, shift: true, alt: false }, percentage: 5,   enabled: true },
  { id: 'MARKET_SELL',   label: '시장가 매도',       hotkey: { key: '2', ctrl: true, shift: true, alt: false }, percentage: 5,   enabled: true },
  { id: 'LIMIT_BUY',     label: '지정가 매수',       hotkey: { key: '3', ctrl: true, shift: true, alt: false }, percentage: 5,   enabled: true },
  { id: 'LIMIT_SELL',    label: '지정가 매도',       hotkey: { key: '4', ctrl: true, shift: true, alt: false }, percentage: 5,   enabled: true },
  { id: 'TICK_BUY',      label: '틱 매수',           hotkey: { key: 'q', ctrl: true, shift: true, alt: false }, percentage: 5,   enabled: true },
  { id: 'TICK_SELL',     label: '틱 매도',           hotkey: { key: 'w', ctrl: true, shift: true, alt: false }, percentage: 5,   enabled: true },
  { id: 'PARTIAL_CLOSE', label: '부분 청산',         hotkey: { key: 'z', ctrl: true, shift: true, alt: false }, percentage: 50,  enabled: true },
  { id: 'CLOSE_PAIR',    label: '페어 청산',         hotkey: { key: 'x', ctrl: true, shift: true, alt: false }, percentage: 100, enabled: true },
  { id: 'CLOSE_ALL',     label: '전체 청산',         hotkey: { key: 'c', ctrl: true, shift: true, alt: false }, percentage: 100, enabled: true },
  { id: 'FLIP',          label: '포지션 반전',       hotkey: { key: 'f', ctrl: true, shift: true, alt: false }, percentage: 100, enabled: true },
  { id: 'CANCEL_LAST',   label: '마지막 주문 취소',  hotkey: { key: 'a', ctrl: true, shift: true, alt: false }, percentage: 0,   enabled: true },
  { id: 'CANCEL_ALL',    label: '전체 주문 취소',    hotkey: { key: 's', ctrl: true, shift: true, alt: false }, percentage: 0,   enabled: true },
  { id: 'CHASE_ORDER',   label: '주문 체이스',       hotkey: { key: 'd', ctrl: true, shift: true, alt: false }, percentage: 0,   enabled: true },
];

const DEFAULT_GENERAL = {
  soundEnabled: true,
  confirmDangerous: true,
  overlayDuration: 2000,
  seedCap: 0
};

// ── State ─────────────────────────────────────────────────────────────────────

let currentSettings = null;
let recordingSlotId = null; // Which slot is currently recording a hotkey

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const slots_container = () => $('slots-container');

// ── Hotkey formatting ──────────────────────────────────────────────────────────

/**
 * Format a hotkey config object into a human-readable string.
 * @param {{ key: string, ctrl: boolean, shift: boolean, alt: boolean }} hotkey
 * @returns {string}
 */
function formatHotkey(hotkey) {
  if (!hotkey || !hotkey.key) return '(없음)';
  const parts = [];
  if (hotkey.ctrl)  parts.push('Ctrl');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.alt)   parts.push('Alt');
  parts.push(hotkey.key.toUpperCase());
  return parts.join('+');
}

/**
 * Convert a KeyboardEvent to a hotkey config object.
 * @param {KeyboardEvent} e
 * @returns {{ key: string, ctrl: boolean, shift: boolean, alt: boolean }|null}
 */
function eventToHotkey(e) {
  // Ignore pure modifier presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  // Require at least one modifier for safety (prevent intercepting normal typing)
  if (!e.ctrlKey && !e.shiftKey && !e.altKey) return null;
  return {
    key: e.key.toLowerCase(),
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey
  };
}

// ── Slot row rendering ─────────────────────────────────────────────────────────

/**
 * Build and return a slot row element.
 * @param {object} slot
 * @returns {HTMLElement}
 */
function renderSlotRow(slot) {
  const row = document.createElement('div');
  row.className = `slot-row${slot.enabled ? '' : ' slot-row--disabled'}`;
  row.dataset.id = slot.id;

  // Toggle
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle';
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = slot.enabled;
  toggleInput.addEventListener('change', () => {
    row.classList.toggle('slot-row--disabled', !toggleInput.checked);
  });
  const toggleTrack = document.createElement('span');
  toggleTrack.className = 'toggle__track';
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleTrack);

  // Label
  const label = document.createElement('span');
  label.className = 'slot-label';
  label.textContent = slot.label;

  // Hotkey input (click-to-record)
  const hotkeyInput = document.createElement('div');
  hotkeyInput.className = 'hotkey-input';
  hotkeyInput.tabIndex = 0;
  hotkeyInput.textContent = formatHotkey(slot.hotkey);
  hotkeyInput.dataset.hotkey = JSON.stringify(slot.hotkey);

  hotkeyInput.addEventListener('click', () => startRecording(slot.id, hotkeyInput));
  hotkeyInput.addEventListener('keydown', (e) => {
    if (recordingSlotId === slot.id) {
      e.preventDefault();
      e.stopPropagation();
      const hk = eventToHotkey(e);
      if (hk) {
        stopRecording(slot.id, hotkeyInput, hk);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      startRecording(slot.id, hotkeyInput);
    }
  });

  // Blur cancels recording
  hotkeyInput.addEventListener('blur', () => {
    if (recordingSlotId === slot.id) {
      cancelRecording(slot.id, hotkeyInput);
    }
  });

  // Percentage input (hidden for CANCEL_LAST, CANCEL_ALL, CHASE_ORDER)
  const pctWrapper = document.createElement('div');
  pctWrapper.className = 'pct-wrapper';

  const NO_PCT_ACTIONS = ['CANCEL_LAST', 'CANCEL_ALL', 'CHASE_ORDER'];
  if (NO_PCT_ACTIONS.includes(slot.id)) {
    pctWrapper.style.visibility = 'hidden';
  }

  const pctInput = document.createElement('input');
  pctInput.type = 'number';
  pctInput.className = 'pct-input';
  pctInput.min = 1;
  pctInput.max = 100;
  pctInput.step = 1;
  pctInput.value = slot.percentage;
  pctInput.placeholder = '5';

  const pctUnit = document.createElement('span');
  pctUnit.className = 'pct-unit';
  pctUnit.textContent = '%';

  pctWrapper.appendChild(pctInput);
  pctWrapper.appendChild(pctUnit);

  row.appendChild(toggleLabel);
  row.appendChild(label);
  row.appendChild(hotkeyInput);
  row.appendChild(pctWrapper);

  return row;
}

// ── Hotkey recording ──────────────────────────────────────────────────────────

function startRecording(slotId, el) {
  // Cancel any existing recording
  if (recordingSlotId && recordingSlotId !== slotId) {
    const prev = slots_container().querySelector(`[data-id="${recordingSlotId}"] .hotkey-input`);
    if (prev) cancelRecording(recordingSlotId, prev);
  }

  recordingSlotId = slotId;
  el.classList.add('recording');
  el.textContent = '키 입력...';
  el.focus();
}

function stopRecording(slotId, el, hotkey) {
  recordingSlotId = null;
  el.classList.remove('recording');
  el.dataset.hotkey = JSON.stringify(hotkey);
  el.textContent = formatHotkey(hotkey);
}

function cancelRecording(slotId, el) {
  recordingSlotId = null;
  el.classList.remove('recording');
  // Restore previous value
  try {
    const hk = JSON.parse(el.dataset.hotkey);
    el.textContent = formatHotkey(hk);
  } catch {
    el.textContent = '(없음)';
  }
}

// ── Render all slots ──────────────────────────────────────────────────────────

function renderSlots(slots) {
  const container = slots_container();
  container.innerHTML = '';
  for (const slot of slots) {
    container.appendChild(renderSlotRow(slot));
  }
}

// ── Read values from DOM ───────────────────────────────────────────────────────

/**
 * Collect current slot values from the DOM.
 * @returns {object[]}
 */
function collectSlots() {
  const rows = slots_container().querySelectorAll('.slot-row');
  return Array.from(rows).map(row => {
    const id = row.dataset.id;
    const enabled = row.querySelector('input[type="checkbox"]').checked;
    const hotkeyEl = row.querySelector('.hotkey-input');
    let hotkey = { key: '', ctrl: false, shift: false, alt: false };
    try { hotkey = JSON.parse(hotkeyEl.dataset.hotkey); } catch {}
    const pctInput = row.querySelector('.pct-input');
    const percentage = pctInput ? parseInt(pctInput.value, 10) || 0 : 0;
    const defaultSlot = DEFAULT_SLOTS.find(s => s.id === id) || {};
    return { id, label: defaultSlot.label || id, hotkey, percentage, enabled };
  });
}

/**
 * Collect general settings from DOM.
 */
function collectGeneral() {
  return {
    overlayDuration: parseInt($('overlay-duration').value, 10) || 2000,
    seedCap: parseFloat($('seed-cap').value) || 0,
    confirmDangerous: $('confirm-dangerous').checked,
    soundEnabled: $('sound-enabled').checked
  };
}

// ── Populate general settings into DOM ────────────────────────────────────────

function populateGeneral(general) {
  $('overlay-duration').value = general.overlayDuration || 2000;
  $('seed-cap').value = general.seedCap || 0;
  $('confirm-dangerous').checked = !!general.confirmDangerous;
  $('sound-enabled').checked = !!general.soundEnabled;
}

// ── Storage operations ────────────────────────────────────────────────────────

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['settings'], result => {
      const saved = result.settings;
      if (!saved) {
        resolve({ slots: DEFAULT_SLOTS.map(s => ({ ...s })), general: { ...DEFAULT_GENERAL } });
        return;
      }
      const slots = DEFAULT_SLOTS.map(def => {
        const s = saved.slots && saved.slots.find(sl => sl.id === def.id);
        return s ? { ...def, ...s } : { ...def };
      });
      resolve({ slots, general: { ...DEFAULT_GENERAL, ...(saved.general || {}) } });
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ settings }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

// ── Status query ──────────────────────────────────────────────────────────────

function queryStatus() {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  const pageInfo = $('page-info');

  chrome.runtime.sendMessage({ type: 'QUERY_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      dot.className = 'status-dot disconnected';
      text.textContent = 'OKX 탭 없음';
      pageInfo.style.display = 'none';
      return;
    }

    if (response.ready) {
      dot.className = 'status-dot connected';
      text.textContent = '연결됨';
      pageInfo.style.display = 'flex';
      $('page-type-label').textContent = response.pageType === 'spot' ? '현물' : '선물/스왑';
      $('trading-mode-label').textContent = response.tradingMode === 'hedge' ? '헤지 모드' : response.tradingMode === 'one-way' ? '단방향 모드' : response.tradingMode;
    } else {
      dot.className = 'status-dot disconnected';
      text.textContent = '콘텐츠 스크립트 없음';
      pageInfo.style.display = 'none';
    }
  });
}

// ── Feedback display ──────────────────────────────────────────────────────────

function showFeedback(message, type = 'success') {
  const el = $('feedback');
  el.textContent = message;
  el.className = `feedback ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ── Event listeners ───────────────────────────────────────────────────────────

$('btn-save').addEventListener('click', async () => {
  try {
    const settings = {
      slots: collectSlots(),
      general: collectGeneral()
    };
    await saveSettings(settings);
    currentSettings = settings;
    showFeedback('설정 저장 완료', 'success');
  } catch (err) {
    showFeedback(`저장 실패: ${err.message}`, 'error');
  }
});

$('btn-reset').addEventListener('click', async () => {
  if (!confirm('모든 설정을 초기값으로 되돌릴까요?')) return;
  const defaults = { slots: DEFAULT_SLOTS.map(s => ({ ...s })), general: { ...DEFAULT_GENERAL } };
  try {
    await saveSettings(defaults);
    currentSettings = defaults;
    renderSlots(defaults.slots);
    populateGeneral(defaults.general);
    showFeedback('초기화 완료', 'success');
  } catch (err) {
    showFeedback(`초기화 실패: ${err.message}`, 'error');
  }
});

// Global keydown for recording (capture phase)
document.addEventListener('keydown', (e) => {
  if (!recordingSlotId) return;
  e.preventDefault();
  e.stopImmediatePropagation();

  const hk = eventToHotkey(e);
  if (!hk) return;

  const hotkeyEl = slots_container().querySelector(`[data-id="${recordingSlotId}"] .hotkey-input`);
  if (hotkeyEl) stopRecording(recordingSlotId, hotkeyEl, hk);
}, true);

// Cancel recording on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && recordingSlotId) {
    const hotkeyEl = slots_container().querySelector(`[data-id="${recordingSlotId}"] .hotkey-input`);
    if (hotkeyEl) cancelRecording(recordingSlotId, hotkeyEl);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  currentSettings = await loadSettings();
  renderSlots(currentSettings.slots);
  populateGeneral(currentSettings.general);
  queryStatus();
}

init();
