// Add this at the beginning of the file
if (typeof JSZip === 'undefined') {
    console.error('JSZip not loaded');
    // Try to load JSZip
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('jszip.min.js');
    document.head.appendChild(script);
}

// Store scraped usernames in chrome.storage
function addToHistory(username) {
    chrome.storage.local.get(['scrapedHistory'], function(result) {
        let history = result.scrapedHistory || [];
        const existingIndex = history.findIndex(item => item.username === username);
        
        // Store only metadata in history, not the full posts
        const historyEntry = {
            username: username,
            lastScraped: new Date().toISOString(),
            postCount: allPosts.length,
            // Store posts in chunks
            chunks: Math.ceil(allPosts.length / 1000) // Split into chunks of 1000 posts
        };
        
        if (existingIndex !== -1) {
            history[existingIndex] = historyEntry;
        } else {
            history.push(historyEntry);
        }
        
        // Keep only last 50 entries
        if (history.length > 50) {
            history = history.slice(-50);
        }
        
        // Store the history metadata
        chrome.storage.local.set({ scrapedHistory: history }, async function() {
            // Store the posts in chunks
            try {
                await storePostsInChunks(username, allPosts);
                showHistory(); // Refresh history display
            } catch (error) {
                console.error('Error storing posts:', error);
                document.getElementById('status').textContent = 'Error storing posts: ' + error.message;
            }
        });
    });
}

// Add new function to store posts in chunks
async function storePostsInChunks(username, posts) {
    const CHUNK_SIZE = 1000;
    const chunks = [];
    
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
        chunks.push(posts.slice(i, i + CHUNK_SIZE));
    }
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
        const key = `posts_${username}_chunk_${i}`;
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: chunks[i] }, function() {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }
}

// Add new function to retrieve posts
async function getStoredPosts(username) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['scrapedHistory'], async function(result) {
            try {
                const history = result.scrapedHistory || [];
                const userData = history.find(item => item.username === username);
                
                if (!userData) {
                    resolve([]);
                    return;
                }
                
                const allPosts = [];
                for (let i = 0; i < userData.chunks; i++) {
                    const key = `posts_${username}_chunk_${i}`;
                    const chunk = await new Promise((resolve) => {
                        chrome.storage.local.get([key], function(result) {
                            resolve(result[key] || []);
                        });
                    });
                    allPosts.push(...chunk);
                }
                
                resolve(allPosts);
            } catch (error) {
                reject(error);
            }
        });
    });
}

function showHistory() {
    const historyList = document.getElementById('historyList');
    
    chrome.storage.local.get(['scrapedHistory'], function(result) {
        const history = result.scrapedHistory || [];
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-item">No collection history available</div>';
        } else {
            historyList.innerHTML = history
                .sort((a, b) => new Date(b.lastScraped) - new Date(a.lastScraped))
                .map(item => `
                    <div class="history-item">
                        <div class="history-item-header">
                            <span class="history-username">${item.username}</span>
                            <span class="history-date">${new Date(item.lastScraped).toLocaleDateString()}</span>
                        </div>
                        <div class="history-info">
                            ${item.postCount} posts collected
                        </div>
                        <div class="download-options">
                            <a href="#" class="download-link" data-username="${item.username}" data-download-type="csv">CSV</a>
                            <a href="#" class="download-link" data-username="${item.username}" data-download-type="images">Images</a>
                        </div>
                    </div>
                `).join('');
        }
    });
}

let allPosts = [];

document.getElementById('collectButton').addEventListener('click', function() {
    const button = document.getElementById('collectButton');
    const status = document.getElementById('status');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('tumblr.com/liked/by/')) {
            // Reset posts array
            allPosts = [];
            
            // Update UI
            button.textContent = 'Collecting...';
            button.disabled = true;
            status.textContent = 'Starting collection...';
            
            // Start collection
            chrome.tabs.sendMessage(tabs[0].id, {action: "startDownload"}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    status.textContent = 'Please refresh the page and try again';
                    button.textContent = 'Collect Posts';
                    button.disabled = false;
                    return;
                }
                
                if (response && response.error) {
                    console.error('Response error:', response.error);
                    status.textContent = 'Error: ' + response.error;
                    button.textContent = 'Collect Posts';
                    button.disabled = false;
                    return;
                }
            });
        } else {
            status.textContent = 'Please navigate to a Tumblr likes page';
        }
    });
});

// Handle clicks on download links
document.getElementById('historyList').addEventListener('click', async function(e) {
    if (e.target.classList.contains('download-link')) {
        e.preventDefault();
        const username = e.target.dataset.username;
        const downloadType = e.target.dataset.downloadType;
        
        try {
            const posts = await getStoredPosts(username);
            
            if (posts && posts.length > 0) {
                if (downloadType === 'images') {
                    downloadImagesAsZip(posts, username);
                } else {
                    // Download CSV
                    const csvContent = createCSV(posts);
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `tumblr_likes_${username}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }
            }
        } catch (error) {
            console.error('Error retrieving posts:', error);
            document.getElementById('status').textContent = 'Error retrieving posts: ' + error.message;
        }
    }
});

// Add these functions back
function createCSV(posts) {
    const header = 'Post ID,Blog Name,Post Type,Post Title,Post Description,Post URL,Image URLs,Video URLs,Tags\n';
    const rows = posts.map(post => {
        return [
            post.id || '',
            post.blogName || '',
            post.type || '',
            post.title || '',
            post.description || '',
            post.postUrl || '',
            (post.imageUrls || []).map(img => img.url).join(' | '),
            (post.videoUrls || []).join(' | '),
            (post.tags || []).join(' | ')
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',');
    });
    return header + rows.join('\n');
}

async function downloadImagesAsZip(posts, username) {
    const status = document.getElementById('status');
    
    // Wait for JSZip to be available
    let attempts = 0;
    while (typeof JSZip === 'undefined' && attempts < 5) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    if (typeof JSZip === 'undefined') {
        console.error('JSZip not found after waiting');
        status.textContent = 'Error: ZIP library not loaded. Please try again.';
        return;
    }
    
    try {
        status.textContent = 'Creating ZIP file...';
        
        const zip = new JSZip();
        const imageFolder = zip.folder("images");
        
        // Get all images with their filenames
        const images = posts.flatMap(post => post.imageUrls);
        console.log(`Found ${images.length} images`);
        
        if (images.length === 0) {
            status.textContent = 'No images found to download';
            return;
        }
        
        status.textContent = `Processing 0/${images.length} images...`;
        
        // Download each image and add to zip
        let completed = 0;
        let failed = 0;
        
        for (const image of images) {
            try {
                console.log(`Downloading image: ${image.url}`);
                const response = await fetch(image.url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const blob = await response.blob();
                console.log(`Image downloaded: ${blob.size} bytes`);
                
                // Use the custom filename
                imageFolder.file(image.filename, blob);
                
                completed++;
                status.textContent = `Processing ${completed}/${images.length} images...`;
            } catch (error) {
                console.error('Error downloading image:', image.url, error);
                failed++;
            }
        }
        
        if (completed === 0) {
            throw new Error('No images were successfully downloaded');
        }
        
        status.textContent = 'Generating ZIP file...';
        console.log('Starting ZIP generation');
        
        // Generate zip file
        const content = await zip.generateAsync({
            type: 'blob',
            compression: "DEFLATE",
            compressionOptions: {
                level: 9
            }
        }, function(metadata) {
            status.textContent = `Compressing: ${metadata.percent.toFixed(1)}%`;
        });
        
        console.log('ZIP generated, size:', content.size);
        
        // Create download link
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tumblr_likes_${username}_images.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        status.textContent = `ZIP file downloaded successfully! (${completed} images${failed > 0 ? `, ${failed} failed` : ''})`;
        
    } catch (error) {
        console.error('Error creating ZIP:', error);
        status.textContent = `Error creating ZIP file: ${error.message}`;
    }
}

// Listen for messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    const button = document.getElementById('collectButton');
    const status = document.getElementById('status');
    
    if (request.action === "processPosts") {
        allPosts = allPosts.concat(request.data);
        status.textContent = `Collected ${allPosts.length} posts...`;
    } else if (request.action === "downloadComplete") {
        button.textContent = 'Collect Posts';
        button.disabled = false;
        status.textContent = `Collection complete! Found ${allPosts.length} posts`;
        
        // Extract username and save to history
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0].url.includes('tumblr.com/liked/by/')) {
                const username = tabs[0].url.split('/liked/by/')[1].split('/')[0];
                addToHistory(username);
            }
        });
    }
});

// Show history immediately when popup opens
showHistory();

// Add this function to clean up old data
async function cleanupOldData() {
    chrome.storage.local.get(null, async function(items) {
        const keysToRemove = [];
        const now = new Date();
        
        // Find history entries older than 30 days
        if (items.scrapedHistory) {
            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
            
            items.scrapedHistory = items.scrapedHistory.filter(item => {
                const isOld = new Date(item.lastScraped) < thirtyDaysAgo;
                if (isOld) {
                    // Mark associated chunks for removal
                    for (let i = 0; i < item.chunks; i++) {
                        keysToRemove.push(`posts_${item.username}_chunk_${i}`);
                    }
                }
                return !isOld;
            });
            
            // Update history
            await new Promise(resolve => {
                chrome.storage.local.set({ scrapedHistory: items.scrapedHistory }, resolve);
            });
        }
        
        // Remove old chunks
        if (keysToRemove.length > 0) {
            await new Promise(resolve => {
                chrome.storage.local.remove(keysToRemove, resolve);
            });
        }
    });
}

// Call cleanup when popup opens
document.addEventListener('DOMContentLoaded', function() {
    cleanupOldData();
    showHistory();
});