/**
 * URL Search Sharing Manager
 * Handles encoding/decoding search parameters to/from URLs for shareable search links
 */

class URLSearchSharing {
    constructor() {
        this.urlParams = new URLSearchParams();
        this.baseUrl = window.location.origin + window.location.pathname;
    }

    /**
     * Encode search parameters into a shareable URL
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Object} options - Additional search options
     * @returns {string} Shareable URL
     */
    encodeSearchToURL(query, filters = {}, options = {}) {
        try {
            const searchParams = new URLSearchParams();

            // Add search query
            if (query && query.trim()) {
                searchParams.set('q', encodeURIComponent(query.trim()));
            }

            // Add filters
            if (filters && typeof filters === 'object') {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '' && value !== 'all') {
                        if (key === 'dateRange' && typeof value === 'object') {
                            // Handle date range specially
                            if (value.start) searchParams.set('dateStart', value.start);
                            if (value.end) searchParams.set('dateEnd', value.end);
                        } else {
                            searchParams.set(`filter_${key}`, encodeURIComponent(String(value)));
                        }
                    }
                });
            }

            // Add options
            if (options && typeof options === 'object') {
                Object.entries(options).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '') {
                        searchParams.set(`opt_${key}`, encodeURIComponent(String(value)));
                    }
                });
            }

            // Add timestamp for tracking
            searchParams.set('shared', Date.now().toString());

            // Create the full URL
            const fullUrl = `${this.baseUrl}?${searchParams.toString()}`;
            
            // Validate URL length (most browsers support up to 2048 characters)
            if (fullUrl.length > 2000) {
                console.warn('Generated URL is very long and may not work in all browsers');
            }

            return fullUrl;

        } catch (error) {
            console.error('Error encoding search to URL:', error);
            throw new Error('Failed to create shareable URL');
        }
    }

    /**
     * Decode search parameters from URL
     * @param {string} url - URL to decode (optional, uses current URL if not provided)
     * @returns {Object} Decoded search parameters
     */
    decodeSearchFromURL(url = null) {
        try {
            const targetUrl = url || window.location.href;
            const urlObj = new URL(targetUrl);
            const params = urlObj.searchParams;

            const result = {
                query: '',
                filters: {},
                options: {},
                hasSearchParams: false,
                sharedTimestamp: null
            };

            // Check if there are any search-related parameters
            const hasQuery = params.has('q');
            const hasFilters = Array.from(params.keys()).some(key => key.startsWith('filter_'));
            const hasOptions = Array.from(params.keys()).some(key => key.startsWith('opt_'));
            const hasDateRange = params.has('dateStart') || params.has('dateEnd');

            if (!hasQuery && !hasFilters && !hasOptions && !hasDateRange) {
                return result; // No search parameters found
            }

            result.hasSearchParams = true;

            // Decode query
            if (hasQuery) {
                result.query = decodeURIComponent(params.get('q'));
            }

            // Decode filters
            params.forEach((value, key) => {
                if (key.startsWith('filter_')) {
                    const filterKey = key.substring(7); // Remove 'filter_' prefix
                    result.filters[filterKey] = decodeURIComponent(value);
                }
            });

            // Handle date range specially
            if (params.has('dateStart') || params.has('dateEnd')) {
                result.filters.dateRange = {};
                if (params.has('dateStart')) {
                    result.filters.dateRange.start = params.get('dateStart');
                }
                if (params.has('dateEnd')) {
                    result.filters.dateRange.end = params.get('dateEnd');
                }
            }

            // Decode options
            params.forEach((value, key) => {
                if (key.startsWith('opt_')) {
                    const optionKey = key.substring(4); // Remove 'opt_' prefix
                    result.options[optionKey] = decodeURIComponent(value);
                }
            });

            // Get shared timestamp
            if (params.has('shared')) {
                result.sharedTimestamp = parseInt(params.get('shared'));
            }

            return result;

        } catch (error) {
            console.error('Error decoding search from URL:', error);
            return {
                query: '',
                filters: {},
                options: {},
                hasSearchParams: false,
                sharedTimestamp: null,
                error: error.message
            };
        }
    }

    /**
     * Generate a shareable URL for the current search and copy to clipboard
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Object} options - Additional options
     * @returns {Promise<string>} The generated URL
     */
    async shareCurrentSearch(query, filters = {}, options = {}) {
        try {
            const shareUrl = this.encodeSearchToURL(query, filters, options);
            
            // Try to copy to clipboard
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(shareUrl);
                return shareUrl;
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return shareUrl;
                } catch (err) {
                    document.body.removeChild(textArea);
                    throw new Error('Could not copy to clipboard');
                }
            }

        } catch (error) {
            console.error('Error sharing search:', error);
            throw error;
        }
    }

    /**
     * Show a share dialog with the generated URL
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Object} options - Additional options
     */
    showShareDialog(query, filters = {}, options = {}) {
        try {
            const shareUrl = this.encodeSearchToURL(query, filters, options);
            
            const modalContent = `
                <div class="share-search-dialog">
                    <div class="share-info">
                        <p>Share this search with others using the link below:</p>
                    </div>
                    
                    <div class="share-url-container">
                        <input type="text" id="shareUrlInput" class="share-url-input" 
                               value="${this.escapeHtml(shareUrl)}" readonly>
                        <button id="copyUrlBtn" class="copy-url-btn" onclick="urlSearchSharing.copyShareUrl()">
                            📋 Copy
                        </button>
                    </div>
                    
                    <div class="share-details">
                        <h4>Search Details:</h4>
                        <div class="search-summary">
                            ${this.renderSearchSummary(query, filters)}
                        </div>
                    </div>
                    
                    <div class="share-options">
                        <h4>Share Options:</h4>
                        <div class="share-buttons">
                            <button class="share-btn email" onclick="urlSearchSharing.shareViaEmail('${encodeURIComponent(shareUrl)}', '${encodeURIComponent(query)}')">
                                📧 Email
                            </button>
                            <button class="share-btn social" onclick="urlSearchSharing.shareViaSocial('${encodeURIComponent(shareUrl)}', '${encodeURIComponent(query)}')">
                                🔗 Social
                            </button>
                            <button class="share-btn qr" onclick="urlSearchSharing.generateQRCode('${encodeURIComponent(shareUrl)}')">
                                📱 QR Code
                            </button>
                        </div>
                    </div>
                    
                    <div id="shareStatus" class="status" style="display: none;"></div>
                </div>

                <style>
                    .share-search-dialog {
                        max-width: 100%;
                    }

                    .share-info {
                        margin-bottom: 20px;
                        padding: 15px;
                        background: #e7f3ff;
                        border-radius: 6px;
                        border-left: 4px solid #007bff;
                    }

                    .share-info p {
                        margin: 0;
                        color: #0c5460;
                    }

                    .share-url-container {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                        align-items: center;
                    }

                    .share-url-input {
                        flex: 1;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 12px;
                        background: #f8f9fa;
                        color: #495057;
                    }

                    .copy-url-btn {
                        padding: 10px 15px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        white-space: nowrap;
                        transition: all 0.2s ease;
                    }

                    .copy-url-btn:hover {
                        background: #0056b3;
                        transform: translateY(-1px);
                    }

                    .copy-url-btn.copied {
                        background: #28a745;
                    }

                    .share-details {
                        margin-bottom: 20px;
                    }

                    .share-details h4 {
                        margin: 0 0 10px 0;
                        color: #495057;
                        font-size: 14px;
                    }

                    .search-summary {
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 4px;
                        border: 1px solid #dee2e6;
                        font-size: 13px;
                    }

                    .summary-item {
                        margin-bottom: 5px;
                    }

                    .summary-label {
                        font-weight: bold;
                        color: #495057;
                    }

                    .summary-value {
                        color: #6c757d;
                        margin-left: 8px;
                    }

                    .share-options h4 {
                        margin: 0 0 10px 0;
                        color: #495057;
                        font-size: 14px;
                    }

                    .share-buttons {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                    }

                    .share-btn {
                        padding: 8px 16px;
                        border: 1px solid #dee2e6;
                        border-radius: 4px;
                        background: white;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.2s ease;
                        text-decoration: none;
                        color: #495057;
                    }

                    .share-btn:hover {
                        background: #f8f9fa;
                        border-color: #007bff;
                        transform: translateY(-1px);
                    }

                    .share-btn.email:hover {
                        background: #d4edda;
                        border-color: #28a745;
                    }

                    .share-btn.social:hover {
                        background: #fff3cd;
                        border-color: #ffc107;
                    }

                    .share-btn.qr:hover {
                        background: #f8d7da;
                        border-color: #dc3545;
                    }

                    @media (max-width: 768px) {
                        .share-url-container {
                            flex-direction: column;
                            align-items: stretch;
                        }

                        .share-buttons {
                            flex-direction: column;
                        }

                        .share-btn {
                            text-align: center;
                        }
                    }
                </style>
            `;

            openModal('Share Search', modalContent, [
                { text: 'Close', class: 'secondary', onclick: 'closeModal()' }
            ]);

            // Focus on the URL input for easy selection
            setTimeout(() => {
                const urlInput = document.getElementById('shareUrlInput');
                if (urlInput) {
                    urlInput.select();
                }
            }, 100);

        } catch (error) {
            console.error('Error showing share dialog:', error);
            alert('Error creating share dialog: ' + error.message);
        }
    }

    /**
     * Copy the share URL to clipboard
     */
    async copyShareUrl() {
        const urlInput = document.getElementById('shareUrlInput');
        const copyBtn = document.getElementById('copyUrlBtn');
        
        if (!urlInput) return;

        try {
            // Select the text
            urlInput.select();
            urlInput.setSelectionRange(0, 99999); // For mobile devices

            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(urlInput.value);
            } else {
                // Fallback to execCommand
                document.execCommand('copy');
            }

            // Update button to show success
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅ Copied!';
                copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('copied');
                }, 2000);
            }

            this.showShareStatus('URL copied to clipboard!', 'success');

        } catch (error) {
            console.error('Error copying URL:', error);
            this.showShareStatus('Failed to copy URL. Please select and copy manually.', 'error');
        }
    }

    /**
     * Share via email
     */
    shareViaEmail(encodedUrl, encodedQuery) {
        try {
            const url = decodeURIComponent(encodedUrl);
            const query = decodeURIComponent(encodedQuery);
            
            const subject = encodeURIComponent(`Search Results: ${query}`);
            const body = encodeURIComponent(
                `I wanted to share this search with you:\n\n` +
                `Search: ${query}\n\n` +
                `Click the link below to view the results:\n${url}\n\n` +
                `This link will automatically load the search with all filters applied.`
            );

            const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
            window.open(mailtoUrl);

        } catch (error) {
            console.error('Error sharing via email:', error);
            this.showShareStatus('Error opening email client', 'error');
        }
    }

    /**
     * Share via social media (opens a generic share dialog)
     */
    shareViaSocial(encodedUrl, encodedQuery) {
        try {
            const url = decodeURIComponent(encodedUrl);
            const query = decodeURIComponent(encodedQuery);
            
            // Try the Web Share API if available
            if (navigator.share) {
                navigator.share({
                    title: `Search Results: ${query}`,
                    text: `Check out these search results for "${query}"`,
                    url: url
                }).catch(error => {
                    console.log('Share cancelled or failed:', error);
                });
            } else {
                // Fallback: copy URL and show instructions
                navigator.clipboard.writeText(url).then(() => {
                    this.showShareStatus('URL copied! You can now paste it in your social media post.', 'info');
                }).catch(() => {
                    this.showShareStatus('Please copy the URL manually to share on social media.', 'info');
                });
            }

        } catch (error) {
            console.error('Error sharing via social:', error);
            this.showShareStatus('Error sharing via social media', 'error');
        }
    }

    /**
     * Generate QR code for the URL
     */
    generateQRCode(encodedUrl) {
        try {
            const url = decodeURIComponent(encodedUrl);
            
            // Use a free QR code API service
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            
            const qrContent = `
                <div class="qr-code-container">
                    <h4>QR Code for Search</h4>
                    <div class="qr-code-image">
                        <img src="${qrApiUrl}" alt="QR Code" style="max-width: 200px; height: auto; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <p style="font-size: 12px; color: #6c757d; margin-top: 10px;">
                        Scan this QR code with a mobile device to open the search
                    </p>
                </div>
            `;

            openModal('QR Code', qrContent, [
                { text: 'Close', class: 'secondary', onclick: 'closeModal()' }
            ]);

        } catch (error) {
            console.error('Error generating QR code:', error);
            this.showShareStatus('Error generating QR code', 'error');
        }
    }

    /**
     * Automatically execute search from URL parameters on page load
     * @param {Function} searchCallback - Function to call with decoded search parameters
     * @returns {boolean} True if search parameters were found and executed
     */
    executeSearchFromURL(searchCallback) {
        try {
            const decoded = this.decodeSearchFromURL();
            
            if (!decoded.hasSearchParams) {
                return false; // No search parameters in URL
            }

            if (decoded.error) {
                console.error('Error in URL parameters:', decoded.error);
                return false;
            }

            // Execute the search
            if (searchCallback && typeof searchCallback === 'function') {
                searchCallback(decoded.query, decoded.filters, decoded.options);
                
                // Show a notification that search was loaded from URL
                if (decoded.sharedTimestamp) {
                    const sharedDate = new Date(decoded.sharedTimestamp);
                    console.log(`Loaded shared search from ${sharedDate.toLocaleString()}`);
                }
                
                return true;
            }

            return false;

        } catch (error) {
            console.error('Error executing search from URL:', error);
            return false;
        }
    }

    /**
     * Update the current URL with search parameters without reloading the page
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Object} options - Additional options
     */
    updateURLWithSearch(query, filters = {}, options = {}) {
        try {
            const searchParams = new URLSearchParams();

            // Add search query
            if (query && query.trim()) {
                searchParams.set('q', encodeURIComponent(query.trim()));
            }

            // Add filters
            if (filters && typeof filters === 'object') {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '' && value !== 'all') {
                        if (key === 'dateRange' && typeof value === 'object') {
                            if (value.start) searchParams.set('dateStart', value.start);
                            if (value.end) searchParams.set('dateEnd', value.end);
                        } else {
                            searchParams.set(`filter_${key}`, encodeURIComponent(String(value)));
                        }
                    }
                });
            }

            // Update the URL without reloading
            const newUrl = searchParams.toString() ? 
                `${this.baseUrl}?${searchParams.toString()}` : 
                this.baseUrl;

            window.history.replaceState({ search: { query, filters, options } }, '', newUrl);

        } catch (error) {
            console.error('Error updating URL:', error);
        }
    }

    /**
     * Clear search parameters from URL
     */
    clearURLSearchParams() {
        try {
            window.history.replaceState({}, '', this.baseUrl);
        } catch (error) {
            console.error('Error clearing URL parameters:', error);
        }
    }

    /**
     * Render search summary for share dialog
     */
    renderSearchSummary(query, filters) {
        let summary = '';

        if (query && query.trim()) {
            summary += `<div class="summary-item">
                <span class="summary-label">Query:</span>
                <span class="summary-value">${this.escapeHtml(query)}</span>
            </div>`;
        }

        if (filters && typeof filters === 'object') {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '' && value !== 'all') {
                    let displayValue = value;
                    if (key === 'dateRange' && typeof value === 'object') {
                        displayValue = `${value.start || 'start'} to ${value.end || 'end'}`;
                    }
                    
                    summary += `<div class="summary-item">
                        <span class="summary-label">${this.capitalizeFirst(key)}:</span>
                        <span class="summary-value">${this.escapeHtml(String(displayValue))}</span>
                    </div>`;
                }
            });
        }

        return summary || '<div class="summary-item">No specific search criteria</div>';
    }

    /**
     * Show status message in share dialog
     */
    showShareStatus(message, type) {
        const statusElement = document.getElementById('shareStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
            statusElement.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Capitalize first letter of a string
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = URLSearchSharing;
}