// Content script for Goodreads page
console.log('Content script loaded for:', window.location.hostname);

// Function to check Goodreads login state
function checkGoodreadsLogin() {
  // Check for elements that indicate logged-in state on Goodreads
  const signedInElements = document.querySelector('.siteHeader__personal');
  const signOutLink = document.querySelector('a[href*="sign_out"]');
  const userShelf = document.querySelector('.userShelf');
  
  const isLoggedIn = !!(signedInElements || signOutLink || userShelf);
  console.log('Goodreads login check:', { 
    isLoggedIn,
    elements: {
      header: !!signedInElements,
      signOut: !!signOutLink,
      shelf: !!userShelf
    }
  });
  
  return isLoggedIn;
}

// Function to send combined status update
function sendStatusUpdate(goodstatsAuth: boolean, goodreadsData?: { isLoggedIn: boolean }) {
  console.log('Sending combined status update:', {
    goodstatsAuthenticated: goodstatsAuth,
    goodreadsLoggedIn: goodreadsData?.isLoggedIn
  });
  
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    data: {
      goodstatsAuthenticated: goodstatsAuth,
      goodreads: goodreadsData
    }
  }, response => {
    console.log('Combined status update response:', response);
  });
}

// Function to check auth status by looking for Supabase auth token
function checkAuthStatus() {
  try {
    console.log('=== Starting Auth Check ===');
    console.log('Current URL:', window.location.href);
    
    // Log all localStorage keys for debugging
    const allKeys = Object.keys(localStorage);
    console.log('All localStorage keys:', allKeys);
    
    // Look for Supabase auth token in localStorage
    const supabaseAuthKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    console.log('Found Supabase auth key:', supabaseAuthKey);
    
    if (!supabaseAuthKey) {
      console.log('❌ No Supabase auth token found in localStorage');
      sendStatusUpdate(false);
      return;
    }

    // Parse the auth data
    const rawAuthData = localStorage.getItem(supabaseAuthKey);
    console.log('Raw auth data exists:', !!rawAuthData);
    
    const authData = JSON.parse(rawAuthData || '{}');
    console.log('Auth data parsed successfully:', {
      hasAccessToken: !!authData.access_token,
      accessTokenLength: authData.access_token?.length,
      hasRefreshToken: !!authData.refresh_token,
      expiresAt: new Date(authData.expires_at * 1000).toLocaleString(),
      hasUser: !!authData.user,
      userId: authData.user?.id,
      email: authData.user?.email ? '✓ Present' : '✗ Missing'
    });

    if (authData.access_token && authData.user) {
      console.log('✅ Valid auth data found, sending authenticated status');
      sendStatusUpdate(true);
      
      // After confirming Goodstats auth, check Goodreads status
      chrome.runtime.sendMessage({
        type: 'CHECK_GOODREADS_STATUS'
      }, response => {
        console.log('Requested Goodreads status check:', response);
      });
    } else {
      console.log('❌ Auth data incomplete:', {
        hasAccessToken: !!authData.access_token,
        hasUser: !!authData.user
      });
      sendStatusUpdate(false);
    }
    console.log('=== Auth Check Complete ===');
  } catch (error) {
    console.error('❌ Error checking auth status:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    sendStatusUpdate(false);
  }
}

// Check auth status based on hostname
if (window.location.hostname === 'goodstats.vercel.app') {
  console.log('On Goodstats website, checking auth status');
  
  // Check immediately for existing login
  checkAuthStatus();
  
  // Also check after a delay in case page is still loading
  setTimeout(checkAuthStatus, 1000);
  
  // Watch for auth token changes in localStorage
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      console.log('Auth token changed, rechecking status');
      checkAuthStatus();
    }
  });
  
  // Watch for localStorage changes in the same window
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, [key, value]);
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      console.log('Auth token updated in current window, rechecking status');
      checkAuthStatus();
    }
  };
  
  // Also check when URL changes
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      console.log('URL changed, checking auth status');
      checkAuthStatus();
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Recheck periodically
  setInterval(checkAuthStatus, 5000);
} else if (window.location.hostname === 'www.goodreads.com') {
  console.log('On Goodreads website, checking login status');
  
  // Check Goodreads login state periodically
  const checkGoodreadsState = () => {
    const isLoggedIn = checkGoodreadsLogin();
    sendStatusUpdate(true, { isLoggedIn });
  };
  
  // Initial check after page load
  setTimeout(checkGoodreadsState, 1000);
  
  // Recheck periodically
  setInterval(checkGoodreadsState, 5000);
  
  // Check when DOM changes
  new MutationObserver(() => {
    checkGoodreadsState();
  }).observe(document.body, { subtree: true, childList: true });
}

interface Book {
  title: string;
  author: string;
  isbn: string;
  rating: number;
  dateRead: string | null;
  review: string;
  shelf: string;
}

interface SessionInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

interface SyncMessage {
  type: 'START_SYNC' | 'READY_TO_SYNC';
  goodstatsUrl?: string;
  session?: SessionInfo;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: SyncMessage, sender, sendResponse) => {
  if (message.type === 'READY_TO_SYNC') {
    // Show sync prompt to user
    showSyncPrompt();
  }

  if (message.type === 'START_SYNC' && message.goodstatsUrl && message.session) {
    startSync(message.goodstatsUrl, message.session);
  }
});

async function startSync(goodstatsUrl: string, session: SessionInfo) {
  try {
    // Get all books from the current page
    const books = await scrapeBooks();
    
    // Send books to Goodstats
    const response = await fetch(`${goodstatsUrl}/api/books/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ books })
    });

    if (!response.ok) {
      // If unauthorized, try to refresh the token
      if (response.status === 401) {
        try {
          const refreshResponse = await fetch(`${goodstatsUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken: session.refreshToken })
          });

          if (refreshResponse.ok) {
            const newSession = await refreshResponse.json();
            // Retry with new token
            const retryResponse = await fetch(`${goodstatsUrl}/api/books/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newSession.accessToken}`
              },
              body: JSON.stringify({ books })
            });

            if (!retryResponse.ok) {
              throw new Error(`Failed to sync books: ${retryResponse.statusText}`);
            }

            const result = await retryResponse.json();
            console.log('Books synced successfully:', result);
            chrome.runtime.sendMessage({ 
              type: 'SYNC_COMPLETE',
              result
            });
            return;
          }
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
        }
      }
      throw new Error(`Failed to sync books: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Books synced successfully:', result);
    
    // Notify background script of success
    chrome.runtime.sendMessage({ 
      type: 'SYNC_COMPLETE',
      result
    });

  } catch (error) {
    console.error('Error syncing books:', error);
    chrome.runtime.sendMessage({ 
      type: 'SYNC_ERROR',
      error: error instanceof Error ? error.message : 'Failed to sync books'
    });
  }
}

async function scrapeBooks(): Promise<Book[]> {
  const books: Book[] = [];
  
  // Find all book entries on the page
  const bookElements = Array.from(document.querySelectorAll('.bookalike'));
  
  for (const element of bookElements) {
    try {
      const titleElement = element.querySelector('.field.title a');
      const authorElement = element.querySelector('.field.author a');
      const isbnElement = element.querySelector('.field.isbn .value');
      const ratingElement = element.querySelector('.field.rating .staticStars');
      const dateElement = element.querySelector('.field.date_read .value');
      const reviewElement = element.querySelector('.field.review .value');
      const shelfElement = element.querySelector('.field.shelf .value');

      if (!titleElement || !authorElement) continue;

      const book: Book = {
        title: titleElement.textContent?.trim() || '',
        author: authorElement.textContent?.trim() || '',
        isbn: isbnElement?.textContent?.trim() || '',
        rating: parseRating(ratingElement?.className || ''),
        dateRead: dateElement?.textContent?.trim() || null,
        review: reviewElement?.textContent?.trim() || '',
        shelf: shelfElement?.textContent?.trim() || 'read'
      };

      books.push(book);
    } catch (error) {
      console.error('Error parsing book:', error);
    }
  }

  return books;
}

function parseRating(ratingClass: string): number {
  // Extract rating from class name (e.g., "staticStars p10" means 5 stars)
  const match = ratingClass.match(/p(\d+)/);
  if (!match) return 0;
  return Math.floor(parseInt(match[1]) / 20); // Convert from 0-100 scale to 0-5
}

function showSyncPrompt() {
  const promptDiv = document.createElement('div');
  promptDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
  `;
  
  promptDiv.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">Sync Your Books</h3>
    <p style="margin: 0 0 15px 0;">Would you like to sync your Goodreads books with Goodstats?</p>
    <button id="syncBooks" style="
      background: #3498db;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    ">Sync Now</button>
  `;
  
  document.body.appendChild(promptDiv);
  
  // Add click handler for sync button
  document.getElementById('syncBooks')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SYNC_BOOKS' });
    promptDiv.innerHTML = '<p style="margin: 0;">Syncing your books...</p>';
    setTimeout(() => promptDiv.remove(), 3000);
  });
}

export {}; 