// scheduler.js — weekly recipe picker logic

const DAY_KEYS   = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

// ── Datumhulpfuncties ────────────────────────────────────

// Compute the ISO week key for any date, e.g. "2026-W19"
function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Move to Thursday of this week (ISO weeks are identified by their Thursday)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const weekNum = 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// Compute the ISO week key for the week before the given date
function getPrevWeekKey(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return getISOWeekKey(d);
}

// Return the Monday of the week containing the given date
function getMondayOfWeek(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  d.setHours(0, 0, 0, 0);
  return d;
}

// Format a Date as "5 mei" in Dutch
function formatDutchDate(date) {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
}

// ── Selectie-algoritme ───────────────────────────────────

// Fisher-Yates shuffle (mutates and returns the array)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Rule 4: exclude recipes used last week. Rule 2: at most 2 weekend recipes.
// Returns up to 5 recipes.
function selectRecipes(allRecipes, lastWeekKey) {
  const available = allRecipes.filter(r => r.last_used_week !== lastWeekKey);

  const weekendPool = shuffle(available.filter(r =>  r.is_weekend));
  const weekdayPool = shuffle(available.filter(r => !r.is_weekend));

  // Take at most 2 weekend recipes, fill the rest with weekday recipes
  const chosen = [
    ...weekendPool.slice(0, 2),
    ...weekdayPool.slice(0, 5 - Math.min(weekendPool.length, 2)),
  ];

  console.log(`Geselecteerde recepten (${chosen.length}): ${chosen.map(r => r.name).join(', ')}`);
  return chosen;
}

// ── Inplanningsalgoritme ─────────────────────────────────

// Assign recipes to the 7 days of the week, respecting all scheduler rules.
// Returns an array of 7 slot-descriptors: { recipeId, slotType } | null
function assignDays(chosenRecipes) {
  const plan = Array(7).fill(null);

  // Rule 3: leftovers recipes are most constrained — place them first
  const leftoversRecipes = shuffle(chosenRecipes.filter(r =>  r.has_leftovers));
  const regularRecipes   = shuffle(chosenRecipes.filter(r => !r.has_leftovers));

  for (const recipe of leftoversRecipes) {
    // A leftovers recipe on day d forces day d+2 to be a leftover slot.
    // Weekend leftovers recipes: only Friday (d=4) keeps d+2=Sunday within the week.
    // Regular leftovers recipes: Monday–Friday (d=0..4) keeps d+2 within the week.
    const candidates = (recipe.is_weekend ? [4] : [0, 1, 2, 3, 4])
      .filter(d => plan[d] === null && plan[d + 2] === null);

    if (candidates.length === 0) {
      // Can't fit leftovers pattern — treat as a regular recipe this week
      console.log(`Geen plek voor restjespatroon, normaal inplannen: ${recipe.name}`);
      regularRecipes.push(recipe);
      continue;
    }

    const d = candidates[Math.floor(Math.random() * candidates.length)];
    plan[d]     = { recipeId: recipe.id, slotType: 'cook' };
    plan[d + 2] = { recipeId: null,      slotType: 'leftover' };
    console.log(`"${recipe.name}" ingepland op ${DAY_LABELS[d]}, restjes op ${DAY_LABELS[d + 2]}`);
  }

  // Place remaining recipes (and any demoted leftovers recipes)
  for (const recipe of regularRecipes) {
    // Rule 2: weekend recipes may only go on Friday, Saturday, or Sunday (indices 4–6)
    const candidates = (recipe.is_weekend ? [4, 5, 6] : [0, 1, 2, 3, 4, 5, 6])
      .filter(d => plan[d] === null);

    if (candidates.length === 0) {
      console.log(`Geen vrije dag voor recept: ${recipe.name}`);
      continue;
    }

    const d = candidates[Math.floor(Math.random() * candidates.length)];
    plan[d] = { recipeId: recipe.id, slotType: 'cook' };
    console.log(`"${recipe.name}" ingepland op ${DAY_LABELS[d]}`);
  }

  return plan;
}

// Convert the plan array into storable week_plan objects
function buildSlots(plan, weekKey) {
  return plan.map((slot, i) => ({
    id:        generateId(),
    week_key:  weekKey,
    day:       DAY_KEYS[i],
    recipe_id: slot ? slot.recipeId : null,
    slot_type: slot ? slot.slotType : 'skip',
  }));
}

// ── Hoofd-entrypoint ─────────────────────────────────────

// Generate a new week plan, save it, and mark used recipes. Returns the saved slots.
async function generateAndSaveWeekPlan(weekKey) {
  const lastWeekKey = getPrevWeekKey(new Date());
  const allRecipes  = await getAllRecipes();

  if (allRecipes.length === 0) {
    console.log('Geen recepten beschikbaar');
    return null;
  }

  // On regenerate: first undo the last_used_week marks we set for this week
  const existingSlots = await getWeekPlan(weekKey);
  if (existingSlots.length > 0) {
    const oldIds = existingSlots
      .filter(s => s.slot_type === 'cook' && s.recipe_id)
      .map(s => s.recipe_id);
    await unmarkRecipesUsed(oldIds, weekKey);
  }

  const chosen = selectRecipes(await getAllRecipes(), lastWeekKey);

  if (chosen.length === 0) {
    console.log('Alle recepten gebruikt vorige week — geen keuze mogelijk');
    return null;
  }

  const plan  = assignDays(chosen);
  const slots = buildSlots(plan, weekKey);

  await saveWeekPlan(slots, weekKey);

  // Rule 4: record this week's key on every cooked recipe
  const cookedIds = slots
    .filter(s => s.slot_type === 'cook' && s.recipe_id)
    .map(s => s.recipe_id);
  await markRecipesUsed(cookedIds, weekKey);

  console.log(`Weekplan klaar: ${weekKey}, ${cookedIds.length} kookdagen`);
  return slots;
}

// ── UI ───────────────────────────────────────────────────

async function renderWeekPlan() {
  const today   = new Date();
  const weekKey = getISOWeekKey(today);
  const monday  = getMondayOfWeek(today);
  const sunday  = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Week label in the header: "5–11 mei"
  const startStr = formatDutchDate(monday);
  const endStr   = formatDutchDate(sunday);
  document.getElementById('week-label').textContent = `${startStr} – ${endStr}`;

  const slots      = await getWeekPlan(weekKey);
  const container  = document.getElementById('week-plan-container');
  const generateBtn = document.getElementById('btn-generate-week');

  if (slots.length === 0) {
    container.innerHTML = '<p class="empty-state">Nog geen weekplan voor deze week.</p>';
    generateBtn.textContent = 'Weekplan maken';
    return;
  }

  generateBtn.textContent = 'Opnieuw genereren';

  // Build a recipe lookup for display
  const allRecipes = await getAllRecipes();
  const recipeMap  = Object.fromEntries(allRecipes.map(r => [r.id, r]));

  // Sort slots into Monday–Sunday order
  const ordered = DAY_KEYS.map(key => slots.find(s => s.day === key));

  container.innerHTML = '';

  ordered.forEach((slot, i) => {
    if (!slot) return;

    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);

    let recipeName = '—';
    let cardClass  = 'week-day-skip';

    if (slot.slot_type === 'cook' && slot.recipe_id) {
      const recipe = recipeMap[slot.recipe_id];
      recipeName   = recipe ? recipe.name : 'Onbekend recept';
      cardClass    = 'week-day-cook';
    } else if (slot.slot_type === 'leftover') {
      recipeName = 'Restjes';
      cardClass  = 'week-day-leftover';
    }

    const card = document.createElement('div');
    card.className = `week-day-card ${cardClass}`;
    card.innerHTML = `
      <div class="week-day-info">
        <span class="week-day-name">${DAY_LABELS[i]}</span>
        <span class="week-day-date">${formatDutchDate(dayDate)}</span>
      </div>
      <span class="week-day-recipe">${escapeHtml(recipeName)}</span>
    `;
    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const weekKey     = getISOWeekKey(new Date());
  const generateBtn = document.getElementById('btn-generate-week');

  generateBtn.addEventListener('click', async () => {
    const existing = await getWeekPlan(weekKey);

    if (existing.length > 0 && !confirm('Er is al een weekplan. Opnieuw genereren?')) return;

    generateBtn.disabled    = true;
    generateBtn.textContent = 'Bezig…';

    const slots = await generateAndSaveWeekPlan(weekKey);

    generateBtn.disabled = false;

    if (!slots) {
      alert('Niet genoeg recepten om een weekplan te maken. Voeg eerst meer recepten toe.');
    }

    await renderWeekPlan();
  });

  renderWeekPlan().catch(err => console.error('Fout bij laden weekplan:', err));
  console.log('scheduler.js geladen');
});
