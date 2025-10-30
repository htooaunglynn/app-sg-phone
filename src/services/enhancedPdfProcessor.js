const pdf = require('pdf-parse');
const databaseManager = require('../utils/database');

class EnhancedPDFProcessor {
    constructor() {
        // Comprehensive Singapore phone number patterns for all formats
        this.phonePatterns = {
            // Basic 8-digit format: 6xxx-xxxx, 8xxx-xxxx, 9xxx-xxxx
            eightDigit: /^[689]\d{7}$/,
            
            // International formats with +65
            internationalPlus: /^\+65[689]\d{7}$/,
            internationalPlusSpaced: /^\+65\s[689]\d{7}$/,
            internationalPlusFormatted: /^\+65[689]\d{3}-\d{4}$/,
            internationalPlusSpaceFormatted: /^\+65\s[689]\d{3}\s\d{4}$/,
            
            // International formats with 65 prefix (no plus)
            internationalPrefix: /^65[689]\d{7}$/,
            internationalPrefixSpaced: /^65\s[689]\d{7}$/,
            internationalPrefixFormatted: /^65[689]\d{3}-\d{4}$/,
            internationalPrefixSpaceFormatted: /^65\s[689]\d{3}\s\d{4}$/,
            
            // Formatted with dash: 6xxx-xxxx, 8xxx-xxxx, 9xxx-xxxx
            formatted: /^[689]\d{3}-\d{4}$/,
            
            // Formatted with space: 6xxx xxxx, 8xxx xxxx, 9xxx xxxx
            spaceFormatted: /^[689]\d{3}\s\d{4}$/,
            
            // Multiple space variations
            multiSpaceFormatted: /^[689]\d{3}\s+\d{4}$/,
            
            // Mixed format with parentheses
            parentheses: /^\(65\)\s?[689]\d{3}-?\d{4}$/,
            parenthesesSpaced: /^\(\+65\)\s[689]\d{3}\s\d{4}$/,
            parenthesesFormatted: /^\(65\)\s[689]\d{3}-\d{4}$/,
            
            // Dot separated format
            dotFormatted: /^[689]\d{3}\.\d{4}$/,
            internationalDotFormatted: /^65\.[689]\d{3}\.\d{4}$/,
            plusDotFormatted: /^\+65\.[689]\d{3}\.\d{4}$/,
            
            // Underscore separated format
            underscoreFormatted: /^[689]\d{3}_\d{4}$/,
            
            // Mixed separators
            mixedSeparators: /^[689]\d{3}[-\s\.\_]\d{4}$/,
            
            // With additional text or formatting
            withText: /.*[689]\d{7}.*/,
            withTextFormatted: /.*[689]\d{3}[-\s\.\_]\d{4}.*/,
            withInternationalText: /.*(?:\+65|65)[689]\d{7}.*/,
            
            // Bracketed formats
            bracketed: /^\[[689]\d{3}-\d{4}\]$/,
            bracketedInternational: /^\[\+65[689]\d{3}-\d{4}\]$/,
            
            // Quoted formats
            quoted: /^"[689]\d{3}-\d{4}"$/,
            quotedInternational: /^"\+65[689]\d{3}-\d{4}"$/,
            
            // With country name
            withCountryName: /^Singapore\s[689]\d{3}-\d{4}$/i,
            withCountryCode: /^SG\s[689]\d{3}-\d{4}$/i,
            
            // Flexible extraction patterns for embedded phone numbers
            embedded: {
                basic: /[689]\d{7}/g,
                formatted: /[689]\d{3}[-\s\.\_]\d{4}/g,
                international: /(?:\+65|65)[689]\d{7}/g,
                internationalFormatted: /(?:\+65|65)[689]\d{3}[-\s\.\_]\d{4}/g,
                withParentheses: /\((?:\+65|65)\)\s?[689]\d{3}[-\s\.\_]?\d{4}/g,
                withBrackets: /\[(?:\+65|65)?[689]\d{3}[-\s\.\_]?\d{4}\]/g,
                withQuotes: /"(?:\+65|65)?[689]\d{3}[-\s\.\_]?\d{4}"/g
            }
        };

        // Advanced table detection patterns
        this.tablePatterns = {
            // Bordered table indicators - enhanced patterns
            bordered: {
                heavy: /[│┃║\|]{2,}|[─┄━═]{3,}|[┌┐└┘├┤┬┴┼]/,
                light: /[\|]{1,}.*[\|]{1,}/,
                ascii: /[+\-=]{3,}|[\|]{1,}/,
                mixed: /[│┃║\|\-─┄━═┌┐└┘├┤┬┴┼+]/
            },
            // Tab-delimited indicators - more flexible
            tabDelimited: {
                multiple: /\t{2,}/,
                single: /\t/,
                mixed: /\t+\s*/
            },
            // Space-separated columns - various spacing patterns
            spaceColumns: {
                wide: /\s{4,}/,
                medium: /\s{3}/,
                narrow: /\s{2}/,
                irregular: /\s+/
            },
            // Column alignment patterns
            alignedColumns: {
                consistent: /^\s*\S+(\s{2,}\S+)+\s*$/,
                leftAligned: /^\S+(\s{2,}\S+)+/,
                rightAligned: /\s+\S+(\s{2,}\S+)*$/,
                centered: /^\s+\S+(\s{2,}\S+)*\s+$/
            },
            // Header detection patterns
            headers: {
                underlined: /^.+\n[-=_]{3,}/m,
                capitalized: /^[A-Z\s]{3,}$/,
                keywords: /\b(ID|PHONE|NUMBER|NAME|COMPANY|EMAIL|ADDRESS|WEBSITE)\b/i,
                numbered: /^\s*\d+[\.\)]\s+/
            },
            // Data type patterns for column identification
            dataTypes: {
                numeric: /^\d+$/,
                alphanumeric: /^[A-Za-z0-9]+$/,
                mixed: /^[A-Za-z0-9\s\-_\.]+$/,
                formatted: /^[A-Za-z0-9\s\-_\.\(\)\+]+$/
            }
        };

        // Enhanced metadata extraction patterns with comprehensive coverage
        this.metadataPatterns = {
            // Company name patterns - various formats
            companyName: {
                standard: /^[A-Z][A-Za-z\s&.,'-]{2,100}$/,
                withLtd: /^[A-Za-z\s&.,'-]+(Ltd|Limited|Inc|Corp|Corporation|Pte|Private|Sdn|Bhd)\.?$/i,
                withNumbers: /^[A-Za-z0-9\s&.,'-]{3,100}$/,
                abbreviated: /^[A-Z]{2,10}(\s[A-Za-z]+)*$/,
                withSymbols: /^[A-Za-z0-9\s&.,'\-()@#]{3,100}$/,
                allCaps: /^[A-Z\s&.,'-]{3,100}$/,
                mixed: /^[A-Za-z][A-Za-z0-9\s&.,'\-()]{2,100}$/
            },
            
            // Email patterns - comprehensive formats
            email: {
                standard: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                embedded: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                withSpaces: /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/,
                withText: /.*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}).*/,
                multiple: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[,;\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
            },
            
            // Website patterns - various URL formats
            website: {
                full: /^https?:\/\/(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?$/,
                withWww: /^www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?$/,
                domain: /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?$/,
                embedded: /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)*/g,
                withText: /.*((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?).*/,
                multiple: /((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)[,;\s]+((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g
            },
            
            // Address patterns - Singapore and international formats
            address: {
                singapore: /\d+[A-Za-z]?\s+[A-Za-z\s]+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Close|Cl|Crescent|Cres|Place|Pl|Walk|Park|Gardens?|Heights?|View|Hill|Rise|Terrace|Ter)\s*#?\d*-?\d*,?\s*(Singapore\s+)?\d{6}?/i,
                international: /\d+[A-Za-z]?\s+[A-Za-z\s,.-]+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Close|Cl|Crescent|Cres|Place|Pl|Walk|Park|Gardens?|Heights?|View|Hill|Rise|Terrace|Ter)/i,
                simple: /\d+[A-Za-z\s,.-]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd)/i,
                withPostal: /.*\d{6}.*Singapore/i,
                block: /Blk\s+\d+[A-Za-z]?\s+[A-Za-z\s]+/i,
                unit: /#\d+-\d+/
            },
            
            // Contact information patterns
            contact: {
                fax: /(?:Fax|F):?\s*[+]?[\d\s\-()]{7,15}/i,
                mobile: /(?:Mobile|Cell|HP|M):?\s*[+]?[\d\s\-()]{7,15}/i,
                office: /(?:Office|Tel|Phone|P):?\s*[+]?[\d\s\-()]{7,15}/i,
                extension: /(?:Ext|Extension):?\s*\d{2,6}/i
            },
            
            // Business information patterns
            business: {
                registration: /(?:Reg|Registration|UEN|Company)\s*(?:No|Number)?:?\s*[A-Z0-9]{8,20}/i,
                gst: /(?:GST|Tax)\s*(?:No|Number)?:?\s*[A-Z0-9]{8,15}/i,
                license: /(?:License|Licence)\s*(?:No|Number)?:?\s*[A-Z0-9]{5,20}/i
            },
            
            // Person name patterns
            personName: {
                full: /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/,
                withTitle: /^(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/i,
                initials: /^[A-Z]\.?\s*[A-Z]\.?\s*[A-Z][a-z]+$/,
                asian: /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/
            },
            
            // Job title patterns
            jobTitle: {
                standard: /^(?:Manager|Director|CEO|CTO|CFO|President|Vice President|Senior|Junior|Assistant|Executive|Officer|Coordinator|Specialist|Analyst|Engineer|Developer|Designer|Consultant|Advisor)/i,
                withDepartment: /^[A-Za-z\s]+(Manager|Director|Head|Lead|Chief|Officer)$/i
            },
            
            // Department patterns
            department: {
                common: /^(?:Sales|Marketing|Finance|HR|Human Resources|IT|Information Technology|Operations|Customer Service|Support|Administration|Legal|Procurement|R&D|Research|Development)$/i,
                withDept: /^[A-Za-z\s]+(Department|Dept|Division|Unit|Team)$/i
            }
        };

        // Error message templates
        this.errorMessages = {
            INVALID_PDF: 'The uploaded file is not a valid PDF or is corrupted. Please check your file and try again.',
            EMPTY_PDF: 'The PDF file appears to be empty or contains no readable text. Please ensure your PDF has content.',
            NO_VALID_RECORDS: 'No valid phone records were found in the PDF. The system supports various table formats and phone number formats.',
            COMPLEX_STRUCTURE: 'The PDF has a complex structure that requires manual review. Please ensure phone numbers are clearly separated in columns.',
            PROCESSING_ERROR: 'An error occurred while processing the PDF. Please try again or contact support if the problem persists.',
            MULTI_PAGE_ERROR: 'Error processing multi-page PDF. Some pages may not have been processed correctly.',
            SECURITY_VIOLATION: 'The PDF file failed security validation. Please ensure the file is safe and try again.',
            FILE_TOO_LARGE: 'The PDF file is too large for processing. Please reduce the file size or split into smaller files.',
            MALICIOUS_CONTENT: 'The PDF file contains potentially malicious content and cannot be processed.'
        };

        // Performance and security settings
        this.performanceSettings = {
            maxFileSize: parseInt(process.env.MAX_PDF_SIZE) || 50 * 1024 * 1024, // 50MB
            streamingThreshold: parseInt(process.env.STREAMING_THRESHOLD) || 5 * 1024 * 1024, // 5MB
            maxProcessingTime: parseInt(process.env.MAX_PROCESSING_TIME) || 300000, // 5 minutes
            memoryLimit: parseInt(process.env.MEMORY_LIMIT) || 512 * 1024 * 1024, // 512MB
            chunkSize: parseInt(process.env.CHUNK_SIZE) || 1024 * 1024, // 1MB chunks
            enableSecurityScanning: process.env.ENABLE_SECURITY_SCANNING !== 'false'
        };
    }

    /**
     * Enhanced data extraction with complex table structure detection and streaming support
     * @param {Buffer} pdfBuffer - The PDF file buffer
     * @param {string} sourceFile - Original filename for metadata
     * @param {Object} options - Processing options including streaming settings
     * @returns {Promise<Object>} Object with records array and detailed extraction report
     */
    async extractData(pdfBuffer, sourceFile = null, options = {}) {
        try {
            if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
                throw new Error(this.errorMessages.INVALID_PDF);
            }

            if (!this.isPDFBuffer(pdfBuffer)) {
                throw new Error(this.errorMessages.INVALID_PDF);
            }

            // Enhanced security validation
            await this.performSecurityValidation(pdfBuffer, options);

            // Use streaming for large files (>5MB)
            const useStreaming = pdfBuffer.length > (options.streamingThreshold || 5 * 1024 * 1024);
            
            let data;
            if (useStreaming) {
                data = await this.extractDataWithStreaming(pdfBuffer, options);
            } else {
                data = await pdf(pdfBuffer);
            }
            
            const textContent = data.text;

            if (!textContent || textContent.trim().length === 0) {
                throw new Error(this.errorMessages.EMPTY_PDF);
            }

            // Detect table structure
            const tableStructure = this.detectTableStructure(textContent);
            
            // Extract records based on detected structure
            const phoneRecords = await this.parseComplexTable(textContent, tableStructure);

            if (phoneRecords.length === 0) {
                throw new Error(this.errorMessages.NO_VALID_RECORDS);
            }

            // Add source file metadata
            const enhancedRecords = phoneRecords.map(record => ({
                ...record,
                sourceFile: sourceFile,
                extractedAt: new Date().toISOString()
            }));

            // Generate comprehensive extraction report
            const extractionReport = this.generateComprehensiveReport(
                textContent, 
                tableStructure, 
                phoneRecords, 
                sourceFile
            );

            return {
                records: enhancedRecords,
                report: extractionReport
            };

        } catch (error) {
            console.error('Enhanced PDF processing error:', error);
            throw this.handleProcessingError(error);
        }
    }

    /**
     * Advanced table structure detection with pattern recognition
     * @param {string} textContent - Raw text from PDF
     * @returns {Object} Comprehensive table structure information
     */
    detectTableStructure(textContent) {
        const lines = textContent.split('\n').filter(line => line.trim().length > 0);
        
        const structure = {
            type: 'unknown',
            subType: null,
            columnCount: 0,
            hasHeaders: false,
            headerLines: [],
            phoneColumnIndex: -1,
            idColumnIndex: -1,
            metadataColumns: [],
            separatorPattern: null,
            confidence: 0,
            irregularSpacing: false,
            mergedCells: false,
            mixedDataTypes: false,
            alignment: 'unknown'
        };

        // Analyze more lines for better detection
        const sampleSize = Math.min(20, lines.length);
        const sampleLines = lines.slice(0, sampleSize);
        const dataLines = this.filterDataLines(sampleLines);
        
        // Multi-pass detection for better accuracy
        this.detectBorderedTables(sampleLines, structure);
        this.detectTabDelimitedTables(sampleLines, structure);
        this.detectSpaceSeparatedTables(sampleLines, structure);
        this.detectAlignedTables(sampleLines, structure);
        
        // Advanced pattern detection
        this.detectIrregularSpacing(dataLines, structure);
        this.detectMergedCells(sampleLines, structure);
        this.detectMixedDataTypes(dataLines, structure);
        this.detectColumnAlignment(dataLines, structure);
        
        // Analyze column structure with enhanced detection
        this.analyzeAdvancedColumnStructure(dataLines, structure);
        
        // Enhanced header detection
        structure.hasHeaders = this.detectAdvancedHeaders(sampleLines, structure);
        
        // Finalize structure type based on confidence scores
        this.finalizeTableType(structure);
        
        return structure;
    }

    /**
     * Filter lines to get actual data lines (skip separators, empty lines)
     * @param {Array} lines - Array of lines
     * @returns {Array} Filtered data lines
     */
    filterDataLines(lines) {
        return lines.filter(line => {
            const trimmed = line.trim();
            if (trimmed.length === 0) return false;
            if (this.isHeaderOrSeparator(line)) return false;
            return true;
        });
    }

    /**
     * Detect bordered table patterns
     * @param {Array} sampleLines - Sample lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectBorderedTables(sampleLines, structure) {
        let borderedScore = 0;
        let subType = null;
        
        for (const line of sampleLines) {
            if (this.tablePatterns.bordered.heavy.test(line)) {
                borderedScore += 0.4;
                subType = 'heavy-bordered';
            } else if (this.tablePatterns.bordered.light.test(line)) {
                borderedScore += 0.3;
                subType = subType || 'light-bordered';
            } else if (this.tablePatterns.bordered.ascii.test(line)) {
                borderedScore += 0.2;
                subType = subType || 'ascii-bordered';
            } else if (this.tablePatterns.bordered.mixed.test(line)) {
                borderedScore += 0.1;
                subType = subType || 'mixed-bordered';
            }
        }
        
        if (borderedScore > structure.confidence) {
            structure.type = 'bordered';
            structure.subType = subType;
            structure.confidence = borderedScore;
            structure.separatorPattern = this.getBorderedSeparatorPattern(subType);
        }
    }

    /**
     * Detect tab-delimited table patterns
     * @param {Array} sampleLines - Sample lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectTabDelimitedTables(sampleLines, structure) {
        let tabScore = 0;
        let subType = null;
        
        for (const line of sampleLines) {
            if (this.tablePatterns.tabDelimited.multiple.test(line)) {
                tabScore += 0.5;
                subType = 'multiple-tabs';
            } else if (this.tablePatterns.tabDelimited.single.test(line)) {
                tabScore += 0.3;
                subType = subType || 'single-tabs';
            } else if (this.tablePatterns.tabDelimited.mixed.test(line)) {
                tabScore += 0.2;
                subType = subType || 'mixed-tabs';
            }
        }
        
        if (tabScore > structure.confidence) {
            structure.type = 'tab-delimited';
            structure.subType = subType;
            structure.confidence = tabScore;
            structure.separatorPattern = /\t+/;
        }
    }

    /**
     * Detect space-separated table patterns
     * @param {Array} sampleLines - Sample lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectSpaceSeparatedTables(sampleLines, structure) {
        let spaceScore = 0;
        let subType = null;
        let separatorPattern = null;
        
        for (const line of sampleLines) {
            if (this.tablePatterns.spaceColumns.wide.test(line)) {
                spaceScore += 0.4;
                subType = 'wide-spaced';
                separatorPattern = /\s{4,}/;
            } else if (this.tablePatterns.spaceColumns.medium.test(line)) {
                spaceScore += 0.3;
                subType = subType || 'medium-spaced';
                separatorPattern = separatorPattern || /\s{3}/;
            } else if (this.tablePatterns.spaceColumns.narrow.test(line)) {
                spaceScore += 0.2;
                subType = subType || 'narrow-spaced';
                separatorPattern = separatorPattern || /\s{2}/;
            }
        }
        
        if (spaceScore > structure.confidence) {
            structure.type = 'space-separated';
            structure.subType = subType;
            structure.confidence = spaceScore;
            structure.separatorPattern = separatorPattern || /\s{2,}/;
        }
    }

    /**
     * Detect aligned table patterns
     * @param {Array} sampleLines - Sample lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectAlignedTables(sampleLines, structure) {
        let alignScore = 0;
        let alignment = 'unknown';
        
        for (const line of sampleLines) {
            if (this.tablePatterns.alignedColumns.consistent.test(line)) {
                alignScore += 0.3;
                alignment = 'consistent';
            } else if (this.tablePatterns.alignedColumns.leftAligned.test(line)) {
                alignScore += 0.2;
                alignment = alignment === 'unknown' ? 'left' : alignment;
            } else if (this.tablePatterns.alignedColumns.rightAligned.test(line)) {
                alignScore += 0.2;
                alignment = alignment === 'unknown' ? 'right' : alignment;
            } else if (this.tablePatterns.alignedColumns.centered.test(line)) {
                alignScore += 0.2;
                alignment = alignment === 'unknown' ? 'centered' : alignment;
            }
        }
        
        if (alignScore > structure.confidence) {
            structure.type = 'aligned';
            structure.alignment = alignment;
            structure.confidence = alignScore;
            structure.separatorPattern = /\s{2,}/;
        }
    }

    /**
     * Detect irregular spacing patterns
     * @param {Array} dataLines - Data lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectIrregularSpacing(dataLines, structure) {
        if (dataLines.length < 2) return;
        
        const spacingPatterns = [];
        
        for (const line of dataLines) {
            const spaces = line.match(/\s+/g);
            if (spaces) {
                spacingPatterns.push(spaces.map(s => s.length));
            }
        }
        
        // Check for consistency in spacing
        if (spacingPatterns.length > 1) {
            const firstPattern = spacingPatterns[0];
            const isConsistent = spacingPatterns.every(pattern => 
                pattern.length === firstPattern.length &&
                pattern.every((space, index) => Math.abs(space - firstPattern[index]) <= 1)
            );
            
            structure.irregularSpacing = !isConsistent;
        }
    }

    /**
     * Detect merged cells or spanning content
     * @param {Array} sampleLines - Sample lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectMergedCells(sampleLines, structure) {
        // Look for patterns that suggest merged cells
        const mergedCellPatterns = [
            /^\s*[A-Za-z\s]+\s{10,}/, // Long text followed by large space
            /\s{10,}[A-Za-z\s]+\s*$/, // Large space followed by text
            /^[^|]*\|[^|]{20,}\|/,    // Very wide content between separators
        ];
        
        structure.mergedCells = sampleLines.some(line => 
            mergedCellPatterns.some(pattern => pattern.test(line))
        );
    }

    /**
     * Detect mixed data types in columns
     * @param {Array} dataLines - Data lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectMixedDataTypes(dataLines, structure) {
        if (dataLines.length === 0) return;
        
        const columnTypes = new Map();
        
        for (const line of dataLines) {
            const columns = this.splitLineIntoColumns(line, structure.separatorPattern);
            
            columns.forEach((column, index) => {
                if (!columnTypes.has(index)) {
                    columnTypes.set(index, new Set());
                }
                
                const types = columnTypes.get(index);
                const trimmed = column.trim();
                
                if (this.tablePatterns.dataTypes.numeric.test(trimmed)) {
                    types.add('numeric');
                } else if (this.tablePatterns.dataTypes.alphanumeric.test(trimmed)) {
                    types.add('alphanumeric');
                } else if (this.tablePatterns.dataTypes.mixed.test(trimmed)) {
                    types.add('mixed');
                } else {
                    types.add('formatted');
                }
            });
        }
        
        // Check if any column has mixed types
        structure.mixedDataTypes = Array.from(columnTypes.values()).some(types => types.size > 1);
    }

    /**
     * Detect column alignment patterns
     * @param {Array} dataLines - Data lines to analyze
     * @param {Object} structure - Structure object to update
     */
    detectColumnAlignment(dataLines, structure) {
        if (dataLines.length < 3) return;
        
        const alignmentScores = {
            left: 0,
            right: 0,
            center: 0,
            mixed: 0
        };
        
        for (const line of dataLines) {
            if (this.tablePatterns.alignedColumns.leftAligned.test(line)) {
                alignmentScores.left++;
            } else if (this.tablePatterns.alignedColumns.rightAligned.test(line)) {
                alignmentScores.right++;
            } else if (this.tablePatterns.alignedColumns.centered.test(line)) {
                alignmentScores.center++;
            } else {
                alignmentScores.mixed++;
            }
        }
        
        const maxScore = Math.max(...Object.values(alignmentScores));
        structure.alignment = Object.keys(alignmentScores).find(key => 
            alignmentScores[key] === maxScore
        );
    }

    /**
     * Get separator pattern for bordered tables
     * @param {string} subType - Bordered table subtype
     * @returns {RegExp} Separator pattern
     */
    getBorderedSeparatorPattern(subType) {
        switch (subType) {
            case 'heavy-bordered':
                return /[│┃║\|]+/;
            case 'light-bordered':
                return /\|+/;
            case 'ascii-bordered':
                return /[\|+]+/;
            default:
                return /[\|│┃║+]+/;
        }
    }

    /**
     * Finalize table type based on confidence and patterns
     * @param {Object} structure - Structure object to finalize
     */
    finalizeTableType(structure) {
        // If confidence is still low, try to infer from other patterns
        if (structure.confidence < 0.3) {
            if (structure.irregularSpacing && structure.mixedDataTypes) {
                structure.type = 'complex-mixed';
                structure.confidence = 0.4;
            } else if (structure.mergedCells) {
                structure.type = 'merged-cells';
                structure.confidence = 0.3;
            } else {
                structure.type = 'unstructured';
                structure.confidence = 0.1;
            }
        }
    }

    /**
     * Advanced column structure analysis with enhanced pattern recognition
     * @param {Array} dataLines - Filtered data lines from PDF
     * @param {Object} structure - Structure object to update
     */
    analyzeAdvancedColumnStructure(dataLines, structure) {
        const columnAnalysis = [];
        const columnWidths = [];
        const columnPositions = [];
        
        for (const line of dataLines) {
            const columns = this.splitLineIntoColumns(line, structure.separatorPattern);
            
            if (columns.length > structure.columnCount) {
                structure.columnCount = columns.length;
            }
            
            // Track column positions for alignment analysis
            this.trackColumnPositions(line, columns, columnPositions);
            
            // Analyze each column for content type with enhanced detection
            columns.forEach((column, index) => {
                if (!columnAnalysis[index]) {
                    columnAnalysis[index] = {
                        phoneCount: 0,
                        idCount: 0,
                        textCount: 0,
                        emailCount: 0,
                        websiteCount: 0,
                        addressCount: 0,
                        numericCount: 0,
                        dateCount: 0,
                        emptyCount: 0,
                        samples: [],
                        avgLength: 0,
                        maxLength: 0,
                        minLength: Infinity
                    };
                }
                
                const analysis = columnAnalysis[index];
                const trimmed = column.trim();
                
                // Track column statistics
                analysis.samples.push(trimmed);
                analysis.maxLength = Math.max(analysis.maxLength, trimmed.length);
                analysis.minLength = Math.min(analysis.minLength, trimmed.length);
                
                if (trimmed.length === 0) {
                    analysis.emptyCount++;
                } else if (this.isPhoneNumber(trimmed)) {
                    analysis.phoneCount++;
                } else if (this.isLikelyId(trimmed)) {
                    analysis.idCount++;
                } else if (this.testAnyEmailPattern(trimmed)) {
                    analysis.emailCount++;
                } else if (this.testAnyWebsitePattern(trimmed)) {
                    analysis.websiteCount++;
                } else if (this.testAnyAddressPattern(trimmed)) {
                    analysis.addressCount++;
                } else if (this.isNumeric(trimmed)) {
                    analysis.numericCount++;
                } else if (this.isDate(trimmed)) {
                    analysis.dateCount++;
                } else if (this.testAnyCompanyPattern(trimmed)) {
                    analysis.textCount++;
                }
            });
        }
        
        // Calculate average lengths
        columnAnalysis.forEach(analysis => {
            if (analysis.samples.length > 0) {
                analysis.avgLength = analysis.samples.reduce((sum, sample) => 
                    sum + sample.length, 0) / analysis.samples.length;
            }
        });
        
        // Determine column roles with enhanced logic
        this.determineColumnRoles(columnAnalysis, structure);
        
        // Detect column relationships and dependencies
        this.detectColumnRelationships(columnAnalysis, structure);
    }

    /**
     * Track column positions for alignment analysis
     * @param {string} line - Original line
     * @param {Array} columns - Split columns
     * @param {Array} columnPositions - Array to track positions
     */
    trackColumnPositions(line, columns, columnPositions) {
        let currentPos = 0;
        
        columns.forEach((column, index) => {
            const startPos = line.indexOf(column, currentPos);
            if (startPos !== -1) {
                if (!columnPositions[index]) {
                    columnPositions[index] = [];
                }
                columnPositions[index].push(startPos);
                currentPos = startPos + column.length;
            }
        });
    }

    /**
     * Determine column roles based on enhanced analysis
     * @param {Array} columnAnalysis - Analysis data for each column
     * @param {Object} structure - Structure object to update
     */
    determineColumnRoles(columnAnalysis, structure) {
        columnAnalysis.forEach((analysis, index) => {
            const totalSamples = analysis.samples.length;
            const phoneRatio = analysis.phoneCount / totalSamples;
            const idRatio = analysis.idCount / totalSamples;
            
            // Phone column detection with confidence scoring
            if (phoneRatio > 0.7 && structure.phoneColumnIndex === -1) {
                structure.phoneColumnIndex = index;
                structure.confidence += 0.5;
            } else if (phoneRatio > 0.3 && structure.phoneColumnIndex === -1) {
                structure.phoneColumnIndex = index;
                structure.confidence += 0.3;
            }
            
            // ID column detection
            if (idRatio > 0.7 && structure.idColumnIndex === -1) {
                structure.idColumnIndex = index;
                structure.confidence += 0.3;
            } else if (idRatio > 0.3 && structure.idColumnIndex === -1 && 
                      analysis.avgLength < 20 && analysis.numericCount > 0) {
                structure.idColumnIndex = index;
                structure.confidence += 0.2;
            }
            
            // Metadata column detection
            if (analysis.emailCount > 0 || analysis.websiteCount > 0 || 
                analysis.addressCount > 0 || analysis.textCount > 0) {
                structure.metadataColumns.push({
                    index: index,
                    type: this.determineAdvancedMetadataType(analysis),
                    confidence: this.calculateMetadataConfidence(analysis, totalSamples),
                    avgLength: analysis.avgLength,
                    samples: analysis.samples.slice(0, 3) // Keep first 3 samples for reference
                });
            }
        });
    }

    /**
     * Detect relationships between columns
     * @param {Array} columnAnalysis - Analysis data for each column
     * @param {Object} structure - Structure object to update
     */
    detectColumnRelationships(columnAnalysis, structure) {
        structure.columnRelationships = [];
        
        // Look for related columns (e.g., first name + last name, area code + phone)
        for (let i = 0; i < columnAnalysis.length - 1; i++) {
            for (let j = i + 1; j < columnAnalysis.length; j++) {
                const relationship = this.analyzeColumnRelationship(
                    columnAnalysis[i], 
                    columnAnalysis[j], 
                    i, 
                    j
                );
                
                if (relationship) {
                    structure.columnRelationships.push(relationship);
                }
            }
        }
    }

    /**
     * Analyze relationship between two columns
     * @param {Object} col1 - First column analysis
     * @param {Object} col2 - Second column analysis
     * @param {number} index1 - First column index
     * @param {number} index2 - Second column index
     * @returns {Object|null} Relationship object or null
     */
    analyzeColumnRelationship(col1, col2, index1, index2) {
        // Check for name splitting (first name + last name)
        if (this.areNameColumns(col1, col2)) {
            return {
                type: 'name-split',
                columns: [index1, index2],
                confidence: 0.8
            };
        }
        
        // Check for phone number splitting (area code + number)
        if (this.arePhoneComponents(col1, col2)) {
            return {
                type: 'phone-split',
                columns: [index1, index2],
                confidence: 0.9
            };
        }
        
        // Check for address components
        if (this.areAddressComponents(col1, col2)) {
            return {
                type: 'address-split',
                columns: [index1, index2],
                confidence: 0.7
            };
        }
        
        return null;
    }

    /**
     * Check if columns contain name components
     * @param {Object} col1 - First column analysis
     * @param {Object} col2 - Second column analysis
     * @returns {boolean} True if columns appear to be name components
     */
    areNameColumns(col1, col2) {
        const namePattern = /^[A-Z][a-z]+$/;
        const col1Names = col1.samples.filter(s => namePattern.test(s)).length;
        const col2Names = col2.samples.filter(s => namePattern.test(s)).length;
        
        return (col1Names / col1.samples.length > 0.5) && 
               (col2Names / col2.samples.length > 0.5) &&
               col1.avgLength < 15 && col2.avgLength < 15;
    }

    /**
     * Check if columns contain phone number components
     * @param {Object} col1 - First column analysis
     * @param {Object} col2 - Second column analysis
     * @returns {boolean} True if columns appear to be phone components
     */
    arePhoneComponents(col1, col2) {
        const areaCodePattern = /^[689]\d{0,2}$/;
        const phonePartPattern = /^\d{4,7}$/;
        
        const col1AreaCodes = col1.samples.filter(s => areaCodePattern.test(s)).length;
        const col2PhoneParts = col2.samples.filter(s => phonePartPattern.test(s)).length;
        
        return (col1AreaCodes / col1.samples.length > 0.7) && 
               (col2PhoneParts / col2.samples.length > 0.7);
    }

    /**
     * Check if columns contain address components
     * @param {Object} col1 - First column analysis
     * @param {Object} col2 - Second column analysis
     * @returns {boolean} True if columns appear to be address components
     */
    areAddressComponents(col1, col2) {
        const streetPattern = /\d+[A-Za-z\s]+/;
        const cityPattern = /^[A-Z][a-z\s]+$/;
        
        const col1Streets = col1.samples.filter(s => streetPattern.test(s)).length;
        const col2Cities = col2.samples.filter(s => cityPattern.test(s)).length;
        
        return (col1Streets / col1.samples.length > 0.5) && 
               (col2Cities / col2.samples.length > 0.5);
    }

    /**
     * Check if text is numeric
     * @param {string} text - Text to check
     * @returns {boolean} True if text is numeric
     */
    isNumeric(text) {
        return /^\d+(\.\d+)?$/.test(text.trim());
    }

    /**
     * Check if text is a date
     * @param {string} text - Text to check
     * @returns {boolean} True if text appears to be a date
     */
    isDate(text) {
        const datePatterns = [
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
            /^\d{1,2}-\d{1,2}-\d{2,4}$/,
            /^\d{4}-\d{1,2}-\d{1,2}$/,
            /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i
        ];
        
        return datePatterns.some(pattern => pattern.test(text.trim()));
    }

    /**
     * Determine advanced metadata type with more precision
     * @param {Object} analysis - Column analysis data
     * @returns {string} Metadata type
     */
    determineAdvancedMetadataType(analysis) {
        const total = analysis.samples.length;
        
        if (analysis.emailCount / total > 0.5) return 'email';
        if (analysis.websiteCount / total > 0.5) return 'website';
        if (analysis.addressCount / total > 0.5) return 'address';
        if (analysis.textCount / total > 0.5) return 'company';
        if (analysis.dateCount / total > 0.5) return 'date';
        if (analysis.numericCount / total > 0.5) return 'numeric';
        
        // Mixed content analysis
        if (analysis.textCount > 0 && analysis.numericCount > 0) return 'mixed';
        if (analysis.avgLength > 50) return 'description';
        if (analysis.avgLength < 10 && analysis.textCount > 0) return 'code';
        
        return 'additional';
    }

    /**
     * Calculate confidence score for metadata column
     * @param {Object} analysis - Column analysis data
     * @param {number} totalSamples - Total number of samples
     * @returns {number} Confidence score between 0 and 1
     */
    calculateMetadataConfidence(analysis, totalSamples) {
        const nonEmptyRatio = (totalSamples - analysis.emptyCount) / totalSamples;
        const contentRatio = Math.max(
            analysis.emailCount,
            analysis.websiteCount,
            analysis.addressCount,
            analysis.textCount,
            analysis.dateCount,
            analysis.numericCount
        ) / totalSamples;
        
        return (nonEmptyRatio * 0.3) + (contentRatio * 0.7);
    }

    /**
     * Parse complex table structure and extract phone records
     * @param {string} textContent - Raw text from PDF
     * @param {Object} tableStructure - Detected table structure
     * @returns {Promise<Array>} Array of phone records with metadata
     */
    async parseComplexTable(textContent, tableStructure) {
        const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const phoneRecords = [];
        let recordId = 1;

        // Skip headers if detected
        const startIndex = tableStructure.hasHeaders ? this.findDataStartIndex(lines) : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            
            if (this.isHeaderOrSeparator(line)) continue;
            
            const columns = this.splitLineIntoColumns(line, tableStructure.separatorPattern);
            
            if (columns.length < 2) continue;
            
            // Extract phone numbers from the line
            const phoneNumbers = this.extractPhoneNumbers(columns, tableStructure);
            
            for (const phoneData of phoneNumbers) {
                const record = {
                    id: phoneData.id || this.generateUniqueId(recordId++),
                    phoneNumber: phoneData.phoneNumber,
                    extractedMetadata: this.extractMetadata(columns, tableStructure, phoneData.phoneIndex)
                };
                
                phoneRecords.push(record);
            }
        }

        return phoneRecords;
    }

    /**
     * Enhanced phone number extraction from columns with intelligent detection
     * @param {Array} columns - Array of column values
     * @param {Object} tableStructure - Table structure information
     * @returns {Array} Array of phone data objects with enhanced metadata
     */
    extractPhoneNumbers(columns, tableStructure) {
        const phoneNumbers = [];
        
        // If we know the phone column index, check there first
        if (tableStructure.phoneColumnIndex >= 0 && tableStructure.phoneColumnIndex < columns.length) {
            const phoneColumn = columns[tableStructure.phoneColumnIndex];
            const extractedPhones = this.handleMultiplePhoneNumbers(phoneColumn);
            
            extractedPhones.forEach(phoneData => {
                const idColumn = tableStructure.idColumnIndex >= 0 ? 
                    columns[tableStructure.idColumnIndex] : null;
                
                phoneNumbers.push({
                    phoneNumber: phoneData.normalized,
                    originalText: phoneData.original,
                    id: idColumn,
                    phoneIndex: tableStructure.phoneColumnIndex,
                    extractionMethod: phoneData.extractionMethod,
                    confidence: phoneData.confidence,
                    partIndex: phoneData.partIndex,
                    totalParts: phoneData.totalParts
                });
            });
        } else {
            // Search all columns for phone numbers with enhanced detection
            columns.forEach((column, index) => {
                const extractedPhones = this.handleMultiplePhoneNumbers(column);
                
                extractedPhones.forEach(phoneData => {
                    // Try to find corresponding ID in adjacent columns
                    const idColumn = this.findBestIdColumn(columns, index, tableStructure);
                    
                    phoneNumbers.push({
                        phoneNumber: phoneData.normalized,
                        originalText: phoneData.original,
                        id: idColumn,
                        phoneIndex: index,
                        extractionMethod: phoneData.extractionMethod,
                        confidence: phoneData.confidence,
                        partIndex: phoneData.partIndex,
                        totalParts: phoneData.totalParts
                    });
                });
            });
        }
        
        // Handle phone number components that might be split across columns
        const combinedPhones = this.handleSplitPhoneNumbers(columns, tableStructure);
        phoneNumbers.push(...combinedPhones);
        
        // Remove duplicates and sort by confidence
        return this.deduplicateAndSortPhoneNumbers(phoneNumbers);
    }

    /**
     * Find the best ID column for a phone number
     * @param {Array} columns - All columns in the row
     * @param {number} phoneIndex - Index of the phone column
     * @param {Object} tableStructure - Table structure information
     * @returns {string|null} Best ID value or null
     */
    findBestIdColumn(columns, phoneIndex, tableStructure) {
        // First check known ID column
        if (tableStructure.idColumnIndex >= 0 && tableStructure.idColumnIndex < columns.length) {
            const idValue = columns[tableStructure.idColumnIndex];
            if (this.isLikelyId(idValue)) {
                return idValue;
            }
        }
        
        // Check adjacent columns
        const adjacentIndices = [phoneIndex - 1, phoneIndex + 1];
        
        for (const index of adjacentIndices) {
            if (index >= 0 && index < columns.length) {
                const value = columns[index];
                if (this.isLikelyId(value)) {
                    return value;
                }
            }
        }
        
        // Check all columns for ID-like values
        for (let i = 0; i < columns.length; i++) {
            if (i !== phoneIndex) {
                const value = columns[i];
                if (this.isLikelyId(value) && this.isStrongIdCandidate(value)) {
                    return value;
                }
            }
        }
        
        return null;
    }

    /**
     * Check if a value is a strong ID candidate
     * @param {string} value - Value to check
     * @returns {boolean} True if strong ID candidate
     */
    isStrongIdCandidate(value) {
        if (!value || typeof value !== 'string') return false;
        
        const trimmed = value.trim();
        
        // Strong ID patterns
        const strongPatterns = [
            /^\d{1,10}$/, // Pure numeric
            /^[A-Z]\d+$/, // Letter followed by numbers
            /^[A-Z]{2,3}\d+$/, // 2-3 letters followed by numbers
            /^\d+[A-Z]$/, // Numbers followed by letter
            /^[A-Z0-9]{3,15}$/ // Mixed alphanumeric, reasonable length
        ];
        
        return strongPatterns.some(pattern => pattern.test(trimmed));
    }

    /**
     * Handle phone numbers that might be split across columns
     * @param {Array} columns - All columns in the row
     * @param {Object} tableStructure - Table structure information
     * @returns {Array} Array of combined phone numbers
     */
    handleSplitPhoneNumbers(columns, tableStructure) {
        const combinedPhones = [];
        
        // Look for phone number components in column relationships
        if (tableStructure.columnRelationships) {
            tableStructure.columnRelationships.forEach(relationship => {
                if (relationship.type === 'phone-split') {
                    const [col1Index, col2Index] = relationship.columns;
                    if (col1Index < columns.length && col2Index < columns.length) {
                        const part1 = columns[col1Index].trim();
                        const part2 = columns[col2Index].trim();
                        
                        // Try to combine the parts
                        const combined = this.combinePhoneParts(part1, part2);
                        if (combined) {
                            combinedPhones.push({
                                phoneNumber: combined.normalized,
                                originalText: `${part1} ${part2}`,
                                id: this.findBestIdColumn(columns, col1Index, tableStructure),
                                phoneIndex: col1Index,
                                extractionMethod: 'split-column-combination',
                                confidence: relationship.confidence,
                                combinedFrom: [col1Index, col2Index]
                            });
                        }
                    }
                }
            });
        }
        
        // Also try adjacent column combinations
        for (let i = 0; i < columns.length - 1; i++) {
            const part1 = columns[i].trim();
            const part2 = columns[i + 1].trim();
            
            if (this.couldBePhoneParts(part1, part2)) {
                const combined = this.combinePhoneParts(part1, part2);
                if (combined) {
                    combinedPhones.push({
                        phoneNumber: combined.normalized,
                        originalText: `${part1} ${part2}`,
                        id: this.findBestIdColumn(columns, i, tableStructure),
                        phoneIndex: i,
                        extractionMethod: 'adjacent-column-combination',
                        confidence: 0.6,
                        combinedFrom: [i, i + 1]
                    });
                }
            }
        }
        
        return combinedPhones;
    }

    /**
     * Check if two parts could be phone number components
     * @param {string} part1 - First part
     * @param {string} part2 - Second part
     * @returns {boolean} True if could be phone parts
     */
    couldBePhoneParts(part1, part2) {
        if (!part1 || !part2) return false;
        
        const digits1 = part1.replace(/\D/g, '');
        const digits2 = part2.replace(/\D/g, '');
        
        // Check for area code + number pattern
        if (digits1.length >= 1 && digits1.length <= 4 && 
            digits2.length >= 4 && digits2.length <= 7) {
            return /^[689]/.test(digits1) || /^[689]/.test(digits2);
        }
        
        return false;
    }

    /**
     * Combine phone number parts
     * @param {string} part1 - First part
     * @param {string} part2 - Second part
     * @returns {Object|null} Combined phone object or null
     */
    combinePhoneParts(part1, part2) {
        if (!part1 || !part2) return null;
        
        const digits1 = part1.replace(/\D/g, '');
        const digits2 = part2.replace(/\D/g, '');
        const combined = digits1 + digits2;
        
        if (this.isValidSingaporePhoneNumber(combined)) {
            return {
                normalized: this.normalizePhoneNumber(combined),
                original: `${part1} ${part2}`
            };
        }
        
        return null;
    }

    /**
     * Remove duplicate phone numbers and sort by confidence
     * @param {Array} phoneNumbers - Array of phone number objects
     * @returns {Array} Deduplicated and sorted array
     */
    deduplicateAndSortPhoneNumbers(phoneNumbers) {
        const uniquePhones = new Map();
        
        phoneNumbers.forEach(phone => {
            const key = phone.phoneNumber;
            if (!uniquePhones.has(key) || 
                uniquePhones.get(key).confidence < phone.confidence) {
                uniquePhones.set(key, phone);
            }
        });
        
        return Array.from(uniquePhones.values())
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }

    /**
     * Enhanced metadata extraction with intelligent mapping and relationship detection
     * @param {Array} columns - Array of column values
     * @param {Object} tableStructure - Table structure information
     * @param {number} phoneIndex - Index of phone number column
     * @returns {Object} Comprehensive extracted metadata with confidence scores
     */
    extractMetadata(columns, tableStructure, phoneIndex) {
        const metadata = {
            companyName: null,
            email: null,
            website: null,
            address: null,
            contactPerson: null,
            jobTitle: null,
            department: null,
            fax: null,
            businessRegistration: null,
            additionalContacts: [],
            additionalData: [],
            extractionReport: {
                totalColumns: columns.length,
                processedColumns: 0,
                confidenceScores: {},
                extractionMethods: {},
                relationships: []
            }
        };

        // Extract from known metadata columns with enhanced processing
        this.extractFromKnownColumns(columns, tableStructure, metadata);
        
        // Extract from all columns with intelligent pattern matching
        this.extractFromAllColumns(columns, tableStructure, phoneIndex, metadata);
        
        // Apply relationship-based extraction
        this.applyRelationshipExtraction(columns, tableStructure, phoneIndex, metadata);
        
        // Post-process and validate extracted metadata
        this.postProcessMetadata(metadata);
        
        // Generate extraction report
        this.generateExtractionReport(columns, metadata);
        
        return metadata;
    }

    /**
     * Extract metadata from known metadata columns
     * @param {Array} columns - Array of column values
     * @param {Object} tableStructure - Table structure information
     * @param {Object} metadata - Metadata object to populate
     */
    extractFromKnownColumns(columns, tableStructure, metadata) {
        tableStructure.metadataColumns.forEach(metaCol => {
            if (metaCol.index < columns.length) {
                const value = columns[metaCol.index].trim();
                if (value) {
                    const extractedData = this.extractFromSingleColumn(value, metaCol.type);
                    this.mergeExtractedData(metadata, extractedData, metaCol.type, metaCol.confidence || 0.8);
                    
                    metadata.extractionReport.extractionMethods[metaCol.index] = 'known-column';
                    metadata.extractionReport.confidenceScores[metaCol.index] = metaCol.confidence || 0.8;
                }
            }
        });
    }

    /**
     * Extract metadata from all columns using pattern matching
     * @param {Array} columns - Array of column values
     * @param {Object} tableStructure - Table structure information
     * @param {number} phoneIndex - Index of phone number column
     * @param {Object} metadata - Metadata object to populate
     */
    extractFromAllColumns(columns, tableStructure, phoneIndex, metadata) {
        columns.forEach((column, index) => {
            if (index !== phoneIndex && 
                index !== tableStructure.idColumnIndex && 
                !this.isColumnProcessed(index, tableStructure)) {
                
                const value = column.trim();
                if (value && !this.isPhoneNumber(value) && !this.isLikelyId(value)) {
                    const extractedData = this.extractFromSingleColumn(value);
                    const confidence = this.calculateExtractionConfidence(value, extractedData);
                    
                    this.mergeExtractedData(metadata, extractedData, 'pattern-match', confidence);
                    
                    metadata.extractionReport.extractionMethods[index] = 'pattern-matching';
                    metadata.extractionReport.confidenceScores[index] = confidence;
                    metadata.extractionReport.processedColumns++;
                }
            }
        });
    }

    /**
     * Extract data from a single column value
     * @param {string} value - Column value to extract from
     * @param {string} expectedType - Expected data type (optional)
     * @returns {Object} Extracted data with types and confidence
     */
    extractFromSingleColumn(value, expectedType = null) {
        const extracted = {
            companyName: [],
            email: [],
            website: [],
            address: [],
            contactPerson: [],
            jobTitle: [],
            department: [],
            fax: [],
            businessRegistration: [],
            additionalContacts: [],
            additionalData: []
        };

        // If expected type is specified, focus on that first
        if (expectedType) {
            const specificExtraction = this.extractSpecificType(value, expectedType);
            if (specificExtraction) {
                // Map expectedType to correct field name
                const fieldMapping = {
                    'company': 'companyName',
                    'email': 'email',
                    'website': 'website',
                    'address': 'address'
                };
                const fieldName = fieldMapping[expectedType] || expectedType;
                if (extracted[fieldName]) {
                    extracted[fieldName].push(specificExtraction);
                }
                return extracted;
            }
        }

        // Company name extraction
        const companyMatches = this.extractCompanyNames(value);
        extracted.companyName.push(...companyMatches);

        // Email extraction
        const emailMatches = this.extractEmails(value);
        extracted.email.push(...emailMatches);

        // Website extraction
        const websiteMatches = this.extractWebsites(value);
        extracted.website.push(...websiteMatches);

        // Address extraction
        const addressMatches = this.extractAddresses(value);
        extracted.address.push(...addressMatches);

        // Contact person extraction
        const personMatches = this.extractPersonNames(value);
        extracted.contactPerson.push(...personMatches);

        // Job title extraction
        const titleMatches = this.extractJobTitles(value);
        extracted.jobTitle.push(...titleMatches);

        // Department extraction
        const deptMatches = this.extractDepartments(value);
        extracted.department.push(...deptMatches);

        // Contact information extraction
        const contactMatches = this.extractContactInfo(value);
        extracted.fax.push(...contactMatches.fax);
        extracted.additionalContacts.push(...contactMatches.other);

        // Business registration extraction
        const businessMatches = this.extractBusinessInfo(value);
        extracted.businessRegistration.push(...businessMatches);

        // If nothing specific was found, add as additional data
        if (this.isEmptyExtraction(extracted)) {
            extracted.additionalData.push({
                value: value,
                confidence: 0.3,
                type: 'unclassified'
            });
        }

        return extracted;
    }

    /**
     * Extract company names using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of company name matches
     */
    extractCompanyNames(value) {
        const matches = [];
        
        Object.entries(this.metadataPatterns.companyName).forEach(([patternName, pattern]) => {
            if (pattern.test(value)) {
                matches.push({
                    value: value,
                    confidence: this.getPatternConfidence('companyName', patternName),
                    pattern: patternName
                });
            }
        });

        return matches;
    }

    /**
     * Extract email addresses using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of email matches
     */
    extractEmails(value) {
        const matches = [];
        
        // Try embedded extraction for multiple emails
        const embeddedMatches = value.match(this.metadataPatterns.email.embedded);
        if (embeddedMatches) {
            embeddedMatches.forEach(email => {
                matches.push({
                    value: email,
                    confidence: 0.9,
                    pattern: 'embedded'
                });
            });
        }

        // Try other patterns if no embedded matches
        if (matches.length === 0) {
            Object.entries(this.metadataPatterns.email).forEach(([patternName, pattern]) => {
                if (patternName !== 'embedded' && pattern.test(value)) {
                    const match = value.match(pattern);
                    if (match) {
                        matches.push({
                            value: match[1] || match[0],
                            confidence: this.getPatternConfidence('email', patternName),
                            pattern: patternName
                        });
                    }
                }
            });
        }

        return matches;
    }

    /**
     * Extract websites using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of website matches
     */
    extractWebsites(value) {
        const matches = [];
        
        // Try embedded extraction for multiple websites
        const embeddedMatches = value.match(this.metadataPatterns.website.embedded);
        if (embeddedMatches) {
            embeddedMatches.forEach(website => {
                matches.push({
                    value: this.normalizeWebsite(website),
                    confidence: 0.8,
                    pattern: 'embedded'
                });
            });
        }

        // Try other patterns if no embedded matches
        if (matches.length === 0) {
            Object.entries(this.metadataPatterns.website).forEach(([patternName, pattern]) => {
                if (patternName !== 'embedded' && pattern.test(value)) {
                    matches.push({
                        value: this.normalizeWebsite(value),
                        confidence: this.getPatternConfidence('website', patternName),
                        pattern: patternName
                    });
                }
            });
        }

        return matches;
    }

    /**
     * Extract addresses using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of address matches
     */
    extractAddresses(value) {
        const matches = [];
        
        Object.entries(this.metadataPatterns.address).forEach(([patternName, pattern]) => {
            if (pattern.test(value)) {
                matches.push({
                    value: value,
                    confidence: this.getPatternConfidence('address', patternName),
                    pattern: patternName,
                    type: patternName
                });
            }
        });

        return matches;
    }

    /**
     * Extract person names using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of person name matches
     */
    extractPersonNames(value) {
        const matches = [];
        
        Object.entries(this.metadataPatterns.personName).forEach(([patternName, pattern]) => {
            if (pattern.test(value)) {
                matches.push({
                    value: value,
                    confidence: this.getPatternConfidence('personName', patternName),
                    pattern: patternName
                });
            }
        });

        return matches;
    }

    /**
     * Extract job titles using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of job title matches
     */
    extractJobTitles(value) {
        const matches = [];
        
        Object.entries(this.metadataPatterns.jobTitle).forEach(([patternName, pattern]) => {
            if (pattern.test(value)) {
                matches.push({
                    value: value,
                    confidence: this.getPatternConfidence('jobTitle', patternName),
                    pattern: patternName
                });
            }
        });

        return matches;
    }

    /**
     * Extract departments using various patterns
     * @param {string} value - Value to extract from
     * @returns {Array} Array of department matches
     */
    extractDepartments(value) {
        const matches = [];
        
        Object.entries(this.metadataPatterns.department).forEach(([patternName, pattern]) => {
            if (pattern.test(value)) {
                matches.push({
                    value: value,
                    confidence: this.getPatternConfidence('department', patternName),
                    pattern: patternName
                });
            }
        });

        return matches;
    }

    /**
     * Extract contact information (fax, mobile, etc.)
     * @param {string} value - Value to extract from
     * @returns {Object} Object with different contact types
     */
    extractContactInfo(value) {
        const contacts = {
            fax: [],
            other: []
        };
        
        Object.entries(this.metadataPatterns.contact).forEach(([contactType, pattern]) => {
            const match = value.match(pattern);
            if (match) {
                const contactInfo = {
                    value: match[0],
                    type: contactType,
                    confidence: this.getPatternConfidence('contact', contactType),
                    pattern: contactType
                };
                
                if (contactType === 'fax') {
                    contacts.fax.push(contactInfo);
                } else {
                    contacts.other.push(contactInfo);
                }
            }
        });

        return contacts;
    }

    /**
     * Extract business information (registration, GST, etc.)
     * @param {string} value - Value to extract from
     * @returns {Array} Array of business info matches
     */
    extractBusinessInfo(value) {
        const matches = [];
        
        Object.entries(this.metadataPatterns.business).forEach(([businessType, pattern]) => {
            const match = value.match(pattern);
            if (match) {
                matches.push({
                    value: match[0],
                    type: businessType,
                    confidence: this.getPatternConfidence('business', businessType),
                    pattern: businessType
                });
            }
        });

        return matches;
    }

    /**
     * Apply relationship-based extraction using column relationships
     * @param {Array} columns - Array of column values
     * @param {Object} tableStructure - Table structure information
     * @param {number} phoneIndex - Index of phone number column
     * @param {Object} metadata - Metadata object to populate
     */
    applyRelationshipExtraction(columns, tableStructure, phoneIndex, metadata) {
        // Extract based on proximity to phone number
        this.extractByProximity(columns, phoneIndex, metadata);
        
        // Extract based on column relationships
        if (tableStructure.columnRelationships) {
            tableStructure.columnRelationships.forEach(relationship => {
                this.extractFromRelationship(columns, relationship, metadata);
            });
        }
        
        // Extract based on column patterns
        this.extractByColumnPatterns(columns, tableStructure, metadata);
    }

    /**
     * Extract metadata based on proximity to phone number
     * @param {Array} columns - Array of column values
     * @param {number} phoneIndex - Index of phone number column
     * @param {Object} metadata - Metadata object to populate
     */
    extractByProximity(columns, phoneIndex, metadata) {
        const proximityWeights = {
            adjacent: 0.8,
            nearBy: 0.6,
            distant: 0.4
        };
        
        columns.forEach((column, index) => {
            if (index !== phoneIndex && column.trim()) {
                const distance = Math.abs(index - phoneIndex);
                let weight;
                
                if (distance === 1) weight = proximityWeights.adjacent;
                else if (distance <= 2) weight = proximityWeights.nearBy;
                else weight = proximityWeights.distant;
                
                const extractedData = this.extractFromSingleColumn(column.trim());
                this.mergeExtractedData(metadata, extractedData, 'proximity', weight);
                
                metadata.extractionReport.relationships.push({
                    type: 'proximity',
                    phoneIndex: phoneIndex,
                    metadataIndex: index,
                    distance: distance,
                    weight: weight
                });
            }
        });
    }

    /**
     * Merge extracted data into metadata object
     * @param {Object} metadata - Target metadata object
     * @param {Object} extractedData - Extracted data to merge
     * @param {string} method - Extraction method
     * @param {number} confidence - Confidence score
     */
    mergeExtractedData(metadata, extractedData, method, confidence) {
        Object.keys(extractedData).forEach(key => {
            if (extractedData[key].length > 0) {
                extractedData[key].forEach(item => {
                    const adjustedConfidence = (item.confidence || 0.5) * confidence;
                    
                    if (key === 'additionalData' || key === 'additionalContacts') {
                        metadata[key].push({
                            ...item,
                            confidence: adjustedConfidence,
                            extractionMethod: method
                        });
                    } else {
                        // For single-value fields, keep the highest confidence value
                        if (!metadata[key] || 
                            (metadata[key].confidence || 0) < adjustedConfidence) {
                            metadata[key] = {
                                ...item,
                                confidence: adjustedConfidence,
                                extractionMethod: method
                            };
                        }
                    }
                });
            }
        });
    }

    /**
     * Get confidence score for a pattern
     * @param {string} category - Pattern category
     * @param {string} patternName - Pattern name
     * @returns {number} Confidence score
     */
    getPatternConfidence(category, patternName) {
        const confidenceMap = {
            companyName: {
                withLtd: 0.9,
                standard: 0.8,
                withNumbers: 0.7,
                abbreviated: 0.6,
                allCaps: 0.5,
                mixed: 0.6,
                withSymbols: 0.4
            },
            email: {
                standard: 0.95,
                embedded: 0.9,
                withSpaces: 0.7,
                withText: 0.8,
                multiple: 0.85
            },
            website: {
                full: 0.95,
                withWww: 0.9,
                domain: 0.8,
                embedded: 0.85,
                withText: 0.7,
                multiple: 0.8
            },
            address: {
                singapore: 0.9,
                international: 0.8,
                simple: 0.7,
                withPostal: 0.85,
                block: 0.8,
                unit: 0.6
            },
            personName: {
                full: 0.8,
                withTitle: 0.9,
                initials: 0.7,
                asian: 0.75
            },
            jobTitle: {
                standard: 0.85,
                withDepartment: 0.8
            },
            department: {
                common: 0.8,
                withDept: 0.75
            },
            contact: {
                fax: 0.8,
                mobile: 0.8,
                office: 0.8,
                extension: 0.7
            },
            business: {
                registration: 0.9,
                gst: 0.85,
                license: 0.8
            }
        };
        
        return confidenceMap[category]?.[patternName] || 0.5;
    }

    /**
     * Normalize website URL
     * @param {string} website - Raw website string
     * @returns {string} Normalized website URL
     */
    normalizeWebsite(website) {
        let normalized = website.trim();
        
        // Add protocol if missing
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        
        return normalized;
    }

    /**
     * Check if extraction result is empty
     * @param {Object} extracted - Extracted data object
     * @returns {boolean} True if extraction is empty
     */
    isEmptyExtraction(extracted) {
        return Object.keys(extracted).every(key => 
            key === 'additionalData' || extracted[key].length === 0
        );
    }

    /**
     * Check if a column has already been processed
     * @param {number} index - Column index
     * @param {Object} tableStructure - Table structure information
     * @returns {boolean} True if column is already processed
     */
    isColumnProcessed(index, tableStructure) {
        return tableStructure.metadataColumns.some(col => col.index === index);
    }

    /**
     * Calculate extraction confidence based on value and extracted data
     * @param {string} value - Original value
     * @param {Object} extractedData - Extracted data
     * @returns {number} Confidence score
     */
    calculateExtractionConfidence(value, extractedData) {
        let confidence = 0.5;
        
        // Increase confidence based on number of successful extractions
        const extractionCount = Object.values(extractedData)
            .reduce((sum, arr) => sum + arr.length, 0);
        
        if (extractionCount > 0) {
            confidence += Math.min(0.3, extractionCount * 0.1);
        }
        
        // Adjust based on value characteristics
        if (value.length > 50) confidence -= 0.1; // Long values are less reliable
        if (value.includes('@')) confidence += 0.1; // Email indicators
        if (value.includes('.com') || value.includes('.sg')) confidence += 0.1; // Website indicators
        if (/\d+.*(?:Street|Road|Avenue)/.test(value)) confidence += 0.1; // Address indicators
        
        return Math.max(0.1, Math.min(0.9, confidence));
    }

    /**
     * Post-process metadata to clean and validate
     * @param {Object} metadata - Metadata object to process
     */
    postProcessMetadata(metadata) {
        // Convert single-value fields from objects to strings
        ['companyName', 'email', 'website', 'address', 'contactPerson', 
         'jobTitle', 'department', 'fax', 'businessRegistration'].forEach(field => {
            if (metadata[field] && typeof metadata[field] === 'object' && metadata[field].value) {
                metadata[field] = metadata[field].value;
            }
        });
        
        // Remove duplicates from array fields
        ['additionalContacts', 'additionalData'].forEach(field => {
            if (metadata[field] && Array.isArray(metadata[field])) {
                const seen = new Set();
                metadata[field] = metadata[field].filter(item => {
                    const key = item.value || item;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }
        });
    }

    /**
     * Generate extraction report
     * @param {Array} columns - Original columns
     * @param {Object} metadata - Processed metadata
     */
    generateExtractionReport(columns, metadata) {
        metadata.extractionReport.totalColumns = columns.length;
        metadata.extractionReport.extractedFields = Object.keys(metadata)
            .filter(key => key !== 'extractionReport' && metadata[key])
            .length;
        
        metadata.extractionReport.overallConfidence = 
            Object.values(metadata.extractionReport.confidenceScores)
                .reduce((sum, conf) => sum + conf, 0) / 
            Math.max(1, Object.keys(metadata.extractionReport.confidenceScores).length);
    }

    /**
     * Extract specific type of data from value
     * @param {string} value - Value to extract from
     * @param {string} expectedType - Expected data type
     * @returns {Object|null} Extracted data or null
     */
    extractSpecificType(value, expectedType) {
        switch (expectedType) {
            case 'company':
                const companyMatches = this.extractCompanyNames(value);
                return companyMatches.length > 0 ? companyMatches[0] : null;
            case 'email':
                const emailMatches = this.extractEmails(value);
                return emailMatches.length > 0 ? emailMatches[0] : null;
            case 'website':
                const websiteMatches = this.extractWebsites(value);
                return websiteMatches.length > 0 ? websiteMatches[0] : null;
            case 'address':
                const addressMatches = this.extractAddresses(value);
                return addressMatches.length > 0 ? addressMatches[0] : null;
            default:
                return null;
        }
    }

    /**
     * Extract from relationship between columns
     * @param {Array} columns - Array of column values
     * @param {Object} relationship - Column relationship object
     * @param {Object} metadata - Metadata object to populate
     */
    extractFromRelationship(columns, relationship, metadata) {
        if (relationship.type === 'name-split') {
            const [col1Index, col2Index] = relationship.columns;
            if (col1Index < columns.length && col2Index < columns.length) {
                const fullName = `${columns[col1Index].trim()} ${columns[col2Index].trim()}`;
                if (!metadata.contactPerson || metadata.contactPerson.confidence < relationship.confidence) {
                    metadata.contactPerson = {
                        value: fullName,
                        confidence: relationship.confidence,
                        extractionMethod: 'relationship-name-split'
                    };
                }
            }
        }
        // Add more relationship types as needed
    }

    /**
     * Extract based on column patterns
     * @param {Array} columns - Array of column values
     * @param {Object} tableStructure - Table structure information
     * @param {Object} metadata - Metadata object to populate
     */
    extractByColumnPatterns(columns, tableStructure, metadata) {
        // Look for patterns like: Name | Phone | Email | Company
        if (columns.length >= 4) {
            columns.forEach((column, index) => {
                const value = column.trim();
                if (value && index !== tableStructure.phoneColumnIndex && index !== tableStructure.idColumnIndex) {
                    // Apply contextual extraction based on position
                    if (index === 0 && this.metadataPatterns.personName.full.test(value)) {
                        if (!metadata.contactPerson) {
                            metadata.contactPerson = {
                                value: value,
                                confidence: 0.7,
                                extractionMethod: 'positional-first-column'
                            };
                        }
                    } else if (index === columns.length - 1 && this.extractCompanyNames(value).length > 0) {
                        if (!metadata.companyName) {
                            metadata.companyName = {
                                value: value,
                                confidence: 0.7,
                                extractionMethod: 'positional-last-column'
                            };
                        }
                    }
                }
            });
        }
    }

    /**
     * Test if text matches any email pattern
     * @param {string} text - Text to test
     * @returns {boolean} True if matches any email pattern
     */
    testAnyEmailPattern(text) {
        return Object.values(this.metadataPatterns.email).some(pattern => {
            if (pattern.test) {
                return pattern.test(text);
            }
            return false;
        });
    }

    /**
     * Test if text matches any website pattern
     * @param {string} text - Text to test
     * @returns {boolean} True if matches any website pattern
     */
    testAnyWebsitePattern(text) {
        return Object.values(this.metadataPatterns.website).some(pattern => {
            if (pattern.test) {
                return pattern.test(text);
            }
            return false;
        });
    }

    /**
     * Test if text matches any address pattern
     * @param {string} text - Text to test
     * @returns {boolean} True if matches any address pattern
     */
    testAnyAddressPattern(text) {
        return Object.values(this.metadataPatterns.address).some(pattern => {
            if (pattern.test) {
                return pattern.test(text);
            }
            return false;
        });
    }

    /**
     * Test if text matches any company name pattern
     * @param {string} text - Text to test
     * @returns {boolean} True if matches any company name pattern
     */
    testAnyCompanyPattern(text) {
        return Object.values(this.metadataPatterns.companyName).some(pattern => {
            if (pattern.test) {
                return pattern.test(text);
            }
            return false;
        });
    }

    /**
     * Enhanced phone number detection with flexible patterns and extraction
     * @param {string} text - Text to check
     * @returns {boolean} True if text appears to be a phone number
     */
    isPhoneNumber(text) {
        if (!text || typeof text !== 'string') return false;
        
        const cleanText = text.trim();
        
        // First check exact patterns (excluding embedded patterns)
        const exactPatterns = Object.entries(this.phonePatterns)
            .filter(([key]) => key !== 'embedded')
            .map(([, pattern]) => pattern);
        
        if (exactPatterns.some(pattern => pattern.test(cleanText))) {
            return true;
        }
        
        // Then check for embedded phone numbers
        return this.extractPhoneNumbersFromText(cleanText).length > 0;
    }

    /**
     * Extract phone numbers from text with additional formatting
     * @param {string} text - Text that may contain phone numbers
     * @returns {Array} Array of extracted phone numbers
     */
    extractPhoneNumbersFromText(text) {
        if (!text || typeof text !== 'string') return [];
        
        const phoneNumbers = [];
        const cleanText = text.trim();
        
        // Use embedded patterns to find phone numbers within text
        Object.values(this.phonePatterns.embedded).forEach(pattern => {
            const matches = cleanText.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const normalized = this.normalizePhoneNumber(match);
                    if (normalized && this.isValidSingaporePhoneNumber(normalized)) {
                        phoneNumbers.push({
                            original: match,
                            normalized: normalized,
                            position: cleanText.indexOf(match)
                        });
                    }
                });
            }
        });
        
        // Remove duplicates based on normalized number
        const uniqueNumbers = [];
        const seen = new Set();
        
        phoneNumbers.forEach(phone => {
            if (!seen.has(phone.normalized)) {
                seen.add(phone.normalized);
                uniqueNumbers.push(phone);
            }
        });
        
        return uniqueNumbers;
    }

    /**
     * Validate if a normalized phone number is a valid Singapore number
     * @param {string} phoneNumber - Normalized phone number
     * @returns {boolean} True if valid Singapore phone number
     */
    isValidSingaporePhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') return false;
        
        // Remove all non-digit characters
        const digits = phoneNumber.replace(/\D/g, '');
        
        // Check for 8-digit Singapore format
        if (digits.length === 8) {
            return /^[689]\d{7}$/.test(digits);
        }
        
        // Check for 10-digit format with 65 prefix
        if (digits.length === 10) {
            return /^65[689]\d{7}$/.test(digits);
        }
        
        return false;
    }

    /**
     * Enhanced phone number normalization with comprehensive format handling
     * @param {string} phoneNumber - Raw phone number in any format
     * @returns {string} Normalized 8-digit Singapore phone number
     */
    normalizePhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') return '';
        
        let cleaned = phoneNumber.trim();
        
        // Remove common prefixes and suffixes
        cleaned = cleaned.replace(/^(Phone:|Tel:|Mobile:|Cell:|Contact:)\s*/i, '');
        cleaned = cleaned.replace(/\s*(ext\.?\s*\d+|extension\s*\d+)$/i, '');
        
        // Remove brackets, quotes, and other formatting
        cleaned = cleaned.replace(/[\[\]"'()]/g, '');
        
        // Remove country name prefixes
        cleaned = cleaned.replace(/^(Singapore|SG)\s*/i, '');
        
        // Handle international formats
        if (cleaned.startsWith('+65')) {
            cleaned = cleaned.substring(3);
        } else if (cleaned.startsWith('65') && /^65[689]\d{7}/.test(cleaned.replace(/\D/g, ''))) {
            cleaned = cleaned.substring(2);
        }
        
        // Remove all non-digit characters
        cleaned = cleaned.replace(/\D/g, '');
        
        // Validate and return 8-digit format
        if (cleaned.length === 8 && /^[689]\d{7}$/.test(cleaned)) {
            return cleaned;
        }
        
        // Handle cases where digits might be separated or formatted
        if (cleaned.length > 8) {
            // Try to extract 8-digit Singapore number
            const match = cleaned.match(/[689]\d{7}/);
            if (match) {
                return match[0];
            }
        }
        
        return cleaned.length === 8 ? cleaned : '';
    }

    /**
     * Extract phone numbers with enhanced detection from cell content
     * @param {string} cellContent - Content of a table cell
     * @returns {Array} Array of phone number objects with metadata
     */
    extractPhoneNumbersFromCell(cellContent) {
        if (!cellContent || typeof cellContent !== 'string') return [];
        
        const results = [];
        const cleanContent = cellContent.trim();
        
        // First try exact pattern matching
        const exactPatterns = Object.entries(this.phonePatterns)
            .filter(([key]) => key !== 'embedded' && key !== 'withText' && 
                               key !== 'withTextFormatted' && key !== 'withInternationalText');
        
        for (const [patternName, pattern] of exactPatterns) {
            if (pattern.test(cleanContent)) {
                const normalized = this.normalizePhoneNumber(cleanContent);
                if (normalized && this.isValidSingaporePhoneNumber(normalized)) {
                    results.push({
                        original: cleanContent,
                        normalized: normalized,
                        extractionMethod: 'exact-pattern',
                        patternName: patternName,
                        confidence: 0.9
                    });
                    return results; // Return immediately for exact matches
                }
            }
        }
        
        // Then try embedded extraction
        const embeddedNumbers = this.extractPhoneNumbersFromText(cleanContent);
        embeddedNumbers.forEach(phone => {
            results.push({
                original: phone.original,
                normalized: phone.normalized,
                extractionMethod: 'embedded-extraction',
                position: phone.position,
                confidence: 0.7
            });
        });
        
        // Try fuzzy extraction for heavily formatted text
        if (results.length === 0) {
            const fuzzyResult = this.fuzzyPhoneExtraction(cleanContent);
            if (fuzzyResult) {
                results.push(fuzzyResult);
            }
        }
        
        return results;
    }

    /**
     * Fuzzy phone number extraction for heavily formatted or corrupted text
     * @param {string} text - Text to extract from
     * @returns {Object|null} Phone number object or null
     */
    fuzzyPhoneExtraction(text) {
        if (!text || typeof text !== 'string') return null;
        
        // Extract all digit sequences
        const digitSequences = text.match(/\d+/g);
        if (!digitSequences) return null;
        
        // Try to reconstruct phone number from digit sequences
        const allDigits = digitSequences.join('');
        
        // Look for 8-digit Singapore patterns
        const singaporeMatch = allDigits.match(/[689]\d{7}/);
        if (singaporeMatch) {
            return {
                original: text,
                normalized: singaporeMatch[0],
                extractionMethod: 'fuzzy-reconstruction',
                confidence: 0.5
            };
        }
        
        // Look for 10-digit international patterns
        const internationalMatch = allDigits.match(/65[689]\d{7}/);
        if (internationalMatch) {
            return {
                original: text,
                normalized: internationalMatch[0].substring(2),
                extractionMethod: 'fuzzy-international',
                confidence: 0.6
            };
        }
        
        return null;
    }

    /**
     * Handle multiple phone numbers in a single cell
     * @param {string} cellContent - Cell content that may contain multiple numbers
     * @returns {Array} Array of phone number objects
     */
    handleMultiplePhoneNumbers(cellContent) {
        if (!cellContent || typeof cellContent !== 'string') return [];
        
        const phoneNumbers = [];
        
        // Split by common delimiters
        const delimiters = [',', ';', '/', '|', '\n', ' and ', ' or ', ' & '];
        let parts = [cellContent];
        
        delimiters.forEach(delimiter => {
            const newParts = [];
            parts.forEach(part => {
                newParts.push(...part.split(delimiter));
            });
            parts = newParts;
        });
        
        // Extract phone numbers from each part
        parts.forEach((part, index) => {
            const extracted = this.extractPhoneNumbersFromCell(part.trim());
            extracted.forEach(phone => {
                phoneNumbers.push({
                    ...phone,
                    partIndex: index,
                    totalParts: parts.length
                });
            });
        });
        
        return phoneNumbers;
    }

    /**
     * Check if text is likely an ID
     * @param {string} text - Text to check
     * @returns {boolean} True if text appears to be an ID
     */
    isLikelyId(text) {
        if (!text || typeof text !== 'string') return false;
        
        const cleanText = text.trim();
        
        // IDs are typically short alphanumeric strings
        return /^[A-Za-z0-9-_]{1,20}$/.test(cleanText) && !this.isPhoneNumber(cleanText);
    }

    /**
     * Split line into columns based on detected separator pattern
     * @param {string} line - Line to split
     * @param {RegExp} separatorPattern - Pattern to split on
     * @returns {Array} Array of column values
     */
    splitLineIntoColumns(line, separatorPattern) {
        if (!line) return [];
        
        if (separatorPattern) {
            return line.split(separatorPattern).map(col => col.trim()).filter(col => col.length > 0);
        }
        
        // Default to whitespace splitting
        return line.split(/\s+/).filter(col => col.length > 0);
    }

    /**
     * Generate unique ID for records without IDs
     * @param {number} sequence - Sequence number
     * @returns {string} Generated unique ID
     */
    generateUniqueId(sequence) {
        const timestamp = Date.now().toString(36);
        return `GEN_${timestamp}_${sequence.toString().padStart(4, '0')}`;
    }

    /**
     * Determine metadata type based on column analysis
     * @param {Object} analysis - Column analysis data
     * @returns {string} Metadata type
     */
    determineMetadataType(analysis) {
        if (analysis.emailCount > 0) return 'email';
        if (analysis.websiteCount > 0) return 'website';
        if (analysis.addressCount > 0) return 'address';
        if (analysis.textCount > 0) return 'company';
        return 'additional';
    }

    /**
     * Advanced header detection with multiple strategies
     * @param {Array} sampleLines - Sample lines to analyze
     * @param {Object} structure - Structure object to update
     * @returns {boolean} True if headers are detected
     */
    detectAdvancedHeaders(sampleLines, structure) {
        if (sampleLines.length === 0) return false;
        
        let headerScore = 0;
        const headerLines = [];
        
        // Check first few lines for header patterns
        for (let i = 0; i < Math.min(3, sampleLines.length); i++) {
            const line = sampleLines[i];
            const lowerLine = line.toLowerCase();
            
            // Pattern 1: Underlined headers
            if (i < sampleLines.length - 1 && 
                this.tablePatterns.headers.underlined.test(line + '\n' + sampleLines[i + 1])) {
                headerScore += 0.8;
                headerLines.push(i);
            }
            
            // Pattern 2: Capitalized headers
            if (this.tablePatterns.headers.capitalized.test(line.trim())) {
                headerScore += 0.6;
                headerLines.push(i);
            }
            
            // Pattern 3: Keyword-based headers
            if (this.tablePatterns.headers.keywords.test(lowerLine)) {
                headerScore += 0.7;
                headerLines.push(i);
            }
            
            // Pattern 4: Numbered headers
            if (this.tablePatterns.headers.numbered.test(line)) {
                headerScore += 0.4;
                headerLines.push(i);
            }
            
            // Pattern 5: Different formatting from data
            if (this.isDifferentFromDataLines(line, sampleLines.slice(i + 1))) {
                headerScore += 0.3;
                headerLines.push(i);
            }
            
            // Pattern 6: No phone numbers in potential header line
            if (!this.containsPhoneNumbers(line) && i === 0) {
                headerScore += 0.2;
            }
        }
        
        structure.headerLines = [...new Set(headerLines)]; // Remove duplicates
        return headerScore > 0.5;
    }

    /**
     * Check if a line is formatted differently from data lines
     * @param {string} headerLine - Potential header line
     * @param {Array} dataLines - Remaining lines to compare against
     * @returns {boolean} True if line appears to be a header
     */
    isDifferentFromDataLines(headerLine, dataLines) {
        if (dataLines.length === 0) return false;
        
        const headerColumns = this.splitLineIntoColumns(headerLine);
        const dataColumns = dataLines.slice(0, 3).map(line => this.splitLineIntoColumns(line));
        
        // Check if header has different column count
        const avgDataColumns = dataColumns.reduce((sum, cols) => sum + cols.length, 0) / dataColumns.length;
        if (Math.abs(headerColumns.length - avgDataColumns) > 1) {
            return true;
        }
        
        // Check if header columns are all text while data has mixed types
        const headerAllText = headerColumns.every(col => /^[A-Za-z\s]+$/.test(col.trim()));
        const dataHasNumbers = dataColumns.some(cols => 
            cols.some(col => /\d/.test(col))
        );
        
        return headerAllText && dataHasNumbers;
    }

    /**
     * Check if line contains phone numbers
     * @param {string} line - Line to check
     * @returns {boolean} True if line contains phone numbers
     */
    containsPhoneNumbers(line) {
        const columns = this.splitLineIntoColumns(line);
        return columns.some(col => this.isPhoneNumber(col));
    }

    /**
     * Find the index where data starts (after headers)
     * @param {Array} lines - All lines from PDF
     * @returns {number} Index where data starts
     */
    findDataStartIndex(lines) {
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            if (this.isHeaderOrSeparator(lines[i])) continue;
            
            const columns = this.splitLineIntoColumns(lines[i]);
            if (columns.some(col => this.isPhoneNumber(col))) {
                return i;
            }
        }
        return 1; // Default to skip first line
    }

    /**
     * Check if a line is likely a header or separator
     * @param {string} line - The line to check
     * @returns {boolean} True if line appears to be a header or separator
     */
    isHeaderOrSeparator(line) {
        if (!line || typeof line !== 'string') return true;
        
        const cleanLine = line.trim();
        if (cleanLine.length === 0) return true;
        
        // Common separator patterns
        const separatorPatterns = [
            /^[-=_+*#]{3,}$/,
            /^[│┃║\|]+$/,
            /^[─┄━═]+$/
        ];
        
        if (separatorPatterns.some(pattern => pattern.test(cleanLine))) {
            return true;
        }
        
        // Header patterns
        const headerPatterns = [
            /^(id|identifier|phone|number|name|company|email|address|website)/i,
            /^(s\/n|serial|no\.?|#)/i
        ];
        
        return headerPatterns.some(pattern => pattern.test(cleanLine));
    }

    /**
     * Check if buffer contains PDF signature
     * @param {Buffer} buffer - The buffer to check
     * @returns {boolean} True if buffer appears to be a PDF
     */
    isPDFBuffer(buffer) {
        if (!buffer || buffer.length < 4) return false;
        return buffer.slice(0, 4).toString() === '%PDF';
    }

    /**
     * Handle processing errors with appropriate error messages
     * @param {Error} error - The error that occurred
     * @returns {Error} Processed error with user-friendly message
     */
    handleProcessingError(error) {
        if (Object.values(this.errorMessages).includes(error.message)) {
            return error;
        }
        
        if (error.message.includes('Invalid PDF') || error.message.includes('PDF parsing')) {
            return new Error(this.errorMessages.INVALID_PDF);
        }
        
        if (error.message.includes('encrypted') || error.message.includes('password')) {
            return new Error('The PDF file is password protected. Please provide an unprotected PDF file.');
        }
        
        console.error('Enhanced PDF processing error:', error);
        return new Error(this.errorMessages.PROCESSING_ERROR);
    }

    /**
     * Process multi-page PDFs with context preservation
     * @param {Buffer} pdfBuffer - The PDF file buffer
     * @param {string} sourceFile - Original filename
     * @returns {Promise<Array>} Array of phone records from all pages
     */
    async processMultiPagePDF(pdfBuffer, sourceFile = null) {
        try {
            const data = await pdf(pdfBuffer);
            const allRecords = [];
            let globalRecordId = 1;

            // Process each page if page information is available
            if (data.numpages && data.numpages > 1) {
                console.log(`Processing ${data.numpages} pages...`);
                
                // For multi-page processing, we'll work with the full text
                // and try to detect page boundaries
                const fullText = data.text;
                const pageTexts = this.splitTextIntoPages(fullText);
                
                for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex++) {
                    const pageText = pageTexts[pageIndex];
                    if (!pageText.trim()) continue;
                    
                    try {
                        const tableStructure = this.detectTableStructure(pageText);
                        const pageRecords = await this.parseComplexTable(pageText, tableStructure);
                        
                        // Add page information to records
                        const enhancedPageRecords = pageRecords.map(record => ({
                            ...record,
                            id: record.id || this.generateUniqueId(globalRecordId++),
                            sourceFile: sourceFile,
                            pageNumber: pageIndex + 1,
                            extractedAt: new Date().toISOString()
                        }));
                        
                        allRecords.push(...enhancedPageRecords);
                        
                    } catch (pageError) {
                        console.warn(`Error processing page ${pageIndex + 1}:`, pageError.message);
                        // Continue with other pages
                    }
                }
            } else {
                // Single page or unable to detect pages, process as single document
                return await this.extractData(pdfBuffer, sourceFile);
            }

            if (allRecords.length === 0) {
                throw new Error(this.errorMessages.NO_VALID_RECORDS);
            }

            return allRecords;

        } catch (error) {
            console.error('Multi-page PDF processing error:', error);
            throw new Error(this.errorMessages.MULTI_PAGE_ERROR);
        }
    }

    /**
     * Split text into pages (heuristic approach)
     * @param {string} fullText - Full text from PDF
     * @returns {Array} Array of page texts
     */
    splitTextIntoPages(fullText) {
        // This is a heuristic approach since pdf-parse doesn't provide page boundaries
        // We'll look for common page break indicators
        const pageBreakPatterns = [
            /\f/g, // Form feed character
            /Page\s+\d+/gi,
            /^\s*\d+\s*$/gm // Standalone page numbers
        ];
        
        let pages = [fullText];
        
        for (const pattern of pageBreakPatterns) {
            const newPages = [];
            for (const page of pages) {
                const splits = page.split(pattern);
                newPages.push(...splits);
            }
            pages = newPages;
        }
        
        return pages.filter(page => page.trim().length > 0);
    }

    /**
     * Store enhanced records to backup table with metadata
     * @param {Array} phoneRecords - Array of enhanced phone records
     * @returns {Promise<Object>} Storage result
     */
    async storeToBackupTable(phoneRecords) {
        try {
            if (!Array.isArray(phoneRecords) || phoneRecords.length === 0) {
                throw new Error('No phone records provided for storage');
            }

            console.log(`Storing ${phoneRecords.length} enhanced records to backup_table...`);

            let insertedCount = 0;
            let duplicateCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const record of phoneRecords) {
                try {
                    // Prepare metadata for storage
                    const metadata = {
                        sourceFile: record.sourceFile,
                        extractedMetadata: record.extractedMetadata,
                        pageNumber: record.pageNumber,
                        extractedAt: record.extractedAt
                    };

                    const result = await databaseManager.insertBackupRecordWithMetadata(
                        record.id, 
                        record.phoneNumber,
                        JSON.stringify(metadata)
                    );
                    
                    if (result) {
                        insertedCount++;
                    } else {
                        duplicateCount++;
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`Failed to insert record ${record.id}: ${error.message}`);
                    console.error(`Error inserting enhanced record ${record.id}:`, error.message);
                }
            }

            console.log(`Enhanced backup storage completed: ${insertedCount} inserted, ${duplicateCount} duplicates, ${errorCount} errors`);

            return {
                success: insertedCount > 0,
                totalRecords: phoneRecords.length,
                insertedCount,
                duplicateCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('Failed to store enhanced records to backup_table:', error.message);
            throw new Error(`Enhanced backup storage failed: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive extraction report with detailed analysis and suggestions
     * @param {string} textContent - Original PDF text content
     * @param {Object} tableStructure - Detected table structure
     * @param {Array} phoneRecords - Extracted phone records
     * @param {string} sourceFile - Source filename
     * @returns {Object} Comprehensive extraction report
     */
    generateComprehensiveReport(textContent, tableStructure, phoneRecords, sourceFile) {
        const lines = textContent.split('\n').filter(line => line.trim().length > 0);
        
        const report = {
            // Basic extraction statistics
            extraction: {
                sourceFile: sourceFile,
                extractedAt: new Date().toISOString(),
                totalRecords: phoneRecords.length,
                totalLines: lines.length,
                processingTimeMs: Date.now() // Will be updated by caller
            },
            
            // Table structure analysis
            tableStructure: {
                type: tableStructure.type,
                subType: tableStructure.subType,
                confidence: tableStructure.confidence,
                columnCount: tableStructure.columnCount,
                hasHeaders: tableStructure.hasHeaders,
                phoneColumnIndex: tableStructure.phoneColumnIndex,
                idColumnIndex: tableStructure.idColumnIndex,
                metadataColumnsCount: tableStructure.metadataColumns ? tableStructure.metadataColumns.length : 0,
                irregularSpacing: tableStructure.irregularSpacing,
                mergedCells: tableStructure.mergedCells,
                mixedDataTypes: tableStructure.mixedDataTypes,
                alignment: tableStructure.alignment
            },
            
            // Phone number analysis
            phoneNumbers: {
                totalFound: phoneRecords.length,
                extractionMethods: this.analyzeExtractionMethods(phoneRecords),
                formatDistribution: this.analyzePhoneFormats(phoneRecords),
                confidenceDistribution: this.analyzeConfidenceScores(phoneRecords),
                duplicatesFound: this.countDuplicates(phoneRecords),
                validationResults: this.analyzeValidationResults(phoneRecords)
            },
            
            // Metadata analysis
            metadata: {
                columnsWithMetadata: 0,
                extractedFields: {},
                confidenceScores: {},
                relationshipsFound: tableStructure.columnRelationships ? tableStructure.columnRelationships.length : 0
            },
            
            // Quality assessment
            quality: {
                overallScore: 0,
                structureScore: Math.min(1.0, tableStructure.confidence),
                extractionScore: 0,
                metadataScore: 0,
                issues: [],
                warnings: [],
                suggestions: []
            },
            
            // Processing details
            processing: {
                pdfPages: 1, // Will be updated if multi-page detection is added
                textLength: textContent.length,
                emptyLines: lines.length - lines.filter(line => line.trim().length > 0).length,
                headerLinesSkipped: tableStructure.hasHeaders ? this.countHeaderLines(lines) : 0,
                separatorPattern: tableStructure.separatorPattern ? tableStructure.separatorPattern.toString() : null
            }
        };
        
        // Analyze metadata extraction
        this.analyzeMetadataExtraction(phoneRecords, report);
        
        // Calculate quality scores
        this.calculateQualityScores(report);
        
        // Generate issues, warnings, and suggestions
        this.generateQualityFeedback(report, tableStructure, phoneRecords);
        
        return report;
    }

    /**
     * Analyze extraction methods used for phone numbers
     * @param {Array} phoneRecords - Extracted phone records
     * @returns {Object} Distribution of extraction methods
     */
    analyzeExtractionMethods(phoneRecords) {
        const methods = {};
        
        phoneRecords.forEach(record => {
            if (record.extractedMetadata && record.extractedMetadata.extractionReport) {
                Object.values(record.extractedMetadata.extractionReport.extractionMethods || {}).forEach(method => {
                    methods[method] = (methods[method] || 0) + 1;
                });
            }
        });
        
        return methods;
    }

    /**
     * Analyze phone number formats found
     * @param {Array} phoneRecords - Extracted phone records
     * @returns {Object} Distribution of phone formats
     */
    analyzePhoneFormats(phoneRecords) {
        const formats = {
            eightDigit: 0,
            international: 0,
            formatted: 0,
            other: 0
        };
        
        phoneRecords.forEach(record => {
            const phone = record.phoneNumber;
            if (/^\d{8}$/.test(phone)) {
                formats.eightDigit++;
            } else if (/^65\d{8}$/.test(phone.replace(/\D/g, ''))) {
                formats.international++;
            } else if (/\d{4}-\d{4}/.test(phone)) {
                formats.formatted++;
            } else {
                formats.other++;
            }
        });
        
        return formats;
    }

    /**
     * Analyze confidence score distribution
     * @param {Array} phoneRecords - Extracted phone records
     * @returns {Object} Confidence score statistics
     */
    analyzeConfidenceScores(phoneRecords) {
        const scores = phoneRecords
            .map(record => record.confidence || 0.5)
            .filter(score => score > 0);
        
        if (scores.length === 0) {
            return { average: 0, min: 0, max: 0, distribution: {} };
        }
        
        const distribution = {
            high: scores.filter(s => s >= 0.8).length,
            medium: scores.filter(s => s >= 0.5 && s < 0.8).length,
            low: scores.filter(s => s < 0.5).length
        };
        
        return {
            average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
            min: Math.min(...scores),
            max: Math.max(...scores),
            distribution: distribution
        };
    }

    /**
     * Count duplicate phone numbers
     * @param {Array} phoneRecords - Extracted phone records
     * @returns {number} Number of duplicates found
     */
    countDuplicates(phoneRecords) {
        const seen = new Set();
        let duplicates = 0;
        
        phoneRecords.forEach(record => {
            if (seen.has(record.phoneNumber)) {
                duplicates++;
            } else {
                seen.add(record.phoneNumber);
            }
        });
        
        return duplicates;
    }

    /**
     * Analyze validation results for phone numbers
     * @param {Array} phoneRecords - Extracted phone records
     * @returns {Object} Validation statistics
     */
    analyzeValidationResults(phoneRecords) {
        const results = {
            valid: 0,
            invalid: 0,
            unvalidated: 0
        };
        
        phoneRecords.forEach(record => {
            if (this.isValidSingaporePhoneNumber(record.phoneNumber)) {
                results.valid++;
            } else {
                results.invalid++;
            }
        });
        
        return results;
    }

    /**
     * Analyze metadata extraction across all records
     * @param {Array} phoneRecords - Extracted phone records
     * @param {Object} report - Report object to update
     */
    analyzeMetadataExtraction(phoneRecords, report) {
        const fieldCounts = {};
        const confidenceScores = {};
        let totalMetadataFields = 0;
        
        phoneRecords.forEach(record => {
            if (record.extractedMetadata) {
                Object.keys(record.extractedMetadata).forEach(field => {
                    if (field !== 'extractionReport' && record.extractedMetadata[field]) {
                        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
                        totalMetadataFields++;
                        
                        // Track confidence if available
                        if (record.extractedMetadata[field].confidence) {
                            if (!confidenceScores[field]) {
                                confidenceScores[field] = [];
                            }
                            confidenceScores[field].push(record.extractedMetadata[field].confidence);
                        }
                    }
                });
            }
        });
        
        report.metadata.extractedFields = fieldCounts;
        report.metadata.columnsWithMetadata = Object.keys(fieldCounts).length;
        
        // Calculate average confidence per field
        Object.keys(confidenceScores).forEach(field => {
            const scores = confidenceScores[field];
            report.metadata.confidenceScores[field] = 
                scores.reduce((sum, score) => sum + score, 0) / scores.length;
        });
    }

    /**
     * Calculate overall quality scores
     * @param {Object} report - Report object to update
     */
    calculateQualityScores(report) {
        // Structure score (already set)
        const structureScore = report.quality.structureScore;
        
        // Extraction score based on phone number quality
        const phoneStats = report.phoneNumbers;
        const extractionScore = Math.min(1.0, 
            (phoneStats.validationResults.valid / Math.max(1, phoneStats.totalFound)) * 
            (phoneStats.confidenceDistribution.average || 0.5)
        );
        
        // Metadata score based on extracted metadata
        const metadataScore = Math.min(1.0, 
            report.metadata.columnsWithMetadata / Math.max(1, report.tableStructure.columnCount)
        );
        
        // Overall score (weighted average)
        const overallScore = (structureScore * 0.4) + (extractionScore * 0.4) + (metadataScore * 0.2);
        
        report.quality.extractionScore = extractionScore;
        report.quality.metadataScore = metadataScore;
        report.quality.overallScore = overallScore;
    }

    /**
     * Generate quality feedback including issues, warnings, and suggestions
     * @param {Object} report - Report object to update
     * @param {Object} tableStructure - Table structure information
     * @param {Array} phoneRecords - Extracted phone records
     */
    generateQualityFeedback(report, tableStructure, phoneRecords) {
        const { issues, warnings, suggestions } = report.quality;
        
        // Structure-related feedback
        if (tableStructure.confidence < 0.5) {
            issues.push('Low confidence in table structure detection');
            suggestions.push('Ensure the PDF has a clear table format with consistent spacing or borders');
        }
        
        if (tableStructure.irregularSpacing) {
            warnings.push('Irregular spacing detected in table columns');
            suggestions.push('Use consistent spacing or tab-delimited format for better parsing');
        }
        
        if (tableStructure.mergedCells) {
            warnings.push('Merged cells detected - may affect data extraction accuracy');
            suggestions.push('Avoid merged cells in data tables for optimal processing');
        }
        
        // Phone number related feedback
        const phoneStats = report.phoneNumbers;
        if (phoneStats.validationResults.invalid > 0) {
            warnings.push(`${phoneStats.validationResults.invalid} invalid phone numbers found`);
            suggestions.push('Ensure phone numbers are in Singapore format (8 digits starting with 6, 8, or 9)');
        }
        
        if (phoneStats.duplicatesFound > 0) {
            warnings.push(`${phoneStats.duplicatesFound} duplicate phone numbers found`);
            suggestions.push('Remove duplicate entries from the source data');
        }
        
        if (phoneStats.confidenceDistribution.average < 0.7) {
            warnings.push('Low average confidence in phone number extraction');
            suggestions.push('Ensure phone numbers are clearly formatted and separated from other text');
        }
        
        // Metadata related feedback
        if (report.metadata.columnsWithMetadata === 0) {
            warnings.push('No metadata extracted from additional columns');
            suggestions.push('Include company names, emails, or addresses in adjacent columns for richer data');
        }
        
        // Overall quality feedback
        if (report.quality.overallScore < 0.6) {
            issues.push('Overall extraction quality is below optimal threshold');
            suggestions.push('Consider reformatting the PDF with clearer table structure and consistent formatting');
        }
        
        // Processing specific feedback
        if (report.processing.emptyLines > report.processing.textLength * 0.3) {
            warnings.push('High number of empty lines detected - may indicate formatting issues');
        }
        
        if (phoneRecords.length < 5) {
            warnings.push('Small number of records extracted - verify PDF contains expected data');
        }
    }

    /**
     * Count header lines that were skipped
     * @param {Array} lines - All lines from PDF
     * @returns {number} Number of header lines
     */
    countHeaderLines(lines) {
        let headerCount = 0;
        
        for (const line of lines) {
            if (this.isHeaderOrSeparator(line)) {
                headerCount++;
            } else if (line.trim().length > 0) {
                // Stop counting when we hit actual data
                break;
            }
        }
        
        return headerCount;
    }

    /**
     * Handle processing errors with enhanced error information
     * @param {Error} error - Original error
     * @returns {Error} Enhanced error with suggestions
     */
    handleProcessingError(error) {
        const enhancedError = new Error(error.message);
        enhancedError.originalError = error;
        enhancedError.suggestions = this.generateProcessingSuggestions(error.message);
        enhancedError.errorType = this.categorizeError(error.message);
        
        return enhancedError;
    }

    /**
     * Generate processing suggestions based on error type
     * @param {string} errorMessage - Error message
     * @returns {Array} Array of suggestions
     */
    generateProcessingSuggestions(errorMessage) {
        const suggestions = [];
        
        if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
            suggestions.push('Remove password protection from the PDF file');
            suggestions.push('Save the PDF without encryption');
        }
        
        if (errorMessage.includes('empty') || errorMessage.includes('no content')) {
            suggestions.push('Ensure the PDF contains visible text and tables');
            suggestions.push('Check that the PDF is not just images (scanned documents)');
            suggestions.push('Try using OCR software to convert scanned PDFs to text-based PDFs');
        }
        
        if (errorMessage.includes('phone') || errorMessage.includes('records')) {
            suggestions.push('Ensure the PDF contains a table with phone numbers');
            suggestions.push('Phone numbers should be in Singapore format (8 digits starting with 6, 8, or 9)');
            suggestions.push('Check that phone numbers are in separate columns or clearly formatted');
            suggestions.push('Avoid mixing phone numbers with other text in the same cell');
        }
        
        if (errorMessage.includes('table') || errorMessage.includes('structure')) {
            suggestions.push('Ensure data is organized in a clear table format');
            suggestions.push('Use consistent spacing or borders between columns');
            suggestions.push('Avoid merged cells or complex table layouts');
            suggestions.push('Consider using tab-delimited format for better parsing');
        }
        
        if (errorMessage.includes('format') || errorMessage.includes('parsing')) {
            suggestions.push('Try saving the PDF from the original source again');
            suggestions.push('Ensure the PDF is not corrupted during transfer');
            suggestions.push('Use a standard PDF format (not PDF/A or other specialized formats)');
            suggestions.push('Check that the PDF was created from a structured document, not scanned');
        }
        
        // Default suggestions if no specific error patterns match
        if (suggestions.length === 0) {
            suggestions.push('Ensure the PDF contains a clear table with phone numbers');
            suggestions.push('Check that the file is a valid, unencrypted PDF');
            suggestions.push('Verify that phone numbers are in Singapore format (8 digits)');
            suggestions.push('Use consistent formatting throughout the document');
        }
        
        return suggestions;
    }

    /**
     * Categorize error type for better handling
     * @param {string} errorMessage - Error message
     * @returns {string} Error category
     */
    categorizeError(errorMessage) {
        if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
            return 'SECURITY_ERROR';
        }
        
        if (errorMessage.includes('empty') || errorMessage.includes('no content')) {
            return 'CONTENT_ERROR';
        }
        
        if (errorMessage.includes('phone') || errorMessage.includes('records')) {
            return 'DATA_ERROR';
        }
        
        if (errorMessage.includes('table') || errorMessage.includes('structure')) {
            return 'STRUCTURE_ERROR';
        }
        
        if (errorMessage.includes('format') || errorMessage.includes('parsing')) {
            return 'FORMAT_ERROR';
        }
        
        return 'UNKNOWN_ERROR';
    }
    /**
     * Perform security validation on PDF buffer
     * @param {Buffer} pdfBuffer - PDF buffer to validate
     * @param {Object} options - Validation options
     */
    async performSecurityValidation(pdfBuffer, options = {}) {
        if (!this.performanceSettings.enableSecurityScanning) {
            return;
        }

        // File size validation
        if (pdfBuffer.length > this.performanceSettings.maxFileSize) {
            throw new Error(this.errorMessages.FILE_TOO_LARGE);
        }

        // Basic malware signature detection
        const pdfString = pdfBuffer.toString('binary', 0, Math.min(pdfBuffer.length, 10000));
        
        // Check for suspicious JavaScript or embedded content
        const suspiciousPatterns = [
            /\/JavaScript/i,
            /\/JS/i,
            /\/Action/i,
            /\/OpenAction/i,
            /\/Launch/i,
            /\/URI/i,
            /\/SubmitForm/i,
            /\/ImportData/i,
            /\/GoToR/i,
            /\/Sound/i,
            /\/Movie/i,
            /\/RichMedia/i,
            /\/3D/i,
            /\/Flash/i,
            /\/XFA/i,
            /<script/i,
            /eval\(/i,
            /document\.write/i,
            /unescape\(/i,
            /fromCharCode/i
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(pdfString)) {
                console.warn('Suspicious content detected in PDF:', pattern.source);
                if (options.strictSecurity) {
                    throw new Error(this.errorMessages.MALICIOUS_CONTENT);
                }
            }
        }

        // Check for excessive embedded objects
        const objectCount = (pdfString.match(/obj/g) || []).length;
        if (objectCount > 10000) {
            console.warn('PDF contains excessive number of objects:', objectCount);
            if (options.strictSecurity) {
                throw new Error(this.errorMessages.SECURITY_VIOLATION);
            }
        }

        // Check for suspicious file structure
        if (pdfString.includes('/EmbeddedFile') || pdfString.includes('/FileAttachment')) {
            console.warn('PDF contains embedded files');
            if (options.strictSecurity) {
                throw new Error(this.errorMessages.SECURITY_VIOLATION);
            }
        }
    }

    /**
     * Extract data using streaming for large files
     * @param {Buffer} pdfBuffer - PDF buffer
     * @param {Object} options - Streaming options
     * @returns {Promise<Object>} Extracted data
     */
    async extractDataWithStreaming(pdfBuffer, options = {}) {
        const startTime = Date.now();
        const chunkSize = options.chunkSize || this.performanceSettings.chunkSize;
        
        try {
            // Process PDF in chunks to manage memory usage
            const chunks = [];
            let offset = 0;
            
            while (offset < pdfBuffer.length) {
                const chunk = pdfBuffer.slice(offset, Math.min(offset + chunkSize, pdfBuffer.length));
                chunks.push(chunk);
                offset += chunkSize;
                
                // Check processing time limit
                if (Date.now() - startTime > this.performanceSettings.maxProcessingTime) {
                    throw new Error('PDF processing timeout exceeded');
                }
                
                // Allow event loop to process other tasks
                await new Promise(resolve => setImmediate(resolve));
            }

            // Reassemble and process
            const reassembledBuffer = Buffer.concat(chunks);
            
            // Use pdf-parse with streaming options
            const data = await pdf(reassembledBuffer, {
                max: options.maxPages || 100,
                version: 'v1.10.100'
            });

            console.log(`Streaming PDF processing completed in ${Date.now() - startTime}ms`);
            return data;

        } catch (error) {
            console.error('Streaming PDF processing failed:', error.message);
            throw new Error(`Streaming processing failed: ${error.message}`);
        }
    }

    /**
     * Monitor memory usage during processing
     * @returns {Object} Memory usage statistics
     */
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
        };
    }

    /**
     * Check if memory usage is within limits
     * @returns {boolean} True if within limits
     */
    isMemoryWithinLimits() {
        const usage = this.getMemoryUsage();
        const limit = this.performanceSettings.memoryLimit / 1024 / 1024; // Convert to MB
        return usage.heapUsed < limit;
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            console.log('Forced garbage collection completed');
        }
    }
}

module.exports = EnhancedPDFProcessor;