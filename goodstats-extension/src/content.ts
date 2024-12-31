// Content script for Goodreads page
console.log('Content script loaded for:', window.location.hostname);

// Function to extract auth data that will run in the page context
function extractAuthData() {
  const nextData = (window as any).__NEXT_DATA__;
  if (!nextData?.props?.pageProps) return null;
  
  const { user, session } = nextData.props.pageProps;
  return { user, session };
}

// Function to check auth status using chrome.scripting
async function checkAuthStatus() {
  try {
    // Get the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab.id) return;
    
    // Execute the script in the page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: extractAuthData
    });
    
    const data = results[0].result;
    console.log('Extracted auth data:', data);
    
    if (data?.user && data?.session) {
      chrome.runtime.sendMessage({
        type: 'GOODSTATS_AUTH_UPDATE',
        data: {
          type: 'GOODSTATS_AUTH_STATUS',
          authenticated: true,
          ...data.session,
          userId: data.user.id,
          email: data.user.email
        }
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'GOODSTATS_AUTH_UPDATE',
        data: {
          type: 'GOODSTATS_AUTH_STATUS',
          authenticated: false
        }
      });
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

// Listen for auth messages from the website
window.addEventListener('message', (event) => {
  // Only accept messages from our website
  if (!event.origin.includes('goodstats.vercel.app')) return;
  
  // Filter out React DevTools messages
  if (event.data.source?.includes('react-devtools')) return;
  
  if (event.data.type === 'GOODSTATS_AUTH_STATUS') {
    console.log('Content script received auth status:', event.data);
    // Forward the message to background script
    chrome.runtime.sendMessage({
      type: 'GOODSTATS_AUTH_UPDATE',
      data: event.data
    });
  }
});

// If we're on Goodstats, check auth status
if (window.location.hostname === 'goodstats.vercel.app') {
  console.log('On Goodstats website, checking auth status');
  
  // Check immediately
  checkAuthStatus();
  
  // Also check when URL changes (for client-side navigation)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      console.log('URL changed, checking auth status');
      checkAuthStatus();
    }
  }).observe(document, { subtree: true, childList: true });
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