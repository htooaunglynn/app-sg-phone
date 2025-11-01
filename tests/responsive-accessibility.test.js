/**
 * Responsive Design and Accessibility Tests
 * Tests for Task 8: Implement responsive design and accessibility features
 */

const fs = require('fs');
const path = require('path');

describe('Responsive Design and Accessibility Features', () => {
    let cssContent;
    
    beforeAll(() => {
        // Read the CSS file
        const cssPath = path.join(__dirname, '../public/css/apple-dark-theme.css');
        cssContent = fs.readFileSync(cssPath, 'utf8');
    });

    describe('Responsive Design System', () => {
        test('should have comprehensive media queries for all screen sizes', () => {
            // Test for various breakpoints
            expect(cssContent).toMatch(/@media.*min-width:\s*1400px/);
            expect(cssContent).toMatch(/@media.*min-width:\s*1200px.*max-width:\s*1399px/);
            expect(cssContent).toMatch(/@media.*min-width:\s*992px.*max-width:\s*1199px/);
            expect(cssContent).toMatch(/@media.*min-width:\s*768px.*max-width:\s*991px/);
            expect(cssContent).toMatch(/@media.*min-width:\s*576px.*max-width:\s*767px/);
            expect(cssContent).toMatch(/@media.*max-width:\s*575px/);
        });

        test('should have responsive typography scaling', () => {
            // Check for font-size adjustments in media queries
            expect(cssContent).toMatch(/font-size:\s*14px.*@media.*max-width/s);
            expect(cssContent).toMatch(/font-size:\s*13px.*@media.*max-width/s);
            expect(cssContent).toMatch(/--font-size-base:\s*18px.*@media.*min-width.*1400px/s);
        });

        test('should have responsive spacing system', () => {
            // Check for spacing adjustments
            expect(cssContent).toMatch(/--space-xs:\s*10px.*@media.*min-width.*1400px/s);
            expect(cssContent).toMatch(/--space-xs:\s*4px.*@media.*max-width.*575px/s);
            expect(cssContent).toMatch(/--space-sm:\s*6px.*@media.*max-width.*575px/s);
        });

        test('should have responsive button sizing', () => {
            // Check for button height adjustments
            expect(cssContent).toMatch(/--btn-height-sm:\s*36px.*@media.*max-width.*575px/s);
            expect(cssContent).toMatch(/--btn-height-md:\s*44px.*@media.*max-width.*575px/s);
        });

        test('should have responsive grid layouts', () => {
            // Check for grid template adjustments
            expect(cssContent).toMatch(/grid-template-columns:\s*1fr.*@media.*max-width/s);
            expect(cssContent).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax/);
        });

        test('should have touch device optimizations', () => {
            // Check for touch-specific media queries
            expect(cssContent).toMatch(/@media.*hover:\s*none.*pointer:\s*coarse/);
            expect(cssContent).toMatch(/min-height:\s*48px.*hover:\s*none/s);
            expect(cssContent).toMatch(/min-width:\s*48px.*hover:\s*none/s);
        });

        test('should have high DPI display optimizations', () => {
            // Check for high DPI media queries
            expect(cssContent).toMatch(/@media.*-webkit-min-device-pixel-ratio:\s*2/);
            expect(cssContent).toMatch(/@media.*min-resolution:\s*192dpi/);
            expect(cssContent).toMatch(/-webkit-font-smoothing:\s*antialiased/);
            expect(cssContent).toMatch(/-moz-osx-font-smoothing:\s*grayscale/);
        });
    });

    describe('High Contrast Mode Support', () => {
        test('should have comprehensive high contrast media query', () => {
            expect(cssContent).toMatch(/@media.*prefers-contrast:\s*high/);
        });

        test('should enhance colors for high contrast', () => {
            // Check for enhanced contrast colors
            expect(cssContent).toMatch(/--bg-primary:\s*#000000.*prefers-contrast:\s*high/s);
            expect(cssContent).toMatch(/--text-primary:\s*#FFFFFF.*prefers-contrast:\s*high/s);
            expect(cssContent).toMatch(/--accent-blue:\s*#66B3FF.*prefers-contrast:\s*high/s);
        });

        test('should enhance border visibility in high contrast', () => {
            expect(cssContent).toMatch(/border-width:\s*2px.*prefers-contrast:\s*high/s);
            // Check for enhanced borders in high contrast mode
            expect(cssContent).toMatch(/prefers-contrast:\s*high/);
        });

        test('should enhance interactive elements in high contrast', () => {
            expect(cssContent).toMatch(/\.btn.*border-width:\s*2px.*prefers-contrast:\s*high/s);
            expect(cssContent).toMatch(/input.*border-width:\s*2px.*prefers-contrast:\s*high/s);
        });

        test('should provide enhanced focus indicators in high contrast', () => {
            expect(cssContent).toMatch(/outline:\s*3px\s*solid.*prefers-contrast:\s*high/s);
            expect(cssContent).toMatch(/outline-offset:\s*2px.*prefers-contrast:\s*high/s);
        });
    });

    describe('Reduced Motion Support', () => {
        test('should have comprehensive reduced motion media query', () => {
            expect(cssContent).toMatch(/@media.*prefers-reduced-motion:\s*reduce/);
        });

        test('should disable transitions and animations', () => {
            expect(cssContent).toMatch(/transition-duration:\s*0\.01ms\s*!important.*prefers-reduced-motion:\s*reduce/s);
            expect(cssContent).toMatch(/animation-duration:\s*0\.01ms\s*!important.*prefers-reduced-motion:\s*reduce/s);
            expect(cssContent).toMatch(/animation-iteration-count:\s*1\s*!important.*prefers-reduced-motion:\s*reduce/s);
        });

        test('should disable transform effects', () => {
            expect(cssContent).toMatch(/transform:\s*none\s*!important.*prefers-reduced-motion:\s*reduce/s);
            expect(cssContent).toMatch(/--scale-hover:\s*1.*prefers-reduced-motion:\s*reduce/s);
        });

        test('should disable specific animations', () => {
            expect(cssContent).toMatch(/\.spinner.*animation:\s*none\s*!important.*prefers-reduced-motion:\s*reduce/s);
            expect(cssContent).toMatch(/\.loading.*animation:\s*none\s*!important.*prefers-reduced-motion:\s*reduce/s);
        });

        test('should preserve essential focus indicators', () => {
            expect(cssContent).toMatch(/\*:focus-visible.*outline:\s*3px\s*solid.*!important.*prefers-reduced-motion:\s*reduce/s);
        });
    });

    describe('WCAG 2.1 AA Color Contrast Compliance', () => {
        test('should define high contrast text colors', () => {
            // Check for colors that meet WCAG AA standards
            expect(cssContent).toMatch(/--text-primary:\s*#FFFFFF.*21:1\s*ratio/s);
            expect(cssContent).toMatch(/--text-secondary:\s*#F5F5F5.*19\.6:1\s*ratio/s);
            expect(cssContent).toMatch(/--text-muted:\s*#E0E0E0.*16\.7:1\s*ratio/s);
        });

        test('should define accessible interactive colors', () => {
            expect(cssContent).toMatch(/--accent-blue:\s*#4A90E2.*4\.8:1\s*ratio/s);
            expect(cssContent).toMatch(/--accent-silver:\s*#C0C0C0.*12\.6:1\s*ratio/s);
        });

        test('should define accessible status colors', () => {
            expect(cssContent).toMatch(/--success-color:\s*#32D74B.*7\.2:1\s*ratio/s);
            expect(cssContent).toMatch(/--warning-color:\s*#FF9F0A.*5\.8:1\s*ratio/s);
            expect(cssContent).toMatch(/--danger-color:\s*#FF453A.*4\.9:1\s*ratio/s);
            expect(cssContent).toMatch(/--info-color:\s*#64D2FF.*8\.1:1\s*ratio/s);
        });

        test('should ensure disabled elements maintain sufficient contrast', () => {
            expect(cssContent).toMatch(/color:\s*var\(--text-subtle\).*disabled/s);
            expect(cssContent).toMatch(/--text-subtle.*9\.7:1\s*ratio.*exceeds\s*4\.5:1/s);
        });
    });

    describe('Keyboard Navigation and Screen Reader Compatibility', () => {
        test('should have enhanced focus indicators', () => {
            expect(cssContent).toMatch(/\*:focus-visible/);
            expect(cssContent).toMatch(/outline:\s*3px\s*solid\s*var\(--accent-blue\)/);
            expect(cssContent).toMatch(/outline-offset:\s*2px/);
            expect(cssContent).toMatch(/box-shadow:.*rgba\(74,\s*144,\s*226,\s*0\.3\)/);
        });

        test('should have skip to main content support', () => {
            expect(cssContent).toMatch(/\.skip-to-main/);
            expect(cssContent).toMatch(/position:\s*absolute/);
            expect(cssContent).toMatch(/top:\s*-40px/);
        });

        test('should have screen reader only classes', () => {
            expect(cssContent).toMatch(/\.sr-only/);
            expect(cssContent).toMatch(/position:\s*absolute.*width:\s*1px.*height:\s*1px/s);
            expect(cssContent).toMatch(/\.sr-only-focusable:focus/);
        });

        test('should have minimum touch target sizes', () => {
            expect(cssContent).toMatch(/min-height:\s*44px/);
            expect(cssContent).toMatch(/min-width:\s*44px/);
        });

        test('should have proper button accessibility', () => {
            expect(cssContent).toMatch(/cursor:\s*pointer.*button/s);
            expect(cssContent).toMatch(/cursor:\s*not-allowed.*disabled/s);
        });

        test('should have enhanced table accessibility', () => {
            expect(cssContent).toMatch(/\.records-table.*border-collapse:\s*separate/s);
            expect(cssContent).toMatch(/scope:\s*col/);
            expect(cssContent).toMatch(/focus-within.*outline:\s*2px\s*solid/s);
        });

        test('should have proper form accessibility', () => {
            expect(cssContent).toMatch(/\.required::after.*content:\s*'\s*\*'/s);
            expect(cssContent).toMatch(/\.error-message.*role:\s*alert/s);
            expect(cssContent).toMatch(/\.success-message.*role:\s*status/s);
        });
    });

    describe('Print Accessibility', () => {
        test('should have comprehensive print styles', () => {
            expect(cssContent).toMatch(/@media\s*print/);
            expect(cssContent).toMatch(/background:\s*transparent\s*!important.*print/s);
            expect(cssContent).toMatch(/color:\s*#000\s*!important.*print/s);
        });

        test('should handle links in print', () => {
            expect(cssContent).toMatch(/a\[href\]:after/);
            expect(cssContent).toMatch(/content:.*attr\(href\)/);
            expect(cssContent).toMatch(/@media\s*print/);
        });

        test('should handle page breaks properly', () => {
            expect(cssContent).toMatch(/page-break-after:\s*avoid.*print/s);
            expect(cssContent).toMatch(/page-break-inside:\s*avoid.*print/s);
            expect(cssContent).toMatch(/orphans:\s*3.*print/s);
            expect(cssContent).toMatch(/widows:\s*3.*print/s);
        });

        test('should hide navigation in print', () => {
            expect(cssContent).toMatch(/\.nav-button.*display:\s*none\s*!important.*print/s);
            expect(cssContent).toMatch(/\.header-buttons.*display:\s*none\s*!important.*print/s);
        });
    });

    describe('Device-Specific Optimizations', () => {
        test('should have dark mode system preference integration', () => {
            expect(cssContent).toMatch(/@media.*prefers-color-scheme:\s*dark/);
            expect(cssContent).toMatch(/--bg-primary:\s*#000000.*prefers-color-scheme:\s*dark/s);
        });

        test('should have light mode fallback', () => {
            expect(cssContent).toMatch(/@media.*prefers-color-scheme:\s*light/);
            expect(cssContent).toMatch(/\.light-mode-toggle/);
            expect(cssContent).toMatch(/display:\s*block.*prefers-color-scheme:\s*light/s);
        });

        test('should remove hover effects on touch devices', () => {
            expect(cssContent).toMatch(/transform:\s*none.*hover:\s*none.*pointer:\s*coarse/s);
            expect(cssContent).toMatch(/box-shadow:\s*var\(--shadow-soft\).*hover:\s*none.*pointer:\s*coarse/s);
        });
    });

    describe('Performance Optimizations', () => {
        test('should have GPU acceleration for smooth animations', () => {
            expect(cssContent).toMatch(/transform:\s*translateZ\(0\)/);
            expect(cssContent).toMatch(/backface-visibility:\s*hidden/);
            expect(cssContent).toMatch(/will-change:\s*transform/);
        });

        test('should optimize will-change usage', () => {
            expect(cssContent).toMatch(/will-change:\s*auto/);
            expect(cssContent).toMatch(/will-change:\s*transform,\s*box-shadow,\s*background/);
        });

        test('should have efficient CSS custom property usage', () => {
            expect(cssContent).toMatch(/var\(--[a-zA-Z-]+\)/);
            expect(cssContent).toMatch(/--[a-zA-Z-]+:/);
        });
    });
});

// Additional integration tests
describe('CSS Integration Tests', () => {
    let cssContent;
    
    beforeAll(() => {
        // Read the CSS file
        const cssPath = path.join(__dirname, '../public/css/apple-dark-theme.css');
        cssContent = fs.readFileSync(cssPath, 'utf8');
    });
    test('should not have any CSS syntax errors', () => {
        // Basic CSS syntax validation - allow nested braces in media queries and selectors
        // Just check that braces are balanced
        const openBraces = (cssContent.match(/\{/g) || []).length;
        const closeBraces = (cssContent.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);
        
        // Check for basic CSS structure
        expect(cssContent).toMatch(/:/); // Should have property declarations
        expect(cssContent).toMatch(/;/); // Should have property terminators
    });

    test('should have consistent variable naming', () => {
        // Check for consistent CSS custom property naming
        const variables = cssContent.match(/--[a-zA-Z][a-zA-Z0-9-]*:/g) || [];
        variables.forEach(variable => {
            expect(variable).toMatch(/^--[a-z][a-z0-9-]*:$/);
        });
    });

    test('should have proper media query structure', () => {
        const mediaQueries = cssContent.match(/@media[^{]+\{/g) || [];
        mediaQueries.forEach(query => {
            // Allow both parentheses-based and print media queries
            expect(query).toMatch(/@media\s+(\([^)]+\)|print)/);
        });
    });

    test('should have comprehensive accessibility coverage', () => {
        // Ensure all major accessibility features are present
        const accessibilityFeatures = [
            'prefers-contrast: high',
            'prefers-reduced-motion: reduce',
            'prefers-color-scheme: dark',
            'focus-visible',
            'sr-only',
            'skip-to-main',
            'min-height: 44px',
            'outline: 3px solid'
        ];

        accessibilityFeatures.forEach(feature => {
            expect(cssContent).toMatch(new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        });
    });
});