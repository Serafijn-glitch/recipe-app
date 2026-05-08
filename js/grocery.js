// grocery.js — grocery list generation

const CATEGORY_LABELS = {
  meat:    'Vlees',
  dairy:   'Zuivel',
  produce: 'Groente & fruit',
  pantry:  'Droogwaren',
  frozen:  'Diepvries',
  bakery:  'Bakkerij',
  other:   'Overig',
};

// Display order for categories in the list (produce first, dry goods last)
const CATEGORY_ORDER = ['produce', 'meat', 'dairy', 'bakery', 'pantry', 'frozen', 'other'];

// ── Generatie ────────────────────────────────────────────

// Combine ingredients with the same name + unit, summing their amounts.
// Ingredients that share a name but differ in unit stay separate.
function mergeIngredients(allIngredients) {
  const merged = new Map();

  for (const ing of allIngredients) {
    const key = `${ing.name.toLowerCase().trim()}__${(ing.unit || '').toLowerCase().trim()}`;

    if (merged.has(key)) {
      merged.get(key).amount += ing.amount;
    } else {
      merged.set(key, {
        name:     ing.name,
        amount:   ing.amount,
        unit:     ing.unit || '',
        category: ing.category || 'other',
      });
    }
  }

  return Array.from(merged.values());
}

// Build and save the grocery list from the week plan's cook slots
async function generateGroceryList(weekKey) {
  const slots     = await getWeekPlan(weekKey);
  const cookSlots = slots.filter(s => s.slot_type === 'cook' && s.recipe_id);

  if (cookSlots.length === 0) {
    console.log('Geen kookdagen in weekplan — boodschappenlijst niet mogelijk');
    return null;
  }

  // Collect all ingredients across every recipe being cooked this week
  const allIngredients = [];
  for (const slot of cookSlots) {
    const ings = await getIngredients(slot.recipe_id);
    allIngredients.push(...ings);
  }

  const merged = mergeIngredients(allIngredients);

  const items = merged.map(ing => ({
    id:       generateId(),
    week_key: weekKey,
    name:     ing.name,
    amount:   ing.amount,
    unit:     ing.unit,
    category: ing.category,
    checked:  false,
  }));

  await saveGroceryList(items, weekKey);
  console.log(`Boodschappenlijst aangemaakt: ${items.length} items (${cookSlots.length} recepten)`);
  return items;
}

// ── UI ───────────────────────────────────────────────────

// Re-render just the "X van Y ingekocht" line without touching the item rows
async function updateProgress(weekKey, el) {
  const items = await getGroceryList(weekKey);
  const done  = items.filter(i => i.checked).length;
  el.textContent = `${done} van ${items.length} ingekocht`;
}

async function renderGroceryList() {
  const today     = new Date();
  const weekKey   = getISOWeekKey(today);
  const monday    = getMondayOfWeek(today);
  const sunday    = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  document.getElementById('grocery-week-label').textContent =
    `${formatDutchDate(monday)} – ${formatDutchDate(sunday)}`;

  const container   = document.getElementById('grocery-list-container');
  const generateBtn = document.getElementById('btn-generate-grocery');
  const items       = await getGroceryList(weekKey);

  if (items.length === 0) {
    const slots = await getWeekPlan(weekKey);

    if (slots.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Maak eerst een weekplan aan via "Deze week".</p>';
      generateBtn.textContent = 'Lijst maken';
      generateBtn.disabled    = true;
    } else {
      container.innerHTML =
        '<p class="empty-state">Nog geen boodschappenlijst voor deze week.</p>';
      generateBtn.textContent = 'Lijst maken';
      generateBtn.disabled    = false;
    }
    return;
  }

  generateBtn.textContent = 'Opnieuw genereren';
  generateBtn.disabled    = false;

  container.innerHTML = '';

  // Progress line
  const progressEl       = document.createElement('p');
  progressEl.className   = 'grocery-progress';
  const done             = items.filter(i => i.checked).length;
  progressEl.textContent = `${done} van ${items.length} ingekocht`;
  container.appendChild(progressEl);

  // Group items by category
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || 'other';
    (byCategory[cat] = byCategory[cat] || []).push(item);
  }

  for (const cat of CATEGORY_ORDER) {
    if (!byCategory[cat]) continue;

    const section  = document.createElement('div');
    section.className = 'grocery-category';

    const heading  = document.createElement('h3');
    heading.className   = 'grocery-category-title';
    heading.textContent = CATEGORY_LABELS[cat] || cat;
    section.appendChild(heading);

    // Sort items alphabetically within each category
    const sorted = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    for (const item of sorted) {
      const row       = document.createElement('label');
      row.className   = `grocery-item${item.checked ? ' grocery-item-checked' : ''}`;
      row.dataset.id  = item.id;

      const amountStr = item.amount > 0
        ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
        : (item.unit || '');

      row.innerHTML = `
        <input type="checkbox" class="grocery-checkbox"${item.checked ? ' checked' : ''}>
        <span class="grocery-item-amount">${escapeHtml(amountStr)}</span>
        <span class="grocery-item-name">${escapeHtml(item.name)}</span>
      `;

      row.querySelector('.grocery-checkbox').addEventListener('change', async (e) => {
        const checked = e.target.checked;
        await toggleGroceryItem(item.id, checked);
        row.classList.toggle('grocery-item-checked', checked);
        await updateProgress(weekKey, progressEl);
        console.log(`${item.name}: ${checked ? 'ingekocht ✓' : 'nog nodig'}`);
      });

      section.appendChild(row);
    }

    container.appendChild(section);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const weekKey     = getISOWeekKey(new Date());
  const generateBtn = document.getElementById('btn-generate-grocery');

  generateBtn.addEventListener('click', async () => {
    const existing = await getGroceryList(weekKey);
    if (existing.length > 0 && !confirm('Er is al een boodschappenlijst. Opnieuw genereren?')) return;

    generateBtn.disabled    = true;
    generateBtn.textContent = 'Bezig…';

    const result = await generateGroceryList(weekKey);

    if (result === null) {
      alert('Maak eerst een weekplan aan via "Deze week".');
    } else if (result.length === 0) {
      alert('De recepten in het weekplan hebben geen ingrediënten. Voeg ingrediënten toe aan je recepten.');
    }

    generateBtn.disabled = false;
    await renderGroceryList();
  });

  // Re-render whenever the user navigates to this tab, so it reflects
  // a newly created week plan without requiring a page reload
  window.addEventListener('hashchange', () => {
    if (location.hash === '#boodschappen') {
      renderGroceryList().catch(err => console.error('Fout bij laden boodschappenlijst:', err));
    }
  });

  renderGroceryList().catch(err => console.error('Fout bij laden boodschappenlijst:', err));
  console.log('grocery.js geladen');
});
