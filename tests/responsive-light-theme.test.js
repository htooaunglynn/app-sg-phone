/**
 * Responsive Design Integration Tests for Apple Light Theme
 * Tests light theme across all screen sizes and devices
 */

const fs = require('fs');
const path = require('path');

describe('Apple Light Theme Responsive Design Integration', () => {
  let cssContent;
  
  beforeAll(() => {
    const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  describe('Responsive Breakpoints', () => {
    test('CSS includes mobile breakpoint (max-width: 768px)', () => {
      expect(cssContent).toMatch(/@media \(max-width: 768px\)/);
    });

    test('CSS includes small mobile breakpoint (max-width: 480px)', () => {
      expect(cssContent).toMatch(/@media \(max-width: 480px\)/);
    });

    test('Mobile breakpoints maintain light theme color variables', () => {
      // Extract mobile media queries
      const mobileQueries = cssContent.match(/@media \(max-width: 768px\)\s*{[\s\S]*?(?=@media|$)/g);
      expect(mobileQueries).toBeTruthy();
      
      // Ensure mobile styles don't override theme colors inappropriately
      mobileQueries.forEach(query => {
        // Should not contain color overrides that break the theme
        expect(query).not.toMatch(/background:\s*#[0-9A-Fa-f]{6}(?!\s*!important)/);
        expect(query).not.toMatch(/color:\s*#[0-9A-Fa-f]{6}(?!\s*!important)/);
      });
    });
  });

  describe('Navigation Responsive Design', () => {
    test('Navigation has mobile-specific styling', () => {
      const mobileNavRegex = /@media \(max-width: 768px\)[\s\S]*?\.header-section[\s\S]*?}/;
      const mobileNavMatch = cssContent.match(mobileNavRegex);
      expect(mobileNavMatch).toBeTruthy();
      
      if (mobileNavMatch) {
        expect(mobileNavMatch[0]).toMatch(/padding:/);
      }
    });

    test('Navigation buttons adapt to mobile screens', () => {
      const mobileButtonRegex = /@media \(max-width: 768px\)[\s\S]*?\.nav-button[\s\S]*?}/;
      const mobileButtonMatch = cssContent.match(mobileButtonRegex);
      expect(mobileButtonMatch).toBeTruthy();
      
      if (mobileButtonMatch) {
        expect(mobileButtonMatch[0]).toMatch(/padding:|font-size:/);
      }
    });
  });

  describe('Hero Section Responsive Design', () => {
    test('Hero section adapts to mobile screens', () => {
      const mobileHeroRegex = /@media \(max-width: 768px\)[\s\S]*?\.container[\s\S]*?}/;
      const mobileHeroMatch = cssContent.match(mobileHeroRegex);
      expect(mobileHeroMatch).toBeTruthy();
    });

    test('Hero heading scales appropriately on mobile', () => {
      const mobileH1Regex = /@media \(max-width: 768px\)[\s\S]*?h1[\s\S]*?}/;
      const mobileH1Match = cssContent.match(mobileH1Regex);
      expect(mobileH1Match).toBeTruthy();
      
      if (mobileH1Match) {
        expect(mobileH1Match[0]).toMatch(/font-size:/);
      }
    });

    test('Hero buttons stack vertically on mobile', () => {
      // Look for hero-actions in any mobile media query
      const heroActionsPattern = /\.hero-actions[\s\S]*?flex-direction:\s*column/;
      expect(cssContent).toMatch(heroActionsPattern);
    });
  });

  describe('Card Layout Responsive Design', () => {
    test('Content cards adapt padding on mobile', () => {
      // Look for content-card mobile padding in any mobile media query
      const cardPaddingPattern = /\.content-card[\s\S]*?padding:\s*var\(--spacing-md\)/;
      expect(cssContent).toMatch(cardPaddingPattern);
    });

    test('Card grids collapse to single column on mobile', () => {
      const mobileGridRegex = /@media \(max-width: 768px\)[\s\S]*?\.card-grid\.cols-[234][\s\S]*?}/;
      const mobileGridMatch = cssContent.match(mobileGridRegex);
      expect(mobileGridMatch).toBeTruthy();
      
      if (mobileGridMatch) {
        expect(mobileGridMatch[0]).toMatch(/grid-template-columns:\s*1fr/);
      }
    });

    test('Feature cards maintain proper spacing on mobile', () => {
      const mobileFeatureRegex = /@media \(max-width: 768px\)[\s\S]*?\.feature-card[\s\S]*?}/;
      const mobileFeatureMatch = cssContent.match(mobileFeatureRegex);
      expect(mobileFeatureMatch).toBeTruthy();
    });
  });

  describe('Form Elements Responsive Design', () => {
    test('Form containers adapt padding on mobile', () => {
      const mobileFormRegex = /@media \(max-width: 768px\)[\s\S]*?\.form-container[\s\S]*?}/;
      const mobileFormMatch = cssContent.match(mobileFormRegex);
      expect(mobileFormMatch).toBeTruthy();
    });

    test('Button groups stack vertically on mobile', () => {
      const mobileButtonGroupRegex = /@media \(max-width: 768px\)[\s\S]*?\.btn-group[\s\S]*?}/;
      const mobileButtonGroupMatch = cssContent.match(mobileButtonGroupRegex);
      expect(mobileButtonGroupMatch).toBeTruthy();
      
      if (mobileButtonGroupMatch) {
        expect(mobileButtonGroupMatch[0]).toMatch(/flex-direction:\s*column/);
      }
    });

    test('Input groups stack vertically on mobile', () => {
      const mobileInputGroupRegex = /@media \(max-width: 768px\)[\s\S]*?\.input-group[\s\S]*?}/;
      const mobileInputGroupMatch = cssContent.match(mobileInputGroupRegex);
      expect(mobileInputGroupMatch).toBeTruthy();
      
      if (mobileInputGroupMatch) {
        expect(mobileInputGroupMatch[0]).toMatch(/flex-direction:\s*column/);
      }
    });
  });

  describe('Glass Effects Responsive Design', () => {
    test('Glass effects are optimized for mobile performance', () => {
      const mobileGlassRegex = /@media \(max-width: 768px\)[\s\S]*?backdrop-filter:\s*blur\(12px\)/;
      const mobileGlassMatch = cssContent.match(mobileGlassRegex);
      expect(mobileGlassMatch).toBeTruthy();
    });

    test('Glass effects have fallbacks for low-performance devices', () => {
      const fallbackRegex = /@supports not \(backdrop-filter: blur\(1px\)\)/;
      expect(cssContent).toMatch(fallbackRegex);
    });
  });

  describe('Typography Responsive Scaling', () => {
    test('Font sizes scale appropriately on mobile', () => {
      // Check that mobile breakpoints include font-size adjustments
      const mobileFontRegex = /@media \(max-width: 768px\)[\s\S]*?font-size:/;
      const mobileFontMatch = cssContent.match(mobileFontRegex);
      expect(mobileFontMatch).toBeTruthy();
    });

    test('Line heights remain readable on mobile', () => {
      // Ensure line-height variables are used consistently
      expect(cssContent).toMatch(/line-height:\s*var\(--line-height-/);
    });
  });

  describe('Touch-Friendly Interface', () => {
    test('Interactive elements have minimum touch target size', () => {
      // Check that buttons have min-height for touch accessibility
      expect(cssContent).toMatch(/min-height:\s*44px/);
      expect(cssContent).toMatch(/min-height:\s*36px/);
    });

    test('Icon buttons are appropriately sized for touch', () => {
      const iconButtonRegex = /\.icon-button\s*{[\s\S]*?width:\s*36px[\s\S]*?height:\s*36px/;
      expect(cssContent).toMatch(iconButtonRegex);
    });
  });

  describe('Performance Optimizations', () => {
    test('Reduced motion preferences are respected', () => {
      expect(cssContent).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    });

    test('Print styles are optimized', () => {
      expect(cssContent).toMatch(/@media print/);
      
      // Look for the complete print section including nested rules
      const printSection = cssContent.match(/@media print\s*{[\s\S]*?(?=@media|$)/);
      if (printSection) {
        expect(printSection[0]).toMatch(/backdrop-filter:\s*none/);
        expect(printSection[0]).toMatch(/animation:\s*none/);
      }
    });
  });

  describe('Small Screen Optimizations', () => {
    test('Extra small screens (480px) have specific optimizations', () => {
      const extraSmallRegex = /@media \(max-width: 480px\)/;
      expect(cssContent).toMatch(extraSmallRegex);
    });

    test('Content cards use smaller border radius on small screens', () => {
      const smallCardRegex = /@media \(max-width: 480px\)[\s\S]*?\.content-card[\s\S]*?border-radius:/;
      const smallCardMatch = cssContent.match(smallCardRegex);
      expect(smallCardMatch).toBeTruthy();
    });

    test('Buttons expand to full width on small screens', () => {
      const smallButtonRegex = /@media \(max-width: 480px\)[\s\S]*?\.btn-primary[\s\S]*?width:\s*100%/;
      const smallButtonMatch = cssContent.match(smallButtonRegex);
      expect(smallButtonMatch).toBeTruthy();
    });
  });

  describe('Accessibility on Mobile', () => {
    test('Focus indicators remain visible on mobile', () => {
      // Ensure focus styles are not disabled on mobile
      const mobileFocusRegex = /@media \(max-width: 768px\)[\s\S]*?:focus/;
      const mobileFocusMatch = cssContent.match(mobileFocusRegex);
      
      // If mobile focus styles exist, they should maintain visibility
      if (mobileFocusMatch) {
        expect(mobileFocusMatch[0]).not.toMatch(/outline:\s*none/);
      }
    });

    test('Text remains readable at mobile sizes', () => {
      // Check minimum font sizes on mobile
      const mobileFontSizes = cssContent.match(/@media \(max-width: 768px\)[\s\S]*?font-size:\s*var\(--font-size-(\w+)\)/g);
      if (mobileFontSizes) {
        // Ensure no font sizes are smaller than xs (12px)
        mobileFontSizes.forEach(match => {
          expect(match).not.toMatch(/font-size:\s*var\(--font-size-xxs\)/);
        });
      }
    });
  });

  describe('Theme Consistency Across Devices', () => {
    test('Color variables remain consistent across breakpoints', () => {
      // Ensure mobile styles don't override core theme colors
      const mobileStyles = cssContent.match(/@media \(max-width: 768px\)[\s\S]*?(?=@media|$)/g);
      
      if (mobileStyles) {
        mobileStyles.forEach(style => {
          // Should not contain hardcoded colors that bypass theme variables
          expect(style).not.toMatch(/background:\s*#[0-9A-Fa-f]{6}(?!\s*!important)/);
          expect(style).not.toMatch(/color:\s*#[0-9A-Fa-f]{6}(?!\s*!important)/);
        });
      }
    });

    test('Premium feel is maintained on mobile devices', () => {
      // Check that key premium elements (shadows, blur) are preserved
      const mobileShadows = cssContent.match(/@media \(max-width: 768px\)[\s\S]*?box-shadow:/);
      const mobileBlur = cssContent.match(/@media \(max-width: 768px\)[\s\S]*?backdrop-filter:/);
      
      // Premium effects should still be present, even if reduced
      expect(mobileShadows || mobileBlur).toBeTruthy();
    });
  });
});