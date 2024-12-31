// Background script
const DEV_MODE = false;
const BASE_URL = DEV_MODE ? 'http://localhost:5173' : 'https://goodstats.vercel.app';
const GOODREADS_URL = 'https://www.goodreads.com';

// Track states and session
interface SessionInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

interface SyncState {
  goodstatsAuth: boolean;
  goodreadsAuth: boolean;
  goodreadsTabId: number | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError: string | null;
  session: SessionInfo | null;
}

let syncState: SyncState = {
  goodstatsAuth: false,
  goodreadsAuth: false,
  goodreadsTabId: null,
  syncStatus: 'idle',
  lastError: null,
  session: null
};

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH_STATUS') {
    updateExtensionState();
  }
  
  if (message.type === 'GOODSTATS_AUTH_UPDATE') {
    console.log('Background received auth update:', message.data);
    if (message.data.authenticated) {
      syncState.goodstatsAuth = true;
      syncState.session = {
        accessToken: message.data.accessToken,
        refreshToken: message.data.refreshToken,
        expiresAt: message.data.expiresAt,
        userId: message.data.userId,
        email: message.data.email
      };
    } else {
      syncState.goodstatsAuth = false;
      syncState.session = null;
    }
    updateExtensionState();
  }
  
  if (message.type === 'SYNC_BOOKS' && syncState.goodreadsTabId) {
    syncState.syncStatus = 'syncing';
    syncState.lastError = null;
    updateExtensionState();
    
    chrome.tabs.sendMessage(syncState.goodreadsTabId, { 
      type: 'START_SYNC',
      goodstatsUrl: BASE_URL,
      session: syncState.session
    });
  }

  if (message.type === 'SYNC_COMPLETE') {
    syncState.syncStatus = 'success';
    updateExtensionState();
  }

  if (message.type === 'SYNC_ERROR') {
    syncState.syncStatus = 'error';
    syncState.lastError = message.error;
    updateExtensionState();
  }

  if (message.type === 'ACTIVATE_GOODREADS') {
    if (syncState.goodreadsTabId) {
      chrome.tabs.update(syncState.goodreadsTabId, { active: true });
    } else {
      chrome.tabs.create({ url: GOODREADS_URL });
    }
  }
});

// Check Goodstats authentication
async function checkGoodstatsAuth(): Promise<boolean> {
  try {
    // If we have a valid session, use it
    if (syncState.session && syncState.session.expiresAt > Date.now()) {
      return true;
    }
    
    // If we have a refresh token, try to refresh the session
    if (syncState.session?.refreshToken) {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: syncState.session.refreshToken })
        });
        
        if (response.ok) {
          const data = await response.json();
          syncState.session = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            userId: data.userId,
            email: data.email
          };
          syncState.goodstatsAuth = true;
          return true;
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    }
    
    // If no valid session or refresh failed, we're not authenticated
    syncState.goodstatsAuth = false;
    syncState.session = null;
    return false;
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
  console.log('Updating extension state:', syncState);
  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.runtime.sendMessage({
          type: 'SYNC_STATE_UPDATE',
          state: syncState
        });
      } catch (error) {
        console.error('Error sending state update:', error);
      }
    });
  });
}

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('Tab updated:', { tabId, changeInfo, tab });
  if (changeInfo.status !== 'complete') return;

  // Check Goodstats auth when on Goodstats pages
  if (tab.url?.includes(BASE_URL)) {
    console.log('On Goodstats page, checking auth');
    await checkGoodstatsAuth();
    updateExtensionState();
  }

  // Check Goodreads auth when on Goodreads pages
  if (tab.url?.includes('goodreads.com')) {
    console.log('On Goodreads page, checking auth');
    syncState.goodreadsTabId = tabId;
    await checkGoodreadsAuth(tabId);
    updateExtensionState();

    // If both services are authenticated, notify that we can sync
    if (syncState.goodstatsAuth && syncState.goodreadsAuth) {
      chrome.tabs.sendMessage(tabId, { type: 'READY_TO_SYNC' });
    }
  }
});

export {}; 