// The Nuxt module generates the base config (it knows the auto-imported composables and Vue helpers).
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: ["supabase/**", "e2e/**", "tests/**", "scripts/**", ".output/**"],
  rules: { "@typescript-eslint/no-explicit-any": "off", /* the project is TypeScript without strict mode: `any` is a deliberate escape hatch for Supabase rows and untyped helpers */ "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }], "vue/multi-word-component-names": "off", "vue/no-v-html": "off", "vue/html-self-closing": "off", "vue/max-attributes-per-line": "off", "vue/singleline-html-element-content-newline": "off", "vue/html-indent": "off", "vue/html-closing-bracket-newline": "off", "vue/first-attribute-linebreak": "off", "vue/attributes-order": "off", "vue/require-default-prop": "off", "vue/no-multiple-template-root": "off" },
});
