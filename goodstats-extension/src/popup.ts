interface SyncState {
  goodstatsAuth: boolean;
  goodreadsAuth: boolean;
  goodreadsTabId: number | null;
}

// Get UI elements
const statusContainer = document.getElementById('statusContainer') as HTMLDivElement;
const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
const syncButton = document.getElementById('syncButton') as HTMLButtonElement;

// URLs
const DEV_MODE = true;
const BASE_URL = DEV_MODE ? 'http://localhost:5173' : 'https://goodstats.app';
const SIGNIN_URL = `${BASE_URL}/signin`;

// Update UI based on sync state
function updateUI(state: SyncState) {
  statusContainer.className = 'status';
  loginButton.style.display = 'none';
  syncButton.style.display = 'none';

  if (!state.goodstatsAuth) {
    // Not logged into Goodstats
    statusContainer.innerHTML = `
      <div class="error-container">
        <div class="error-icon">!</div>
        <div class="error-content">
          <div class="error-title">Not Connected</div>
          <div class="error-message">Please log in to Goodstats to continue</div>
        </div>
      </div>
    `;
    loginButton.style.display = 'block';
    loginButton.textContent = 'Login to Goodstats';
    return;
  }

  if (!state.goodreadsTabId) {
    // No Goodreads tab open
    statusContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="status-icon error"></div>
        <span>Please open Goodreads to sync your books</span>
      </div>
    `;
    loginButton.style.display = 'block';
    loginButton.textContent = 'Open Goodreads';
    return;
  }

  if (!state.goodreadsAuth) {
    // Not logged into Goodreads
    statusContainer.innerHTML = `
      <div class="error-container">
        <div class="error-icon">!</div>
        <div class="error-content">
          <div class="error-title">Goodreads Login Required</div>
          <div class="error-message">Please log in to your Goodreads account</div>
        </div>
      </div>
    `;
    loginButton.style.display = 'block';
    loginButton.textContent = 'Go to Goodreads';
    return;
  }

  // Everything is ready
  statusContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div class="status-icon success"></div>
      <span>Ready to sync your books</span>
    </div>
  `;
  syncButton.style.display = 'block';
}

// Add button click handlers
loginButton.addEventListener('click', () => {
  if (!syncState.goodstatsAuth) {
    chrome.tabs.create({ url: SIGNIN_URL });
  } else {
    chrome.runtime.sendMessage({ type: 'ACTIVATE_GOODREADS' });
  }
});

syncButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SYNC_BOOKS' });
  syncButton.disabled = true;
  syncButton.textContent = 'Syncing...';
  setTimeout(() => {
    syncButton.disabled = false;
    syncButton.textContent = 'Sync Books';
  }, 3000);
});

// Initialize state
let syncState: SyncState = {
  goodstatsAuth: false,
  goodreadsAuth: false,
  goodreadsTabId: null
};

// Listen for state updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SYNC_STATE_UPDATE') {
    syncState = message.state;
    updateUI(syncState);
  }
});

// Request initial state
chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATUS' });

export {}; 