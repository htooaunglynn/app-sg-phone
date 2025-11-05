/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./public/**/*.{html,ejs}",
        "./public/**/*.js",
        "./src/**/*.js",
        "./src/**/*.html"
    ],
    darkMode: 'media', // or 'class' for manual toggle
    theme: {
        extend: {
            // Apple-inspired color palette
            colors: {
                // Neutral grays (Apple-style)
                neutral: {
                    50: '#FAFAFA',
                    100: '#F5F5F5',
                    200: '#E5E5E5',
                    300: '#D4D4D4',
                    400: '#A3A3A3',
                    500: '#737373',
                    600: '#525252',
                    700: '#404040',
                    800: '#262626',
                    900: '#171717',
                },
                // Apple-inspired blues
                blue: {
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    200: '#BFDBFE',
                    300: '#93C5FD',
                    400: '#60A5FA',
                    500: '#3B82F6',
                    600: '#2563EB',
                    700: '#1D4ED8',
                    800: '#1E40AF',
                    900: '#1E3A8A',
                },
                // System colors
                success: {
                    50: '#ECFDF5',
                    100: '#D1FAE5',
                    500: '#10B981',
                    600: '#059669',
                    700: '#047857',
                },
                warning: {
                    50: '#FFFBEB',
                    100: '#FEF3C7',
                    500: '#F59E0B',
                    600: '#D97706',
                    700: '#B45309',
                },
                danger: {
                    50: '#FEF2F2',
                    100: '#FEE2E2',
                    500: '#EF4444',
                    600: '#DC2626',
                    700: '#B91C1C',
                },
                // Apple-style backgrounds
                background: {
                    primary: '#FFFFFF',
                    secondary: '#F8F8F8',
                    tertiary: '#F5F5F5',
                    elevated: '#FEFEFE',
                },
                // Apple-style text colors
                text: {
                    primary: '#1F2937',
                    secondary: '#6B7280',
                    tertiary: '#9CA3AF',
                    quaternary: '#D1D5DB',
                    inverse: '#FFFFFF',
                },
                // Apple-style borders
                border: {
                    light: '#F3F4F6',
                    medium: '#E5E7EB',
                    strong: '#D1D5DB',
                }
            },

            // Apple-inspired typography
            fontFamily: {
                'apple': ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
                'mono': ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Monaco', 'Consolas', 'monospace'],
            },

            // Apple-style spacing scale
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },

            // Apple-inspired border radius
            borderRadius: {
                'apple': '12px',
                'apple-lg': '16px',
                'apple-xl': '20px',
                'apple-2xl': '24px',
            },

            // Apple-style shadows
            boxShadow: {
                'apple-sm': '0 1px 3px rgba(0, 0, 0, 0.05)',
                'apple': '0 4px 6px rgba(0, 0, 0, 0.07)',
                'apple-md': '0 6px 20px rgba(0, 0, 0, 0.08)',
                'apple-lg': '0 10px 25px rgba(0, 0, 0, 0.1)',
                'apple-xl': '0 20px 40px rgba(0, 0, 0, 0.1)',
                'apple-focus': '0 0 0 3px rgba(59, 130, 246, 0.1)',
                'apple-glow': '0 0 20px rgba(59, 130, 246, 0.3)',
            },

            // Glass/blur effects
            backdropBlur: {
                'apple': '20px',
                'apple-sm': '12px',
                'apple-lg': '28px',
            },

            // Apple-style animations
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'bounce-subtle': 'bounceSubtle 0.4s ease-out',
                'pulse-subtle': 'pulseSubtle 2s infinite',
            },

            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                bounceSubtle: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-2px)' },
                },
                pulseSubtle: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' },
                },
            },

            // Responsive breakpoints (Apple-style)
            screens: {
                'xs': '475px',
                'sm': '640px',
                'md': '768px',
                'lg': '1024px',
                'xl': '1280px',
                '2xl': '1536px',
                '3xl': '1920px',
            },

            // Apple-style transitions
            transitionTimingFunction: {
                'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
                'apple-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                'apple-smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            },
        },
    },
}
