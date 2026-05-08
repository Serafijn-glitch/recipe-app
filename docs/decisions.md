## Styling
- Chose a clean mobile-first layout
- Tested in Firefox Responsive Design Mode at 390x844 (iPhone) and 412x915 (Android)
- Alignment fixes applied via style.css only — HTML structure was not changed
- Dark teal theme (#0f1923 background, #00bcd4 accent)

## Ingredients
- Each ingredient has: name, amount, unit, category
- Category field is used for grouping the grocery list by aisle
- Multiple ingredients handled with dynamic "Add ingredient" rows in the form

## Language
- App is in Dutch
- All UI text, labels, buttons, placeholders, and messages should be in Dutch

## Recipe list
- Cards show: name, total time, servings, and optional weekend/restjes badges
- Delete requires a confirm() dialog to prevent accidents
- List sorted alphabetically (Dutch locale) — simple and predictable

## IndexedDB
- Four object stores at DB_VERSION 1: recipes, ingredients, week_plans, grocery_items
- ingredients store has a recipe_id index for fast lookup by parent recipe
- deleteRecipe() fetches ingredient ids first, then deletes recipe + ingredients in one transaction

## Recipe detail / edit
- Tapping a card opens a detail view (no separate route — same section, different div visible)
- Edit mode pre-fills the form; originalRecipe variable preserves id, created_at, last_used_week
- updateRecipe() deletes old ingredients first, then calls saveRecipe() (which uses put() to upsert)

## Scheduler
- Leftovers recipes placed first (most constrained: day d and d+2 must both be free)
- Weekend leftovers recipes can only go on Friday (d+2 = Sunday, still in same week)
- On regenerate: unmarks last_used_week for old plan's recipes before selecting new ones
- Max 2 leftovers recipes per week (5 cook + 3 leftover = 8 days, doesn't fit in 7)

## Grocery list
- Generated as a snapshot from cook slots in the week plan — not recomputed live
- Ingredients with same name + unit are merged (amounts summed)
- Display order: produce → meat → dairy → bakery → pantry → frozen → other
- Checked state persisted in IndexedDB; survives page reload

## PWA
- Icons generated via PowerShell/.NET System.Drawing (192 and 512px)
- manifest.json: purpose "any" + "maskable" for Android adaptive icons
- Service worker: cache-first, pre-caches app shell on install, cleans old caches on activate
- skipWaiting() + clients.claim() so new SW version takes control immediately

## Security
- Content Security Policy: default-src 'self' — blocks external scripts and eval()
- img-src also allows data: for the SVG arrow in the select dropdown (CSS background-image)
- All user data inserted via innerHTML goes through escapeHtml() (&, <, >, ", ')
- No external dependencies — nothing loaded from CDNs

## Deployment
- Hosted on GitHub Pages: https://serafijn-glitch.github.io/recipe-app
- Repository: https://github.com/Serafijn-glitch/recipe-app
- All data stays on the user's device (IndexedDB) — nothing stored server-side
