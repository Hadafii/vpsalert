/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
    {
        ignores: [
            ".now/*",
            "**/*.css",
            "**/.changeset",
            "**/dist",
            "esm/*",
            "public/*",
            "tests/*",
            "scripts/*",
            "**/*.config.js",
            "**/.DS_Store",
            "**/node_modules",
            "**/coverage",
            "**/.next",
            "**/build",
        ],
    },
    {
        files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            "no-console": "warn",
            "no-unused-vars": "off", // Disable base rule for TypeScript
        },
    },
];

export default config;