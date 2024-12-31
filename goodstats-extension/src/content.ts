// Content script for Goodreads page
console.log('Goodreads content script loaded');

// Listen for the sync ready message from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'READY_TO_SYNC') {
    // Show sync prompt to user
    showSyncPrompt();
  }
});

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