## 2026-04-01
- Built project scaffold
- Built recipe form with all fields including is_weekend and has_leftovers toggles
- Ingredients section works with Add Ingredient button
- Styled for mobile, alignment issues fixed
- Save button currently logs to console only

## 2026-05-08 (sessie 1)
- Translated entire app to Dutch (labels, buttons, placeholders, nav, console messages)
- Implemented IndexedDB storage in db.js (recipes, ingredients, week_plans, grocery_items stores)
- Wired up recipe form save → IndexedDB
- Built recipe list view with cards (name, time, servings, weekend/restjes badges)
- Delete button per recipe card with confirmation dialog

## 2026-05-08 (sessie 2)
- Recipe detail view: tik op een kaartje → volledige weergave (stats, ingrediënten, bereiding)
- Edit mode: "Bewerken" knop vult het formulier voor met bestaande gegevens
- updateRecipe() in db.js: verwijdert oude ingrediënten en schrijft nieuwe terug
- Verwijderknop ook in de detailweergave

## 2026-05-08 (sessie 3)
- Weekplanner volledig gebouwd in scheduler.js
- Selectiealgoritme: max 2 weekendrecepten, regel 4 (geen herhaling vorige week)
- Inplanningsalgoritme: leftoversrecepten eerst (meest beperkt), dan regulier
- Regenereren: zet vorige marks terug, selecteert opnieuw
- DB: getWeekPlan, saveWeekPlan, deleteWeekPlan, markRecipesUsed, unmarkRecipesUsed
- UI: weekplan-dagkaartjes met kleurgecodeerde linkerbalk

## 2026-05-08 (sessie 4)
- Boodschappenlijst volledig gebouwd in grocery.js
- Genereert lijst vanuit kookdagen van het weekplan
- Mergelogica: ingrediënten met dezelfde naam + eenheid worden samengevoegd (hoeveelheden opgeteld)
- Gegroepeerd per categorie (groente & fruit eerst, droogwaren/diepvries op het eind)
- Alfabetisch gesorteerd per categorie
- Afvinken per item (checkbox + doorstrepen), voortgangsregel ("3 van 12 ingekocht")
- Checked-staat opgeslagen in IndexedDB, blijft bewaard na herladen
- DB: getGroceryList, saveGroceryList, deleteGroceryList, toggleGroceryItem
- Herlaadt automatisch wanneer de gebruiker naar het tabblad navigeert

## 2026-05-08 (sessie 5)
- PWA installatie afgerond
- icons/icon-192.png en icons/icon-512.png gegenereerd (donker teal + witte R)
- manifest.json compleet: name, short_name, description, lang, start_url, display, orientation, theme/background color, icons (any + maskable)
- service-worker.js: cache-first strategie, pre-cachet hele app shell bij install, ruimt oude caches op bij activate
- index.html: service worker registratie, apple-mobile-web-app meta-tags, apple-touch-icon

## Alles klaar
Alle geplande features zijn gebouwd. De app is volledig functioneel en installeerbaar als PWA.

## Mogelijke volgende stappen (optioneel)
- Recepten importeren/exporteren (JSON backup)
- Zoeken en filteren in de receptenlijst
- Notities per dag in het weekplan
- Hoeveelheden aanpassen naar aantal porties bij boodschappenlijst generatie
