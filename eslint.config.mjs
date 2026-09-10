import globals from "globals";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * There was no lint step. `package.json` carried `"lint": "next lint"`, which
 * Next 16 removed — running it tried to build a directory called `lint` — so
 * the one command that looked like a lint step had not run for a major version.
 * `tsc --noEmit` was doing the whole job, and it does not report an unused
 * import: two dead ones survived a refactor here and were only caught by
 * reading the file.
 *
 * Next's own two configs carry almost everything worth having. What is added
 * below is the small set this codebase has already paid for once.
 */
export default [
  {
    /*
      Generated or vendored, and none of it is ours to fix. `drizzle/` is
      migration SQL and its meta journal, `public/sw.js` is a built service
      worker, and `next-env.d.ts` is rewritten by the framework on every build.
    */
    ignores: [".next/**", "drizzle/**", "public/sw.js", "next-env.d.ts"],
  },

  ...coreWebVitals,
  ...nextTypescript,

  {
    rules: {
      /*
        The reason this config exists, so it is an error rather than a warning.
        A warning in a step nobody runs is a comment.

        The underscore escapes are deliberate: an unused argument is sometimes
        load-bearing — it holds a position in a signature — and there has to be
        a way to say "yes, on purpose" that is not switching the rule off.
      */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      /*
        `catch {}` appears deliberately in both layouts — "decoration must never
        take a page down" — and the empty block is the point. Everywhere else an
        empty block is a hole someone left.
      */
      "no-empty": ["error", { allowEmptyCatch: true }],

      /*
        Narrowed rather than switched off. The rule guards against characters
        that are genuinely ambiguous inside JSX text, but its default set
        includes the apostrophe — and this app writes long prose in JSX and
        spells possessives with a plain `'` in every one of them. Firing on
        "the app's only clock" is the rule arguing with the house style, so it
        keeps the two characters that can actually be read as markup.
      */
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],

      /*
        An error now. It was a warning while five sites predated it, and the
        note here listed them; four are gone and two disables are left where
        the rule is wrong about this codebase, each with its reason at the
        site rather than here:

          GameProvider  `mounted` may only flip once the clock offset beside
                        it is set, and a store would flip it from its own
                        effect with no guarantee of running second
          ReportCard    the draft lives in sessionStorage, which the server
                        cannot read, so a lazy initialiser would send one
                        markup and hydrate another

        The three that were fixed all turned out to be the same mistake —
        a component keeping its own copy of something the browser already
        knew — and `useClientValue` is what they became.
      */
      "react-hooks/set-state-in-effect": "error",
    },
  },

  {
    /*
      A config file's default export is an anonymous object or array because
      that is the shape the tool loads. Naming it first would satisfy the rule
      and tell a reader nothing.
    */
    files: ["*.config.{js,mjs,ts}", "**/*.config.{js,mjs,ts}"],
    rules: { "import/no-anonymous-default-export": "off" },
  },

  {
    /*
      Scripts and tests run under `--experimental-strip-types` on Node, not
      through the bundler, so the rules about React and the browser do not
      apply to them. They still get the unused-vars rule, which is the one that
      matters in a file nobody renders.
    */
    files: ["scripts/**", "tests/**"],
    languageOptions: { globals: globals.node },
    rules: {
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-require-imports": "off",
      /*
        The tests build deliberately partial objects to hand to a pure rule —
        a loadout with one slot missing, a spec without its archetype — to
        check the rule copes. Naming those shapes properly would mean
        exporting a type that exists only so a test can be wrong on purpose.
      */
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    /*
      The one place `no-undef` earns its keep. Everything else here is
      TypeScript, where the compiler already knows what a name is and the rule
      is switched off for being a worse version of it — but `scripts/*.mjs` is
      checked by nothing. `tsc --noEmit` skips it and `next build` never sees
      it, so a bad import in the audit script is only found by running the
      script. One was: three names were deleted from an import as "unused" and
      the file did not fail until it was executed.
    */
    files: ["**/*.mjs"],
    rules: { "no-undef": "error" },
  },
];
