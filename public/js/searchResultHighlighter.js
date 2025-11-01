/**
 * Search Result Highlighter for Enhanced Search Engine
 * Handles visual feedback, match highlighting, and result statistics
 * Implements Requirements: 1.5, 4.3, 4.4
 */

class SearchResultHighlighter {
    constructor(options = {}) {
        this.options = {
            highlightClass: 'search-highlight',
            highlightStyle: 'background-color: #ffeb3b; font-weight: bold; padding: 1px 2px; border-radius: 2px;',
            maxHighlights: 50, // Limit highlights for performance
            caseSensitive: false,
            ...options
        };
        
        // Statistics tracking
        this.stats = {
            totalMatches: 0,
            highlightedFields: 0,
            lastHighlightTime: 0
        };
        
        this.setupStyles();
    }

    /**
     * Setup CSS styles for highlighting
     */
    setupStyles() {
        // Check if styles already exist
        if (document.getElementById('search-highlight-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'search-highlight-styles';
        style.textContent = `
            .${this.options.highlightClass} {
                ${this.options.highlightStyle}
            }
            
            .search-stats {
                font-size: 0.9em;
                color: #666;
                margin: 10px 0;
                padding: 8px 12px;
                background-color: #f5f5f5;
                border-radius: 4px;
                border-left: 3px solid #2196f3;
            }
            
            .no-results-message {
                text-align: center;
                padding: 40px 20px;
                color: #666;
                font-size: 1.1em;
            }
            
            .no-results-suggestions {
                margin-top: 15px;
                font-size: 0.9em;
            }
            
            .no-results-suggestions ul {
                list-style: none;
                padding: 0;
                margin: 10px 0;
            }
            
            .no-results-suggestions li {
                padding: 5px 0;
                cursor: pointer;
                color: #2196f3;
                text-decoration: underline;
            }
            
            .no-results-suggestions li:hover {
                color: #1976d2;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Highlight search matches in text content
     * @param {string} text - Text to highlight
     * @param {string} searchTerm - Term to highlight
     * @param {Object} options - Highlighting options
     * @returns {string} HTML with highlighted matches
     */
    highlightSearchMatches(text, searchTerm, options = {}) {
        if (!text || !searchTerm || typeof text !== 'string') {
            return text || '';
        }

        const highlightStart = Date.now();
        
        const opts = {
            caseSensitive: this.options.caseSensitive,
            maxMatches: this.options.maxHighlights,
            ...options
        };

        let highlightedText = text;
        let matchCount = 0;

        try {
            // Escape special regex characters in search term
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Create regex with appropriate flags
            const flags = opts.caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(`(${escapedTerm})`, flags);
            
            // Replace matches with highlighted version
            highlightedText = text.replace(regex, (match) => {
                if (matchCount >= opts.maxMatches) {
                    return match; // Stop highlighting after max matches
                }
                matchCount++;
                return `<span class="${this.options.highlightClass}">${match}</span>`;
            });

            // Update statistics
            this.stats.totalMatches += matchCount;
            this.stats.highlightedFields++;
            this.stats.lastHighlightTime = Date.now() - highlightStart;

        } catch (error) {
            console.warn('Error highlighting search matches:', error);
            return text; // Return original text on error
        }

        return highlightedText;
    }

    /**
     * Highlight search matches in table results
     * @param {Array} records - Records to highlight
     * @param {string} searchTerm - Search term to highlight
     * @param {Array} fieldsToHighlight - Fields to apply highlighting to
     * @returns {Array} Records with highlighted content
     */
    highlightTableResults(records, searchTerm, fieldsToHighlight = null) {
        if (!records || !Array.isArray(records) || !searchTerm) {
            return records || [];
        }

        // Default fields to highlight
        const defaultFields = ['Id', 'Phone', 'CompanyName', 'PhysicalAddress', 'Email', 'Website'];
        const fields = fieldsToHighlight || defaultFields;

        return records.map(record => {
            const highlightedRecord = { ...record };

            fields.forEach(field => {
                if (record[field]) {
                    highlightedRecord[field] = this.highlightSearchMatches(
                        record[field].toString(),
                        searchTerm
                    );
                }
            });

            return highlightedRecord;
        });
    }

    /**
     * Create and display match count and result statistics
     * @param {number} totalResults - Total number of results
     * @param {string} searchQuery - Original search query
     * @param {number} executionTime - Search execution time in ms
     * @param {Object} additionalStats - Additional statistics
     * @returns {HTMLElement} Statistics element
     */
    createResultStatistics(totalResults, searchQuery, executionTime = 0, additionalStats = {}) {
        const statsElement = document.createElement('div');
        statsElement.className = 'search-stats';

        let statsText = '';

        if (totalResults === 0) {
            statsText = `No results found for "${searchQuery}"`;
        } else if (totalResults === 1) {
            statsText = `1 result found for "${searchQuery}"`;
        } else {
            statsText = `${totalResults.toLocaleString()} results found for "${searchQuery}"`;
        }

        if (executionTime > 0) {
            statsText += ` (${executionTime}ms)`;
        }

        // Add additional statistics if provided
        if (additionalStats.filteredFrom) {
            statsText += ` • Filtered from ${additionalStats.filteredFrom.toLocaleString()} total records`;
        }

        if (additionalStats.highlightedMatches && additionalStats.highlightedMatches > 0) {
            statsText += ` • ${additionalStats.highlightedMatches} highlighted matches`;
        }

        statsElement.textContent = statsText;
        return statsElement;
    }

    /**
     * Display match count in a specific container
     * @param {string|HTMLElement} container - Container element or selector
     * @param {number} totalResults - Total number of results
     * @param {string} searchQuery - Original search query
     * @param {number} executionTime - Search execution time
     * @param {Object} additionalStats - Additional statistics
     */
    displayMatchCount(container, totalResults, searchQuery, executionTime = 0, additionalStats = {}) {
        const containerElement = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;

        if (!containerElement) {
            console.warn('Search stats container not found');
            return;
        }

        // Remove existing stats
        const existingStats = containerElement.querySelector('.search-stats');
        if (existingStats) {
            existingStats.remove();
        }

        // Create and add new stats
        const statsElement = this.createResultStatistics(
            totalResults, 
            searchQuery, 
            executionTime, 
            additionalStats
        );

        containerElement.insertBefore(statsElement, containerElement.firstChild);
    }

    /**
     * Build "no results found" state with search suggestions
     * @param {string} searchQuery - Original search query
     * @param {Array} suggestions - Alternative search suggestions
     * @param {Function} onSuggestionClick - Callback for suggestion clicks
     * @returns {HTMLElement} No results element
     */
    buildNoResultsState(searchQuery, suggestions = [], onSuggestionClick = null) {
        const noResultsElement = document.createElement('div');
        noResultsElement.className = 'no-results-message';

        const messageElement = document.createElement('div');
        messageElement.innerHTML = `
            <h3>No results found for "${searchQuery}"</h3>
            <p>Try adjusting your search criteria or check the suggestions below.</p>
        `;

        noResultsElement.appendChild(messageElement);

        if (suggestions && suggestions.length > 0) {
            const suggestionsElement = document.createElement('div');
            suggestionsElement.className = 'no-results-suggestions';
            
            const suggestionsTitle = document.createElement('p');
            suggestionsTitle.textContent = 'Try these suggestions:';
            suggestionsElement.appendChild(suggestionsTitle);

            const suggestionsList = document.createElement('ul');
            
            suggestions.slice(0, 5).forEach(suggestion => {
                const listItem = document.createElement('li');
                listItem.textContent = suggestion.query || suggestion;
                
                if (onSuggestionClick) {
                    listItem.addEventListener('click', () => {
                        onSuggestionClick(suggestion.query || suggestion);
                    });
                }
                
                suggestionsList.appendChild(listItem);
            });

            suggestionsElement.appendChild(suggestionsList);
            noResultsElement.appendChild(suggestionsElement);
        }

        // Add general search tips
        const tipsElement = document.createElement('div');
        tipsElement.className = 'search-tips';
        tipsElement.innerHTML = `
            <p><strong>Search tips:</strong></p>
            <ul>
                <li>Use wildcards: "SG COM-200*" to find all IDs starting with "SG COM-200"</li>
                <li>Use ranges: "SG COM-2001 to SG COM-2010" to find IDs in that range</li>
                <li>Try partial matches: "COM" to find all records containing "COM"</li>
                <li>Check your spelling and try different terms</li>
            </ul>
        `;

        noResultsElement.appendChild(tipsElement);

        return noResultsElement;
    }

    /**
     * Display no results state in a container
     * @param {string|HTMLElement} container - Container element or selector
     * @param {string} searchQuery - Original search query
     * @param {Array} suggestions - Alternative search suggestions
     * @param {Function} onSuggestionClick - Callback for suggestion clicks
     */
    displayNoResultsState(container, searchQuery, suggestions = [], onSuggestionClick = null) {
        const containerElement = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;

        if (!containerElement) {
            console.warn('No results container not found');
            return;
        }

        // Clear existing content
        containerElement.innerHTML = '';

        // Add no results state
        const noResultsElement = this.buildNoResultsState(searchQuery, suggestions, onSuggestionClick);
        containerElement.appendChild(noResultsElement);
    }

    /**
     * Remove all highlighting from text
     * @param {string} text - Text with highlighting
     * @returns {string} Clean text without highlighting
     */
    removeHighlighting(text) {
        if (!text || typeof text !== 'string') {
            return text || '';
        }

        // Remove highlight spans while preserving content
        return text.replace(new RegExp(`<span class="${this.options.highlightClass}">([^<]*)</span>`, 'gi'), '$1');
    }

    /**
     * Clear all highlighting from a container
     * @param {string|HTMLElement} container - Container element or selector
     */
    clearHighlighting(container) {
        const containerElement = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;

        if (!containerElement) {
            return;
        }

        // Remove all highlight spans
        const highlights = containerElement.querySelectorAll(`.${this.options.highlightClass}`);
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize(); // Merge adjacent text nodes
        });

        // Remove search stats
        const stats = containerElement.querySelector('.search-stats');
        if (stats) {
            stats.remove();
        }
    }

    /**
     * Get highlighting statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            ...this.stats,
            averageHighlightTime: this.stats.highlightedFields > 0 
                ? this.stats.lastHighlightTime / this.stats.highlightedFields 
                : 0
        };
    }

    /**
     * Reset highlighting statistics
     */
    resetStatistics() {
        this.stats = {
            totalMatches: 0,
            highlightedFields: 0,
            lastHighlightTime: 0
        };
    }

    /**
     * Update highlighting options
     * @param {Object} newOptions - New options to merge
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.setupStyles(); // Refresh styles if needed
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchResultHighlighter;
}