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

// ============= MODAL MANAGEMENT =============

function openExcelModal() {
    const modal = document.getElementById('excelModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

async function closeExcelModal() {
    const modal = document.getElementById('excelModal');
    const fileInput = document.getElementById('excelFile');
    const fileName = document.getElementById('fileName');

    if (modal) modal.classList.add('hidden');
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
        const uploadButton = modal?.querySelector('button[onclick="uploadExcel()"]');

        // Show loading state
        if (uploadButton) {
            uploadButton.textContent = 'Uploading...';
            uploadButton.disabled = true;
        }

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
        const uploadButton = modal?.querySelector('button[onclick="uploadExcel()"]');
        if (uploadButton) {
            uploadButton.textContent = 'Upload';
            uploadButton.disabled = false;
        }
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
                // Update the count displays with total counts from database
                const duplicateCountEl = document.getElementById('duplicateCount');
                const invalidCountEl = document.getElementById('invalidCount');
                const validCountEl = document.getElementById('validCount');
                const totalCountEl = document.getElementById('totalCount');

                if (duplicateCountEl) duplicateCountEl.textContent = stats.duplicateCount;
                if (invalidCountEl) invalidCountEl.textContent = stats.invalidCount;
                if (validCountEl) validCountEl.textContent = stats.validCount;
                if (totalCountEl) totalCountEl.textContent = stats.totalRecords;
            }
        }
    } catch (error) {
        console.error('Error fetching validation stats:', error);
    }
}

function updateValidationCounts(data = []) {
    let duplicateCount = 0;
    let invalidCount = 0;
    let validCount = 0;

    data.forEach(company => {
        const status = company.Status !== undefined ? company.Status : company.status;
        const isValidSingapore = company.isValidSingaporePhone;

        if (company.isDuplicate) {
            duplicateCount++;
        } else if (status === 0 || status === false || isValidSingapore === false) {
            invalidCount++;
        } else if (status === 1 || status === true || isValidSingapore === true) {
            validCount++;
        } else {
            // Default fallback - treat as invalid if status is unclear
            invalidCount++;
        }
    });

    // Update the count displays for current page only (we'll show total counts separately)
    // Note: We'll show total counts from the database instead of per-page counts
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
        let rowBgColor = '';
        let phoneStyle = '';

        // Get Status from either camelCase (Id, Phone, Status) or lowercase (id, phone, status)
        const status = company.Status !== undefined ? company.Status : company.status;
        const isValidSingapore = company.isValidSingaporePhone;

        // Debug logging
        if (index === 0) {
            console.log('Sample company data:', {
                isDuplicate: company.isDuplicate,
                isValidSingaporePhone: isValidSingapore,
                Status: status,
                Phone: company.Phone || company.phone
            });
        }

        // Priority: 1. Duplicates (Orange), 2. Invalid (Red), 3. Valid (White)
        if (company.isDuplicate) {
            // Orange background for duplicate phone numbers (highest priority)
            rowBgColor = 'bg-orange-100';
            phoneStyle = 'bg-orange-200 font-semibold';
        } else if (status === 0 || status === false || isValidSingapore === false) {
            // Red background for invalid Singapore phone numbers (Status = 0 or false)
            rowBgColor = 'bg-red-50';
            phoneStyle = 'bg-red-200 font-semibold';
        } else if (status === 1 || status === true || isValidSingapore === true) {
            // White/normal background for valid Singapore phone numbers (Status = 1 or true)
            rowBgColor = '';
            phoneStyle = '';
        } else {
            // Default fallback - treat as invalid if status is unclear
            rowBgColor = 'bg-red-50';
            phoneStyle = 'bg-red-200 font-semibold';
        }

        // Prepare phone helpers
        const rawPhone = String(company.Phone || company.phone || '');
        const digitsOnly = rawPhone.replace(/\D+/g, '');
        const encodedPhone = encodeURIComponent(digitsOnly);

        // Get field values supporting both cases
        const id = company.Id || company.id || (index + 1);
        const companyName = company.CompanyName || company['Company Name'] || company.companyName || company.company_name || '';
        const physicalAddress = company.PhysicalAddress || company['Physical Address'] || company.physicalAddress || company.physical_address || '';
        const email = company.Email || company.email || '';
        const website = company.Website || company.website || '';

        return `
        <tr class="hover:bg-gray-50 border-b border-gray-100 ${rowBgColor}">
            <td class="px-6 py-4 text-sm font-medium whitespace-nowrap">${escapeHtml(id)}</td>
            <td class="px-6 py-4 text-sm ${phoneStyle} whitespace-nowrap">
                ${escapeHtml(rawPhone)}
                <!-- Search helpers hidden to keep single-line phone cell. Restore if needed. -->
                <!--
                <div class="phone-search-buttons mt-1 flex gap-2">
                    <a href="https://www.google.com/search?q=%2B65${encodedPhone}" target="_blank" rel="noopener noreferrer" class="phone-search-btn plus65 text-xs text-blue-600 hover:underline">+65 search</a>
                    <a href="https://www.google.com/search?q=%27${encodedPhone}%27" target="_blank" rel="noopener noreferrer" class="phone-search-btn quotes text-xs text-blue-600 hover:underline">'quotes' search</a>
                </div>
                -->
            </td>
            <td class="px-6 py-4 text-sm">${escapeHtml(companyName)}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${escapeHtml(physicalAddress)}</td>
            <td class="px-6 py-4 text-sm text-blue-600 break-all">
                ${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ''}
            </td>
            <td class="px-6 py-4 text-sm text-blue-600">
                ${website ? `<a href="http://${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>` : ''}
            </td>
            <td class="px-6 py-4 text-sm">
                <button onclick="openEditModal('${escapeHtml(String(id))}')"
                    class="text-gray-700 hover:text-black font-medium transition">
                    Edit
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

function renderPagination(result) {
    // Check if pagination container exists, if not create it
    let paginationContainer = document.getElementById('paginationContainer');

    if (!paginationContainer) {
        // Create pagination container after the table
        const tableContainer = document.querySelector('.overflow-x-auto');
        if (tableContainer && tableContainer.parentElement) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'paginationContainer';
            paginationContainer.className = 'mt-4 flex items-center justify-between px-4';
            tableContainer.parentElement.insertBefore(paginationContainer, tableContainer.nextSibling);
        } else {
            return; // Can't add pagination if no container found
        }
    }

    // Show pagination
    paginationContainer.style.display = 'flex';

    const total = result.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    if (total === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startRecord = ((currentPage - 1) * pageSize) + 1;
    const endRecord = Math.min(currentPage * pageSize, total);

    let paginationHTML = `
        <div class="text-sm text-gray-600">
            Showing ${startRecord} to ${endRecord} of ${total} results
        </div>
        <div class="flex gap-2">
    `;

    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button onclick="loadCompaniesData(${currentPage - 1})"
                class="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 text-sm font-medium">
                Previous
            </button>
        `;
    }

    // Page numbers (show max 5 pages)
    const maxPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `
                <button class="px-3 py-1 bg-black text-white rounded text-sm font-medium">
                    ${i}
                </button>
            `;
        } else {
            paginationHTML += `
                <button onclick="loadCompaniesData(${i})"
                    class="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 text-sm font-medium">
                    ${i}
                </button>
            `;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `
            <button onclick="loadCompaniesData(${currentPage + 1})"
                class="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 text-sm font-medium">
                Next
            </button>
        `;
    }

    paginationHTML += `</div>`;
    paginationContainer.innerHTML = paginationHTML;
}

function filterTable() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        // If search is cleared, reload data with pagination
        loadCompaniesData(currentPage);
        return;
    }

    // Filter current page data only
    const filtered = companiesData.filter(company => {
        const companyName = (company.CompanyName || company['Company Name'] || company.companyName || company.company_name || '').toLowerCase();
        const email = (company.Email || company.email || '').toLowerCase();
        const phone = (company.Phone || company.phone || '').toLowerCase();
        const website = (company.Website || company.website || '').toLowerCase();
        const address = (company.PhysicalAddress || company['Physical Address'] || company.physicalAddress || company.physical_address || '').toLowerCase();

        return companyName.includes(searchTerm) ||
            email.includes(searchTerm) ||
            phone.includes(searchTerm) ||
            website.includes(searchTerm) ||
            address.includes(searchTerm);
    });

    renderTable(filtered);

    // Hide pagination when filtering
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }
}

// Note: Delete functionality removed per access restrictions. All delete actions have been disabled.

// ============= EXPORT FUNCTIONALITY =============

async function exportToExcel() {
    try {
        // Show loading state
        const exportButton = event?.target || document.querySelector('button[onclick="exportToExcel()"]');
        const originalText = exportButton?.textContent;
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<span>↓</span> Exporting...';
        }

        // Fetch ALL records for export (not just current page)
        console.log('Fetching all records for export...');
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

        console.log(`Exporting ${result.data.length} records...`);

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

        console.log(`Export completed: ${exportData.length} records`);

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

// ============= UTILITY FUNCTIONS =============

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ============= EDIT MODAL FUNCTIONS =============

function openEditModal(id) {
    try {
        editingCompanyId = id;
        const company = companiesData.find(c => String(c.Id || c.id) === String(id));
        const modal = document.getElementById('editModal');
        if (!modal || !company) return;

        const idInput = document.getElementById('editId');
        const phoneInput = document.getElementById('editPhone');
        const nameInput = document.getElementById('editCompanyName');
        const addrInput = document.getElementById('editPhysicalAddress');
        const emailInput = document.getElementById('editEmail');
        const websiteInput = document.getElementById('editWebsite');

        idInput.value = company.Id || company.id || '';
        phoneInput.value = company.Phone || company.phone || '';
        nameInput.value = company.CompanyName || company['Company Name'] || company.companyName || company.company_name || '';
        addrInput.value = company.PhysicalAddress || company['Physical Address'] || company.physicalAddress || company.physical_address || '';
        emailInput.value = company.Email || company.email || '';
        websiteInput.value = company.Website || company.website || '';

        modal.classList.remove('hidden');
    } catch (e) {
        console.error('Failed to open edit modal:', e);
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.add('hidden');
    editingCompanyId = null;
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
        const idx = companiesData.findIndex(c => String(c.Id || c.id) === String(id));
        if (idx !== -1) {
            const item = companiesData[idx];
            // Update all possible column name variations for compatibility
            item.CompanyName = companyName;
            item['Company Name'] = companyName;
            item.companyName = companyName;
            item.company_name = companyName;

            item.PhysicalAddress = physicalAddress;
            item['Physical Address'] = physicalAddress;
            item.physicalAddress = physicalAddress;
            item.physical_address = physicalAddress;

            item.Email = email;
            item.email = email;

            item.Website = website;
            item.website = website;
        }

        renderTable(companiesData);
        closeEditModal();
    } catch (err) {
        console.error('Save edit failed:', err);
        alert('Failed to save changes');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText || 'Save'; }
    }
}

// ============= INITIALIZATION =============

document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data and total validation counts
    await loadCompaniesData();
    await updateTotalValidationCounts();
});

// Close modal on escape key
document.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
        await closeExcelModal();
    }
});

// Close modal when clicking outside
document.addEventListener('click', async (event) => {
    const modal = document.getElementById('excelModal');
    if (modal && event.target === modal) {
        await closeExcelModal();
    }
});
