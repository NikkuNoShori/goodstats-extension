// Content script for Goodreads page
console.log('Content script loaded for:', window.location.hostname);

// Function to safely send messages to the extension
function safeSendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome.runtime?.id) {
        console.log('Extension context invalid, cannot send message');
        reject(new Error('Extension context invalid'));
        return;
      }

      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          console.log('Message send error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      console.log('Error sending message:', error);
      reject(error);
    }
  });
}

// Function to send combined status update
async function sendStatusUpdate(state: {
  status: 'checking' | 'authenticated' | 'unauthenticated',
  goodstatsAuthenticated?: boolean,
  goodreadsData?: { isLoggedIn: boolean }
}) {
  try {
    console.log('Sending status update:', state);
    
    await safeSendMessage({
      type: 'STATUS_UPDATE',
      data: state
    });
  } catch (error) {
    console.log('Failed to send status update:', error);
  }
}

// Function to check auth status by looking for Supabase auth token
async function checkAuthStatus() {
  try {
    console.log('=== Starting Auth Check ===');
    
    // Send initial checking state
    await sendStatusUpdate({ status: 'checking' });
    
    // Look for Supabase auth token in localStorage
    const supabaseAuthKey = Object.keys(localStorage).find(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
    
    if (!supabaseAuthKey) {
      console.log('❌ No Supabase auth token found');
      await sendStatusUpdate({ 
        status: 'unauthenticated',
        goodstatsAuthenticated: false 
      });
      return;
    }

    // Parse the auth data
    const rawAuthData = localStorage.getItem(supabaseAuthKey);
    if (!rawAuthData) {
      console.log('❌ Auth token exists but is empty');
      await sendStatusUpdate({ 
        status: 'unauthenticated',
        goodstatsAuthenticated: false 
      });
      return;
    }

    const authData = JSON.parse(rawAuthData);
    if (!authData.access_token || !authData.user) {
      console.log('❌ Invalid auth data structure');
      await sendStatusUpdate({ 
        status: 'unauthenticated',
        goodstatsAuthenticated: false 
      });
      return;
    }

    console.log('✅ Valid auth data found');
    await sendStatusUpdate({ 
      status: 'authenticated',
      goodstatsAuthenticated: true 
    });
    
    // After confirming auth, check Goodreads status
    await safeSendMessage({ type: 'CHECK_GOODREADS_STATUS' });
    
  } catch (error) {
    console.error('❌ Auth check failed:', error);
    await sendStatusUpdate({ 
      status: 'unauthenticated',
      goodstatsAuthenticated: false 
    });
  }
}

// Initialize extension with retry logic
async function initializeExtension(retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  try {
    // Send initial checking state
    await sendStatusUpdate({ status: 'checking' });

    if (!chrome.runtime?.id) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Extension context invalid, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => initializeExtension(retryCount + 1), RETRY_DELAY);
        return;
      }
      console.log('Max retries reached, extension initialization failed');
      await sendStatusUpdate({ 
        status: 'unauthenticated',
        goodstatsAuthenticated: false 
      });
      return;
    }

    if (window.location.hostname === 'goodstats.vercel.app') {
      console.log('Initializing extension on Goodstats');
      
      // Initial auth check
      await checkAuthStatus();
      
      // Set up event listeners
      window.addEventListener('storage', async (e) => {
        if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
          await checkAuthStatus();
        }
      });
      
      // Watch for URL changes
      let lastUrl = window.location.href;
      new MutationObserver(async () => {
        if (lastUrl !== window.location.href) {
          lastUrl = window.location.href;
          await checkAuthStatus();
        }
      }).observe(document, { subtree: true, childList: true });
      
      // Periodic check
      setInterval(async () => {
        if (chrome.runtime?.id) {
          await checkAuthStatus();
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Initialization error:', error);
    await sendStatusUpdate({ 
      status: 'unauthenticated',
      goodstatsAuthenticated: false 
    });
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => initializeExtension(retryCount + 1), RETRY_DELAY);
    }
  }
}

// Start the extension with async/await
(async () => {
  try {
    await initializeExtension();
  } catch (error) {
    console.error('Failed to start extension:', error);
  }
})();

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