interface SyncState {
  goodstatsAuth: boolean;
  goodreadsAuth: boolean;
  goodreadsTabId: number | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError: string | null;
  hasGoodreadsConnection?: boolean;
  needsGoodreadsConnection?: boolean;
  canSyncBooks?: boolean;
  hasBooks?: boolean;
}

// Get UI elements
const statusContainer = document.getElementById('statusContainer') as HTMLDivElement;
const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
const syncButton = document.getElementById('syncButton') as HTMLButtonElement;

// URLs
const DEV_MODE = false;
const BASE_URL = DEV_MODE ? 'http://localhost:5173' : 'https://goodstats.vercel.app';
const SIGNIN_URL = `${BASE_URL}/signin`;
console.log('Popup initialized with URLs:', { DEV_MODE, BASE_URL, SIGNIN_URL });

// Initialize state
let syncState: SyncState = {
  goodstatsAuth: false,
  goodreadsAuth: false,
  goodreadsTabId: null,
  syncStatus: 'idle',
  lastError: null
};

// Listen for state updates from background script
chrome.runtime.onMessage.addListener((message) => {
  console.log('Popup received message:', message);
  if (message.type === 'SYNC_STATE_UPDATE') {
    console.log('Updating popup state:', message.state);
    syncState = message.state;
    updateUI(syncState);
  }
});

// Add button click handlers
loginButton.addEventListener('click', () => {
  console.log('Login button clicked, current state:', syncState);
  if (!syncState.goodstatsAuth) {
    console.log('Opening signin URL:', SIGNIN_URL);
    chrome.tabs.create({ url: SIGNIN_URL });
  } else if (syncState.needsGoodreadsConnection) {
    console.log('Opening connect Goodreads page');
    chrome.tabs.create({ url: `${BASE_URL}/connect-goodreads` });
  } else {
    chrome.runtime.sendMessage({ type: 'ACTIVATE_GOODREADS' });
  }
});

syncButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SYNC_BOOKS' });
});

// Request initial state
console.log('Requesting initial state');
chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATUS' });

// Also request state update when popup opens
function checkState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    console.log('Current tab:', currentTab);
    // If we're on Goodstats, force a state refresh
    if (currentTab.url?.includes('goodstats.vercel.app')) {
      console.log('On Goodstats page, refreshing tab to trigger auth check');
      chrome.tabs.reload(currentTab.id!);
    }
  });
}

// Check state when popup opens
checkState();

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

  if (state.needsGoodreadsConnection) {
    // Needs to connect Goodreads account
    statusContainer.innerHTML = `
      <div class="error-container">
        <div class="error-icon">!</div>
        <div class="error-content">
          <div class="error-title">Connect Goodreads</div>
          <div class="error-message">Please connect your Goodreads account to continue</div>
        </div>
      </div>
    `;
    loginButton.style.display = 'block';
    loginButton.textContent = 'Connect Goodreads';
    return;
  }

  if (!state.hasGoodreadsConnection) {
    // Waiting for Goodreads connection to complete
    statusContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="status-icon syncing"></div>
        <span>Connecting to Goodreads...</span>
      </div>
    `;
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

  // Show sync status
  if (state.syncStatus === 'syncing') {
    statusContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="status-icon syncing"></div>
        <span>Syncing your books...</span>
      </div>
    `;
    syncButton.style.display = 'block';
    syncButton.disabled = true;
    syncButton.textContent = 'Syncing...';
    return;
  }

  if (state.syncStatus === 'error') {
    statusContainer.innerHTML = `
      <div class="error-container">
        <div class="error-icon">!</div>
        <div class="error-content">
          <div class="error-title">Sync Failed</div>
          <div class="error-message">${state.lastError || 'An error occurred while syncing'}</div>
        </div>
      </div>
    `;
    syncButton.style.display = 'block';
    syncButton.disabled = false;
    syncButton.textContent = 'Try Again';
    return;
  }

  if (state.syncStatus === 'success') {
    statusContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="status-icon success"></div>
        <span>Books synced successfully!</span>
      </div>
    `;
    syncButton.style.display = 'block';
    syncButton.disabled = false;
    syncButton.textContent = 'Sync Again';
    return;
  }

  // Default ready state
  statusContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div class="status-icon success"></div>
      <span>Ready to sync your books</span>
    </div>
  `;
  syncButton.style.display = 'block';
  syncButton.disabled = false;
  syncButton.textContent = 'Sync Books';
}

export {}; 