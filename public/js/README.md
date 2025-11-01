# Enhanced Search Infrastructure

This directory contains the enhanced search functionality for the Singapore Phone Detect application.

## Components

### Core Classes

1. **SearchEngine** (`searchEngine.js`)
   - Main search orchestration logic
   - Integrates pattern matching, filtering, and indexing
   - Provides performance tracking and result ranking

2. **PatternMatcher** (`patternMatcher.js`)
   - ID pattern parsing and matching
   - Supports wildcards (`SG COM-200*`)
   - Supports ranges (`SG COM-2001 to SG COM-2010`)
   - Handles exact and contains matching

3. **FilterEngine** (`filterEngine.js`)
   - Multi-criteria filtering system
   - Supports filtering by ID, phone, company, address, email, website, status
   - Date range filtering capabilities

4. **IndexManager** (`indexManager.js`)
   - Client-side search indexing for performance
   - N-gram indexing for partial matching
   - Optimized search with caching

### Storage Classes

5. **SearchHistory** (`searchHistory.js`)
   - Manages search history with localStorage persistence
   - Deduplication and size management
   - Search suggestions based on history

6. **SavedSearches** (`savedSearches.js`)
   - Persistent saved searches with localStorage
   - CRUD operations for saved searches
   - Import/export functionality

### Integration

7. **EnhancedSearchSystem** (`enhancedSearchSystem.js`)
   - Main integration class that orchestrates all components
   - Provides unified API for search functionality
   - Global instance management

## Usage

### Basic Usage

```javascript
// Initialize the enhanced search system
const searchSystem = await initializeEnhancedSearch(recordsData);

// Perform a search
const results = await searchSystem.performSearch('SG COM-200*');

// Get suggestions
const suggestions = searchSystem.getSuggestions('SG COM');

// Save a search
const searchId = searchSystem.saveCurrentSearch('My Search');
```

### Pattern Examples

- `SG COM-200*` - Wildcard search for IDs starting with "SG COM-200"
- `SG COM-2001 to SG COM-2010` - Range search from 2001 to 2010
- `SG COM` - Contains search for "SG COM"

### Advanced Filtering

```javascript
const results = await searchSystem.performSearch('company name', {
    status: 'valid',
    companyName: 'Tech',
    dateRange: {
        start: '2024-01-01',
        end: '2024-12-31'
    }
});
```

## Features

- **Pattern Matching**: Wildcard and range searches for ID patterns
- **Multi-criteria Filtering**: Filter by multiple fields simultaneously
- **Performance Optimization**: Client-side indexing and caching
- **Search History**: Automatic history tracking with suggestions
- **Saved Searches**: Persistent saved searches with management
- **Error Handling**: Graceful fallback when components fail
- **Metrics Tracking**: Performance and usage analytics

## Integration with Existing Code

The enhanced search system is designed to work alongside the existing search functionality in `index.html`. It can be gradually integrated by:

1. Including the script files in the HTML
2. Initializing the system with existing record data
3. Replacing or enhancing existing search functions
4. Adding UI components for advanced features

## Performance

- Optimized for datasets up to 10,000+ records
- Client-side indexing reduces search time
- Debounced input handling prevents excessive searches
- Efficient memory management with cache limits

## Browser Compatibility

- Modern browsers with ES6+ support
- localStorage support required for persistence
- Graceful degradation when features are unavailable