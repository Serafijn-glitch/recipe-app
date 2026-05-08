# Recipe app — project context

## What this is
A PWA (Progressive Web App) recipe app that runs in the browser and stores all data locally
on the device. It can be installed on a phone or tablet from the browser, no app store needed.

## Tech stack
- Vanilla HTML, CSS, and JavaScript — no frameworks
- IndexedDB for local storage (via the `idb` helper library)
- No build tools — open `index.html` directly in the browser to test
- Target: mobile first, installable as a PWA

## Project structure
```
recipe-app/
├── CLAUDE.md              ← you are here
├── index.html             ← main entry point
├── manifest.json          ← PWA install config
├── service-worker.js      ← PWA offline support
├── css/
│   └── style.css
├── js/
│   ├── db.js              ← all IndexedDB read/write logic
│   ├── recipes.js         ← add, edit, delete recipes
│   ├── scheduler.js       ← weekly recipe picker logic
│   └── grocery.js         ← grocery list generation
└── docs/
    ├── progress.md        ← what's done and what's next
    └── decisions.md       ← why we made certain choices
```

## Current status
- [x] Project scaffold (index.html, folders, PWA manifest)
- [x] Recipe form (add a new recipe)
- [x] Recipe list view (browse all recipes)
- [x] IndexedDB storage (save and load recipes)
- [x] Weekly scheduler
- [x] Grocery list view
- [x] PWA install setup (manifest + service worker)

Update this list as things get built — move [ ] to [x] when done.

## Data structure

### Recipe object
```js
{
  id: "uuid-string",
  name: "Spaghetti bolognese",
  description: "Classic Italian pasta dish",
  prep_minutes: 15,
  cook_minutes: 45,
  default_servings: 4,
  is_weekend: false,        // true = can only be picked max twice in a week (Fri/Sat/Sun)
  has_leftovers: false,     // true = makes enough for two meals
  instructions: "Step 1...",
  created_at: "2026-04-01T12:00:00Z",
  last_used_week: "2026-W13"  // ISO week string, updated each time recipe is scheduled
}
```

### Ingredient object (linked to a recipe)
```js
{
  id: "uuid-string",
  recipe_id: "parent-recipe-id",
  name: "Ground beef",
  amount: 500,
  unit: "g",
  category: "meat"          // used to group the grocery list by aisle
}
```

### Week plan object
```js
{
  id: "uuid-string",
  week_key: "2026-W14",     // ISO week identifier
  day: "monday",            // monday through sunday
  recipe_id: "uuid-string", // null if day is a leftover or skip day
  slot_type: "cook"         // "cook" | "leftover" | "skip"
}
```

### Grocery item object
```js
{
  id: "uuid-string",
  week_key: "2026-W14",
  name: "Ground beef",
  amount: 500,
  unit: "g",
  category: "meat",
  checked: false            // user ticks this off while shopping
}
```

## Scheduler rules — critical, do not change without discussion
These rules must all be respected when generating a week plan:

1. **5 cooking days per week** — the scheduler picks 5 recipes to cook across the week
2. **Weekend limit** — recipes marked `is_weekend: true` may appear at most twice per week,
   and should only be placed on Friday, Saturday, or Sunday
3. **Leftovers pattern** — when a recipe has `has_leftovers: true`, the day pattern is:
   - Day N: cook the recipe
   - Day N+1: cook something else (a normal recipe)
   - Day N+2: eat leftovers (slot_type = "leftover", no new recipe needed)
   This means a leftovers recipe only uses 1 of the 5 cooking slots but occupies 3 calendar days.
4. **No repeats two weeks in a row** — do not pick a recipe whose `last_used_week` equals
   last week's ISO week string
5. **Shopping list timing** — the week plan and grocery list are generated/available on Thursday,
   ready for shopping on Friday

## Key decisions
- **No framework** — keeping it simple so the code is easy to read and debug
- **IndexedDB over localStorage** — needed for structured ingredient data and querying
- **`idb` library** — thin wrapper that makes IndexedDB feel like normal async/await code
- **ISO week keys** — using strings like "2026-W14" for week identification keeps date logic simple
- **Grocery list is a snapshot** — generated once on Thursday and stored, not re-computed live

## How to run and test
1. Open `index.html` in Chrome or Firefox
2. Press F12 to open developer tools
3. Use the **Console** tab to see logs and errors
4. Use the **Application** tab → IndexedDB to inspect stored data
5. The scheduler logs its decisions to the console — check there if something looks wrong

## Coding style preferences
- Add `console.log` statements when building new features so behaviour is visible in the console
- Keep functions small and focused on one thing
- Add a short comment above any function that implements a scheduler rule
- Prefer readability over cleverness — this codebase should be easy to follow
