// recipes.js — add, edit, delete recipes

// Houdt het recept bij dat momenteel bewerkt wordt (null = nieuw recept)
let originalRecipe = null;

// Generate a simple UUID v4 — fallback for non-secure contexts (e.g. file://)
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Escape user content before inserting into innerHTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Ingrediëntrijen ──────────────────────────────────────

// Build one ingredient row; optionally pre-fill with existing data
function addIngredientRow(data = null) {
  const list = document.getElementById('ingredients-list');
  const index = list.children.length;

  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <input type="text"   class="ing-name"     placeholder="Ingrediënt"   aria-label="Naam ingrediënt"  value="${data ? escapeHtml(data.name) : ''}">
    <input type="number" class="ing-amount"   placeholder="Hoeveelheid" min="0" aria-label="Hoeveelheid" value="${data ? data.amount : ''}">
    <input type="text"   class="ing-unit"     placeholder="Eenheid"      aria-label="Eenheid"           value="${data ? escapeHtml(data.unit) : ''}">
    <select class="ing-category" aria-label="Categorie">
      <option value="">Categorie</option>
      <option value="meat"    ${data && data.category === 'meat'    ? 'selected' : ''}>Vlees</option>
      <option value="dairy"   ${data && data.category === 'dairy'   ? 'selected' : ''}>Zuivel</option>
      <option value="produce" ${data && data.category === 'produce' ? 'selected' : ''}>Groente &amp; fruit</option>
      <option value="pantry"  ${data && data.category === 'pantry'  ? 'selected' : ''}>Droogwaren</option>
      <option value="frozen"  ${data && data.category === 'frozen'  ? 'selected' : ''}>Diepvries</option>
      <option value="bakery"  ${data && data.category === 'bakery'  ? 'selected' : ''}>Bakkerij</option>
      <option value="other"   ${data && data.category === 'other'   ? 'selected' : ''}>Overig</option>
    </select>
    <button type="button" class="btn-remove-ingredient" aria-label="Ingrediënt verwijderen">&times;</button>
  `;

  row.querySelector('.btn-remove-ingredient').addEventListener('click', () => row.remove());
  list.appendChild(row);
  if (!data) console.log(`Ingrediëntrij ${index + 1} toegevoegd`);
}

// Read all filled-in ingredient rows and return an array of ingredient objects
function collectIngredients(recipeId) {
  const rows = document.querySelectorAll('.ingredient-row');
  const ingredients = [];

  rows.forEach((row) => {
    const name = row.querySelector('.ing-name').value.trim();
    if (!name) return; // lege rijen overslaan

    ingredients.push({
      id: generateId(),
      recipe_id: recipeId,
      name,
      amount: parseFloat(row.querySelector('.ing-amount').value) || 0,
      unit: row.querySelector('.ing-unit').value.trim(),
      category: row.querySelector('.ing-category').value || 'other',
    });
  });

  return ingredients;
}

// Read the form and return a complete recipe object
function collectRecipeForm() {
  // In bewerkmode: behoud het originele id, created_at en last_used_week
  const id           = originalRecipe ? originalRecipe.id          : generateId();
  const created_at   = originalRecipe ? originalRecipe.created_at  : new Date().toISOString();
  const last_used_week = originalRecipe ? originalRecipe.last_used_week : null;

  const recipe = {
    id,
    name:             document.getElementById('recipe-name').value.trim(),
    description:      document.getElementById('recipe-description').value.trim(),
    prep_minutes:     parseInt(document.getElementById('recipe-prep').value)     || 0,
    cook_minutes:     parseInt(document.getElementById('recipe-cook').value)     || 0,
    default_servings: parseInt(document.getElementById('recipe-servings').value) || 1,
    is_weekend:       document.getElementById('recipe-is-weekend').checked,
    has_leftovers:    document.getElementById('recipe-has-leftovers').checked,
    instructions:     document.getElementById('recipe-instructions').value.trim(),
    created_at,
    last_used_week,
  };

  const ingredients = collectIngredients(id);
  return { recipe, ingredients };
}

// Reset the form back to empty
function resetRecipeForm() {
  document.getElementById('recipe-form').reset();
  document.getElementById('ingredients-list').innerHTML = '';
  originalRecipe = null;
}

// ── Navigatie tussen subviews ────────────────────────────

function showRecipeList() {
  document.getElementById('recipe-form-view').classList.add('hidden');
  document.getElementById('recipe-detail-view').classList.add('hidden');
  document.getElementById('recipe-list-view').classList.remove('hidden');
  resetRecipeForm();
  console.log('Receptenlijst geopend');
}

function showRecipeForm(recipe = null) {
  originalRecipe = recipe;
  document.getElementById('recipe-list-view').classList.add('hidden');
  document.getElementById('recipe-detail-view').classList.add('hidden');
  document.getElementById('recipe-form-view').classList.remove('hidden');
  document.getElementById('form-title').textContent =
    recipe ? 'Recept bewerken' : 'Nieuw recept';
  console.log(recipe ? `Recept bewerken: ${recipe.name}` : 'Nieuw recept formulier geopend');
}

function showRecipeDetail() {
  document.getElementById('recipe-list-view').classList.add('hidden');
  document.getElementById('recipe-form-view').classList.add('hidden');
  document.getElementById('recipe-detail-view').classList.remove('hidden');
}

// ── Detailweergave vullen ────────────────────────────────

async function openRecipeDetail(recipe) {
  const ingredients = await getIngredients(recipe.id);
  populateDetailView(recipe, ingredients);
  showRecipeDetail();
  console.log(`Detailweergave geopend: ${recipe.name}`);
}

function populateDetailView(recipe, ingredients) {
  const totalMin = recipe.prep_minutes + recipe.cook_minutes;

  // Badges
  const badges = [
    recipe.is_weekend    ? '<span class="badge badge-weekend">weekend</span>'   : '',
    recipe.has_leftovers ? '<span class="badge badge-leftovers">restjes</span>' : '',
  ].filter(Boolean).join(' ');

  // Statistieken-rij
  const stats = [];
  if (recipe.prep_minutes) stats.push(`<div class="detail-stat"><span class="detail-stat-label">Bereiding</span><span class="detail-stat-value">${recipe.prep_minutes} min</span></div>`);
  if (recipe.cook_minutes)  stats.push(`<div class="detail-stat"><span class="detail-stat-label">Kooktijd</span><span class="detail-stat-value">${recipe.cook_minutes} min</span></div>`);
  if (totalMin > 0)         stats.push(`<div class="detail-stat"><span class="detail-stat-label">Totaal</span><span class="detail-stat-value">${totalMin} min</span></div>`);
  stats.push(`<div class="detail-stat"><span class="detail-stat-label">Porties</span><span class="detail-stat-value">${recipe.default_servings}</span></div>`);

  // Ingrediëntenlijst
  let ingHtml = '';
  if (ingredients.length > 0) {
    const rows = ingredients.map(ing => {
      const amt = ing.amount ? `${ing.amount}${ing.unit ? ' ' + escapeHtml(ing.unit) : ''}` : (ing.unit ? escapeHtml(ing.unit) : '');
      return `<li class="detail-ingredient">${amt ? `<span class="detail-ing-amount">${amt}</span>` : ''}<span>${escapeHtml(ing.name)}</span></li>`;
    }).join('');
    ingHtml = `
      <div class="detail-section">
        <h3 class="detail-section-title">Ingrediënten</h3>
        <ul class="detail-ingredient-list">${rows}</ul>
      </div>`;
  }

  // Bereiding
  const instrHtml = recipe.instructions ? `
    <div class="detail-section">
      <h3 class="detail-section-title">Bereiding</h3>
      <p class="detail-instructions">${escapeHtml(recipe.instructions).replace(/\n/g, '<br>')}</p>
    </div>` : '';

  document.getElementById('detail-content').innerHTML = `
    <h2 class="detail-name">${escapeHtml(recipe.name)}</h2>
    ${recipe.description ? `<p class="detail-description">${escapeHtml(recipe.description)}</p>` : ''}
    <div class="detail-meta-row">${stats.join('')}${badges ? `<div class="detail-badges">${badges}</div>` : ''}</div>
    ${ingHtml}
    ${instrHtml}
  `;

  // Koppel de bewerkknop aan dit recept
  document.getElementById('btn-edit-recipe').onclick = async () => {
    const ing = await getIngredients(recipe.id);
    showRecipeForm(recipe);
    resetRecipeForm();
    originalRecipe = recipe; // reset wist originalRecipe, zet het terug

    // Formulier invullen met bestaande waarden
    document.getElementById('recipe-name').value         = recipe.name;
    document.getElementById('recipe-description').value  = recipe.description || '';
    document.getElementById('recipe-prep').value         = recipe.prep_minutes  || '';
    document.getElementById('recipe-cook').value         = recipe.cook_minutes  || '';
    document.getElementById('recipe-servings').value     = recipe.default_servings || '';
    document.getElementById('recipe-instructions').value = recipe.instructions  || '';
    document.getElementById('recipe-is-weekend').checked  = recipe.is_weekend;
    document.getElementById('recipe-has-leftovers').checked = recipe.has_leftovers;

    ing.forEach(i => addIngredientRow(i));
    console.log(`Formulier ingevuld voor bewerken: ${recipe.name}`);
  };

  // Koppel de verwijderknop aan dit recept
  document.getElementById('btn-delete-recipe-detail').onclick = async () => {
    if (!confirm(`"${recipe.name}" verwijderen?`)) return;
    await deleteRecipe(recipe.id);
    console.log(`Recept verwijderd: ${recipe.name}`);
    showRecipeList();
    await renderRecipeList();
  };
}

// ── Receptenlijst renderen ───────────────────────────────

async function renderRecipeList() {
  const cards = document.getElementById('recipe-cards');
  const empty = document.getElementById('recipe-list-empty');
  const recipes = await getAllRecipes();

  cards.innerHTML = '';

  if (recipes.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  recipes.forEach(recipe => {
    const totalMin = recipe.prep_minutes + recipe.cook_minutes;
    const timeLabel = totalMin > 0 ? `${totalMin} min` : null;
    const meta = [timeLabel, `${recipe.default_servings} port.`].filter(Boolean).join(' · ');

    const badges = [
      recipe.is_weekend    ? '<span class="badge badge-weekend">weekend</span>'   : '',
      recipe.has_leftovers ? '<span class="badge badge-leftovers">restjes</span>' : '',
    ].join('');

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.id = recipe.id;
    card.innerHTML = `
      <div class="recipe-card-body">
        <span class="recipe-card-name">${escapeHtml(recipe.name)}</span>
        <span class="recipe-card-meta">${escapeHtml(meta)}${badges ? ' ' + badges : ''}</span>
      </div>
      <button class="btn-delete-recipe" aria-label="Verwijder recept" data-id="${recipe.id}">✕</button>
    `;

    // Tik op de kaart → detailweergave
    card.querySelector('.recipe-card-body').addEventListener('click', () => {
      openRecipeDetail(recipe);
    });

    // Verwijderknop (snel, zonder detailweergave)
    card.querySelector('.btn-delete-recipe').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${recipe.name}" verwijderen?`)) return;
      await deleteRecipe(recipe.id);
      console.log(`Recept verwijderd: ${recipe.name}`);
      renderRecipeList();
    });

    cards.appendChild(card);
  });

  console.log(`${recipes.length} recept(en) geladen`);
}

// ── Formulier opslaan ────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-recipe').addEventListener('click', () => showRecipeForm());
  document.getElementById('btn-back-to-list').addEventListener('click', showRecipeList);
  document.getElementById('btn-back-from-detail').addEventListener('click', showRecipeList);
  document.getElementById('btn-add-ingredient').addEventListener('click', () => addIngredientRow());

  document.getElementById('recipe-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const { recipe, ingredients } = collectRecipeForm();

    if (!recipe.name) {
      alert('Vul een naam in voor het recept.');
      return;
    }

    if (originalRecipe) {
      console.log(`Recept bijwerken: ${recipe.name}`);
      await updateRecipe(recipe, ingredients);
    } else {
      console.log(`Recept opslaan: ${recipe.name}`);
      await saveRecipe(recipe, ingredients);
    }

    showRecipeList();
    await renderRecipeList();
  });

  renderRecipeList();
  console.log('recipes.js geladen');
});
