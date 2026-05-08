## Styling
- Chose a clean mobile-first layout
- Tested in Firefox Responsive Design Mode at 390x844 (iPhone) and 412x915 (Android)
- Alignment fixes applied via style.css only — HTML structure was not changed

## Ingredients
- Each ingredient has: name, amount, unit, category
- Category field is used later for grouping the grocery list by aisle
- Multiple ingredients handled with dynamic "Add ingredient" rows in the form

## General
- Save button logs to console for now — IndexedDB connection comes next session
- No framework — vanilla HTML/CSS/JS only, keeps code readable and debuggable

## Language
- App is in Dutch
- All UI text, labels, buttons, placeholders, and messages should be in Dutch

## Recipe list
- Cards show: name, total time, servings, and optional weekend/restjes badges
- Delete requires a confirm() dialog to prevent accidents
- List sorted alphabetically (Dutch locale) — simple and predictable

## IndexedDB
- Four object stores created at DB_VERSION 1: recipes, ingredients, week_plans, grocery_items
- ingredients store has a recipe_id index for fast lookup by parent recipe
- deleteRecipe() fetches ingredient ids first, then deletes recipe + ingredients in one transaction