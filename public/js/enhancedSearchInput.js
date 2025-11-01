/**
 * Enhanced Search Input Component
 * Provides auto-complete, suggestions, and pattern matching for search input
 */

class EnhancedSearchInput {
    constructor(inputId, options = {}) {
        this.inputElement = document.getElementById(inputId);
        if (!this.inputElement) {
            throw new Error(`Search input element with ID '${inputId}' not found`);
        }

        // Configuration options
        this.options = {
            placeholder: "Search records (try 'SG COM-200*' or 'range:2001-2010')...",
            showSuggestions: true,
            showHistory: true,
            showHelp: true,
            debounceMs: 300,
            maxSuggestions: 5,
            maxHistoryItems: 10,
            enablePatternHelp: true,
            ...options
        };

        // Component elements
        this.wrapper = this.inputElement.closest('.enhanced-search-wrapper');
        this.suggestionsElement = document.getElementById('searchSuggestions');
        this.historyElement = document.getElementById('searchHistory');
        this.helpElement = document.getElementById('searchHelp');
        this.loadingElement = null; // Will be created if needed

        // State management
        this.isInitialized = false;
        this.currentSuggestions = [];
        this.selectedSuggestionIndex = -1;
        this.isShowingSuggestions = false;
        this.isShowingHistory = false;
        this.isShowingHelp = false;
        this.debounceTimer = null;

        // Event handlers (bound to maintain context)
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);

        // Callbacks
        this.onSearch = null;
        this.onSuggestionSelect = null;
        this.onPatternDetected = null;

        this.initialize();
    }

    /**
     * Initialize the enhanced search input
     */
    initialize() {
        try {
            this.setupElements();
            this.setupEventListeners();
            this.setupQuickSearchButtons();
            this.loadSearchHistory();
            
            this.isInitialized = true;
            console.log('Enhanced Search Input initialized successfully');
        } catch (error) {
            console.error('Error initializing Enhanced Search Input:', error);
        }
    }

    /**
     * Set up DOM elements
     */
    setupElements() {
        // Update placeholder
        this.inputElement.placeholder = this.options.placeholder;

        // Create loading indicator
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'search-loading';
        this.loadingElement.id = 'searchLoading';
        this.wrapper.appendChild(this.loadingElement);

        // Ensure dropdown elements exist
        if (!this.suggestionsElement) {
            console.warn('Search suggestions element not found');
        }
        if (!this.historyElement) {
            console.warn('Search history element not found');
        }
        if (!this.helpElement) {
            console.warn('Search help element not found');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Input events
        this.inputElement.addEventListener('input', this.handleInput);
        this.inputElement.addEventListener('keydown', this.handleKeyDown);
        this.inputElement.addEventListener('focus', this.handleFocus);
        this.inputElement.addEventListener('blur', this.handleBlur);

        // Click outside to close dropdowns
        document.addEventListener('click', this.handleClickOutside);

        // History clear button
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearSearchHistory();
            });
        }

        // Suggestion and history item clicks
        if (this.suggestionsElement) {
            this.suggestionsElement.addEventListener('click', (e) => {
                const suggestionItem = e.target.closest('.suggestion-item');
                if (suggestionItem) {
                    const query = suggestionItem.dataset.query;
                    this.selectSuggestion(query);
                }
            });
        }

        if (this.historyElement) {
            this.historyElement.addEventListener('click', (e) => {
                const historyItem = e.target.closest('.history-item');
                if (historyItem) {
                    const query = historyItem.dataset.query;
                    this.selectFromHistory(query);
                }
            });
        }
    }

    /**
     * Set up quick search buttons
     */
    setupQuickSearchButtons() {
        const quickSearchButtons = document.querySelectorAll('.quick-search-btn');
        quickSearchButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const pattern = button.dataset.pattern;
                if (pattern) {
                    this.setSearchValue(pattern);
                    this.triggerSearch(pattern);
                }
            });
        });
    }

    /**
     * Handle input events with debouncing
     */
    handleInput(event) {
        const query = event.target.value.trim();
        
        // Clear previous debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Hide dropdowns immediately if input is empty
        if (!query) {
            this.hideAllDropdowns();
            this.triggerSearch('');
            return;
        }

        // Show loading indicator
        this.showLoading();

        // Debounce the search and suggestions
        this.debounceTimer = setTimeout(() => {
            this.hideLoading();
            this.handleSearchInput(query);
        }, this.options.debounceMs);
    }

    /**
     * Handle search input processing
     */
    async handleSearchInput(query) {
        try {
            // Detect search patterns
            const patternInfo = this.detectSearchPattern(query);
            if (patternInfo && this.onPatternDetected) {
                this.onPatternDetected(patternInfo);
            }

            // Get suggestions if enabled
            if (this.options.showSuggestions && query.length >= 2) {
                await this.showSuggestions(query);
            } else {
                this.hideSuggestions();
            }

            // Trigger search callback
            if (this.onSearch) {
                this.onSearch(query, patternInfo);
            }

        } catch (error) {
            console.error('Error handling search input:', error);
            this.hideLoading();
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyDown(event) {
        const { key } = event;

        // Handle dropdown navigation
        if (this.isShowingSuggestions || this.isShowingHistory) {
            switch (key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.navigateDropdown(1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.navigateDropdown(-1);
                    break;
                case 'Enter':
                    event.preventDefault();
                    this.selectCurrentItem();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.hideAllDropdowns();
                    break;
            }
            return;
        }

        // Handle other keys
        switch (key) {
            case 'Enter':
                event.preventDefault();
                const query = this.inputElement.value.trim();
                if (query) {
                    this.addToHistory(query);
                    this.triggerSearch(query);
                }
                break;
            case 'ArrowDown':
                if (this.options.showHistory) {
                    event.preventDefault();
                    this.showHistory();
                }
                break;
            case 'F1':
                if (this.options.showHelp) {
                    event.preventDefault();
                    this.toggleHelp();
                }
                break;
        }
    }

    /**
     * Handle focus events
     */
    handleFocus(event) {
        const query = this.inputElement.value.trim();
        
        // Show appropriate dropdown based on input state
        if (query && this.options.showSuggestions) {
            this.showSuggestions(query);
        } else if (this.options.showHistory) {
            this.showHistory();
        }
    }

    /**
     * Handle blur events (with delay to allow for clicks)
     */
    handleBlur(event) {
        // Delay hiding to allow for dropdown clicks
        setTimeout(() => {
            if (!this.wrapper.contains(document.activeElement)) {
                this.hideAllDropdowns();
            }
        }, 150);
    }

    /**
     * Handle clicks outside the component
     */
    handleClickOutside(event) {
        if (!this.wrapper.contains(event.target)) {
            this.hideAllDropdowns();
        }
    }

    /**
     * Show search suggestions
     */
    async showSuggestions(query) {
        if (!this.suggestionsElement || !this.options.showSuggestions) return;

        try {
            // Get suggestions from enhanced search system
            const suggestions = await this.getSuggestions(query);
            
            if (suggestions.length === 0) {
                this.hideSuggestions();
                return;
            }

            this.currentSuggestions = suggestions;
            this.renderSuggestions(suggestions);
            this.showDropdown('suggestions');

        } catch (error) {
            console.error('Error showing suggestions:', error);
            this.hideSuggestions();
        }
    }

    /**
     * Get suggestions from various sources
     */
    async getSuggestions(query) {
        const suggestions = [];

        try {
            // Get suggestions from enhanced search system if available
            const enhancedSearch = window.getEnhancedSearchSystem && window.getEnhancedSearchSystem();
            if (enhancedSearch) {
                const systemSuggestions = enhancedSearch.getSuggestions(query);
                suggestions.push(...systemSuggestions);
            }

            // Add pattern-based suggestions
            const patternSuggestions = this.generatePatternSuggestions(query);
            suggestions.push(...patternSuggestions);

            // Limit and deduplicate
            return this.deduplicateSuggestions(suggestions).slice(0, this.options.maxSuggestions);

        } catch (error) {
            console.error('Error getting suggestions:', error);
            return [];
        }
    }

    /**
     * Generate pattern-based suggestions
     */
    generatePatternSuggestions(query) {
        const suggestions = [];
        const lowerQuery = query.toLowerCase();

        // ID pattern suggestions
        if (lowerQuery.includes('sg com') || lowerQuery.includes('sg-com')) {
            suggestions.push({
                query: 'SG COM-*',
                source: 'pattern',
                description: 'All SG COM records'
            });
            
            if (lowerQuery.match(/\d/)) {
                const numbers = lowerQuery.match(/\d+/g);
                if (numbers) {
                    const num = numbers[0];
                    suggestions.push({
                        query: `SG COM-${num}*`,
                        source: 'pattern',
                        description: `SG COM records starting with ${num}`
                    });
                }
            }
        }

        // Phone number suggestions
        if (lowerQuery.includes('+65') || lowerQuery.includes('65')) {
            suggestions.push({
                query: '+65*',
                source: 'pattern',
                description: 'Singapore phone numbers'
            });
        }

        // Range suggestions
        if (lowerQuery.includes('range') || lowerQuery.includes('to')) {
            suggestions.push({
                query: 'range:2001-2100',
                source: 'pattern',
                description: 'ID range 2001 to 2100'
            });
        }

        return suggestions;
    }

    /**
     * Render suggestions in the dropdown
     */
    renderSuggestions(suggestions) {
        if (!this.suggestionsElement) return;

        const html = suggestions.map((suggestion, index) => `
            <div class="suggestion-item" 
                 data-query="${this.escapeHtml(suggestion.query)}" 
                 data-index="${index}"
                 role="option"
                 aria-selected="false">
                <span class="suggestion-text">${this.escapeHtml(suggestion.query)}</span>
                <span class="suggestion-source ${suggestion.source}">${suggestion.source}</span>
            </div>
        `).join('');

        this.suggestionsElement.innerHTML = html;
    }

    /**
     * Show search history
     */
    showHistory() {
        if (!this.historyElement || !this.options.showHistory) return;

        const history = this.getSearchHistory();
        if (history.length === 0) return;

        this.renderHistory(history);
        this.showDropdown('history');
    }

    /**
     * Render search history
     */
    renderHistory(history) {
        if (!this.historyElement) return;

        const historyList = this.historyElement.querySelector('.search-history-list');
        if (!historyList) return;

        const html = history.map((item, index) => `
            <div class="history-item" 
                 data-query="${this.escapeHtml(item.query)}" 
                 data-index="${index}"
                 role="option"
                 aria-selected="false">
                <span class="history-query">${this.escapeHtml(item.query)}</span>
                <span class="history-timestamp">${this.formatTimestamp(item.timestamp)}</span>
            </div>
        `).join('');

        historyList.innerHTML = html || '<div class="history-item">No recent searches</div>';
    }

    /**
     * Show help information
     */
    showHelp() {
        if (!this.helpElement || !this.options.showHelp) return;
        this.showDropdown('help');
    }

    /**
     * Show specific dropdown
     */
    showDropdown(type) {
        this.hideAllDropdowns();

        switch (type) {
            case 'suggestions':
                if (this.suggestionsElement) {
                    this.suggestionsElement.classList.add('show');
                    this.inputElement.classList.add('has-suggestions');
                    this.isShowingSuggestions = true;
                }
                break;
            case 'history':
                if (this.historyElement) {
                    this.historyElement.classList.add('show');
                    this.isShowingHistory = true;
                }
                break;
            case 'help':
                if (this.helpElement) {
                    this.helpElement.classList.add('show');
                    this.isShowingHelp = true;
                }
                break;
        }

        this.selectedSuggestionIndex = -1;
    }

    /**
     * Hide all dropdowns
     */
    hideAllDropdowns() {
        this.hideSuggestions();
        this.hideHistory();
        this.hideHelp();
    }

    /**
     * Hide suggestions dropdown
     */
    hideSuggestions() {
        if (this.suggestionsElement) {
            this.suggestionsElement.classList.remove('show');
            this.inputElement.classList.remove('has-suggestions');
        }
        this.isShowingSuggestions = false;
        this.selectedSuggestionIndex = -1;
    }

    /**
     * Hide history dropdown
     */
    hideHistory() {
        if (this.historyElement) {
            this.historyElement.classList.remove('show');
        }
        this.isShowingHistory = false;
    }

    /**
     * Hide help dropdown
     */
    hideHelp() {
        if (this.helpElement) {
            this.helpElement.classList.remove('show');
        }
        this.isShowingHelp = false;
    }

    /**
     * Navigate dropdown items with keyboard
     */
    navigateDropdown(direction) {
        const activeDropdown = this.getActiveDropdown();
        if (!activeDropdown) return;

        const items = activeDropdown.querySelectorAll('.suggestion-item, .history-item');
        if (items.length === 0) return;

        // Remove current selection
        items.forEach(item => {
            item.classList.remove('highlighted');
            item.setAttribute('aria-selected', 'false');
        });

        // Calculate new index
        this.selectedSuggestionIndex += direction;
        
        if (this.selectedSuggestionIndex < 0) {
            this.selectedSuggestionIndex = items.length - 1;
        } else if (this.selectedSuggestionIndex >= items.length) {
            this.selectedSuggestionIndex = 0;
        }

        // Highlight new selection
        const selectedItem = items[this.selectedSuggestionIndex];
        if (selectedItem) {
            selectedItem.classList.add('highlighted');
            selectedItem.setAttribute('aria-selected', 'true');
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Get currently active dropdown
     */
    getActiveDropdown() {
        if (this.isShowingSuggestions) return this.suggestionsElement;
        if (this.isShowingHistory) return this.historyElement;
        return null;
    }

    /**
     * Select current highlighted item
     */
    selectCurrentItem() {
        const activeDropdown = this.getActiveDropdown();
        if (!activeDropdown) return;

        const highlightedItem = activeDropdown.querySelector('.highlighted');
        if (highlightedItem) {
            const query = highlightedItem.dataset.query;
            if (this.isShowingSuggestions) {
                this.selectSuggestion(query);
            } else if (this.isShowingHistory) {
                this.selectFromHistory(query);
            }
        }
    }

    /**
     * Select a suggestion
     */
    selectSuggestion(query) {
        this.setSearchValue(query);
        this.addToHistory(query);
        this.hideAllDropdowns();
        
        if (this.onSuggestionSelect) {
            this.onSuggestionSelect(query);
        }
        
        this.triggerSearch(query);
    }

    /**
     * Select from history
     */
    selectFromHistory(query) {
        this.setSearchValue(query);
        this.hideAllDropdowns();
        this.triggerSearch(query);
    }

    /**
     * Set search input value
     */
    setSearchValue(value) {
        this.inputElement.value = value;
        this.inputElement.focus();
    }

    /**
     * Get search input value
     */
    getSearchValue() {
        return this.inputElement.value.trim();
    }

    /**
     * Clear search input
     */
    clearSearch() {
        this.setSearchValue('');
        this.hideAllDropdowns();
        this.triggerSearch('');
    }

    /**
     * Trigger search callback
     */
    triggerSearch(query) {
        if (this.onSearch) {
            const patternInfo = this.detectSearchPattern(query);
            this.onSearch(query, patternInfo);
        }
    }

    /**
     * Detect search patterns in query
     */
    detectSearchPattern(query) {
        if (!query) return null;

        const patterns = {
            wildcard: /^(.+)\*$/,
            range: /^(.+?)\s+to\s+(.+)$/i,
            rangeShort: /^range:(\d+)-(\d+)$/i,
            phoneNumber: /^\+?65/,
            exactPhrase: /^"(.+)"$/,
            idPattern: /^SG\s+COM-/i
        };

        for (const [type, regex] of Object.entries(patterns)) {
            const match = query.match(regex);
            if (match) {
                return {
                    type,
                    original: query,
                    matches: match.slice(1),
                    isPattern: true
                };
            }
        }

        return {
            type: 'text',
            original: query,
            matches: [query],
            isPattern: false
        };
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        if (this.loadingElement) {
            this.loadingElement.classList.add('show');
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.classList.remove('show');
        }
    }

    /**
     * Toggle help display
     */
    toggleHelp() {
        if (this.isShowingHelp) {
            this.hideHelp();
        } else {
            this.showHelp();
        }
    }

    // Search History Management

    /**
     * Add query to search history
     */
    addToHistory(query) {
        if (!query || query.length < 2) return;

        try {
            let history = this.getSearchHistory();
            
            // Remove existing entry if present
            history = history.filter(item => item.query !== query);
            
            // Add to beginning
            history.unshift({
                query,
                timestamp: new Date().toISOString()
            });
            
            // Limit history size
            if (history.length > this.options.maxHistoryItems) {
                history = history.slice(0, this.options.maxHistoryItems);
            }
            
            localStorage.setItem('enhancedSearchHistory', JSON.stringify(history));
            
        } catch (error) {
            console.error('Error adding to search history:', error);
        }
    }

    /**
     * Get search history from localStorage
     */
    getSearchHistory() {
        try {
            const history = localStorage.getItem('enhancedSearchHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading search history:', error);
            return [];
        }
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        try {
            localStorage.removeItem('enhancedSearchHistory');
            this.hideHistory();
            console.log('Search history cleared');
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    }

    /**
     * Load search history on initialization
     */
    loadSearchHistory() {
        // History is loaded on-demand when showing the dropdown
        console.log('Search history management initialized');
    }

    // Utility Methods

    /**
     * Deduplicate suggestions array
     */
    deduplicateSuggestions(suggestions) {
        const seen = new Set();
        return suggestions.filter(suggestion => {
            const key = suggestion.query.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString();
        } catch (error) {
            return 'Recently';
        }
    }

    /**
     * Set callback functions
     */
    setCallbacks({ onSearch, onSuggestionSelect, onPatternDetected }) {
        if (onSearch) this.onSearch = onSearch;
        if (onSuggestionSelect) this.onSuggestionSelect = onSuggestionSelect;
        if (onPatternDetected) this.onPatternDetected = onPatternDetected;
    }

    /**
     * Update options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // Update placeholder if changed
        if (newOptions.placeholder) {
            this.inputElement.placeholder = newOptions.placeholder;
        }
    }

    /**
     * Destroy the component
     */
    destroy() {
        // Remove event listeners
        this.inputElement.removeEventListener('input', this.handleInput);
        this.inputElement.removeEventListener('keydown', this.handleKeyDown);
        this.inputElement.removeEventListener('focus', this.handleFocus);
        this.inputElement.removeEventListener('blur', this.handleBlur);
        document.removeEventListener('click', this.handleClickOutside);

        // Clear timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Reset state
        this.isInitialized = false;
        console.log('Enhanced Search Input destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedSearchInput;
}