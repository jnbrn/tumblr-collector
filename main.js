let imagesLoadingDelay = 4000;
let nextPageLoadingDelay = 4000;
let urlBase = "";
let page;
let currentPageUrl;
let downloadingItems = [];
let errorLog = "Downloading is finished.\n";
let downloadedUrls = new Set();
let allPosts = [];

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// Remove browserAction (it's not supported in Manifest V3)
chrome.action.onClicked.addListener((tab) => {
    openFirstPage();
});

function openFirstPage() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (activeTabs) {
        if (activeTabs[0]) {
            urlBase = activeTabs[0].url;
            page = 0;
            
            if (urlBase.indexOf("/page/") > 0) {
                page = parseInt(urlBase.substring(urlBase.indexOf("/page/") + 6)) - 1;
                urlBase = urlBase.substring(0, urlBase.indexOf("/page/"));
            }
            
            currentPageUrl = "";
            downloadingItems = [];
            openNextPage();
        }
    });
}

function openNextPage() {
    page = page + 1;
    chrome.tabs.query({ active: true, currentWindow: true }, function (activeTabs) {
        if (activeTabs[0]) {
            chrome.tabs.update(activeTabs[0].id, {
                url: urlBase + "/page/" + page
            });
        }
    });
}

chrome.downloads.onDeterminingFilename.addListener(function (item, suggest) {
    let name = item.filename;
    for (let i = 0; i < downloadingItems.length; ++i) {
        if (item.url === downloadingItems[i][0]) {
            name = downloadingItems[i][1];
        }
    }
    suggest({ conflictAction: "overwrite", filename: "tumblr_likes/" + name});
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        setTimeout(() => {
            getAndDownloadImagesAndVideosOnPage(tab.url);
        }, imagesLoadingDelay);
    }
});

function getAndDownloadImagesAndVideosOnPage(pageUrl) {
    if (pageUrl === currentPageUrl) {
        return;
    }
    currentPageUrl = pageUrl;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {text: 'download_images_and_videos'}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    return;
                }

                chrome.downloads.erase({state: "complete"});
                
                chrome.downloads.search({state: "interrupted"}, function(items) {
                    items.forEach(item => {
                        errorLog += "Not loaded: " + item.url + " (now on page " + page + ")\n";
                    });
                    chrome.downloads.erase({state: "interrupted"});
                });
                
                if (response?.imagesAndVideos?.length > 0) {
                    response.imagesAndVideos.forEach(item => {
                        downloadingItems.push([item[0], item[1]]);
                        chrome.downloads.download({ url: item[0] });
                    });
                
                    setTimeout(openNextPage, nextPageLoadingDelay);
                } else {
                    console.log(errorLog);
                    chrome.runtime.sendMessage({
                        action: "updateStatus",
                        status: "Download complete"
                    });
                }
            });
        }
    });
}

// Handle messages for CSV creation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[main] Received message:", request.action);

    if (request.action === "processPosts") {
        const newPosts = request.data;
        console.log("[main] Processing new posts batch:", newPosts.length);
        allPosts = allPosts.concat(newPosts);
        console.log("[main] Total posts collected:", allPosts.length);
        
        // Send the posts data to the data.js page
        chrome.runtime.sendMessage({
            action: "updatePosts",
            posts: allPosts,
            status: `Collected ${allPosts.length} posts...`
        });
        
        sendResponse({ received: true });
    } else if (request.action === "downloadComplete") {
        console.log("[main] Download complete, total posts:", allPosts.length);
        
        // Send final posts data to the data.js page
        chrome.runtime.sendMessage({
            action: "downloadComplete",
            posts: allPosts
        });
        
        // Clear the collection
        allPosts = [];
        console.log("[main] Posts collection cleared");
    }
    
    return true;
});
