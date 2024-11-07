# Tumblr Post Collector

A Chrome extension that helps you collect, organize, and download your liked Tumblr posts. The extension allows you to export post data to CSV and download all images in bulk.

## Features

- Collect all posts from a Tumblr likes page
- Export post data to CSV including:
  - Post ID
  - Blog Name
  - Post Type
  - Post Title
  - Post Description
  - Post URL
  - Image URLs
  - Video URLs
  - Tags
- Download all images from collected posts as a ZIP file
- View collection history
- Organize downloaded images with post ID-based filenames

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## How to Use

1. **Collecting Posts**
   - Navigate to a Tumblr likes page (e.g., `https://www.tumblr.com/liked/by/username`)
   - Click the extension icon to open the popup
   - Click "Collect Posts" to start collecting
   - Wait for the collection to complete

2. **Viewing History**
   - All your collections are automatically saved
   - View them in the "Collection History" section
   - Each entry shows:
     - Username
     - Collection date
     - Number of posts collected

3. **Downloading Data**
   - From the Collection History, you have two options for each entry:
     - **CSV**: Download post data as a CSV file
     - **Images**: Download all images as a ZIP file
   - Images are named using the format: `postID-1.jpg`, `postID-2.jpg`, etc.

## File Structure

- `manifest.json`: Extension configuration
- `popup.html`: Main extension popup interface
- `popup.js`: Popup functionality
- `page_content.js`: Content script for collecting post data
- `main.js`: Background service worker
- `jszip.min.js`: Library for ZIP file creation

## Requirements

- Chrome browser version 88 or higher
- Tumblr account to access liked posts

## Permissions

The extension requires the following permissions:
- `tabs`: To access tab information
- `activeTab`: To interact with the current tab
- `downloads`: To download files
- `storage`: To save collection history

## Notes

- The extension only works on Tumblr likes pages
- Collection time depends on the number of posts
- Large image collections may take time to download
- History keeps the last 50 collections

## Troubleshooting

If you encounter issues:
1. Make sure you're on a Tumblr likes page
2. Refresh the page before collecting
3. Check the browser console for error messages
4. Try reloading the extension

## Contributing

Feel free to submit issues and enhancement requests!
