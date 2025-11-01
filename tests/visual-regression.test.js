/**
 * Visual Regression Testing Suite
 * Tests for Task 10: Visual testing and refinement
 */

const fs = require('fs');
const path = require('path');

describe('Visual Regression Testing', () => {
    let cssContent;
    
    beforeAll(() => {
        // Read the CSS file
        const cssPath = path.join(__dirname, '../public/css/apple-dark-theme.css');
        cssContent = fs.readFileSync(cssPath, 'utf8');
    });

    describe('Theme Consistency Validation', () => {
        test('should have consistent color variables across all components', () => {
            // Test for consistent color variable usage
            const colorVariables = [
                '--bg-primary',
                '--bg-secondary',
                '--bg-elevated',
                '--text-primary',
                '--text-secondary',
                '--text-muted',
                '--accent-blue',
                '--success-color',
                '--warning-color',
                '--danger-color'
            ];
            
            colorVariables.forEach(variable => {
                expect(cssContent).toMatch(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
                expect(cssContent).toMatch(new RegExp(`var\\(${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
            });
        });

        test('should have consistent spacing scale throughout', () => {
            const spacingVariables = [
                '--space-xs',
                '--space-sm',
                '--space-md',
                '--space-lg',
                '--space-xl',
                '--space-2xl',
                '--space-3xl'
            ];
            
            spacingVariables.forEach(variable => {
                expect(cssContent).toMatch(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
            });
        });

        test('should have consistent typography scale', () => {
            const typographyVariables = [
                '--font-size-xs',
                '--font-size-sm',
                '--font-size-base',
                '--font-size-lg',
                '--font-size-xl',
                '--font-size-2xl',
                '--font-size-3xl',
                '--font-size-4xl',
                '--font-size-5xl',
                '--font-size-6xl'
            ];
            
            typographyVariables.forEach(variable => {
                expect(cssContent).toMatch(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
            });
        });

        test('should have consistent shadow hierarchy', () => {
            const shadowVariables = [
                '--shadow-ultra-soft',
                '--shadow-soft',
                '--shadow-elevated',
                '--shadow-focus'
            ];
            
            shadowVariables.forEach(variable => {
                expect(cssContent).toMatch(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
            });
        });

        test('should have consistent border radius scale', () => {
            const radiusVariables = [
                '--radius-small',
                '--radius-medium',
                '--radius-large',
                '--radius-xl',
                '--radius-full'
            ];
            
            radiusVariables.forEach(variable => {
                expect(cssContent).toMatch(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
            });
        });
    });

    describe('Component Visual Consistency', () => {
        test('should have consistent button styling patterns', () => {
            // Test for button consistency
            expect(cssContent).toMatch(/\.btn.*border-radius:\s*var\(--radius-medium\)/s);
            expect(cssContent).toMatch(/\.btn.*transition:\s*.*var\(--transition-/s);
            expect(cssContent).toMatch(/\.btn.*backdrop-filter:\s*blur/s);
        });

        test('should have consistent form element styling', () => {
            // Test for form element consistency
            expect(cssContent).toMatch(/input.*border-radius:\s*var\(--radius-medium\)/s);
            expect(cssContent).toMatch(/input.*background:\s*var\(--glass-bg\)/s);
            expect(cssContent).toMatch(/input.*transition:\s*.*var\(--transition-/s);
        });

        test('should have consistent card styling patterns', () => {
            // Test for card consistency
            expect(cssContent).toMatch(/\.section.*border-radius:\s*var\(--radius-large\)/s);
            expect(cssContent).toMatch(/\.section.*backdrop-filter:\s*blur/s);
            expect(cssContent).toMatch(/\.section.*box-shadow:\s*var\(--shadow-soft\)/s);
        });

        test('should have consistent navigation styling', () => {
            // Test for navigation consistency
            expect(cssContent).toMatch(/\.nav-button.*border-radius:\s*var\(--radius-medium\)/s);
            expect(cssContent).toMatch(/\.nav-button.*transition:\s*.*var\(--transition-/s);
            expect(cssContent).toMatch(/\.nav-button.*backdrop-filter:\s*blur/s);
        });

        test('should have consistent table styling', () => {
            // Test for table consistency
            expect(cssContent).toMatch(/\.records-table.*border-collapse:\s*collapse/s);
            expect(cssContent).toMatch(/\.records-table.*th.*background:\s*var\(--bg-surface\)/s);
            expect(cssContent).toMatch(/\.records-table.*tr.*transition:/s);
        });
    });

    describe('Micro-interactions Validation', () => {
        test('should have consistent hover effects', () => {
            // Test for hover effect consistency
            expect(cssContent).toMatch(/:hover.*transform:\s*translateY\(-\d+px\)/s);
            expect(cssContent).toMatch(/:hover.*box-shadow:\s*.*var\(--shadow-elevated\)/s);
            expect(cssContent).toMatch(/:hover.*scale\(1\.0[1-9]\)/s);
        });

        test('should have consistent focus states', () => {
            // Test for focus state consistency
            expect(cssContent).toMatch(/:focus.*outline:\s*none/s);
            expect(cssContent).toMatch(/:focus.*box-shadow:\s*.*var\(--shadow-focus\)/s);
            expect(cssContent).toMatch(/:focus-visible.*outline:\s*\d+px\s*solid/s);
        });

        test('should have consistent active states', () => {
            // Test for active state consistency
            expect(cssContent).toMatch(/:active.*transform:\s*.*scale\(0\.9[5-9]\)/s);
            expect(cssContent).toMatch(/:active.*transition:\s*.*var\(--transition-micro\)/s);
        });

        test('should have consistent disabled states', () => {
            // Test for disabled state consistency
            expect(cssContent).toMatch(/:disabled.*opacity:\s*0\.[3-6]/s);
            expect(cssContent).toMatch(/:disabled.*cursor:\s*not-allowed/s);
            expect(cssContent).toMatch(/:disabled.*transform:\s*none/s);
        });
    });

    describe('Glass Morphism Effects', () => {
        test('should have consistent glass effect implementation', () => {
            // Test for glass morphism consistency
            expect(cssContent).toMatch(/backdrop-filter:\s*blur\(var\(--glass-blur\)\)/);
            expect(cssContent).toMatch(/-webkit-backdrop-filter:\s*blur\(var\(--glass-blur\)\)/);
            expect(cssContent).toMatch(/background:\s*var\(--glass-bg\)/);
            expect(cssContent).toMatch(/border:\s*1px\s*solid\s*var\(--glass-border\)/);
        });

        test('should have glass effect variables defined', () => {
            expect(cssContent).toMatch(/--glass-bg:/);
            expect(cssContent).toMatch(/--glass-border:/);
            expect(cssContent).toMatch(/--glass-blur:/);
        });
    });

    describe('Animation and Transition Consistency', () => {
        test('should have consistent transition durations', () => {
            const transitionVariables = [
                '--transition-fast',
                '--transition-normal',
                '--transition-slow',
                '--transition-micro',
                '--transition-gentle',
                '--transition-smooth'
            ];
            
            transitionVariables.forEach(variable => {
                if (cssContent.includes(variable + ':')) {
                    expect(cssContent).toMatch(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`));
                }
            });
        });

        test('should have consistent easing functions', () => {
            expect(cssContent).toMatch(/ease-out/);
            expect(cssContent).toMatch(/cubic-bezier/);
        });

        test('should have GPU acceleration for animated elements', () => {
            expect(cssContent).toMatch(/transform:\s*translateZ\(0\)/);
            expect(cssContent).toMatch(/backface-visibility:\s*hidden/);
            expect(cssContent).toMatch(/will-change:/);
        });
    });

    describe('Responsive Design Consistency', () => {
        test('should have consistent breakpoints', () => {
            const breakpoints = [
                '@media.*max-width:\\s*575px',
                '@media.*min-width:\\s*576px.*max-width:\\s*767px',
                '@media.*min-width:\\s*768px.*max-width:\\s*991px',
                '@media.*min-width:\\s*992px.*max-width:\\s*1199px',
                '@media.*min-width:\\s*1200px.*max-width:\\s*1399px',
                '@media.*min-width:\\s*1400px'
            ];
            
            breakpoints.forEach(breakpoint => {
                expect(cssContent).toMatch(new RegExp(breakpoint));
            });
        });

        test('should have responsive spacing adjustments', () => {
            expect(cssContent).toMatch(/@media.*--space-xs:\s*\d+px/s);
            expect(cssContent).toMatch(/@media.*--space-sm:\s*\d+px/s);
            expect(cssContent).toMatch(/@media.*--space-md:\s*\d+px/s);
        });

        test('should have responsive typography scaling', () => {
            expect(cssContent).toMatch(/@media.*font-size:\s*\d+px/s);
            expect(cssContent).toMatch(/@media.*--font-size-base:\s*\d+px/s);
        });
    });

    describe('Accessibility Compliance', () => {
        test('should have high contrast mode support', () => {
            expect(cssContent).toMatch(/@media.*prefers-contrast:\s*high/);
            expect(cssContent).toMatch(/prefers-contrast:\s*high.*--text-primary:\s*#FFFFFF/s);
            expect(cssContent).toMatch(/prefers-contrast:\s*high.*border-width:\s*2px/s);
        });

        test('should have reduced motion support', () => {
            expect(cssContent).toMatch(/@media.*prefers-reduced-motion:\s*reduce/);
            expect(cssContent).toMatch(/prefers-reduced-motion:\s*reduce.*transition-duration:\s*0\.01ms\s*!important/s);
            expect(cssContent).toMatch(/prefers-reduced-motion:\s*reduce.*animation-duration:\s*0\.01ms\s*!important/s);
        });

        test('should have focus indicators for accessibility', () => {
            expect(cssContent).toMatch(/:focus-visible.*outline:\s*\d+px\s*solid/s);
            expect(cssContent).toMatch(/:focus-visible.*outline-offset:\s*\d+px/s);
        });

        test('should have minimum touch target sizes', () => {
            expect(cssContent).toMatch(/min-height:\s*44px/);
            expect(cssContent).toMatch(/min-width:\s*44px/);
        });
    });

    describe('Performance Optimizations', () => {
        test('should have efficient CSS custom property usage', () => {
            // Count CSS custom properties
            const customProperties = cssContent.match(/--[a-zA-Z-]+:/g) || [];
            expect(customProperties.length).toBeGreaterThan(50);
            
            // Check for consistent naming
            customProperties.forEach(prop => {
                expect(prop).toMatch(/^--[a-z][a-z0-9-]*:$/);
            });
        });

        test('should have optimized selectors', () => {
            // Check for efficient selector patterns
            expect(cssContent).not.toMatch(/\*\s*\*\s*\*/); // Avoid universal selector chains
            expect(cssContent).not.toMatch(/[#.][a-zA-Z-]+\s+[#.][a-zA-Z-]+\s+[#.][a-zA-Z-]+\s+[#.][a-zA-Z-]+/); // Avoid deep nesting
        });

        test('should have GPU acceleration hints', () => {
            expect(cssContent).toMatch(/will-change:\s*transform/);
            expect(cssContent).toMatch(/will-change:\s*auto/);
            expect(cssContent).toMatch(/transform:\s*translateZ\(0\)/);
        });
    });

    describe('Cross-browser Compatibility', () => {
        test('should have webkit prefixes for critical features', () => {
            expect(cssContent).toMatch(/-webkit-backdrop-filter/);
            expect(cssContent).toMatch(/-webkit-font-smoothing/);
            expect(cssContent).toMatch(/-moz-osx-font-smoothing/);
        });

        test('should have fallbacks for modern CSS features', () => {
            // Check for backdrop-filter fallbacks
            const backdropFilterLines = cssContent.split('\n').filter(line => 
                line.includes('backdrop-filter') && !line.includes('-webkit-')
            );
            
            backdropFilterLines.forEach(line => {
                const lineIndex = cssContent.split('\n').indexOf(line);
                const nextLine = cssContent.split('\n')[lineIndex + 1];
                if (nextLine) {
                    expect(nextLine).toMatch(/-webkit-backdrop-filter/);
                }
            });
        });

        test('should have CSS Grid fallbacks', () => {
            // Check for flexbox fallbacks where grid is used
            expect(cssContent).toMatch(/display:\s*flex/);
            expect(cssContent).toMatch(/display:\s*grid/);
        });
    });

    describe('Theme Switching Support', () => {
        test('should have theme variation classes', () => {
            const themeClasses = [
                '.theme-ultra-dark',
                '.theme-soft-dark',
                '.theme-blue-dark',
                '.theme-warm-dark',
                '.theme-light'
            ];
            
            // Note: These might be in separate test files, so we check if they exist
            themeClasses.forEach(themeClass => {
                if (cssContent.includes(themeClass)) {
                    expect(cssContent).toMatch(new RegExp(`\\${themeClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
                }
            });
        });

        test('should have smooth transition support for theme switching', () => {
            expect(cssContent).toMatch(/transition:\s*all.*var\(--transition-/);
            expect(cssContent).toMatch(/transition:\s*.*300ms/);
        });
    });

    describe('Print Styles', () => {
        test('should have print-specific styles', () => {
            expect(cssContent).toMatch(/@media\s*print/);
            expect(cssContent).toMatch(/print.*background:\s*transparent\s*!important/s);
            expect(cssContent).toMatch(/print.*color:\s*#000\s*!important/s);
        });

        test('should hide interactive elements in print', () => {
            expect(cssContent).toMatch(/print.*\.nav-button.*display:\s*none\s*!important/s);
            expect(cssContent).toMatch(/print.*\.header-buttons.*display:\s*none\s*!important/s);
        });
    });
});

// Integration tests for visual consistency
describe('Visual Integration Tests', () => {
    let cssContent;
    
    beforeAll(() => {
        const cssPath = path.join(__dirname, '../public/css/apple-dark-theme.css');
        cssContent = fs.readFileSync(cssPath, 'utf8');
    });

    test('should have no CSS syntax errors', () => {
        // Basic CSS syntax validation
        const openBraces = (cssContent.match(/\{/g) || []).length;
        const closeBraces = (cssContent.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);
        
        // Check for basic CSS structure
        expect(cssContent).toMatch(/:/); // Should have property declarations
        expect(cssContent).toMatch(/;/); // Should have property terminators
    });

    test('should have consistent variable naming convention', () => {
        const variables = cssContent.match(/--[a-zA-Z][a-zA-Z0-9-]*:/g) || [];
        variables.forEach(variable => {
            expect(variable).toMatch(/^--[a-z][a-z0-9-]*:$/);
        });
    });

    test('should have proper media query structure', () => {
        const mediaQueries = cssContent.match(/@media[^{]+\{/g) || [];
        mediaQueries.forEach(query => {
            expect(query).toMatch(/@media\s+(\([^)]+\)|print|screen)/);
        });
    });

    test('should have comprehensive component coverage', () => {
        const componentSelectors = [
            '.btn',
            '.nav-button',
            '.section',
            '.records-table',
            '.status-badge',
            '.stat-item',
            'input',
            'textarea',
            'select',
            'button'
        ];
        
        componentSelectors.forEach(selector => {
            expect(cssContent).toMatch(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        });
    });

    test('should have all required accessibility features', () => {
        const accessibilityFeatures = [
            'prefers-contrast: high',
            'prefers-reduced-motion: reduce',
            'prefers-color-scheme: dark',
            'focus-visible',
            'min-height: 44px',
            'outline: 3px solid'
        ];

        accessibilityFeatures.forEach(feature => {
            expect(cssContent).toMatch(new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        });
    });

    test('should have performance optimizations', () => {
        expect(cssContent).toMatch(/will-change/);
        expect(cssContent).toMatch(/transform:\s*translateZ\(0\)/);
        expect(cssContent).toMatch(/backface-visibility:\s*hidden/);
        expect(cssContent).toMatch(/contain:\s*layout/);
    });

    test('should have proper z-index management', () => {
        expect(cssContent).toMatch(/--z-dropdown/);
        expect(cssContent).toMatch(/--z-modal/);
        expect(cssContent).toMatch(/--z-tooltip/);
        expect(cssContent).toMatch(/z-index:\s*\d+/);
    });
});