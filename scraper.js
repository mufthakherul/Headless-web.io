/**
 * Web Scraper & Media Downloader
 * 
 * Supports:
 * - Webpage scraping with Playwright
 * - YouTube video/audio download
 * - Social media content download
 * - Image/video extraction from websites
 */

const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const database = require('./database');
const logger = require('./logger');

class ScraperManager {
    constructor() {
        this.downloadDir = path.join(__dirname, 'downloads');
        this.activeDownloads = new Map();

        // Create download directory
        this.initializeDownloadDir();
    }

    async initializeDownloadDir() {
        try {
            await fs.mkdir(this.downloadDir, { recursive: true });
            logger.info('Download directory initialized', { path: this.downloadDir });
        } catch (error) {
            logger.error('Failed to create download directory', { error: error.message });
        }
    }

    /**
     * Scrape webpage content
     */
    async scrapeWebpage(url, options = {}) {
        try {
            const {
                extractText = true,
                extractImages = true,
                extractLinks = true,
                extractMetadata = true
            } = options;

            const response = await axios.get(url, {
                timeout: 30000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const result = {
                url,
                title: $('title').text() || '',
                scrapedAt: new Date().toISOString()
            };

            // Extract metadata
            if (extractMetadata) {
                result.metadata = {
                    description: $('meta[name="description"]').attr('content') || '',
                    keywords: $('meta[name="keywords"]').attr('content') || '',
                    author: $('meta[name="author"]').attr('content') || '',
                    og: {
                        title: $('meta[property="og:title"]').attr('content') || '',
                        description: $('meta[property="og:description"]').attr('content') || '',
                        image: $('meta[property="og:image"]').attr('content') || '',
                        url: $('meta[property="og:url"]').attr('content') || ''
                    }
                };
            }

            // Extract text content
            if (extractText) {
                result.text = {
                    headings: {
                        h1: $('h1').map((i, el) => $(el).text().trim()).get(),
                        h2: $('h2').map((i, el) => $(el).text().trim()).get(),
                        h3: $('h3').map((i, el) => $(el).text().trim()).get()
                    },
                    paragraphs: $('p').map((i, el) => $(el).text().trim()).get().filter(p => p.length > 20),
                    lists: $('ul, ol').map((i, el) => {
                        return $(el).find('li').map((j, li) => $(li).text().trim()).get();
                    }).get()
                };
            }

            // Extract images
            if (extractImages) {
                result.images = $('img').map((i, el) => {
                    const src = $(el).attr('src');
                    const alt = $(el).attr('alt') || '';

                    if (src) {
                        // Convert relative URLs to absolute
                        const absoluteUrl = new URL(src, url).href;
                        return {
                            url: absoluteUrl,
                            alt,
                            width: $(el).attr('width'),
                            height: $(el).attr('height')
                        };
                    }
                }).get().filter(img => img);
            }

            // Extract links
            if (extractLinks) {
                result.links = $('a[href]').map((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().trim();

                    if (href && !href.startsWith('#')) {
                        try {
                            const absoluteUrl = new URL(href, url).href;
                            return {
                                url: absoluteUrl,
                                text,
                                title: $(el).attr('title') || ''
                            };
                        } catch (e) {
                            return null;
                        }
                    }
                }).get().filter(link => link);
            }

            logger.info('Webpage scraped successfully', {
                url,
                imagesFound: result.images?.length || 0,
                linksFound: result.links?.length || 0
            });

            return {
                success: true,
                data: result
            };
        } catch (error) {
            logger.error('Webpage scraping failed', {
                error: error.message,
                url
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Download YouTube video
     */
    async downloadYouTube(url, format = 'video', quality = 'highest', userId = null) {
        try {
            // Validate YouTube URL
            if (!ytdl.validateURL(url)) {
                return {
                    success: false,
                    error: 'Invalid YouTube URL'
                };
            }

            // Get video info
            const info = await ytdl.getInfo(url);
            const videoId = info.videoDetails.videoId;
            const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

            const downloadId = crypto.randomBytes(16).toString('hex');
            const filename = `${title}_${downloadId}.${format === 'audio' ? 'mp3' : 'mp4'}`;
            const filepath = path.join(this.downloadDir, filename);

            // Track download
            this.activeDownloads.set(downloadId, {
                id: downloadId,
                url,
                title: info.videoDetails.title,
                format,
                status: 'downloading',
                progress: 0,
                startedAt: Date.now()
            });

            // Download options
            const downloadOptions = format === 'audio'
                ? { quality: 'highestaudio', filter: 'audioonly' }
                : { quality: quality === 'highest' ? 'highestvideo' : quality };

            // Start download
            const stream = ytdl(url, downloadOptions);
            const fileStream = require('fs').createWriteStream(filepath);

            let downloadedBytes = 0;
            const totalBytes = parseInt(info.formats[0].contentLength || 0);

            stream.on('progress', (chunkLength, downloaded, total) => {
                downloadedBytes = downloaded;
                const progress = Math.round((downloaded / total) * 100);

                const download = this.activeDownloads.get(downloadId);
                if (download) {
                    download.progress = progress;
                    download.downloadedBytes = downloaded;
                    download.totalBytes = total;
                }
            });

            return new Promise((resolve, reject) => {
                stream.pipe(fileStream);

                fileStream.on('finish', async () => {
                    const stats = await fs.stat(filepath);

                    this.activeDownloads.get(downloadId).status = 'completed';
                    this.activeDownloads.get(downloadId).completedAt = Date.now();

                    // Save to database if user is authenticated
                    if (userId && database.isConnected()) {
                        await database.query(
                            `INSERT INTO download_history (user_id, url, type, filename, size_bytes, status, completed_at)
               VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
                            [userId, url, format === 'audio' ? 'youtube-audio' : 'youtube-video', filename, stats.size, 'completed']
                        );
                    }

                    logger.info('YouTube download completed', {
                        downloadId,
                        title: info.videoDetails.title,
                        size: stats.size
                    });

                    resolve({
                        success: true,
                        downloadId,
                        filename,
                        filepath,
                        size: stats.size,
                        title: info.videoDetails.title,
                        duration: info.videoDetails.lengthSeconds
                    });
                });

                stream.on('error', (error) => {
                    this.activeDownloads.get(downloadId).status = 'failed';
                    this.activeDownloads.get(downloadId).error = error.message;

                    logger.error('YouTube download failed', {
                        error: error.message,
                        url
                    });

                    reject({
                        success: false,
                        error: error.message
                    });
                });
            });
        } catch (error) {
            logger.error('YouTube download error', {
                error: error.message,
                url
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Download image from URL
     */
    async downloadImage(url, userId = null) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 50 * 1024 * 1024, // 50MB max
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const contentType = response.headers['content-type'];
            const ext = contentType.split('/')[1] || 'jpg';

            const downloadId = crypto.randomBytes(16).toString('hex');
            const filename = `image_${downloadId}.${ext}`;
            const filepath = path.join(this.downloadDir, filename);

            await fs.writeFile(filepath, response.data);

            const stats = await fs.stat(filepath);

            // Save to database
            if (userId && database.isConnected()) {
                await database.query(
                    `INSERT INTO download_history (user_id, url, type, filename, size_bytes, status, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
                    [userId, url, 'image', filename, stats.size, 'completed']
                );
            }

            logger.info('Image downloaded successfully', {
                downloadId,
                size: stats.size,
                url
            });

            return {
                success: true,
                downloadId,
                filename,
                filepath,
                size: stats.size,
                contentType
            };
        } catch (error) {
            logger.error('Image download failed', {
                error: error.message,
                url
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get download status
     */
    getDownloadStatus(downloadId) {
        const download = this.activeDownloads.get(downloadId);

        if (!download) {
            return {
                found: false,
                error: 'Download not found'
            };
        }

        return {
            found: true,
            ...download
        };
    }

    /**
     * Get user download history
     */
    async getDownloadHistory(userId, limit = 50) {
        try {
            if (!database.isConnected()) {
                return [];
            }

            const result = await database.query(
                `SELECT * FROM download_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
                [userId, limit]
            );

            return result.rows;
        } catch (error) {
            logger.error('Failed to get download history', {
                error: error.message,
                userId
            });
            return [];
        }
    }

    /**
     * Extract social media metadata (basic)
     */
    async extractSocialMediaInfo(url) {
        try {
            // Simple extraction - can be extended for specific platforms
            const scraped = await this.scrapeWebpage(url, {
                extractMetadata: true,
                extractImages: true,
                extractText: false,
                extractLinks: false
            });

            if (!scraped.success) {
                return scraped;
            }

            return {
                success: true,
                platform: this.detectPlatform(url),
                data: scraped.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Detect social media platform from URL
     */
    detectPlatform(url) {
        const urlLower = url.toLowerCase();

        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
            return 'youtube';
        } else if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
            return 'twitter';
        } else if (urlLower.includes('facebook.com')) {
            return 'facebook';
        } else if (urlLower.includes('instagram.com')) {
            return 'instagram';
        } else if (urlLower.includes('tiktok.com')) {
            return 'tiktok';
        } else if (urlLower.includes('linkedin.com')) {
            return 'linkedin';
        }

        return 'unknown';
    }

    /**
     * Cleanup old downloads
     */
    async cleanupOldDownloads(maxAgeHours = 24) {
        try {
            const files = await fs.readdir(this.downloadDir);
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000;

            let cleanedCount = 0;

            for (const file of files) {
                const filepath = path.join(this.downloadDir, file);
                const stats = await fs.stat(filepath);

                if (now - stats.mtimeMs > maxAge) {
                    await fs.unlink(filepath);
                    cleanedCount++;
                }
            }

            logger.info('Old downloads cleaned up', {
                cleanedCount,
                maxAgeHours
            });

            return { success: true, cleanedCount };
        } catch (error) {
            logger.error('Download cleanup failed', {
                error: error.message
            });
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new ScraperManager();
