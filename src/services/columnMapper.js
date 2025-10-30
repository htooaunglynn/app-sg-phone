/**
 * Column Mapper Component
 * Intelligently maps Excel columns to expected data fields regardless of header names or positions
 */
class ColumnMapper {
    constructor() {
        // Phone number validation pattern
        this.phonePattern = /^[689]\d{7}$/;
        
        // Header patterns for different field types
        this.fieldPatterns = {
            phone: [
                /phone/i, /mobile/i, /contact/i, /number/i, /tel/i, /cell/i,
                /手机/i, /电话/i, /联系/i, /号码/i, /移动/i, /座机/i
            ],
            id: [
                /^id$/i, /identifier/i, /序号/i, /编号/i, /^no$/i, /^num$/i,
                /index/i, /key/i, /code/i, /ref/i, /reference/i
            ],
            name: [
                /name/i, /company/i, /企业/i, /公司/i, /姓名/i, /客户/i,
                /organization/i, /org/i, /business/i, /firm/i, /corp/i
            ],
            email: [
                /email/i, /mail/i, /邮箱/i, /邮件/i, /e-mail/i, /@/
            ],
            address: [
                /address/i, /location/i, /地址/i, /位置/i, /addr/i, /street/i,
                /city/i, /province/i, /state/i, /country/i, /postal/i, /zip/i
            ],
            website: [
                /website/i, /url/i, /site/i, /网站/i, /链接/i, /web/i,
                /http/i, /www/i, /domain/i
            ]
        };
        
        // Minimum confidence threshold for column mapping
        this.minConfidenceThreshold = 0.6;
        
        // Maximum number of rows to sample for pattern analysis
        this.maxSampleRows = 20;
    }

    /**
     * Analyze headers to identify column purposes from header names
     * @param {Array} headerRow - Array of header values
     * @returns {Object} Header analysis result with column mappings
     */
    analyzeHeaders(headerRow) {
        const analysis = {
            phoneColumns: [],
            idColumn: null,
            companyFields: {},
            unmappedColumns: [],
            confidence: 0,
            mappingDetails: {}
        };

        if (!headerRow || !Array.isArray(headerRow) || headerRow.length === 0) {
            return analysis;
        }

        let totalMappedColumns = 0;
        const totalColumns = headerRow.length;

        for (let i = 0; i < headerRow.length; i++) {
            const header = String(headerRow[i] || '').trim();
            
            if (!header) {
                analysis.unmappedColumns.push(i);
                continue;
            }

            const mapping = this.mapHeaderToField(header, i);
            
            if (mapping.fieldType) {
                totalMappedColumns++;
                analysis.mappingDetails[i] = mapping;
                
                switch (mapping.fieldType) {
                    case 'phone':
                        analysis.phoneColumns.push(i);
                        break;
                    case 'id':
                        if (analysis.idColumn === null) {
                            analysis.idColumn = i;
                        }
                        break;
                    case 'name':
                    case 'email':
                    case 'address':
                    case 'website':
                        analysis.companyFields[mapping.fieldType] = i;
                        break;
                }
            } else {
                analysis.unmappedColumns.push(i);
            }
        }

        // Calculate confidence based on mapping success rate
        analysis.confidence = totalColumns > 0 ? totalMappedColumns / totalColumns : 0;

        return analysis;
    }

    /**
     * Map a single header to a field type
     * @param {string} header - Header text
     * @param {number} columnIndex - Column index
     * @returns {Object} Mapping result with fieldType and confidence
     */
    mapHeaderToField(header, columnIndex) {
        const mapping = {
            fieldType: null,
            confidence: 0,
            matchedPattern: null,
            originalHeader: header
        };

        if (!header || typeof header !== 'string') {
            return mapping;
        }

        const normalizedHeader = header.trim().toLowerCase();
        
        // Check each field type pattern
        for (const [fieldType, patterns] of Object.entries(this.fieldPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(normalizedHeader)) {
                    // Calculate confidence based on pattern specificity
                    let confidence = 0.8;
                    
                    // Exact matches get higher confidence
                    if (pattern.source === `^${normalizedHeader}$`) {
                        confidence = 1.0;
                    }
                    // Partial matches get lower confidence
                    else if (normalizedHeader.includes(pattern.source.replace(/[^a-z]/gi, ''))) {
                        confidence = 0.9;
                    }
                    
                    // Phone patterns get priority
                    if (fieldType === 'phone') {
                        confidence += 0.1;
                    }
                    
                    if (confidence > mapping.confidence) {
                        mapping.fieldType = fieldType;
                        mapping.confidence = confidence;
                        mapping.matchedPattern = pattern.source;
                    }
                }
            }
        }

        return mapping;
    }

    /**
     * Detect phone columns using flexible pattern matching on data
     * @param {Array} worksheetData - 2D array of worksheet data
     * @param {number} dataStartRow - Row index where data starts
     * @returns {Object} Phone column detection result
     */
    detectPhoneColumns(worksheetData, dataStartRow = 0) {
        const detection = {
            phoneColumns: [],
            confidence: {},
            patternAnalysis: {},
            sampleSize: 0
        };

        if (!worksheetData || !Array.isArray(worksheetData) || worksheetData.length <= dataStartRow) {
            return detection;
        }

        const sampleRows = worksheetData.slice(dataStartRow, dataStartRow + this.maxSampleRows);
        detection.sampleSize = sampleRows.length;

        if (sampleRows.length === 0) {
            return detection;
        }

        // Determine column count
        const maxColumns = Math.max(...sampleRows.map(row => row ? row.length : 0));
        
        // Analyze each column for phone patterns
        for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
            const columnAnalysis = this.analyzeColumnForPhones(sampleRows, colIndex);
            
            detection.patternAnalysis[colIndex] = columnAnalysis;
            
            if (columnAnalysis.isPhoneColumn) {
                detection.phoneColumns.push(colIndex);
                detection.confidence[colIndex] = columnAnalysis.confidence;
            }
        }

        return detection;
    }

    /**
     * Analyze a single column for phone number patterns
     * @param {Array} sampleRows - Sample rows to analyze
     * @param {number} columnIndex - Column index to analyze
     * @returns {Object} Column analysis result
     */
    analyzeColumnForPhones(sampleRows, columnIndex) {
        const analysis = {
            isPhoneColumn: false,
            confidence: 0,
            phoneCount: 0,
            totalNonEmpty: 0,
            phoneRatio: 0,
            patterns: {
                validSingaporePhones: 0,
                phonelikeNumbers: 0,
                nonNumericValues: 0
            }
        };

        for (const row of sampleRows) {
            if (!row || columnIndex >= row.length) continue;
            
            const cellValue = row[columnIndex];
            if (!cellValue || !String(cellValue).trim()) continue;
            
            analysis.totalNonEmpty++;
            const cellStr = String(cellValue).trim();
            
            // Check if it's a valid Singapore phone number
            const cleanPhone = this.cleanPhoneNumber(cellStr);
            if (cleanPhone && this.validatePhoneNumber(cleanPhone)) {
                analysis.phoneCount++;
                analysis.patterns.validSingaporePhones++;
            }
            // Check if it looks like a phone number (8+ digits)
            else if (/\d{8,}/.test(cellStr)) {
                analysis.patterns.phonelikeNumbers++;
            }
            // Check if it's non-numeric
            else if (!/^\d+$/.test(cellStr.replace(/[\s\-\(\)\+]/g, ''))) {
                analysis.patterns.nonNumericValues++;
            }
        }

        if (analysis.totalNonEmpty > 0) {
            analysis.phoneRatio = analysis.phoneCount / analysis.totalNonEmpty;
            
            // Determine if this is a phone column
            if (analysis.phoneRatio >= 0.7 && analysis.phoneCount >= 2) {
                analysis.isPhoneColumn = true;
                analysis.confidence = Math.min(0.95, analysis.phoneRatio);
            }
            // Lower threshold for columns with some phone-like numbers
            else if (analysis.phoneRatio >= 0.5 && 
                     (analysis.patterns.phonelikeNumbers / analysis.totalNonEmpty) >= 0.3) {
                analysis.isPhoneColumn = true;
                analysis.confidence = 0.6;
            }
        }

        return analysis;
    }

    /**
     * Map company information fields from headers and data patterns
     * @param {Array} headerRow - Header row data
     * @param {Array} sampleData - Sample data rows for pattern analysis
     * @returns {Object} Company field mapping result
     */
    mapCompanyFields(headerRow, sampleData = []) {
        const mapping = {
            name: null,
            email: null,
            address: null,
            website: null,
            confidence: {},
            alternativeColumns: {}
        };

        if (!headerRow || !Array.isArray(headerRow)) {
            return mapping;
        }

        // First pass: header-based mapping
        const headerAnalysis = this.analyzeHeaders(headerRow);
        Object.assign(mapping, headerAnalysis.companyFields);
        
        // Store confidence scores from header analysis
        for (const [fieldType, columnIndex] of Object.entries(mapping)) {
            if (columnIndex !== null && headerAnalysis.mappingDetails[columnIndex]) {
                mapping.confidence[fieldType] = headerAnalysis.mappingDetails[columnIndex].confidence;
            }
        }

        // Second pass: pattern-based mapping for unmapped fields
        if (sampleData && sampleData.length > 0) {
            const patternMapping = this.detectCompanyFieldsByPattern(sampleData, headerAnalysis.unmappedColumns);
            
            // Fill in missing mappings with pattern-based detection
            for (const [fieldType, columnIndex] of Object.entries(patternMapping)) {
                if (mapping[fieldType] === null && columnIndex !== null) {
                    mapping[fieldType] = columnIndex;
                    mapping.confidence[fieldType] = 0.6; // Lower confidence for pattern-based
                }
                // Store as alternative if main mapping exists
                else if (mapping[fieldType] !== null && columnIndex !== null) {
                    if (!mapping.alternativeColumns[fieldType]) {
                        mapping.alternativeColumns[fieldType] = [];
                    }
                    mapping.alternativeColumns[fieldType].push(columnIndex);
                }
            }
        }

        return mapping;
    }

    /**
     * Detect company fields by analyzing data patterns
     * @param {Array} sampleData - Sample data rows
     * @param {Array} candidateColumns - Column indices to analyze
     * @returns {Object} Pattern-based field mapping
     */
    detectCompanyFieldsByPattern(sampleData, candidateColumns = []) {
        const mapping = {
            name: null,
            email: null,
            address: null,
            website: null
        };

        if (!sampleData || sampleData.length === 0) {
            return mapping;
        }

        // If no candidate columns specified, analyze all columns
        if (candidateColumns.length === 0) {
            const maxColumns = Math.max(...sampleData.map(row => row ? row.length : 0));
            candidateColumns = Array.from({ length: maxColumns }, (_, i) => i);
        }

        for (const columnIndex of candidateColumns) {
            const columnData = sampleData
                .map(row => row && row[columnIndex] ? String(row[columnIndex]).trim() : '')
                .filter(value => value);

            if (columnData.length === 0) continue;

            // Analyze column content patterns
            const patterns = this.analyzeColumnPatterns(columnData);
            
            // Map to field types based on patterns
            if (patterns.emailRatio > 0.5 && mapping.email === null) {
                mapping.email = columnIndex;
            }
            else if (patterns.urlRatio > 0.3 && mapping.website === null) {
                mapping.website = columnIndex;
            }
            else if (patterns.addressRatio > 0.4 && mapping.address === null) {
                mapping.address = columnIndex;
            }
            else if (patterns.nameRatio > 0.6 && mapping.name === null) {
                mapping.name = columnIndex;
            }
        }

        return mapping;
    }

    /**
     * Analyze patterns in column data
     * @param {Array} columnData - Array of cell values from a column
     * @returns {Object} Pattern analysis result
     */
    analyzeColumnPatterns(columnData) {
        const patterns = {
            emailRatio: 0,
            urlRatio: 0,
            addressRatio: 0,
            nameRatio: 0,
            phoneRatio: 0
        };

        if (columnData.length === 0) {
            return patterns;
        }

        let emailCount = 0;
        let urlCount = 0;
        let addressCount = 0;
        let nameCount = 0;
        let phoneCount = 0;

        for (const value of columnData) {
            const lowerValue = value.toLowerCase();
            
            // Email pattern
            if (/@.*\./.test(value)) {
                emailCount++;
            }
            // URL pattern
            else if (/^https?:\/\/|www\.|\.com|\.org|\.net/i.test(value)) {
                urlCount++;
            }
            // Address pattern (contains common address keywords)
            else if (/street|road|avenue|drive|lane|blvd|st\.|rd\.|ave\.|dr\.|#\d+|\d+\s+\w+/i.test(value)) {
                addressCount++;
            }
            // Phone pattern
            else if (this.validatePhoneNumber(this.cleanPhoneNumber(value))) {
                phoneCount++;
            }
            // Name pattern (2-4 words, mostly alphabetic)
            else if (/^[a-zA-Z\s\u4e00-\u9fff]{2,50}$/.test(value) && 
                     value.split(/\s+/).length >= 2 && 
                     value.split(/\s+/).length <= 4) {
                nameCount++;
            }
        }

        const total = columnData.length;
        patterns.emailRatio = emailCount / total;
        patterns.urlRatio = urlCount / total;
        patterns.addressRatio = addressCount / total;
        patterns.nameRatio = nameCount / total;
        patterns.phoneRatio = phoneCount / total;

        return patterns;
    }

    /**
     * Handle variable column arrangements by adapting mapping strategies
     * @param {Array} worksheetData - Complete worksheet data
     * @param {Object} initialMapping - Initial column mapping attempt
     * @returns {Object} Adapted column mapping
     */
    handleVariableColumns(worksheetData, initialMapping = {}) {
        const adaptedMapping = {
            phoneColumns: initialMapping.phoneColumns || [],
            idColumn: initialMapping.idColumn || null,
            companyFields: initialMapping.companyFields || {},
            adaptations: [],
            confidence: 0
        };

        if (!worksheetData || worksheetData.length === 0) {
            return adaptedMapping;
        }

        // Find header row
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(5, worksheetData.length); i++) {
            const row = worksheetData[i];
            if (row && row.length > 0) {
                const hasTextHeaders = row.some(cell => {
                    const cellStr = String(cell || '').trim();
                    return cellStr && isNaN(cellStr) && cellStr.length > 1;
                });
                if (hasTextHeaders) {
                    headerRowIndex = i;
                    break;
                }
            }
        }

        const dataStartRow = headerRowIndex + 1;
        
        // Adaptation 1: If no phone columns found, try more flexible detection
        if (adaptedMapping.phoneColumns.length === 0) {
            const flexiblePhoneDetection = this.detectPhoneColumns(worksheetData, dataStartRow);
            if (flexiblePhoneDetection.phoneColumns.length > 0) {
                adaptedMapping.phoneColumns = flexiblePhoneDetection.phoneColumns;
                adaptedMapping.adaptations.push('Used flexible phone number detection');
            }
        }

        // Adaptation 2: If no ID column found, try to identify sequential or unique columns
        if (adaptedMapping.idColumn === null) {
            const idColumn = this.detectIdColumnByPattern(worksheetData, dataStartRow);
            if (idColumn !== null) {
                adaptedMapping.idColumn = idColumn;
                adaptedMapping.adaptations.push('Detected ID column by pattern analysis');
            }
        }

        // Adaptation 3: Handle multiple phone columns in same row
        if (adaptedMapping.phoneColumns.length > 1) {
            adaptedMapping.adaptations.push(`Found ${adaptedMapping.phoneColumns.length} phone columns - will create separate records for each`);
        }

        // Adaptation 4: Try to map company fields if none found
        if (Object.keys(adaptedMapping.companyFields).length === 0 && headerRowIndex >= 0) {
            const sampleData = worksheetData.slice(dataStartRow, dataStartRow + 10);
            const companyMapping = this.mapCompanyFields(worksheetData[headerRowIndex], sampleData);
            
            for (const [fieldType, columnIndex] of Object.entries(companyMapping)) {
                if (columnIndex !== null && !['confidence', 'alternativeColumns'].includes(fieldType)) {
                    adaptedMapping.companyFields[fieldType] = columnIndex;
                }
            }
            
            if (Object.keys(adaptedMapping.companyFields).length > 0) {
                adaptedMapping.adaptations.push('Mapped company fields using pattern analysis');
            }
        }

        // Calculate overall confidence
        let confidenceScore = 0;
        if (adaptedMapping.phoneColumns.length > 0) confidenceScore += 0.5;
        if (adaptedMapping.idColumn !== null) confidenceScore += 0.2;
        if (Object.keys(adaptedMapping.companyFields).length > 0) confidenceScore += 0.2;
        if (adaptedMapping.adaptations.length === 0) confidenceScore += 0.1; // Bonus for no adaptations needed

        adaptedMapping.confidence = Math.min(1.0, confidenceScore);

        return adaptedMapping;
    }

    /**
     * Detect ID column by analyzing data patterns
     * @param {Array} worksheetData - Worksheet data
     * @param {number} dataStartRow - Row where data starts
     * @returns {number|null} Column index of ID column or null
     */
    detectIdColumnByPattern(worksheetData, dataStartRow = 0) {
        if (!worksheetData || worksheetData.length <= dataStartRow) {
            return null;
        }

        const sampleRows = worksheetData.slice(dataStartRow, dataStartRow + this.maxSampleRows);
        const maxColumns = Math.max(...sampleRows.map(row => row ? row.length : 0));

        for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
            const columnValues = sampleRows
                .map(row => row && row[colIndex] ? String(row[colIndex]).trim() : '')
                .filter(value => value);

            if (columnValues.length < 3) continue;

            // Check for uniqueness
            const uniqueValues = new Set(columnValues);
            if (uniqueValues.size !== columnValues.length) continue;

            // Check for sequential pattern or consistent format
            const isSequential = this.isSequentialPattern(columnValues);
            const hasConsistentFormat = this.hasConsistentFormat(columnValues);

            if (isSequential || hasConsistentFormat) {
                return colIndex;
            }
        }

        return null;
    }

    /**
     * Check if values follow a sequential pattern
     * @param {Array} values - Array of values to check
     * @returns {boolean} True if sequential pattern detected
     */
    isSequentialPattern(values) {
        if (values.length < 3) return false;

        // Check for numeric sequence
        const numericValues = values.map(v => parseInt(v)).filter(n => !isNaN(n));
        if (numericValues.length === values.length && numericValues.length >= 3) {
            numericValues.sort((a, b) => a - b);
            let isSequential = true;
            for (let i = 1; i < numericValues.length; i++) {
                if (numericValues[i] - numericValues[i-1] !== 1) {
                    isSequential = false;
                    break;
                }
            }
            if (isSequential) return true;
        }

        return false;
    }

    /**
     * Check if values have consistent format
     * @param {Array} values - Array of values to check
     * @returns {boolean} True if consistent format detected
     */
    hasConsistentFormat(values) {
        if (values.length < 3) return false;

        // Check length consistency
        const lengths = values.map(v => v.length);
        const uniqueLengths = new Set(lengths);
        if (uniqueLengths.size === 1) return true;

        // Check pattern consistency (e.g., all start with same prefix)
        const patterns = values.map(v => v.replace(/\d/g, '#'));
        const uniquePatterns = new Set(patterns);
        if (uniquePatterns.size === 1) return true;

        return false;
    }

    /**
     * Generate detailed column mapping report
     * @param {Object} mappingResult - Result from column mapping operations
     * @param {Array} headerRow - Original header row
     * @returns {Object} Detailed mapping report
     */
    generateMappingReport(mappingResult, headerRow = []) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalColumns: headerRow.length,
                mappedColumns: 0,
                phoneColumns: mappingResult.phoneColumns ? mappingResult.phoneColumns.length : 0,
                hasIdColumn: mappingResult.idColumn !== null,
                companyFieldsMapped: 0,
                overallConfidence: mappingResult.confidence || 0
            },
            columnDetails: {},
            mappingStrategy: {
                headerBased: false,
                patternBased: false,
                adaptations: mappingResult.adaptations || []
            },
            recommendations: []
        };

        // Analyze column details
        for (let i = 0; i < headerRow.length; i++) {
            const header = headerRow[i];
            const detail = {
                index: i,
                header: header,
                mappedTo: null,
                confidence: 0,
                mappingMethod: 'unmapped'
            };

            // Check if this column is mapped
            if (mappingResult.phoneColumns && mappingResult.phoneColumns.includes(i)) {
                detail.mappedTo = 'phone';
                detail.confidence = mappingResult.confidence ? mappingResult.confidence[i] || 0.8 : 0.8;
                detail.mappingMethod = 'pattern_analysis';
                report.summary.mappedColumns++;
            }
            else if (mappingResult.idColumn === i) {
                detail.mappedTo = 'id';
                detail.confidence = 0.8;
                detail.mappingMethod = 'pattern_analysis';
                report.summary.mappedColumns++;
            }
            else if (mappingResult.companyFields) {
                for (const [fieldType, columnIndex] of Object.entries(mappingResult.companyFields)) {
                    if (columnIndex === i) {
                        detail.mappedTo = fieldType;
                        detail.confidence = mappingResult.confidence ? mappingResult.confidence[fieldType] || 0.7 : 0.7;
                        detail.mappingMethod = 'header_analysis';
                        report.summary.mappedColumns++;
                        report.summary.companyFieldsMapped++;
                        break;
                    }
                }
            }

            report.columnDetails[i] = detail;
        }

        // Determine mapping strategy
        report.mappingStrategy.headerBased = headerRow.some(h => h && String(h).trim());
        report.mappingStrategy.patternBased = report.mappingStrategy.adaptations.length > 0;

        // Generate recommendations
        if (report.summary.phoneColumns === 0) {
            report.recommendations.push('No phone columns detected. Please verify that your Excel file contains phone number data.');
        }
        else if (report.summary.phoneColumns > 1) {
            report.recommendations.push(`Multiple phone columns detected (${report.summary.phoneColumns}). Each phone number will create a separate record.`);
        }

        if (!report.summary.hasIdColumn) {
            report.recommendations.push('No ID column detected. Sequential IDs will be generated automatically.');
        }

        if (report.summary.companyFieldsMapped === 0) {
            report.recommendations.push('No company information fields detected. Only phone numbers will be extracted.');
        }

        if (report.summary.overallConfidence < 0.7) {
            report.recommendations.push('Low confidence in column mapping. Please review the results and consider adjusting your Excel file format.');
        }

        return report;
    }

    /**
     * Clean phone number for validation
     * @param {string} phoneNumber - Raw phone number
     * @returns {string|null} Cleaned phone number or null
     */
    cleanPhoneNumber(phoneNumber) {
        if (!phoneNumber) return null;
        
        const cleaned = String(phoneNumber).replace(/\D/g, '');
        
        // Remove Singapore country code if present
        if (cleaned.startsWith('65') && cleaned.length === 10) {
            return cleaned.substring(2);
        }
        
        return cleaned || null;
    }

    /**
     * Validate Singapore phone number format
     * @param {string} phoneNumber - Phone number to validate
     * @returns {boolean} True if valid Singapore phone number
     */
    validatePhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return false;
        }

        const cleanNumber = phoneNumber.replace(/\D/g, '');
        return this.phonePattern.test(cleanNumber);
    }
}

module.exports = ColumnMapper;