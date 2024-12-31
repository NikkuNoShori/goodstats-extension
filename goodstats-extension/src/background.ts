// Background script
const DEV_MODE = true;
const BASE_URL = DEV_MODE ? 'http://localhost:5173' : 'https://goodstats.app';
const GOODREADS_URL = 'https://www.goodreads.com';

// Track states
interface SyncState {
  goodstatsAuth: boolean;
  goodreadsAuth: boolean;
  goodreadsTabId: number | null;
}

let syncState: SyncState = {
  goodstatsAuth: false,
  goodreadsAuth: false,
  goodreadsTabId: null
};

// Check Goodstats authentication
async function checkGoodstatsAuth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/status`, {
      credentials: 'include' // Important for sending cookies
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    syncState.goodstatsAuth = data.authenticated;
    return syncState.goodstatsAuth;
  } catch (error) {
    console.error('Error checking Goodstats auth:', error);
    return false;
  }
}

// Check if user is logged into Goodreads
async function checkGoodreadsAuth(tabId: number): Promise<boolean> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Check for elements that only appear when logged in
        const signedInElements = document.querySelectorAll('.userLoggedIn, .userIcon, .myBooks');
        return signedInElements.length > 0;
      }
    });
    
    syncState.goodreadsAuth = result[0]?.result || false;
    return syncState.goodreadsAuth;
  } catch (error) {
    console.error('Error checking Goodreads auth:', error);
    return false;
  }
}

// Update extension popup with current state
function updateExtensionState() {
  chrome.runtime.sendMessage({
    type: 'SYNC_STATE_UPDATE',
    state: syncState
  });
}

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  // Check Goodstats auth when on Goodstats pages
  if (tab.url?.includes(BASE_URL)) {
    await checkGoodstatsAuth();
    updateExtensionState();
  }

  // Check Goodreads auth when on Goodreads pages
  if (tab.url?.includes('goodreads.com')) {
    syncState.goodreadsTabId = tabId;
    await checkGoodreadsAuth(tabId);
    updateExtensionState();

    // If both services are authenticated, notify that we can sync
    if (syncState.goodstatsAuth && syncState.goodreadsAuth) {
      chrome.tabs.sendMessage(tabId, { type: 'READY_TO_SYNC' });
    }
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH_STATUS') {
    updateExtensionState();
  }
  
  if (message.type === 'SYNC_BOOKS' && syncState.goodreadsTabId) {
    chrome.tabs.sendMessage(syncState.goodreadsTabId, { 
      type: 'START_SYNC',
      goodstatsUrl: BASE_URL
    });
  }

  if (message.type === 'ACTIVATE_GOODREADS') {
    if (syncState.goodreadsTabId) {
      chrome.tabs.update(syncState.goodreadsTabId, { active: true });
    } else {
      chrome.tabs.create({ url: GOODREADS_URL });
    }
  }
});

export {}; 