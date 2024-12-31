// Content script for Goodreads page
console.log('Goodreads content script loaded');

interface Book {
  title: string;
  author: string;
  isbn: string;
  rating: number;
  dateRead: string | null;
  review: string;
  shelf: string;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'READY_TO_SYNC') {
    // Show sync prompt to user
    showSyncPrompt();
  }

  if (message.type === 'START_SYNC') {
    startSync(message.goodstatsUrl);
  }
});

async function startSync(goodstatsUrl: string) {
  try {
    // Get all books from the current page
    const books = await scrapeBooks();
    
    // Send books to Goodstats
    const response = await fetch(`${goodstatsUrl}/api/books/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ books })
    });

    if (!response.ok) {
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