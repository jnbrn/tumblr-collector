let isScrolling = false;
let lastPostCount = 0;
let noNewPostsCount = 0;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.text === 'download_images_and_videos') {
		console.log("[page_content] Received download_images_and_videos request");
		sendResponse({imagesAndVideos: getImagesAndVideosOnThisPage()});
		return true;
	}
	
	if (request.action === "startDownload") {
		console.log("[page_content] Received startDownload request");
		try {
			// Get all posts at once since they're already loaded
			let postsData = collectPostsData();
			console.log("[page_content] Posts collected:", postsData.length);
			
			// Send all posts at once
			chrome.runtime.sendMessage({
				action: "processPosts",
				data: postsData,
				isPageComplete: true
			}, (response) => {
				console.log("[page_content] processPosts response:", response);
			});

			// Send completion message
			chrome.runtime.sendMessage({
				action: "downloadComplete"
			});
			
			sendResponse({status: "completed"});
		} catch (error) {
			console.error("[page_content] Error in startDownload:", error);
			sendResponse({error: error.message});
		}
		return true;
	}

	if (request.action === "startScrolling") {
		if (!isScrolling) {
			isScrolling = true;
			lastPostCount = 0;
			noNewPostsCount = 0;
			scrollToBottom();
		}
		sendResponse({status: "started"});
		return true;
	}
});

function scrollToBottom() {
	if (!isScrolling) return;

	const posts = document.querySelectorAll('.post, article[data-post-id]');
	const currentPostCount = posts.length;

	// Send update to popup
	chrome.runtime.sendMessage({
		action: "scrollUpdate",
		postsFound: currentPostCount
	});

	if (currentPostCount > lastPostCount) {
		// New posts found, reset counter
		lastPostCount = currentPostCount;
		noNewPostsCount = 0;
	} else {
		// No new posts found, increment counter
		noNewPostsCount++;
	}

	// If no new posts after 3 attempts, consider scrolling complete
	if (noNewPostsCount >= 3) {
		isScrolling = false;
		chrome.runtime.sendMessage({
			action: "scrollComplete",
			totalPosts: currentPostCount
		});
		return;
	}

	// Scroll to bottom
	window.scrollTo(0, document.documentElement.scrollHeight);

	// Wait for new content to load
	setTimeout(scrollToBottom, 2000);
}

let processedPostIds = new Set(); // Keep track of processed post IDs

function collectPostsData() {
	console.log("[page_content] Starting collectPostsData");
	let posts = [];
	const postElements = document.querySelectorAll('.post, article[data-post-id]');
	console.log("[page_content] Found post elements:", postElements.length);
	
	postElements.forEach((post, index) => {
		try {
			let postData = {
				id: post.getAttribute('data-post-id') || '',
				type: post.getAttribute('data-type') || '',
				blogName: post.getAttribute('data-tumblelog-name') || '',
				postUrl: '',
				title: '',
				description: '',
				imageUrls: [],
				videoUrls: [],
				tags: []
			};

			// Detailed logging for each post
			if (index === 0) {
				console.log("[page_content] First post attributes:", {
					id: postData.id,
					type: postData.type,
					blogName: postData.blogName
				});
			}

			// Get post URL
			const permalinkElement = post.querySelector('.post_permalink, .permalink');
			if (permalinkElement) {
				postData.postUrl = permalinkElement.href;
			}

			// Get post title
			const titleElement = post.querySelector('.post_title');
			if (titleElement) {
				postData.title = titleElement.textContent.trim();
			} else {
				// Try alternate selectors if the first one doesn't work
				const altTitleElement = post.querySelector('.post_content .post_title, .title');
				if (altTitleElement) {
					postData.title = altTitleElement.textContent.trim();
				}
			}

			// Get post description
			const bodyElement = post.querySelector('.post_body');
			if (bodyElement) {
				postData.description = bodyElement.textContent.trim()
					.replace(/\n/g, ' ')  // Replace newlines with spaces
					.replace(/,/g, ';')   // Replace commas with semicolons to avoid CSV issues
					.replace(/"/g, '""'); // Escape quotes for CSV
			} else {
				// Try alternate selectors if the first one doesn't work
				const altBodyElement = post.querySelector('.post_content .post_body, .body-text, .caption, .post_content_inner');
				if (altBodyElement) {
					postData.description = altBodyElement.textContent.trim()
						.replace(/\n/g, ' ')
						.replace(/,/g, ';')
						.replace(/"/g, '""');
				}
			}

			// Add logging to debug title and description capture
			if (index === 0) {
				console.log("[page_content] First post title:", postData.title);
				console.log("[page_content] First post description:", postData.description);
			}

			// Collect images (including high-res versions)
			let imageIndex = 1;
			post.querySelectorAll('img').forEach(img => {
				if (img.src && !img.src.includes('avatar') && !img.src.includes('pixel')) {
					let imageUrl = img.src;
					// Try to get high-res version
					if (img.dataset.highRes) {
						imageUrl = img.dataset.highRes;
					} else {
						imageUrl = imageUrl.replace(/_[0-9]+\./, '_1280.');
					}
					
					// Add the image with its index
					const extension = imageUrl.split('.').pop().split('?')[0];
					const filename = `${postData.id}-${imageIndex}.${extension}`;
					postData.imageUrls.push({
						url: imageUrl,
						filename: filename
					});
					imageIndex++;
				}
			});

			// Collect videos
			post.querySelectorAll('video source, iframe[src*="tumblr.com/video"]').forEach(video => {
				if (video.src) {
					postData.videoUrls.push(video.src);
				}
			});

			// Collect tags
			post.querySelectorAll('.post_tags a, .tags a').forEach(tag => {
				const tagText = tag.textContent.trim().replace('#', '');
				if (tagText) {
					postData.tags.push(tagText);
				}
			});

			// Only add posts that have some content
			if (postData.id && (postData.imageUrls.length > 0 || postData.videoUrls.length > 0)) {
				posts.push(postData);
			}
		} catch (error) {
			console.error("[page_content] Error processing post:", error);
		}
	});
	
	console.log("[page_content] Collected posts count:", posts.length);
	return posts;
}

// Keep the getImagesAndVideosOnThisPage function for compatibility
function getImagesAndVideosOnThisPage() {
	// Your existing implementation...
}

