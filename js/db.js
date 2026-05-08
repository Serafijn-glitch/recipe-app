// db.js — all IndexedDB read/write logic

const DB_NAME = 'recepten-app';
const DB_VERSION = 1;

let db;

// Open the database and create object stores on first run
async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      console.log('Database aangemaakt / bijgewerkt');

      if (!database.objectStoreNames.contains('recipes')) {
        const store = database.createObjectStore('recipes', { keyPath: 'id' });
        store.createIndex('last_used_week', 'last_used_week', { unique: false });
      }

      if (!database.objectStoreNames.contains('ingredients')) {
        const store = database.createObjectStore('ingredients', { keyPath: 'id' });
        // Index used by getIngredients() to look up all ingredients for a recipe
        store.createIndex('recipe_id', 'recipe_id', { unique: false });
      }

      if (!database.objectStoreNames.contains('week_plans')) {
        const store = database.createObjectStore('week_plans', { keyPath: 'id' });
        store.createIndex('week_key', 'week_key', { unique: false });
      }

      if (!database.objectStoreNames.contains('grocery_items')) {
        const store = database.createObjectStore('grocery_items', { keyPath: 'id' });
        store.createIndex('week_key', 'week_key', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('Database geopend');
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('Database fout:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Save a recipe and its ingredients in a single transaction
async function saveRecipe(recipe, ingredients) {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(['recipes', 'ingredients'], 'readwrite');

    tx.objectStore('recipes').put(recipe);

    const ingStore = tx.objectStore('ingredients');
    ingredients.forEach(ing => ingStore.put(ing));

    tx.oncomplete = () => {
      console.log(`Recept opgeslagen: ${recipe.name}`);
      resolve();
    };
    tx.onerror = () => {
      console.error('Fout bij opslaan recept:', tx.error);
      reject(tx.error);
    };
  });
}

// Get all recipes, sorted alphabetically by name
async function getAllRecipes() {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction('recipes', 'readonly');
    const request = tx.objectStore('recipes').getAll();

    request.onsuccess = () => {
      const sorted = request.result.sort((a, b) =>
        a.name.localeCompare(b.name, 'nl')
      );
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

// Get a single recipe by id
async function getRecipe(id) {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction('recipes', 'readonly');
    const request = tx.objectStore('recipes').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all ingredients for a given recipe
async function getIngredients(recipeId) {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction('ingredients', 'readonly');
    const index = tx.objectStore('ingredients').index('recipe_id');
    const request = index.getAll(recipeId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete all ingredients for a recipe — used before re-saving on edit
async function deleteIngredients(recipeId) {
  const ingredients = await getIngredients(recipeId);
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction('ingredients', 'readwrite');
    const store = tx.objectStore('ingredients');
    ingredients.forEach(ing => store.delete(ing.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Update an existing recipe: replace its ingredients and overwrite the recipe record
async function updateRecipe(recipe, ingredients) {
  await deleteIngredients(recipe.id);
  return saveRecipe(recipe, ingredients);
}

// ── Week plan ────────────────────────────────────────────

// Get all day-slots for a given week
async function getWeekPlan(weekKey) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('week_plans', 'readonly');
    const request = tx.objectStore('week_plans').index('week_key').getAll(weekKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete all day-slots for a week (used before saving a new plan)
async function deleteWeekPlan(weekKey) {
  const existing = await getWeekPlan(weekKey);
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('week_plans', 'readwrite');
    const store = tx.objectStore('week_plans');
    existing.forEach(slot => store.delete(slot.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Save an array of week plan slot objects, replacing any existing plan for that week
async function saveWeekPlan(slots, weekKey) {
  await deleteWeekPlan(weekKey);
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('week_plans', 'readwrite');
    const store = tx.objectStore('week_plans');
    slots.forEach(slot => store.put(slot));
    tx.oncomplete = () => {
      console.log(`Weekplan opgeslagen: ${weekKey}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Set last_used_week on a list of recipes to mark them as recently used
async function markRecipesUsed(recipeIds, weekKey) {
  if (recipeIds.length === 0) return;
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('recipes', 'readwrite');
    const store = tx.objectStore('recipes');
    recipeIds.forEach(id => {
      const req = store.get(id);
      req.onsuccess = () => {
        const recipe = req.result;
        if (recipe) { recipe.last_used_week = weekKey; store.put(recipe); }
      };
    });
    tx.oncomplete = () => {
      console.log(`last_used_week bijgewerkt voor ${recipeIds.length} recept(en): ${weekKey}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Clear last_used_week for recipes that were marked for a specific week (used on regenerate)
async function unmarkRecipesUsed(recipeIds, weekKey) {
  if (recipeIds.length === 0) return;
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('recipes', 'readwrite');
    const store = tx.objectStore('recipes');
    recipeIds.forEach(id => {
      const req = store.get(id);
      req.onsuccess = () => {
        const recipe = req.result;
        if (recipe && recipe.last_used_week === weekKey) {
          recipe.last_used_week = null;
          store.put(recipe);
        }
      };
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Grocery list ─────────────────────────────────────────

// Get all grocery items for a week
async function getGroceryList(weekKey) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('grocery_items', 'readonly');
    const request = tx.objectStore('grocery_items').index('week_key').getAll(weekKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete all grocery items for a week
async function deleteGroceryList(weekKey) {
  const existing = await getGroceryList(weekKey);
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('grocery_items', 'readwrite');
    const store = tx.objectStore('grocery_items');
    existing.forEach(item => store.delete(item.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Save grocery items for a week, replacing any existing list
async function saveGroceryList(items, weekKey) {
  await deleteGroceryList(weekKey);
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('grocery_items', 'readwrite');
    const store = tx.objectStore('grocery_items');
    items.forEach(item => store.put(item));
    tx.oncomplete = () => {
      console.log(`Boodschappenlijst opgeslagen: ${items.length} items voor ${weekKey}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Flip the checked flag on a single grocery item
async function toggleGroceryItem(id, checked) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('grocery_items', 'readwrite');
    const store = tx.objectStore('grocery_items');
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) { item.checked = checked; store.put(item); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Recipes (delete) ─────────────────────────────────────

// Delete a recipe and all its ingredients
async function deleteRecipe(id) {
  const ingredients = await getIngredients(id);
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(['recipes', 'ingredients'], 'readwrite');

    tx.objectStore('recipes').delete(id);

    const ingStore = tx.objectStore('ingredients');
    ingredients.forEach(ing => ingStore.delete(ing.id));

    tx.oncomplete = () => {
      console.log(`Recept verwijderd: ${id}`);
      resolve();
    };
    tx.onerror = () => {
      console.error('Fout bij verwijderen recept:', tx.error);
      reject(tx.error);
    };
  });
}
