let allPosts = [];

// Extract username from URL
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
document.getElementById('usernameDisplay').textContent = `Liked Posts for ${username}`;

// Function to collect posts data
function startCollection() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "startDownload"}, handleResponse);
    });
}

function handleResponse(response) {
    if (response && response.error) {
        showStatus('Error: ' + response.error, 'error');
    }
}

// Update table with posts data
function updateTable(posts) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    posts.forEach(post => {
        const row = document.createElement('tr');
        
        // Blog Name
        row.innerHTML += `<td>${post.blogName}</td>`;
        
        // Post Type
        row.innerHTML += `<td>${post.type}</td>`;
        
        // Media Preview
        let mediaPreview = '<td>';
        if (post.imageUrls.length > 0) {
            mediaPreview += `<img src="${post.imageUrls[0]}" class="image-preview" onclick="window.open('${post.imageUrls[0]}', '_blank')">`;
        } else if (post.videoUrls.length > 0) {
            mediaPreview += `<video src="${post.videoUrls[0]}" class="image-preview" controls></video>`;
        }
        mediaPreview += '</td>';
        row.innerHTML += mediaPreview;
        
        // Tags
        const tags = post.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ');
        row.innerHTML += `<td>${tags}</td>`;
        
        // Post Link
        row.innerHTML += `<td><a href="${post.postUrl}" target="_blank">View Post</a></td>`;
        
        tableBody.appendChild(row);
    });
}

// Download CSV function
document.getElementById('downloadCsv').addEventListener('click', function() {
    try {
        const csvContent = createCSV(allPosts);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tumblr_likes_${username}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        showStatus('CSV downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error creating CSV:', error);
        showStatus('Error creating CSV file', 'error');
    }
});

function createCSV(posts) {
    const header = 'Post ID,Blog Name,Post Type,Post URL,Image URLs,Video URLs,Tags\n';
    const rows = posts.map(post => {
        return [
            post.id || '',
            post.blogName || '',
            post.type || '',
            post.postUrl || '',
            (post.imageUrls || []).join(' | '),
            (post.videoUrls || []).join(' | '),
            (post.tags || []).join(' | ')
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',');
    });
    return header + rows.join('\n');
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// Listen for messages from content script and background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updatePosts") {
        allPosts = request.posts;
        updateTable(allPosts);
    } else if (request.action === "downloadComplete") {
        allPosts = request.posts;
        updateTable(allPosts);
        showStatus('All posts collected!', 'success');
    }
});

// Start collection when page loads
startCollection();