# DISCOVERY: build

Gotchas, pointers, and invariants for the module source in `src/` and the build. Read this file before you change `package.json`, `vite.config.js`, `src/order.js`, or the tests. `DISCOVERY_engine.md` covers the game itself.

## Invariants

- Edit `src/`. Never edit the root `index.html`. `npm run build` overwrites it, and its second line says so.
- Git tracks the built `index.html`. Commit it with the source change. `npm run check` fails when it is stale.
- `src/order.js` lists every module once, in load order. `main.js` imports it first.
- A module imports an earlier module's names from that module. It imports a later module's names (upward names) from `./order.js` and uses them only inside a function.
- An imported binding is read-only. A write to another module's `let` goes through the owner's setter (`setTarget`, `setHomes`, and 7 more).
- `src/worldgen.js` has no imports. The worker runs `WorldGenModule.toString()` alone.
- The pure modules (`PURE` in `tools/depcheck.js`) never reach `order.js`. Node tests import them without a browser.
- `tools/depcheck.js` enforces all of these. Each error starts with its rule id: `order`, `main`, `downward`, `upward`, `readonly`, `free`, `worker`, or `pure`.

## Gotchas

- Stay on Vite 7. `package.json` pins Vite 7.3.6 and vite-plugin-singlefile 2.3.3 exactly. Vite 8 bundles with Rolldown and rewrites the code: it removes comments, turns `const` into `var`, and inlines constants. The built file then no longer reads as the source.
- `vite.config.js` turns off minify and tree-shake and sets `target: 'esnext'`. Each setting keeps the built script equal to the module text.
- `modulePreload: false` stops Vite from adding a preload polyfill to the script.
- Vite moves the script into `<head>` and adds `crossorigin` to the tag. A module script runs after the document parses, so the move is harmless. Do not "fix" it.
- The built script holds the modules in load order. The living header from `src/order.js` therefore sits near the end of the script, not at the top.
- Run the tests with `npm test`. On Node 25, `node --test tests/` fails: Node runs the folder as one test file. The script passes a quoted glob instead.
- `tests/host-stub.js` stubs `location`, `localStorage`, and `history`. Each test file imports it first, because `config.js` reads the URL at load time.
- The golden hashes in `tests/worldgen.test.js` come from the baseline tag `baseline-single-file`. A change to world generation fails them on purpose. Update them only when the change is intended, and say so in the commit.
- On Joe's Mac, other processes hold ports 5173 and 5199. Run the dev server on a free port: `npx vite --port 5281 --strictPort`.
- Chromium caches the page. After a build, load it with a new query string, such as `&v=2`.

## Pointers

- Build config: `vite.config.js`. The `mark-generated` plugin writes the "GENERATED" comment.
- Dependency check: `tools/depcheck.js`. Run it alone with `node tools/depcheck.js`.
- Tests: `tests/*.test.js`. Run one file with `node --test tests/crafting.test.js`.
- The single-file source before the split: `git show baseline-single-file:index.html`.
