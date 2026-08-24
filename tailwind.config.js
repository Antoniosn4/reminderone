/** @type {import('tailwindcss').Config} */
function colorVar(name) {
    return `rgb(var(--${name}) / <alpha-value>)`;
}

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                gray: {
                    50:  colorVar("gray-50"),
                    100: colorVar("gray-100"),
                    200: colorVar("gray-200"),
                    300: colorVar("gray-300"),
                    400: colorVar("gray-400"),
                    500: colorVar("gray-500"),
                    600: colorVar("gray-600"),
                    700: colorVar("gray-700"),
                    800: colorVar("gray-800"),
                    900: colorVar("gray-900"),
                    950: colorVar("gray-950"),
                },
            },
        },
    },
    plugins: [],
};
