/**
 * Saved Search Modal Manager
 * Provides UI for managing saved searches with CRUD operations
 */

class SavedSearchModal {
    constructor(savedSearches, searchEngine) {
        this.savedSearches = savedSearches;
        this.searchEngine = searchEngine;
        this.currentEditingId = null;
        this.onSearchExecute = null; // Callback for when a search is executed
        
        // Modal state
        this.isOpen = false;
        this.currentView = 'list'; // 'list', 'edit', 'create'
    }

    /**
     * Open the saved search management modal
     * @param {Function} onSearchExecute - Callback function when a search is executed
     */
    open(onSearchExecute = null) {
        this.onSearchExecute = onSearchExecute;
        this.currentView = 'list';
        this.isOpen = true;
        this.render();
    }

    /**
     * Close the modal
     */
    close() {
        this.isOpen = false;
        this.currentEditingId = null;
        this.currentView = 'list';
        closeModal();
    }

    /**
     * Render the modal content based on current view
     */
    render() {
        const title = this.getModalTitle();
        const content = this.getModalContent();
        const footerButtons = this.getModalFooterButtons();

        openModal(title, content, footerButtons);
        this.attachEventListeners();
    }

    /**
     * Get modal title based on current view
     */
    getModalTitle() {
        switch (this.currentView) {
            case 'create':
                return 'Save Current Search';
            case 'edit':
                return 'Edit Saved Search';
            default:
                return 'Manage Saved Searches';
        }
    }

    /**
     * Get modal content based on current view
     */
    getModalContent() {
        switch (this.currentView) {
            case 'create':
                return this.renderCreateForm();
            case 'edit':
                return this.renderEditForm();
            default:
                return this.renderSearchList();
        }
    }

    /**
     * Get modal footer buttons based on current view
     */
    getModalFooterButtons() {
        switch (this.currentView) {
            case 'create':
                return [
                    { text: 'Cancel', class: 'secondary', onclick: 'savedSearchModal.switchToList()' },
                    { text: 'Save Search', class: 'primary', onclick: 'savedSearchModal.saveCurrentSearch()' }
                ];
            case 'edit':
                return [
                    { text: 'Cancel', class: 'secondary', onclick: 'savedSearchModal.switchToList()' },
                    { text: 'Update Search', class: 'primary', onclick: 'savedSearchModal.updateSearch()' }
                ];
            default:
                return [
                    { text: 'Close', class: 'secondary', onclick: 'savedSearchModal.close()' }
                ];
        }
    }

    /**
     * Render the saved searches list view
     */
    renderSearchList() {
        const searches = this.savedSearches.getAll({ sortBy: 'name' });
        const recentSearches = this.savedSearches.getRecentlyExecuted(3);
        const popularSearches = this.savedSearches.getPopular(3);

        return `
            <div class="saved-search-container">
                <!-- Search and Filter Controls -->
                <div class="saved-search-controls">
                    <div class="search-filter-row">
                        <input type="text" id="savedSearchFilter" class="form-control" 
                               placeholder="Filter saved searches..." 
                               onkeyup="savedSearchModal.filterSearches(this.value)">
                        <button class="btn btn-primary" onclick="savedSearchModal.switchToCreate()" 
                                title="Save current search">
                            💾 Save Current Search
                        </button>
                    </div>
                    
                    <div class="search-sort-controls">
                        <label for="savedSearchSort">Sort by:</label>
                        <select id="savedSearchSort" onchange="savedSearchModal.sortSearches(this.value)">
                            <option value="name">Name</option>
                            <option value="created">Date Created</option>
                            <option value="lastExecuted">Last Used</option>
                            <option value="popularity">Most Used</option>
                        </select>
                    </div>
                </div>

                <!-- Quick Access Sections -->
                ${recentSearches.length > 0 ? `
                <div class="saved-search-section">
                    <h4>Recently Used</h4>
                    <div class="saved-search-quick-list">
                        ${recentSearches.map(search => this.renderQuickSearchItem(search)).join('')}
                    </div>
                </div>
                ` : ''}

                ${popularSearches.length > 0 ? `
                <div class="saved-search-section">
                    <h4>Most Popular</h4>
                    <div class="saved-search-quick-list">
                        ${popularSearches.map(search => this.renderQuickSearchItem(search)).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- All Saved Searches -->
                <div class="saved-search-section">
                    <h4>All Saved Searches (${searches.length})</h4>
                    <div id="savedSearchList" class="saved-search-list">
                        ${searches.length > 0 ? 
                            searches.map(search => this.renderSearchItem(search)).join('') :
                            '<div class="no-saved-searches">No saved searches yet. Save your current search to get started!</div>'
                        }
                    </div>
                </div>

                <!-- Import/Export Section -->
                <div class="saved-search-section">
                    <h4>Import/Export</h4>
                    <div class="import-export-controls">
                        <button class="btn btn-secondary" onclick="savedSearchModal.exportSearches()">
                            📤 Export All Searches
                        </button>
                        <input type="file" id="importSearchFile" accept=".json" style="display: none;" 
                               onchange="savedSearchModal.importSearches(this.files[0])">
                        <button class="btn btn-secondary" onclick="document.getElementById('importSearchFile').click()">
                            📥 Import Searches
                        </button>
                    </div>
                </div>
            </div>

            <style>
                .saved-search-container {
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .saved-search-controls {
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #dee2e6;
                }

                .search-filter-row {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    align-items: center;
                }

                .search-filter-row input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }

                .search-sort-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                }

                .search-sort-controls select {
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }

                .saved-search-section {
                    margin-bottom: 25px;
                }

                .saved-search-section h4 {
                    margin: 0 0 12px 0;
                    color: #495057;
                    font-size: 16px;
                    border-bottom: 2px solid #007bff;
                    padding-bottom: 4px;
                }

                .saved-search-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .saved-search-quick-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .saved-search-item {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 12px;
                    transition: all 0.2s ease;
                }

                .saved-search-item:hover {
                    background: #e9ecef;
                    border-color: #007bff;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
                }

                .saved-search-quick-item {
                    background: #e7f3ff;
                    border: 1px solid #bee5eb;
                    border-radius: 20px;
                    padding: 6px 12px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .saved-search-quick-item:hover {
                    background: #007bff;
                    color: white;
                    transform: translateY(-1px);
                }

                .search-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }

                .search-item-name {
                    font-weight: bold;
                    color: #495057;
                    font-size: 14px;
                    margin: 0;
                }

                .search-item-actions {
                    display: flex;
                    gap: 4px;
                }

                .search-item-btn {
                    background: none;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 4px 8px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .search-item-btn:hover {
                    background: #007bff;
                    color: white;
                    border-color: #007bff;
                }

                .search-item-btn.danger:hover {
                    background: #dc3545;
                    border-color: #dc3545;
                }

                .search-item-description {
                    font-size: 12px;
                    color: #6c757d;
                    margin-bottom: 8px;
                    line-height: 1.4;
                }

                .search-item-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                    color: #6c757d;
                }

                .search-item-tags {
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                }

                .search-tag {
                    background: #e9ecef;
                    color: #495057;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                }

                .search-tag.wildcard { background: #fff3cd; color: #856404; }
                .search-tag.range { background: #d4edda; color: #155724; }
                .search-tag.id-pattern { background: #d1ecf1; color: #0c5460; }
                .search-tag.phone { background: #f8d7da; color: #721c24; }

                .no-saved-searches {
                    text-align: center;
                    padding: 40px 20px;
                    color: #6c757d;
                    font-style: italic;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border: 2px dashed #dee2e6;
                }

                .import-export-controls {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }

                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                }

                .btn.btn-primary {
                    background: #007bff;
                    color: white;
                }

                .btn.btn-primary:hover {
                    background: #0056b3;
                    transform: translateY(-1px);
                }

                .btn.btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .btn.btn-secondary:hover {
                    background: #545b62;
                    transform: translateY(-1px);
                }

                @media (max-width: 768px) {
                    .search-filter-row {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .search-item-header {
                        flex-direction: column;
                        gap: 8px;
                    }

                    .search-item-actions {
                        align-self: flex-start;
                    }

                    .import-export-controls {
                        flex-direction: column;
                    }
                }
            </style>
        `;
    }

    /**
     * Render a quick search item for recent/popular sections
     */
    renderQuickSearchItem(search) {
        return `
            <div class="saved-search-quick-item" 
                 onclick="savedSearchModal.executeSearch('${search.id}')"
                 title="${search.description}">
                ${search.name}
                ${search.executionCount > 0 ? `<span class="execution-count">(${search.executionCount})</span>` : ''}
            </div>
        `;
    }

    /**
     * Render a full search item for the main list
     */
    renderSearchItem(search) {
        return `
            <div class="saved-search-item" data-search-id="${search.id}">
                <div class="search-item-header">
                    <h5 class="search-item-name">${this.escapeHtml(search.name)}</h5>
                    <div class="search-item-actions">
                        <button class="search-item-btn" onclick="savedSearchModal.executeSearch('${search.id}')" 
                                title="Execute this search">
                            ▶️ Run
                        </button>
                        <button class="search-item-btn" onclick="savedSearchModal.shareSearch('${search.id}')" 
                                title="Share this search">
                            🔗 Share
                        </button>
                        <button class="search-item-btn" onclick="savedSearchModal.editSearch('${search.id}')" 
                                title="Edit this search">
                            ✏️ Edit
                        </button>
                        <button class="search-item-btn" onclick="savedSearchModal.duplicateSearch('${search.id}')" 
                                title="Duplicate this search">
                            📋 Copy
                        </button>
                        <button class="search-item-btn danger" onclick="savedSearchModal.deleteSearch('${search.id}')" 
                                title="Delete this search">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                
                <div class="search-item-description">
                    ${this.escapeHtml(search.description)}
                </div>
                
                <div class="search-item-meta">
                    <div class="search-item-tags">
                        ${search.tags ? search.tags.map(tag => `<span class="search-tag ${tag}">${tag}</span>`).join('') : ''}
                    </div>
                    <div class="search-item-stats">
                        Created: ${search.timeAgo} | 
                        Used: ${search.lastExecutedAgo} | 
                        Runs: ${search.executionCount || 0}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the create search form
     */
    renderCreateForm() {
        const currentQuery = this.searchEngine ? this.searchEngine.currentQuery || '' : '';
        const currentFilters = this.searchEngine ? this.searchEngine.currentFilters || {} : {};

        return `
            <div class="saved-search-form">
                <div class="form-group">
                    <label for="searchName">Search Name *</label>
                    <input type="text" id="searchName" class="form-control" 
                           placeholder="Enter a descriptive name for this search"
                           maxlength="100" required>
                    <div class="form-help">Choose a name that will help you remember this search later</div>
                </div>

                <div class="form-group">
                    <label for="searchQuery">Search Query</label>
                    <input type="text" id="searchQuery" class="form-control" 
                           value="${this.escapeHtml(currentQuery)}" readonly>
                    <div class="form-help">This is your current search query</div>
                </div>

                <div class="form-group">
                    <label>Active Filters</label>
                    <div class="current-filters">
                        ${this.renderCurrentFilters(currentFilters)}
                    </div>
                </div>

                <div class="form-group">
                    <label for="searchDescription">Description (Optional)</label>
                    <textarea id="searchDescription" class="form-control" rows="3"
                              placeholder="Add a description to help you remember what this search is for"
                              maxlength="500"></textarea>
                </div>

                <div id="saveSearchStatus" class="status" style="display: none;"></div>
            </div>

            <style>
                .saved-search-form .form-group {
                    margin-bottom: 20px;
                }

                .saved-search-form label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #495057;
                }

                .saved-search-form .form-control {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }

                .saved-search-form .form-control:focus {
                    outline: none;
                    border-color: #007bff;
                    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
                }

                .saved-search-form .form-help {
                    font-size: 12px;
                    color: #6c757d;
                    margin-top: 4px;
                }

                .current-filters {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 10px;
                    min-height: 40px;
                }

                .filter-item {
                    display: inline-block;
                    background: #e7f3ff;
                    color: #0c5460;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    margin: 2px;
                }

                .no-filters {
                    color: #6c757d;
                    font-style: italic;
                    font-size: 14px;
                }
            </style>
        `;
    }

    /**
     * Render the edit search form
     */
    renderEditForm() {
        const search = this.savedSearches.load(this.currentEditingId);
        if (!search) {
            return '<div class="error">Search not found</div>';
        }

        return `
            <div class="saved-search-form">
                <div class="form-group">
                    <label for="editSearchName">Search Name *</label>
                    <input type="text" id="editSearchName" class="form-control" 
                           value="${this.escapeHtml(search.name)}"
                           maxlength="100" required>
                </div>

                <div class="form-group">
                    <label for="editSearchQuery">Search Query</label>
                    <input type="text" id="editSearchQuery" class="form-control" 
                           value="${this.escapeHtml(search.query)}">
                    <div class="form-help">You can modify the search query</div>
                </div>

                <div class="form-group">
                    <label>Current Filters</label>
                    <div class="current-filters">
                        ${this.renderCurrentFilters(search.filters)}
                    </div>
                    <div class="form-help">Filters will be updated when you save</div>
                </div>

                <div class="form-group">
                    <label for="editSearchDescription">Description</label>
                    <textarea id="editSearchDescription" class="form-control" rows="3"
                              maxlength="500">${this.escapeHtml(search.description || '')}</textarea>
                </div>

                <div class="form-group">
                    <div class="search-stats">
                        <strong>Search Statistics:</strong><br>
                        Created: ${search.timeAgo}<br>
                        Last used: ${search.lastExecutedAgo}<br>
                        Total executions: ${search.executionCount || 0}
                    </div>
                </div>

                <div id="editSearchStatus" class="status" style="display: none;"></div>
            </div>

            <style>
                .search-stats {
                    background: #f8f9fa;
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #495057;
                }
            </style>
        `;
    }

    /**
     * Render current filters display
     */
    renderCurrentFilters(filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return '<div class="no-filters">No active filters</div>';
        }

        const filterItems = [];
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== '' && value !== 'all') {
                let displayValue = value;
                if (key === 'dateRange' && typeof value === 'object') {
                    displayValue = `${value.start} to ${value.end}`;
                }
                filterItems.push(`<span class="filter-item">${key}: ${displayValue}</span>`);
            }
        });

        return filterItems.length > 0 ? filterItems.join('') : '<div class="no-filters">No active filters</div>';
    }

    /**
     * Switch to list view
     */
    switchToList() {
        this.currentView = 'list';
        this.currentEditingId = null;
        this.render();
    }

    /**
     * Switch to create view
     */
    switchToCreate() {
        this.currentView = 'create';
        this.render();
    }

    /**
     * Edit a specific search
     */
    editSearch(searchId) {
        this.currentEditingId = searchId;
        this.currentView = 'edit';
        this.render();
    }

    /**
     * Save the current search
     */
    async saveCurrentSearch() {
        const nameInput = document.getElementById('searchName');
        const queryInput = document.getElementById('searchQuery');
        const descriptionInput = document.getElementById('searchDescription');
        
        const name = nameInput.value.trim();
        const query = queryInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!name) {
            this.showFormStatus('saveSearchStatus', 'Please enter a name for the search', 'error');
            nameInput.focus();
            return;
        }

        if (!query) {
            this.showFormStatus('saveSearchStatus', 'No search query to save', 'error');
            return;
        }

        try {
            const currentFilters = this.searchEngine ? this.searchEngine.currentFilters || {} : {};
            const searchId = this.savedSearches.save(name, query, currentFilters);
            
            // Update description if provided
            if (description) {
                this.savedSearches.update(searchId, { description });
            }

            this.showFormStatus('saveSearchStatus', 'Search saved successfully!', 'success');
            
            // Switch back to list after a short delay
            setTimeout(() => {
                this.switchToList();
            }, 1500);

        } catch (error) {
            this.showFormStatus('saveSearchStatus', error.message, 'error');
        }
    }

    /**
     * Update an existing search
     */
    async updateSearch() {
        const nameInput = document.getElementById('editSearchName');
        const queryInput = document.getElementById('editSearchQuery');
        const descriptionInput = document.getElementById('editSearchDescription');
        
        const name = nameInput.value.trim();
        const query = queryInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!name) {
            this.showFormStatus('editSearchStatus', 'Please enter a name for the search', 'error');
            nameInput.focus();
            return;
        }

        if (!query) {
            this.showFormStatus('editSearchStatus', 'Search query cannot be empty', 'error');
            return;
        }

        try {
            const success = this.savedSearches.update(this.currentEditingId, {
                name,
                query,
                description
            });

            if (success) {
                this.showFormStatus('editSearchStatus', 'Search updated successfully!', 'success');
                
                // Switch back to list after a short delay
                setTimeout(() => {
                    this.switchToList();
                }, 1500);
            } else {
                this.showFormStatus('editSearchStatus', 'Failed to update search', 'error');
            }

        } catch (error) {
            this.showFormStatus('editSearchStatus', error.message, 'error');
        }
    }

    /**
     * Execute a saved search
     */
    async executeSearch(searchId) {
        try {
            const search = this.savedSearches.load(searchId);
            if (!search) {
                throw new Error('Search not found');
            }

            // Close the modal
            this.close();

            // Execute the search through callback
            if (this.onSearchExecute) {
                await this.onSearchExecute(search.query, search.filters);
            }

        } catch (error) {
            console.error('Error executing saved search:', error);
            alert('Error executing search: ' + error.message);
        }
    }

    /**
     * Delete a saved search
     */
    async deleteSearch(searchId) {
        const search = this.savedSearches.load(searchId);
        if (!search) {
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete the search "${search.name}"?\n\nThis action cannot be undone.`);
        if (!confirmed) {
            return;
        }

        try {
            const success = this.savedSearches.delete(searchId);
            if (success) {
                // Re-render the list to show the updated state
                this.render();
            } else {
                alert('Failed to delete search');
            }
        } catch (error) {
            console.error('Error deleting search:', error);
            alert('Error deleting search: ' + error.message);
        }
    }

    /**
     * Duplicate a saved search
     */
    async duplicateSearch(searchId) {
        const search = this.savedSearches.load(searchId);
        if (!search) {
            return;
        }

        const newName = prompt(`Enter a name for the duplicated search:`, `${search.name} (Copy)`);
        if (!newName || !newName.trim()) {
            return;
        }

        try {
            const newSearchId = this.savedSearches.duplicate(searchId, newName.trim());
            if (newSearchId) {
                // Re-render the list to show the new search
                this.render();
            } else {
                alert('Failed to duplicate search');
            }
        } catch (error) {
            console.error('Error duplicating search:', error);
            alert('Error duplicating search: ' + error.message);
        }
    }

    /**
     * Share a saved search via URL
     */
    async shareSearch(searchId) {
        try {
            const search = this.savedSearches.load(searchId);
            if (!search) {
                throw new Error('Search not found');
            }

            // Use the global URL sharing instance
            if (window.urlSearchSharing) {
                window.urlSearchSharing.showShareDialog(search.query, search.filters);
            } else {
                // Fallback: generate URL and copy to clipboard
                const urlSharing = new URLSearchSharing();
                const shareUrl = await urlSharing.shareCurrentSearch(search.query, search.filters);
                alert(`Search URL copied to clipboard!\n\nSearch: "${search.name}"\nURL: ${shareUrl}`);
            }

        } catch (error) {
            console.error('Error sharing saved search:', error);
            alert('Error sharing search: ' + error.message);
        }
    }

    /**
     * Filter searches based on search term
     */
    filterSearches(searchTerm) {
        const searches = this.savedSearches.getAll({ search: searchTerm });
        const listContainer = document.getElementById('savedSearchList');
        
        if (listContainer) {
            listContainer.innerHTML = searches.length > 0 ? 
                searches.map(search => this.renderSearchItem(search)).join('') :
                '<div class="no-saved-searches">No searches match your filter</div>';
        }
    }

    /**
     * Sort searches by specified criteria
     */
    sortSearches(sortBy) {
        const searches = this.savedSearches.getAll({ sortBy });
        const listContainer = document.getElementById('savedSearchList');
        
        if (listContainer) {
            listContainer.innerHTML = searches.length > 0 ? 
                searches.map(search => this.renderSearchItem(search)).join('') :
                '<div class="no-saved-searches">No saved searches yet</div>';
        }
    }

    /**
     * Export all saved searches
     */
    exportSearches() {
        try {
            const exportData = this.savedSearches.export();
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `saved-searches-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error exporting searches:', error);
            alert('Error exporting searches: ' + error.message);
        }
    }

    /**
     * Import saved searches from file
     */
    async importSearches(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            const result = this.savedSearches.import(importData, {
                handleConflicts: 'rename'
            });

            let message = `Import completed!\n`;
            message += `Imported: ${result.imported} searches\n`;
            if (result.skipped > 0) {
                message += `Skipped: ${result.skipped} searches\n`;
            }
            if (result.errors.length > 0) {
                message += `Errors: ${result.errors.length}\n`;
                message += result.errors.slice(0, 3).join('\n');
                if (result.errors.length > 3) {
                    message += `\n... and ${result.errors.length - 3} more`;
                }
            }

            alert(message);
            
            // Re-render the list to show imported searches
            this.render();

        } catch (error) {
            console.error('Error importing searches:', error);
            alert('Error importing searches: ' + error.message);
        }
    }

    /**
     * Attach event listeners for the modal
     */
    attachEventListeners() {
        // Handle Enter key in search name input
        const nameInput = document.getElementById('searchName') || document.getElementById('editSearchName');
        if (nameInput) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (this.currentView === 'create') {
                        this.saveCurrentSearch();
                    } else if (this.currentView === 'edit') {
                        this.updateSearch();
                    }
                }
            });
        }

        // Handle filter input changes
        const filterInput = document.getElementById('savedSearchFilter');
        if (filterInput) {
            // Debounce the filter function
            let filterTimeout;
            filterInput.addEventListener('input', (e) => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    this.filterSearches(e.target.value);
                }, 300);
            });
        }
    }

    /**
     * Show status message in form
     */
    showFormStatus(elementId, message, type) {
        const statusElement = document.getElementById(elementId);
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
            statusElement.style.display = 'block';
            
            // Auto-hide success messages
            if (type === 'success') {
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 3000);
            }
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SavedSearchModal;
}