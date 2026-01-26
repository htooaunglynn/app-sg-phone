// Main application JavaScript for DataHub

// API configuration
const API_BASE_URL = window.location.origin;

// State management
let companiesData = [];
let editingCompanyId = null;
let selectedFile = null;
let currentPage = 1;
let pageSize = 50;
let totalRecords = 0;

// Cached DOM elements
let cachedElements = {};

// Helper to get normalized field value
function getField(obj, ...keys) {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
}

// Cache DOM elements
function cacheElements() {
    cachedElements = {
        tableBody: document.getElementById('tableBody'),
        emptyState: document.getElementById('emptyState'),
        searchInput: document.getElementById('searchInput'),
        paginationContainer: document.getElementById('paginationContainer'),
        duplicateCount: document.getElementById('duplicateCount'),
        invalidCount: document.getElementById('invalidCount'),
        totalCount: document.getElementById('totalCount'),
        finishCount: document.getElementById('finishCount')
    };
}

// ============= MODAL MANAGEMENT =============

function openExcelModal() {
    const modal = document.getElementById('excelModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('modal-opening');
        // Remove animation class after animation completes
        setTimeout(() => {
            modal.classList.remove('modal-opening');
        }, 300);
    }
}

async function closeExcelModal() {
    const modal = document.getElementById('excelModal');
    const fileInput = document.getElementById('excelFile');
    const fileName = document.getElementById('fileName');

    if (modal) {
        modal.classList.add('modal-closing');
        // Wait for animation to complete before hiding
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('modal-closing');
        }, 200);
    }
    if (fileInput) fileInput.value = '';
    if (fileName) fileName.textContent = '';

    selectedFile = null;
}

// ============= FILE HANDLING =============

function handleFileUpload(event) {
    selectedFile = event.target.files[0];
    const fileName = document.getElementById('fileName');

    if (selectedFile && fileName) {
        fileName.textContent = `Selected: ${selectedFile.name}`;
    }
}

// Show upload status spinner and message
function showUploadStatus(message) {
    const status = document.getElementById('uploadStatus');
    const statusText = document.getElementById('uploadStatusText');
    const cancelBtn = document.getElementById('excelCancelBtn');
    const closeBtns = document.querySelectorAll('.modal-close-btn');

    if (statusText) statusText.textContent = message || 'Uploading...';
    if (status) status.classList.remove('hidden');
    if (cancelBtn) cancelBtn.disabled = true;
    if (closeBtns) closeBtns.forEach(b => b.disabled = true);
}

function hideUploadStatus() {
    const status = document.getElementById('uploadStatus');
    const statusText = document.getElementById('uploadStatusText');
    const cancelBtn = document.getElementById('excelCancelBtn');
    const closeBtns = document.querySelectorAll('.modal-close-btn');

    if (statusText) statusText.textContent = '';
    if (status) status.classList.add('hidden');
    if (cancelBtn) cancelBtn.disabled = false;
    if (closeBtns) closeBtns.forEach(b => b.disabled = false);
}

async function uploadExcel() {
    if (!selectedFile) {
        alert('Please select a file first');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
        // Find the upload button within the modal
        const modal = document.getElementById('excelModal');
        const uploadButton = document.getElementById('excelUploadBtn') || modal?.querySelector('button[onclick="uploadExcel()"]');

        // Show loading state + spinner
        if (uploadButton) {
            uploadButton.textContent = 'Uploading...';
            uploadButton.disabled = true;
        }
        showUploadStatus('Uploading...');

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();

        // Success
        const lines = [
            `Successfully uploaded!`,
            `Rows processed: ${result.rows || 0}`,
            `New records: ${result.stored || 0}`,
            `Updated records: ${result.updated || 0}`,
            `Validated (SG): ${result.validated || 0}`
        ];

        if (typeof result.insertedDelta === 'number') {
            lines.push(`Inserted into DB (delta): ${result.insertedDelta}`);
        }
        if (typeof result.checkTableCountAfter === 'number') {
            lines.push(`Check table total after: ${result.checkTableCountAfter}`);
        }
        if (result.errors && result.errors.length) {
            lines.push(`(First ${result.errors.length} error(s)):`);
            result.errors.forEach((e, idx) => lines.push(`  ${idx + 1}. ${e}`));
        }

        alert(lines.join('\n'));

        closeExcelModal();

        // Reload data to show the newly uploaded companies and refresh counts
        await loadCompaniesData();
        // Also refresh total validation counts since new data was added
        await updateTotalValidationCounts();

    } catch (error) {
        console.error('Upload error:', error);
        alert(`Upload failed: ${error.message}`);
    } finally {
        // Reset button state
        const modal = document.getElementById('excelModal');
        const uploadButton = document.getElementById('excelUploadBtn') || modal?.querySelector('button[onclick="uploadExcel()"]');
        if (uploadButton) {
            uploadButton.textContent = 'Upload';
            uploadButton.disabled = false;
        }
        hideUploadStatus();
    }
}

// ============= DATA MANAGEMENT =============

async function loadCompaniesData(page = 1) {
    try {
        currentPage = page;
        const offset = (page - 1) * pageSize;

        const response = await fetch(`${API_BASE_URL}/api/companies?limit=${pageSize}&offset=${offset}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch companies');
        }

        const result = await response.json();

        if (result.success && result.data) {
            totalRecords = result.total || 0;

            renderTable(result.data);
            renderPagination(result);
        } else {
            renderTable([]);
            renderPagination({ total: 0, count: 0 });
        }

    } catch (error) {
        console.error('Error loading companies:', error);
        renderTable([]);
        renderPagination({ total: 0, count: 0 });
    }
}

// ============= COUNT MANAGEMENT =============

async function updateTotalValidationCounts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/validation-stats`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const stats = await response.json();
            if (stats.success) {
                // Use cached elements for better performance
                const duplicateCountEl = cachedElements.duplicateCount || document.getElementById('duplicateCount');
                const invalidCountEl = cachedElements.invalidCount || document.getElementById('invalidCount');
                const totalCountEl = cachedElements.totalCount || document.getElementById('totalCount');
                const finishCountEl = cachedElements.finishCount || document.getElementById('finishCount');

                if (duplicateCountEl) duplicateCountEl.textContent = stats.duplicateCount;
                if (invalidCountEl) invalidCountEl.textContent = stats.invalidCount;
                if (totalCountEl) totalCountEl.textContent = stats.totalRecords;
                if (finishCountEl) finishCountEl.textContent = stats.finishCount;
            }
        }
    } catch (error) {
        console.error('Error fetching validation stats:', error);
    }
}

function renderTable(data = []) {
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');

    if (!tableBody || !emptyState) return;

    companiesData = data;

    // Update total validation counts from database instead of per-page counts
    updateTotalValidationCounts();

    if (data.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tableBody.innerHTML = data.map((company, index) => {
        // Determine background color based on validation
        let rowBgStyle = '';
        let phoneStyle = '';

        const status = company.Status !== undefined ? company.Status : company.status;
        const isValidSingapore = company.isValidSingaporePhone;

        if (company.isDuplicate) {
            // Orange background for duplicate phone numbers
            rowBgStyle = 'background-color: var(--validation-duplicate);';
            phoneStyle = 'font-semibold';
        } else if (status === 0 || status === false || isValidSingapore === false) {
            // Red background for invalid Singapore phone numbers
            rowBgStyle = 'background-color: var(--validation-invalid);';
            phoneStyle = 'font-semibold';
        } else {
            // Default background for valid or unknown status
            rowBgStyle = '';
            phoneStyle = '';
        }

        // Prepare phone helpers
        const rawPhone = String(company.Phone || company.phone || '');
        const cleanPhone = rawPhone.replace(/\D+/g, '');
        const formattedPhone = cleanPhone.replace(/(\d{4})(\d{4})/, '$1 $2');
        const encodedFormattedPhone = encodeURIComponent(formattedPhone);
        const encodedCleanPhone = encodeURIComponent(cleanPhone.replace(/(\d{4})(\d{4})/, '$1 $2'));

        // Calculate row number based on pagination
        const rowNumber = ((currentPage - 1) * pageSize) + index + 1;

        // Get field values supporting both cases
        const id = company.Id || company.id || '';
        const companyName = company.CompanyName || company['Company Name'] || company.companyName || company.company_name || '';
        const physicalAddress = company.PhysicalAddress || company['Physical Address'] || company.physicalAddress || company.physical_address || '';
        const email = company.Email || company.email || '';
        const website = company.Website || company.website || '';

        return `
        <tr onclick="openEditModal('${escapeHtml(String(id))}')" style="cursor: pointer; ${rowBgStyle}">
            <td class="whitespace-nowrap">${rowNumber}</td>
            <td class="whitespace-nowrap">${escapeHtml(id)}</td>
            <td class="${phoneStyle} whitespace-nowrap">
                ${escapeHtml(formattedPhone)}
                <div class="phone-search-buttons mt-1 flex gap-2">
                    <a href="https://www.google.com/search?q=%2B65+${encodedFormattedPhone}" target="_blank" rel="noopener noreferrer" class="phone-search-btn plus65 text-xs hover:underline" style="color: var(--accent-blue);">+65 search</a>
                    <a href="https://www.google.com/search?q=%27${encodedCleanPhone}%27" target="_blank" rel="noopener noreferrer" class="phone-search-btn quotes text-xs hover:underline" style="color: var(--accent-blue);">'quotes' search</a>
                </div>
            </td>
            <td class="whitespace-nowrap">${escapeHtml(companyName)}</td>
            <td class="whitespace-nowrap" style="color: var(--text-tertiary);">${escapeHtml(physicalAddress)}</td>
            <td class="break-all whitespace-nowrap">
                ${email ? `<a href="mailto:${escapeHtml(email)}" style="color: var(--accent-blue);">${escapeHtml(email)}</a>` : ''}
            </td>
            <td class="whitespace-nowrap">
                ${website ? `<a href="http://${escapeHtml(website)}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue);">${escapeHtml(website)}</a>` : ''}
            </td>
        </tr>
    `;
    }).join('');
}

function renderPagination(result) {
    const paginationContainer = cachedElements.paginationContainer || document.getElementById('paginationContainer');

    if (!paginationContainer) {
        console.error('Pagination container not found');
        return;
    }

    // Show pagination
    paginationContainer.style.display = 'block';

    const total = result.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    if (total === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startRecord = ((currentPage - 1) * pageSize) + 1;
    const endRecord = Math.min(currentPage * pageSize, total);

    let paginationHTML = `
        <div class="flex items-center justify-between px-4 mb-3">
            <div class="pagination-info text-sm">
                Showing ${startRecord} to ${endRecord} of ${total} results
            </div>
        </div>
        <div class="flex items-center justify-center gap-1 px-4 flex-wrap">
    `;

    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button onclick="loadCompaniesData(${currentPage - 1})"
                class="pagination-btn text-sm font-medium">
                Previous
            </button>
        `;
    }

    // Page numbers (show max 15 pages)
    const maxPages = 15;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }

    // Show first page if not in range
    if (startPage > 1) {
        paginationHTML += `
            <button onclick="loadCompaniesData(1)"
                class="pagination-btn text-sm font-medium">
                1
            </button>
        `;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis px-2">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `
                <button class="pagination-btn pagination-btn-active text-sm font-medium">
                    ${i}
                </button>
            `;
        } else {
            paginationHTML += `
                <button onclick="loadCompaniesData(${i})"
                    class="pagination-btn text-sm font-medium">
                    ${i}
                </button>
            `;
        }
    }

    // Show last page if not in range
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis px-2">...</span>`;
        }
        paginationHTML += `
            <button onclick="loadCompaniesData(${totalPages})"
                class="pagination-btn text-sm font-medium">
                ${totalPages}
            </button>
        `;
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `
            <button onclick="loadCompaniesData(${currentPage + 1})"
                class="pagination-btn text-sm font-medium">
                Next
            </button>
        `;
    }

    paginationHTML += `</div>`;
    paginationContainer.innerHTML = paginationHTML;
}

async function filterTable() {
    const searchInput = cachedElements.searchInput || document.getElementById('searchInput');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        // If search is cleared, reload data with pagination
        await loadCompaniesData(currentPage);
        return;
    }

    try {
        // Search across all records in the database
        const response = await fetch(`${API_BASE_URL}/api/companies/search?q=${encodeURIComponent(searchTerm)}&limit=100&offset=0`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const result = await response.json();

        if (result.success && result.data) {
            // Skip count updates during search for better performance
            renderTable(result.data, true);

            // Hide pagination when showing search results
            const paginationContainer = cachedElements.paginationContainer || document.getElementById('paginationContainer');
            if (paginationContainer) {
                paginationContainer.style.display = 'none';
            }
        } else {
            renderTable([], true);
        }

    } catch (error) {
        console.error('Search error:', error);
        // Fallback to local filtering if search API fails
        const filtered = companiesData.filter(company => {
            const id = String(getField(company, 'Id', 'id')).toLowerCase();
            const companyName = String(getField(company, 'CompanyName', 'Company Name', 'companyName', 'company_name')).toLowerCase();
            const email = String(getField(company, 'Email', 'email')).toLowerCase();
            const phone = String(getField(company, 'Phone', 'phone')).toLowerCase();
            const website = String(getField(company, 'Website', 'website')).toLowerCase();
            const address = String(getField(company, 'PhysicalAddress', 'Physical Address', 'physicalAddress', 'physical_address')).toLowerCase();

            return id.includes(searchTerm) ||
                companyName.includes(searchTerm) ||
                email.includes(searchTerm) ||
                phone.includes(searchTerm) ||
                website.includes(searchTerm) ||
                address.includes(searchTerm);
        });

        renderTable(filtered, true);

        // Hide pagination when filtering
        const paginationContainer = cachedElements.paginationContainer || document.getElementById('paginationContainer');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
    }
}

// ============= EXPORT FUNCTIONALITY =============

async function exportToExcel() {
    try {
        // Show loading state
        const exportButton = event?.target || document.querySelector('button[onclick="exportToExcel()"]');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<span>↓</span> Exporting...';
        }

        // Fetch ALL records for export (not just current page)

        const response = await fetch(`${API_BASE_URL}/api/companies?limit=${totalRecords || 10000}&offset=0`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch all companies');
        }

        const result = await response.json();

        if (!result.success || !result.data || result.data.length === 0) {
            alert('No data to export');
            return;
        }



        // Prepare data for export
        const exportData = result.data.map(company => ({
            Id: company.Id || company.id || '',
            Phone: company.Phone || company.phone || '',
            'Company Name': company.CompanyName || company['Company Name'] || company.companyName || company.company_name || '',
            'Physical Address': company.PhysicalAddress || company['Physical Address'] || company.physicalAddress || company.physical_address || '',
            Email: company.Email || company.email || '',
            Website: company.Website || company.website || ''
        }));

        const exportResponse = await fetch(`${API_BASE_URL}/api/export`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(exportData)
        });

        if (!exportResponse.ok) {
            throw new Error('Export failed');
        }

        // Download the file
        const blob = await exportResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `companies_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);



    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data: ' + error.message);
    } finally {
        // Reset button state
        const exportButton = document.querySelector('button[onclick="exportToExcel()"]');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = '<span>↓</span> Export Excel';
        }
    }
}

async function exportFinishData() {
    try {
        // Show loading state
        const exportButton = event?.target || document.querySelector('button[onclick="exportFinishData()"]');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<span>↓</span> Exporting...';
        }


        const response = await fetch(`${API_BASE_URL}/api/export/finish-data`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Export failed');
        }

        // Check if there's data
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            if (!errorData.success) {
                alert(errorData.error || 'No data to export');
                return;
            }
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finish_data_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);



    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export finish data: ' + error.message);
    } finally {
        // Reset button state
        const exportButton = document.querySelector('button[onclick="exportFinishData()"]');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = '<span>↓</span> Export Finish Data';
        }
    }
}

async function exportNoData() {
    try {
        // Show loading state
        const exportButton = event?.target || document.querySelector('button[onclick="exportNoData()"]');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<span>↓</span> Exporting...';
        }


        const response = await fetch(`${API_BASE_URL}/api/export/no-data`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Export failed');
        }

        // Check if there's data
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            if (!errorData.success) {
                alert(errorData.error || 'No data to export');
                return;
            }
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `no_data_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);



    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export no data: ' + error.message);
    } finally {
        // Reset button state
        const exportButton = document.querySelector('button[onclick="exportNoData()"]');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = '<span>↓</span> Export No Data';
        }
    }
}

async function exportWrongNumber() {
    try {
        // Show loading state
        const exportButton = event?.target || document.querySelector('button[onclick="exportWrongNumber()"]');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<span>↓</span> Exporting...';
        }


        const response = await fetch(`${API_BASE_URL}/api/export/wrong-number`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Export failed');
        }

        // Check if there's data
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            if (!errorData.success) {
                alert(errorData.error || 'No data to export');
                return;
            }
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wrong_number_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);



    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export wrong numbers: ' + error.message);
    } finally {
        // Reset button state
        const exportButton = document.querySelector('button[onclick="exportWrongNumber()"]');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = '<span>↓</span> Export Wrong Number';
        }
    }
}

// ============= UTILITY FUNCTIONS =============

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function copyPhoneNumber() {
    const phoneInput = document.getElementById('editPhone');
    if (!phoneInput) return;

    const rawPhone = phoneInput.value.replace(/\D+/g, '');
    const formattedPhone = rawPhone.replace(/(\d{4})(\d{4})/, '$1 $2');

    navigator.clipboard.writeText(formattedPhone).then(() => {
        // Show feedback
        const copyBtn = event?.target;
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 1500);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy phone number');
    });
}

// Copy the phone number and open two Google search tabs (+65 and quoted search)
function copyAndSearch() {
    const phoneInput = document.getElementById('editPhone');
    const button = event?.target || document.querySelector('button[onclick="copyAndSearch()"]');
    if (!phoneInput) return;

    const rawPhone = phoneInput.value.replace(/\D+/g, '');
    const formattedPhone = rawPhone.replace(/(\d{4})(\d{4})/, '$1 $2');

    // Copy to clipboard first
    navigator.clipboard.writeText(formattedPhone).then(() => {
        // Open searches only if phone has enough digits
        if (rawPhone.length >= 4) {
            // Create proper encoded URLs (using same format as working table links)
            const encodedFormattedPhone = encodeURIComponent(formattedPhone);
            const encodedCleanPhone = encodeURIComponent(formattedPhone);

            const plus65Url = `https://www.google.com/search?q=%2B65+${encodedFormattedPhone}`;
            const quotesUrl = `https://www.google.com/search?q=%27${encodedCleanPhone}%27`;

            // Try to open both windows synchronously (no setTimeout to avoid popup blockers)
            try {
                window.open(plus65Url, '_blank', 'noopener,noreferrer');
                window.open(quotesUrl, '_blank', 'noopener,noreferrer');
            } catch (err) {
                console.error('Failed to open search windows:', err);
                // Fallback: show alert with URLs
                alert(`Phone copied! Open these searches manually:\n\n+65 search: ${plus65Url}\n\nQuoted search: ${quotesUrl}`);
            }

            // Also update the modal's anchor links so the user can see both searches
            const plus65Link = document.getElementById('editPhoneSearchPlus65');
            const quotesLink = document.getElementById('editPhoneSearchQuotes');
            if (plus65Link) plus65Link.href = plus65Url;
            if (quotesLink) quotesLink.href = quotesUrl;
        }

        // Provide feedback on the button
        if (button) {
            const original = button.textContent;
            button.textContent = '✓ Copied & Searched';
            setTimeout(() => { button.textContent = original; }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy phone number:', err);
        // Even if copy fails, try to open searches
        if (rawPhone.length >= 4) {
            const formattedForSearch = rawPhone.replace(/(\d{4})(\d{4})/, '$1 $2');
            const encodedFormattedPhone = encodeURIComponent(formattedForSearch);
            const encodedCleanPhone = encodeURIComponent(formattedForSearch);

            try {
                window.open(`https://www.google.com/search?q=%2B65+${encodedFormattedPhone}`, '_blank');
                window.open(`https://www.google.com/search?q=%27${encodedCleanPhone}%27`, '_blank');
            } catch (e) {
                console.error('Failed to open searches:', e);
            }
        }
        alert('Failed to copy phone number, but searches should still open');
    });
}

function markBothFieldsEmpty(btn) {
    const nameInput = document.getElementById('editCompanyName');
    const addrInput = document.getElementById('editPhysicalAddress');
    if (nameInput) nameInput.value = '---';
    if (addrInput) addrInput.value = '---';

    const button = btn || (typeof event !== 'undefined' ? event.target : null);
    if (button) {
        const original = button.textContent;
        button.textContent = '✓';
        setTimeout(() => { button.textContent = original; }, 1200);
    }
}

// ============= EDIT MODAL FUNCTIONS =============

function openEditModal(id) {
    try {
        editingCompanyId = id;
        const company = companiesData.find(c => String(getField(c, 'Id', 'id')) === String(id));
        const modal = document.getElementById('editModal');
        if (!modal || !company) return;

        const idInput = document.getElementById('editId');
        const phoneInput = document.getElementById('editPhone');
        const nameInput = document.getElementById('editCompanyName');
        const addrInput = document.getElementById('editPhysicalAddress');
        const emailInput = document.getElementById('editEmail');
        const websiteInput = document.getElementById('editWebsite');

        idInput.value = getField(company, 'Id', 'id');
        phoneInput.value = getField(company, 'Phone', 'phone');
        nameInput.value = getField(company, 'CompanyName', 'Company Name', 'companyName', 'company_name');
        addrInput.value = getField(company, 'PhysicalAddress', 'Physical Address', 'physicalAddress', 'physical_address');
        emailInput.value = getField(company, 'Email', 'email');
        websiteInput.value = getField(company, 'Website', 'website');

        // Dynamic phone search links
        const cleanPhone = String(getField(company, 'Phone', 'phone')).replace(/\D+/g, '');
        const formattedPhone = cleanPhone.replace(/(\d{4})(\d{4})/, '$1 $2');
        const encodedFormattedPhone = encodeURIComponent(formattedPhone);
        const encodedCleanPhone = encodeURIComponent(cleanPhone.replace(/(\d{4})(\d{4})/, '$1 $2'));
        const plus65Link = document.getElementById('editPhoneSearchPlus65');
        const quotesLink = document.getElementById('editPhoneSearchQuotes');
        if (plus65Link) {
            plus65Link.href = cleanPhone ? `https://www.google.com/search?q=%2B65+${encodedFormattedPhone}` : '#';
        }
        if (quotesLink) {
            quotesLink.href = cleanPhone ? `https://www.google.com/search?q=%27${encodedCleanPhone}%27` : '#';
        }

        // Update navigation buttons state
        updateNavigationButtons();

        modal.classList.remove('hidden');
        modal.classList.add('modal-opening');
        // Remove animation class after animation completes
        setTimeout(() => {
            modal.classList.remove('modal-opening');
        }, 300);
    } catch (e) {
        console.error('Failed to open edit modal:', e);
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.add('modal-closing');
        // Wait for animation to complete before hiding
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('modal-closing');
        }, 200);
    }
    editingCompanyId = null;
}

function getCurrentRecordIndex() {
    if (!editingCompanyId) return -1;
    return companiesData.findIndex(c => String(getField(c, 'Id', 'id')) === String(editingCompanyId));
}

function updateNavigationButtons() {
    const currentIndex = getCurrentRecordIndex();
    const prevBtn = document.getElementById('prevRecordBtn');
    const nextBtn = document.getElementById('nextRecordBtn');
    const recordPosition = document.getElementById('recordPosition');

    // Update position indicator
    if (recordPosition) {
        recordPosition.textContent = `${currentIndex + 1} / ${companiesData.length}`;
    }

    if (prevBtn) {
        prevBtn.disabled = currentIndex <= 0;
        prevBtn.style.opacity = currentIndex <= 0 ? '0.5' : '1';
        prevBtn.style.cursor = currentIndex <= 0 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = currentIndex >= companiesData.length - 1;
        nextBtn.style.opacity = currentIndex >= companiesData.length - 1 ? '0.5' : '1';
        nextBtn.style.cursor = currentIndex >= companiesData.length - 1 ? 'not-allowed' : 'pointer';
    }
}

function navigatePreviousRecord() {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
        const previousCompany = companiesData[currentIndex - 1];
        const previousId = getField(previousCompany, 'Id', 'id');
        openEditModal(previousId);
    }
}

function navigateNextRecord() {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < companiesData.length - 1) {
        const nextCompany = companiesData[currentIndex + 1];
        const nextId = getField(nextCompany, 'Id', 'id');
        openEditModal(nextId);
    }
}

async function saveEdit() {
    const modal = document.getElementById('editModal');
    if (!modal || !editingCompanyId) return;

    const id = editingCompanyId;
    const companyName = document.getElementById('editCompanyName').value.trim();
    const physicalAddress = document.getElementById('editPhysicalAddress').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const website = document.getElementById('editWebsite').value.trim();

    // Basic validation (optional)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address');
        return;
    }

    // Button loading state
    const saveBtn = modal.querySelector('button[onclick="saveEdit()"]');
    const originalText = saveBtn?.textContent;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
        // Attempt server update if API available
        const response = await fetch(`${API_BASE_URL}/api/companies/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ companyName, physicalAddress, email, website })
        });

        if (!response.ok) {
            // If server not supporting update, we still update locally for UX
            console.warn('Update API not available or failed, applying local update.');
        }

        // Update local data for immediate UX
        const idx = companiesData.findIndex(c => String(getField(c, 'Id', 'id')) === String(id));
        if (idx !== -1) {
            const item = companiesData[idx];
            // Update primary field and maintain existing field name
            const existingNameKey = ['CompanyName', 'Company Name', 'companyName', 'company_name'].find(k => k in item) || 'CompanyName';
            const existingAddrKey = ['PhysicalAddress', 'Physical Address', 'physicalAddress', 'physical_address'].find(k => k in item) || 'PhysicalAddress';
            const existingEmailKey = ['Email', 'email'].find(k => k in item) || 'Email';
            const existingWebsiteKey = ['Website', 'website'].find(k => k in item) || 'Website';

            item[existingNameKey] = companyName;
            item[existingAddrKey] = physicalAddress;
            item[existingEmailKey] = email;
            item[existingWebsiteKey] = website;
        }

        renderTable(companiesData, true);
        closeEditModal();
    } catch (err) {
        console.error('Save edit failed:', err);
        alert('Failed to save changes');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText || 'Save'; }
    }
}

// ============= THEME TOGGLE =============

function toggleTheme() {
    const root = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    const currentTheme = root.getAttribute('data-theme');

    if (currentTheme === 'light') {
        root.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    } else {
        root.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const root = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');

    if (savedTheme === 'light') {
        root.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        root.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// ============= DUPLICATE CHECKING =============

async function checkDuplicates() {
    try {
        // Show loading state
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<span aria-hidden="true">⏳</span> Checking...';
        button.disabled = true;



        // Call the backend API to process duplicates
        const response = await fetch('/api/check-duplicates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            alert(`Duplicate check completed!\n\nResults:\n- ${result.processedCount} duplicate groups processed\n- ${result.updatedCount} records updated with missing data`);

            // Refresh the data to show updates
            await loadCompaniesData(currentPage);
            await updateTotalValidationCounts();
        } else {
            throw new Error(result.error || 'Unknown error occurred');
        }

    } catch (error) {
        console.error('Error checking duplicates:', error);
        alert(`Error checking duplicates: ${error.message}`);
    } finally {
        // Restore button state
        const button = document.querySelector('[onclick="checkDuplicates()"]');
        if (button) {
            button.innerHTML = '<span aria-hidden="true">🔍</span> Check Duplicates';
            button.disabled = false;
        }
    }
}

// ============= INITIALIZATION =============

// ============= CHECK EMPTY FIELDS =============

async function checkEmpty() {
    try {
        if (!companiesData || companiesData.length === 0) {
            alert('No data loaded on this page to check.');
            return;
        }

        let updatedCount = 0;
        let delay = 0;

        // Operate on the currently loaded page of data
        companiesData.forEach((company) => {
            const companyName = company.CompanyName || company['Company Name'] || company.companyName || company.company_name || '';
            const physicalAddress = company.PhysicalAddress || company['Physical Address'] || company.physicalAddress || company.physical_address || '';

            const missingCompany = !String(companyName).trim();
            const missingAddress = !String(physicalAddress).trim();
            const missingEmail = !String(company.Email || company.email || '').trim();
            const missingWebsite = !String(company.Website || company.website || '').trim();

            // Only act when Company, Address, Email and Website are ALL missing
            if (missingCompany && missingAddress && missingEmail && missingWebsite) {
                if (missingCompany) company.CompanyName = '---';
                if (missingAddress) company.PhysicalAddress = '---';
                updatedCount++;

                // Open Google searches for the phone number (staggered)
                const rawPhone = String(company.Phone || company.phone || '');
                const cleanPhone = rawPhone.replace(/\D+/g, '');
                if (cleanPhone.length >= 4) {
                    const formattedPhone = cleanPhone.replace(/(\d{4})(\d{4})/, '$1 $2');
                    const encodedFormattedPhone = encodeURIComponent(formattedPhone);
                    const encodedCleanPhone = encodeURIComponent(cleanPhone.replace(/(\d{4})(\d{4})/, '$1 $2'));

                    setTimeout(() => {
                        // +65 search
                        window.open(`https://www.google.com/search?q=%2B65+${encodedFormattedPhone}`, '_blank');
                        // 'quotes' search
                        window.open(`https://www.google.com/search?q=%27${encodedCleanPhone}%27`, '_blank');
                    }, delay);

                    delay += 500; // stagger to avoid opening too many tabs at once
                }
            }
        });

        // Re-render table to show placeholders
        renderTable(companiesData);

        alert(`Check completed. Updated ${updatedCount} record(s) on this page.`);
    } catch (err) {
        console.error('Error in checkEmpty:', err);
        alert('Error checking empty fields: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme before anything else
    initTheme();

    // Cache DOM elements for better performance
    cacheElements();

    // Load initial data and total validation counts
    await loadCompaniesData();
    await updateTotalValidationCounts();
});

// Close modal on escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeExcelModal();
    }
});

// Close modal when clicking outside
document.addEventListener('click', (event) => {
    const modal = document.getElementById('excelModal');
    if (modal && event.target === modal) {
        closeExcelModal();
    }
});
