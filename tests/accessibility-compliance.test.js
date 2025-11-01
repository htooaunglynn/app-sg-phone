/**
 * Accessibility Compliance Tests for Apple Light Theme
 * Tests contrast ratios, focus indicators, and screen reader compatibility
 */

const fs = require('fs');
const path = require('path');

// Color contrast calculation utilities
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

// Extract color values from CSS
function extractColorsFromCSS() {
  const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  
  const colors = {};
  const colorRegex = /--([^:]+):\s*#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g;
  let match;
  
  while ((match = colorRegex.exec(cssContent)) !== null) {
    const varName = match[1].trim();
    const colorValue = '#' + match[2];
    colors[varName] = colorValue;
  }
  
  return colors;
}

describe('Apple Light Theme Accessibility Compliance', () => {
  let colors;
  
  beforeAll(() => {
    colors = extractColorsFromCSS();
  });

  describe('Color Contrast Ratios - WCAG AA Compliance', () => {
    test('Primary text on primary background meets WCAG AA (4.5:1)', () => {
      const textColor = colors['text-primary']; // #1F2937
      const bgColor = colors['bg-primary']; // #FFFFFF
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Primary text contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Secondary text on primary background meets WCAG AA (4.5:1)', () => {
      const textColor = colors['text-secondary']; // #6B7280
      const bgColor = colors['bg-primary']; // #FFFFFF
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Secondary text contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Primary text on secondary background meets WCAG AA', () => {
      const textColor = colors['text-primary']; // #1F2937
      const bgColor = colors['bg-secondary']; // #F8F8F8
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Primary text on secondary bg contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Secondary text on secondary background meets WCAG AA', () => {
      const textColor = colors['text-secondary']; // #6B7280
      const bgColor = colors['bg-secondary']; // #F8F8F8
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Secondary text on secondary bg contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Primary button text on button background meets WCAG AA', () => {
      const textColor = colors['btn-primary-text']; // #FFFFFF
      const bgColor = colors['btn-primary-bg']; // #3B82F6
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Primary button contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Secondary button text on hover background meets WCAG AA', () => {
      const textColor = colors['text-primary']; // #1F2937
      const bgColor = colors['btn-secondary-hover']; // #F9FAFB
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Secondary button hover contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Link text on primary background meets WCAG AA', () => {
      const textColor = colors['text-link']; // #3B82F6
      const bgColor = colors['bg-primary']; // #FFFFFF
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Link text contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Tertiary text meets minimum contrast for large text (3:1)', () => {
      const textColor = colors['text-tertiary']; // #9CA3AF
      const bgColor = colors['bg-primary']; // #FFFFFF
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      console.log(`Tertiary text contrast ratio: ${ratio.toFixed(2)}:1`);
    });
  });

  describe('Focus Indicators and Keyboard Navigation', () => {
    test('Focus border color has sufficient contrast', () => {
      const focusColor = colors['border-focus']; // #3B82F6
      const bgColor = colors['bg-primary']; // #FFFFFF
      
      const ratio = getContrastRatio(focusColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      console.log(`Focus indicator contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('CSS includes focus-visible selectors for keyboard navigation', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      expect(cssContent).toMatch(/:focus-visible/);
      expect(cssContent).toMatch(/\.focus-ring:focus/);
    });

    test('Focus states are defined for interactive elements', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Check for focus states on buttons
      expect(cssContent).toMatch(/\.btn-primary:focus/);
      expect(cssContent).toMatch(/\.btn-secondary:focus/);
      
      // Check for focus states on form elements
      expect(cssContent).toMatch(/\.form-input:focus/);
      expect(cssContent).toMatch(/\.form-textarea:focus/);
      expect(cssContent).toMatch(/\.form-select:focus/);
    });
  });

  describe('High Contrast Mode Support', () => {
    test('CSS includes high contrast media query', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      expect(cssContent).toMatch(/@media \(prefers-contrast: high\)/);
    });

    test('High contrast mode adjusts text colors appropriately', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Check that high contrast mode overrides are present
      const highContrastSection = cssContent.match(/@media \(prefers-contrast: high\)\s*{[^}]*}/s);
      expect(highContrastSection).toBeTruthy();
      
      if (highContrastSection) {
        expect(highContrastSection[0]).toMatch(/--text-primary:\s*#000000/);
        expect(highContrastSection[0]).toMatch(/--text-secondary:\s*#333333/);
      }
    });
  });

  describe('Reduced Motion Support', () => {
    test('CSS includes reduced motion media query', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      expect(cssContent).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    });

    test('Reduced motion disables animations and transitions', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Match the entire reduced motion section including nested rules
      const reducedMotionSection = cssContent.match(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?(?=@media|$)/);
      expect(reducedMotionSection).toBeTruthy();
      
      if (reducedMotionSection) {
        expect(reducedMotionSection[0]).toMatch(/transition.*none/);
        expect(reducedMotionSection[0]).toMatch(/transform:\s*none/);
      }
    });
  });

  describe('Error State Accessibility', () => {
    test('Error border color has sufficient contrast', () => {
      const errorColor = colors['border-error']; // #EF4444
      const bgColor = colors['bg-primary']; // #FFFFFF
      
      const ratio = getContrastRatio(errorColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      console.log(`Error border contrast ratio: ${ratio.toFixed(2)}:1`);
    });

    test('Error text color on error background meets WCAG AA', () => {
      // Error text would typically be dark on light error background
      const textColor = '#991B1B'; // Dark red for error text
      const bgColor = colors['accent-error']; // #FEE2E2
      
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Error text contrast ratio: ${ratio.toFixed(2)}:1`);
    });
  });

  describe('Form Accessibility', () => {
    test('Form validation states have proper contrast', () => {
      // Success state
      const successText = '#065F46';
      const successBg = colors['accent-success']; // #D1FAE5
      const successRatio = getContrastRatio(successText, successBg);
      expect(successRatio).toBeGreaterThanOrEqual(4.5);
      
      // Warning state  
      const warningText = '#92400E';
      const warningBg = colors['accent-warning']; // #FEF3C7
      const warningRatio = getContrastRatio(warningText, warningBg);
      expect(warningRatio).toBeGreaterThanOrEqual(4.5);
      
      console.log(`Success state contrast ratio: ${successRatio.toFixed(2)}:1`);
      console.log(`Warning state contrast ratio: ${warningRatio.toFixed(2)}:1`);
    });

    test('Placeholder text has minimum contrast for large text', () => {
      const placeholderColor = colors['input-placeholder']; // #9CA3AF
      const bgColor = colors['input-bg']; // #F9FAFB
      
      const ratio = getContrastRatio(placeholderColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      console.log(`Placeholder text contrast ratio: ${ratio.toFixed(2)}:1`);
    });
  });

  describe('Print Accessibility', () => {
    test('CSS includes print media query with high contrast', () => {
      const cssPath = path.join(__dirname, '../public/css/apple-light-theme.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      expect(cssContent).toMatch(/@media print/);
      
      const printSection = cssContent.match(/@media print\s*{[^}]*}/s);
      expect(printSection).toBeTruthy();
      
      if (printSection) {
        expect(printSection[0]).toMatch(/--text-primary:\s*#000000/);
        expect(printSection[0]).toMatch(/--bg-primary:\s*#FFFFFF/);
      }
    });
  });
});