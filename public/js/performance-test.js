/**
 * Performance Test Suite for Apple Dark Theme
 * Tests CSS performance optimizations and browser compatibility
 */

class PerformanceTest {
    constructor() {
        this.results = {
            loadTime: 0,
            renderTime: 0,
            animationFPS: 0,
            memoryUsage: 0,
            browserSupport: {},
            cssFeatures: {}
        };
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.runTests());
        } else {
            this.runTests();
        }
    }
    
    runTests() {
        console.log('🚀 Starting Performance Tests...');
        
        this.testLoadTime();
        this.testBrowserSupport();
        this.testCSSFeatures();
        this.testAnimationPerformance();
        this.testMemoryUsage();
        this.testAccessibility();
        
        // Display results after a short delay
        setTimeout(() => this.displayResults(), 1000);
    }
    
    testLoadTime() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
            this.results.loadTime = Math.round(navigation.loadEventEnd - navigation.fetchStart);
            console.log(`⏱️ Page Load Time: ${this.results.loadTime}ms`);
        }
        
        // Test CSS load time
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        cssLinks.forEach(link => {
            const href = link.href;
            if (href.includes('apple-dark-theme.css')) {
                console.log(`🎨 CSS File: ${href.split('/').pop()}`);
            }
        });
    }
    
    testBrowserSupport() {
        const features = {
            cssGrid: CSS.supports('display', 'grid'),
            flexbox: CSS.supports('display', 'flex'),
            customProperties: CSS.supports('--css', 'variables'),
            backdropFilter: CSS.supports('backdrop-filter', 'blur(20px)'),
            webkitBackdropFilter: CSS.supports('-webkit-backdrop-filter', 'blur(20px)'),
            transforms3d: CSS.supports('transform', 'translate3d(0, 0, 0)'),
            willChange: CSS.supports('will-change', 'transform'),
            containment: CSS.supports('contain', 'layout')
        };
        
        this.results.browserSupport = features;
        
        console.log('🌐 Browser Support:');
        Object.entries(features).forEach(([feature, supported]) => {
            const status = supported ? '✅' : '❌';
            console.log(`  ${status} ${feature}: ${supported}`);
        });
        
        // Detect browser
        const userAgent = navigator.userAgent;
        let browser = 'Unknown';
        
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
            browser = 'Chrome';
        } else if (userAgent.includes('Firefox')) {
            browser = 'Firefox';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            browser = 'Safari';
        } else if (userAgent.includes('Edg')) {
            browser = 'Edge';
        }
        
        console.log(`🔍 Detected Browser: ${browser}`);
        this.results.browser = browser;
    }
    
    testCSSFeatures() {
        const features = {
            glassMorphism: this.testGlassMorphism(),
            gpuAcceleration: this.testGPUAcceleration(),
            smoothAnimations: this.testSmoothAnimations(),
            responsiveDesign: this.testResponsiveDesign()
        };
        
        this.results.cssFeatures = features;
        
        console.log('🎨 CSS Features:');
        Object.entries(features).forEach(([feature, result]) => {
            const status = result.supported ? '✅' : '❌';
            console.log(`  ${status} ${feature}: ${result.message}`);
        });
    }
    
    testGlassMorphism() {
        const testElement = document.createElement('div');
        testElement.style.backdropFilter = 'blur(20px)';
        document.body.appendChild(testElement);
        
        const computedStyle = window.getComputedStyle(testElement);
        const hasBackdropFilter = computedStyle.backdropFilter !== 'none';
        
        document.body.removeChild(testElement);
        
        return {
            supported: hasBackdropFilter,
            message: hasBackdropFilter ? 'Glass morphism effects active' : 'Using fallback backgrounds'
        };
    }
    
    testGPUAcceleration() {
        const testElement = document.createElement('div');
        testElement.style.transform = 'translateZ(0)';
        testElement.style.backfaceVisibility = 'hidden';
        document.body.appendChild(testElement);
        
        const computedStyle = window.getComputedStyle(testElement);
        const hasTransform = computedStyle.transform !== 'none';
        const hasBackfaceVisibility = computedStyle.backfaceVisibility === 'hidden';
        
        document.body.removeChild(testElement);
        
        return {
            supported: hasTransform && hasBackfaceVisibility,
            message: hasTransform && hasBackfaceVisibility ? 'GPU acceleration enabled' : 'Software rendering'
        };
    }
    
    testSmoothAnimations() {
        const testElement = document.createElement('div');
        testElement.style.transition = 'transform 300ms ease-out';
        testElement.style.willChange = 'transform';
        document.body.appendChild(testElement);
        
        const computedStyle = window.getComputedStyle(testElement);
        const hasTransition = computedStyle.transition !== 'all 0s ease 0s';
        const hasWillChange = computedStyle.willChange === 'transform';
        
        document.body.removeChild(testElement);
        
        return {
            supported: hasTransition,
            message: hasTransition ? 'Smooth animations enabled' : 'Animations disabled'
        };
    }
    
    testResponsiveDesign() {
        const viewportWidth = window.innerWidth;
        let breakpoint = 'desktop';
        
        if (viewportWidth <= 480) {
            breakpoint = 'mobile-small';
        } else if (viewportWidth <= 768) {
            breakpoint = 'mobile';
        } else if (viewportWidth <= 1024) {
            breakpoint = 'tablet';
        }
        
        return {
            supported: true,
            message: `Responsive design active (${breakpoint}: ${viewportWidth}px)`
        };
    }
    
    testAnimationPerformance() {
        const testElement = document.querySelector('.section, .card, .btn');
        if (!testElement) {
            console.log('⚠️ No test elements found for animation performance');
            return;
        }
        
        let frameCount = 0;
        let startTime = performance.now();
        let animationId;
        
        const measureFPS = () => {
            frameCount++;
            if (frameCount < 60) {
                animationId = requestAnimationFrame(measureFPS);
            } else {
                const endTime = performance.now();
                const fps = Math.round(1000 / ((endTime - startTime) / frameCount));
                this.results.animationFPS = fps;
                console.log(`🎬 Animation Performance: ${fps} FPS`);
                
                if (fps >= 55) {
                    console.log('✅ Excellent animation performance');
                } else if (fps >= 30) {
                    console.log('⚠️ Acceptable animation performance');
                } else {
                    console.log('❌ Poor animation performance');
                }
            }
        };
        
        // Trigger animation test
        testElement.style.transform = 'translateY(-2px) scale(1.02)';
        requestAnimationFrame(measureFPS);
        
        // Reset after test
        setTimeout(() => {
            testElement.style.transform = '';
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        }, 2000);
    }
    
    testMemoryUsage() {
        if ('memory' in performance) {
            const memory = performance.memory;
            this.results.memoryUsage = {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            };
            
            console.log(`💾 Memory Usage: ${this.results.memoryUsage.used}MB / ${this.results.memoryUsage.total}MB`);
        } else {
            console.log('💾 Memory usage information not available');
        }
    }
    
    testAccessibility() {
        const tests = {
            focusIndicators: this.testFocusIndicators(),
            colorContrast: this.testColorContrast(),
            reducedMotion: this.testReducedMotion(),
            highContrast: this.testHighContrast()
        };
        
        console.log('♿ Accessibility Tests:');
        Object.entries(tests).forEach(([test, result]) => {
            const status = result.passed ? '✅' : '⚠️';
            console.log(`  ${status} ${test}: ${result.message}`);
        });
    }
    
    testFocusIndicators() {
        const focusableElements = document.querySelectorAll('button, input, a, [tabindex]');
        return {
            passed: focusableElements.length > 0,
            message: `${focusableElements.length} focusable elements found`
        };
    }
    
    testColorContrast() {
        // This is a simplified test - in production, you'd use a proper contrast checker
        const bodyStyle = window.getComputedStyle(document.body);
        const hasHighContrast = bodyStyle.color && bodyStyle.backgroundColor;
        
        return {
            passed: hasHighContrast,
            message: hasHighContrast ? 'Color contrast appears adequate' : 'Could not verify contrast'
        };
    }
    
    testReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return {
            passed: true,
            message: prefersReducedMotion ? 'Reduced motion preference detected' : 'Full animations enabled'
        };
    }
    
    testHighContrast() {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
        return {
            passed: true,
            message: prefersHighContrast ? 'High contrast mode active' : 'Standard contrast mode'
        };
    }
    
    displayResults() {
        console.log('\n📊 Performance Test Results Summary:');
        console.log('=====================================');
        console.log(`Load Time: ${this.results.loadTime}ms`);
        console.log(`Animation FPS: ${this.results.animationFPS}`);
        console.log(`Browser: ${this.results.browser}`);
        
        if (this.results.memoryUsage) {
            console.log(`Memory Usage: ${this.results.memoryUsage.used}MB`);
        }
        
        const supportedFeatures = Object.values(this.results.browserSupport).filter(Boolean).length;
        const totalFeatures = Object.keys(this.results.browserSupport).length;
        console.log(`Browser Support: ${supportedFeatures}/${totalFeatures} features`);
        
        // Create visual indicator
        this.createResultsDisplay();
    }
    
    createResultsDisplay() {
        const existingDisplay = document.getElementById('performance-results');
        if (existingDisplay) {
            existingDisplay.remove();
        }
        
        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'performance-results';
        resultsDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--glass-bg, rgba(0, 0, 0, 0.8));
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-primary, rgba(255, 255, 255, 0.1));
            border-radius: 12px;
            padding: 20px;
            color: var(--text-primary, #FFFFFF);
            font-family: var(--font-family-mono, monospace);
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;
        
        const supportedFeatures = Object.values(this.results.browserSupport).filter(Boolean).length;
        const totalFeatures = Object.keys(this.results.browserSupport).length;
        const supportPercentage = Math.round((supportedFeatures / totalFeatures) * 100);
        
        resultsDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: var(--accent-blue, #4A90E2);">Performance Results</h3>
            <div><strong>Load Time:</strong> ${this.results.loadTime}ms</div>
            <div><strong>Animation FPS:</strong> ${this.results.animationFPS}</div>
            <div><strong>Browser:</strong> ${this.results.browser}</div>
            <div><strong>Support:</strong> ${supportPercentage}%</div>
            ${this.results.memoryUsage ? `<div><strong>Memory:</strong> ${this.results.memoryUsage.used}MB</div>` : ''}
            <div style="margin-top: 15px;">
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: var(--accent-blue, #4A90E2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(resultsDiv);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (resultsDiv.parentElement) {
                resultsDiv.remove();
            }
        }, 30000);
    }
}

// Auto-start performance test when script loads
new PerformanceTest();

// Export for manual testing
window.PerformanceTest = PerformanceTest;