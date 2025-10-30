const XLSX = require('xlsx');

/**
 * Worksheet Detector Component
 * Identifies worksheets containing phone data in multi-sheet Excel files
 */
class WorksheetDetector {
    constructor() {
        // Phone number patterns for detection
        this.phonePattern = /^[689]\d{7}$/;
        
        // Header patterns that suggest phone data
        this.phoneHeaderPatterns = [
            /phone/i, /mobile/i, /contact/i, /number/i, /tel/i, /cell/i, 
            /手机/i, /电话/i, /联系/i
        ];
        
        // ID header patterns
        this.idHeaderPatterns = [
            /^id$/i, /identifier/i, /序号/i, /编号/i, /^no$/i, /index/i
        ];
        
        // Minimum confidence score for a worksheet to be considered valid
        this.minConfidenceScore = 0.3;
        
        // Maximum number of rows to sample for pattern detection
        this.maxSampleRows = 20;
    }

    /**
     * Scan all worksheets in a workbook to identify those containing phone data
     * @param {Object} workbook - XLSX workbook object
     * @returns {Array} Array of worksheet analysis results
     */
    scanWorksheets(workbook) {
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            return [];
        }

        const worksheetAnalysis = [];

        for (const sheetName of workbook.SheetNames) {
            try {
                const worksheet = workbook.Sheets[sheetName];
                const score = this.scoreWorksheet(worksheet, sheetName);
                
                worksheetAnalysis.push({
                    name: sheetName,
                    score: score.totalScore,
                    confidence: score.confidence,
                    details: score.details,
                    phoneColumns: score.phoneColumns,
                    idColumn: score.idColumn,
                    hasData: score.hasData,
                    rowCount: score.rowCount,
                    columnCount: score.columnCount
                });
            } catch (error) {
                console.warn(`Error analyzing worksheet '${sheetName}':`, error.message);
                worksheetAnalysis.push({
                    name: sheetName,
                    score: 0,
                    confidence: 'none',
                    details: { error: error.message },
                    phoneColumns: [],
                    idColumn: null,
                    hasData: false,
                    rowCount: 0,
                    columnCount: 0
                });
            }
        }

        return worksheetAnalysis;
    }

    /**
     * Assign confidence score to a worksheet based on phone data likelihood
     * @param {Object} worksheet - XLSX worksheet object
     * @param {string} sheetName - Name of the worksheet
     * @returns {Object} Scoring result with totalScore, confidence, and details
     */
    scoreWorksheet(worksheet, sheetName = 'Unknown') {
        const scoring = {
            totalScore: 0,
            confidence: 'none',
            details: {
                headerScore: 0,
                dataPatternScore: 0,
                structureScore: 0,
                contentScore: 0
            },
            phoneColumns: [],
            idColumn: null,
            hasData: false,
            rowCount: 0,
            columnCount: 0
        };

        if (!worksheet) {
            return scoring;
        }

        try {
            // Convert worksheet to JSON for analysis
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1, 
                defval: '', 
                raw: false 
            });

            if (!jsonData || jsonData.length === 0) {
                return scoring;
            }

            scoring.hasData = true;
            scoring.rowCount = jsonData.length;
            scoring.columnCount = jsonData[0] ? jsonData[0].length : 0;

            // Analyze worksheet structure
            const structureAnalysis = this.analyzeWorksheetStructure(jsonData);
            scoring.details.structureScore = structureAnalysis.score;

            // Analyze headers if present
            if (structureAnalysis.headerRowIndex >= 0) {
                const headerAnalysis = this.analyzeHeaders(jsonData[structureAnalysis.headerRowIndex]);
                scoring.details.headerScore = headerAnalysis.score;
                scoring.phoneColumns = headerAnalysis.phoneColumns;
                scoring.idColumn = headerAnalysis.idColumn;
            }

            // Analyze data patterns
            const dataAnalysis = this.analyzeDataPatterns(jsonData, structureAnalysis.dataStartIndex);
            scoring.details.dataPatternScore = dataAnalysis.score;
            
            // If no phone columns found by header, use pattern detection
            if (scoring.phoneColumns.length === 0) {
                scoring.phoneColumns = dataAnalysis.phoneColumns;
            }
            
            if (scoring.idColumn === null) {
                scoring.idColumn = dataAnalysis.idColumn;
            }

            // Analyze content quality
            const contentAnalysis = this.analyzeContentQuality(jsonData, structureAnalysis.dataStartIndex, scoring.phoneColumns);
            scoring.details.contentScore = contentAnalysis.score;

            // Calculate total score
            scoring.totalScore = (
                scoring.details.headerScore * 0.3 +
                scoring.details.dataPatternScore * 0.4 +
                scoring.details.structureScore * 0.2 +
                scoring.details.contentScore * 0.1
            );

            // Determine confidence level
            scoring.confidence = this.determineConfidenceLevel(scoring.totalScore);

            return scoring;
        } catch (error) {
            console.error(`Error scoring worksheet '${sheetName}':`, error);
            scoring.details.error = error.message;
            return scoring;
        }
    }

    /**
     * Analyze worksheet structure to identify headers and data sections
     * @param {Array} jsonData - Worksheet data as JSON array
     * @returns {Object} Structure analysis result
     */
    analyzeWorksheetStructure(jsonData) {
        const analysis = {
            score: 0,
            headerRowIndex: -1,
            dataStartIndex: 0,
            hasHeaders: false,
            dataRowCount: 0,
            emptyRowCount: 0
        };

        if (!jsonData || jsonData.length === 0) {
            return analysis;
        }

        // Look for header row in first 5 rows
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
                const nonEmptyCount = row.filter(cell => cell && String(cell).trim()).length;
                
                // Check if this looks like a header row
                if (nonEmptyCount >= 2) {
                    const hasTextHeaders = row.some(cell => {
                        const cellStr = String(cell || '').trim();
                        return cellStr && isNaN(cellStr) && cellStr.length > 1;
                    });
                    
                    if (hasTextHeaders) {
                        analysis.headerRowIndex = i;
                        analysis.dataStartIndex = i + 1;
                        analysis.hasHeaders = true;
                        break;
                    }
                }
            }
        }

        // Count data and empty rows
        for (let i = analysis.dataStartIndex; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.some(cell => cell && String(cell).trim())) {
                analysis.dataRowCount++;
            } else {
                analysis.emptyRowCount++;
            }
        }

        // Calculate structure score
        let score = 0;
        if (analysis.hasHeaders) score += 0.3;
        if (analysis.dataRowCount > 0) score += 0.4;
        if (analysis.dataRowCount >= 5) score += 0.2;
        if (analysis.emptyRowCount / jsonData.length < 0.3) score += 0.1; // Not too many empty rows

        analysis.score = Math.min(1.0, score);
        return analysis;
    }

    /**
     * Analyze headers to identify column purposes
     * @param {Array} headerRow - Header row data
     * @returns {Object} Header analysis result
     */
    analyzeHeaders(headerRow) {
        const analysis = {
            score: 0,
            phoneColumns: [],
            idColumn: null,
            companyColumns: {},
            totalColumns: 0
        };

        if (!headerRow || headerRow.length === 0) {
            return analysis;
        }

        analysis.totalColumns = headerRow.length;
        let phoneHeaderCount = 0;
        let idHeaderCount = 0;
        let recognizedHeaders = 0;

        for (let i = 0; i < headerRow.length; i++) {
            const header = String(headerRow[i] || '').trim();
            
            if (!header) continue;

            // Check for phone headers
            if (this.phoneHeaderPatterns.some(pattern => pattern.test(header))) {
                analysis.phoneColumns.push(i);
                phoneHeaderCount++;
                recognizedHeaders++;
            }
            
            // Check for ID headers
            else if (this.idHeaderPatterns.some(pattern => pattern.test(header))) {
                if (analysis.idColumn === null) {
                    analysis.idColumn = i;
                    idHeaderCount++;
                    recognizedHeaders++;
                }
            }
            
            // Check for company-related headers
            else if (/name|company|企业|公司/i.test(header)) {
                analysis.companyColumns.name = i;
                recognizedHeaders++;
            }
            else if (/email|mail|邮箱/i.test(header)) {
                analysis.companyColumns.email = i;
                recognizedHeaders++;
            }
            else if (/address|地址/i.test(header)) {
                analysis.companyColumns.address = i;
                recognizedHeaders++;
            }
        }

        // Calculate header score
        let score = 0;
        if (phoneHeaderCount > 0) score += 0.5;
        if (idHeaderCount > 0) score += 0.2;
        if (recognizedHeaders / analysis.totalColumns > 0.3) score += 0.3;

        analysis.score = Math.min(1.0, score);
        return analysis;
    }

    /**
     * Analyze data patterns to identify phone columns
     * @param {Array} jsonData - Worksheet data
     * @param {number} dataStartIndex - Index where data rows start
     * @returns {Object} Data pattern analysis result
     */
    analyzeDataPatterns(jsonData, dataStartIndex = 0) {
        const analysis = {
            score: 0,
            phoneColumns: [],
            idColumn: null,
            phoneNumberCount: 0,
            totalDataCells: 0
        };

        if (!jsonData || jsonData.length <= dataStartIndex) {
            return analysis;
        }

        const sampleSize = Math.min(this.maxSampleRows, jsonData.length - dataStartIndex);
        const sampleRows = jsonData.slice(dataStartIndex, dataStartIndex + sampleSize);
        
        if (sampleRows.length === 0) {
            return analysis;
        }

        const columnCount = Math.max(...sampleRows.map(row => row ? row.length : 0));
        const columnStats = Array(columnCount).fill(null).map(() => ({
            phoneCount: 0,
            totalNonEmpty: 0,
            uniqueValues: new Set(),
            phoneRatio: 0
        }));

        // Analyze each column
        for (const row of sampleRows) {
            if (!row) continue;
            
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cellValue = row[colIndex];
                if (cellValue && String(cellValue).trim()) {
                    const stats = columnStats[colIndex];
                    stats.totalNonEmpty++;
                    stats.uniqueValues.add(String(cellValue).trim());
                    analysis.totalDataCells++;

                    // Check if this looks like a phone number
                    const cleanPhone = this.cleanPhoneNumber(cellValue);
                    if (cleanPhone && this.validatePhoneNumber(cleanPhone)) {
                        stats.phoneCount++;
                        analysis.phoneNumberCount++;
                    }
                }
            }
        }

        // Calculate phone ratios and identify phone columns
        for (let i = 0; i < columnStats.length; i++) {
            const stats = columnStats[i];
            if (stats.totalNonEmpty > 0) {
                stats.phoneRatio = stats.phoneCount / stats.totalNonEmpty;
                
                // Column is likely a phone column if >50% of values are phone numbers
                if (stats.phoneRatio > 0.5 && stats.phoneCount >= 2) {
                    analysis.phoneColumns.push(i);
                }
                
                // Column is likely an ID column if all values are unique and not phone numbers
                if (stats.uniqueValues.size === stats.totalNonEmpty && 
                    stats.phoneRatio === 0 && 
                    stats.totalNonEmpty >= 3 &&
                    analysis.idColumn === null) {
                    analysis.idColumn = i;
                }
            }
        }

        // Calculate pattern score
        let score = 0;
        if (analysis.phoneColumns.length > 0) score += 0.6;
        if (analysis.phoneNumberCount > 0) score += 0.2;
        if (analysis.phoneNumberCount / Math.max(1, analysis.totalDataCells) > 0.1) score += 0.2;

        analysis.score = Math.min(1.0, score);
        return analysis;
    }

    /**
     * Analyze content quality of the worksheet
     * @param {Array} jsonData - Worksheet data
     * @param {number} dataStartIndex - Index where data rows start
     * @param {Array} phoneColumns - Identified phone columns
     * @returns {Object} Content quality analysis result
     */
    analyzeContentQuality(jsonData, dataStartIndex, phoneColumns) {
        const analysis = {
            score: 0,
            validPhoneCount: 0,
            totalPhoneCount: 0,
            dataCompleteness: 0,
            consistencyScore: 0
        };

        if (!jsonData || jsonData.length <= dataStartIndex || phoneColumns.length === 0) {
            return analysis;
        }

        const dataRows = jsonData.slice(dataStartIndex);
        let totalCells = 0;
        let nonEmptyCells = 0;

        for (const row of dataRows) {
            if (!row) continue;
            
            for (const phoneColIndex of phoneColumns) {
                if (row[phoneColIndex]) {
                    const cellValue = row[phoneColIndex];
                    analysis.totalPhoneCount++;
                    
                    const cleanPhone = this.cleanPhoneNumber(cellValue);
                    if (cleanPhone && this.validatePhoneNumber(cleanPhone)) {
                        analysis.validPhoneCount++;
                    }
                }
            }
            
            // Calculate data completeness
            totalCells += row.length;
            nonEmptyCells += row.filter(cell => cell && String(cell).trim()).length;
        }

        // Calculate metrics
        if (analysis.totalPhoneCount > 0) {
            analysis.consistencyScore = analysis.validPhoneCount / analysis.totalPhoneCount;
        }
        
        if (totalCells > 0) {
            analysis.dataCompleteness = nonEmptyCells / totalCells;
        }

        // Calculate quality score
        let score = 0;
        if (analysis.validPhoneCount > 0) score += 0.4;
        if (analysis.consistencyScore > 0.7) score += 0.3;
        if (analysis.dataCompleteness > 0.5) score += 0.2;
        if (analysis.validPhoneCount >= 5) score += 0.1;

        analysis.score = Math.min(1.0, score);
        return analysis;
    }

    /**
     * Identify phone number columns within a worksheet
     * @param {Object} worksheet - XLSX worksheet object
     * @returns {Array} Array of column indices containing phone numbers
     */
    identifyPhoneColumns(worksheet) {
        if (!worksheet) {
            return [];
        }

        try {
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1, 
                defval: '', 
                raw: false 
            });

            if (!jsonData || jsonData.length === 0) {
                return [];
            }

            const structureAnalysis = this.analyzeWorksheetStructure(jsonData);
            const dataAnalysis = this.analyzeDataPatterns(jsonData, structureAnalysis.dataStartIndex);
            
            // Try header analysis first if headers exist
            if (structureAnalysis.hasHeaders && structureAnalysis.headerRowIndex >= 0) {
                const headerAnalysis = this.analyzeHeaders(jsonData[structureAnalysis.headerRowIndex]);
                if (headerAnalysis.phoneColumns.length > 0) {
                    return headerAnalysis.phoneColumns;
                }
            }

            // Fall back to pattern analysis
            return dataAnalysis.phoneColumns;
        } catch (error) {
            console.error('Error identifying phone columns:', error);
            return [];
        }
    }

    /**
     * Order worksheets by processing priority based on confidence scores
     * @param {Array} worksheetAnalysis - Array of worksheet analysis results
     * @returns {Array} Sorted array of worksheets by priority (highest first)
     */
    prioritizeWorksheets(worksheetAnalysis) {
        if (!Array.isArray(worksheetAnalysis)) {
            return [];
        }

        // Filter out worksheets with very low confidence
        const validWorksheets = worksheetAnalysis.filter(ws => 
            ws.score >= this.minConfidenceScore && ws.hasData
        );

        // Sort by score (descending) and then by phone column count
        return validWorksheets.sort((a, b) => {
            // Primary sort: by total score
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            
            // Secondary sort: by number of phone columns
            const aPhoneColumns = a.phoneColumns ? a.phoneColumns.length : 0;
            const bPhoneColumns = b.phoneColumns ? b.phoneColumns.length : 0;
            if (bPhoneColumns !== aPhoneColumns) {
                return bPhoneColumns - aPhoneColumns;
            }
            
            // Tertiary sort: by row count
            return (b.rowCount || 0) - (a.rowCount || 0);
        });
    }

    /**
     * Determine confidence level based on score
     * @param {number} score - Numerical score (0-1)
     * @returns {string} Confidence level string
     */
    determineConfidenceLevel(score) {
        if (score >= 0.8) return 'high';
        if (score >= 0.6) return 'medium';
        if (score >= 0.3) return 'low';
        return 'none';
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

    /**
     * Get detailed analysis report for all worksheets
     * @param {Array} worksheetAnalysis - Array of worksheet analysis results
     * @returns {Object} Detailed analysis report
     */
    generateAnalysisReport(worksheetAnalysis) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalWorksheets: worksheetAnalysis.length,
                validWorksheets: 0,
                highConfidenceWorksheets: 0,
                mediumConfidenceWorksheets: 0,
                lowConfidenceWorksheets: 0,
                totalPhoneColumns: 0,
                recommendedWorksheets: []
            },
            worksheetDetails: {},
            recommendations: []
        };

        for (const ws of worksheetAnalysis) {
            // Update summary counts
            if (ws.score >= this.minConfidenceScore) {
                report.summary.validWorksheets++;
                
                switch (ws.confidence) {
                    case 'high':
                        report.summary.highConfidenceWorksheets++;
                        break;
                    case 'medium':
                        report.summary.mediumConfidenceWorksheets++;
                        break;
                    case 'low':
                        report.summary.lowConfidenceWorksheets++;
                        break;
                }
            }
            
            report.summary.totalPhoneColumns += (ws.phoneColumns ? ws.phoneColumns.length : 0);
            
            // Add worksheet details
            report.worksheetDetails[ws.name] = {
                score: ws.score,
                confidence: ws.confidence,
                phoneColumns: ws.phoneColumns || [],
                idColumn: ws.idColumn,
                rowCount: ws.rowCount || 0,
                columnCount: ws.columnCount || 0,
                hasData: ws.hasData || false
            };
        }

        // Get prioritized worksheets for recommendations
        const prioritized = this.prioritizeWorksheets(worksheetAnalysis);
        report.summary.recommendedWorksheets = prioritized.slice(0, 3).map(ws => ws.name);

        // Generate recommendations
        if (prioritized.length === 0) {
            report.recommendations.push('No worksheets found with recognizable phone data patterns.');
        } else if (prioritized.length === 1) {
            report.recommendations.push(`Process worksheet '${prioritized[0].name}' which contains the most promising phone data.`);
        } else {
            report.recommendations.push(`Process worksheets in this order: ${prioritized.slice(0, 3).map(ws => `'${ws.name}'`).join(', ')}.`);
        }

        return report;
    }
}

module.exports = WorksheetDetector;