const DATA_PATH = "data/trip-data.json";
const LEGACY_STORAGE_KEY = "spliwise-lite-state";

let state = window.SpliwiseShared.sanitizeState({});

const manageElements = {
  tripName: document.querySelector("#trip-name"),
  tripCurrency: document.querySelector("#trip-currency"),
  managerStatus: document.querySelector("#manager-status"),
  loadRepoData: document.querySelector("#load-repo-data"),
  importLegacy: document.querySelector("#import-legacy"),
  importFile: document.querySelector("#import-file"),
  exportJson: document.querySelector("#export-json"),
  clearDraft: document.querySelector("#clear-draft"),
  personForm: document.querySelector("#person-form"),
  personName: document.querySelector("#person-name"),
  peopleList: document.querySelector("#people-list"),
  expenseForm: document.querySelector("#expense-form"),
  expenseTitle: document.querySelector("#expense-title"),
  expenseAmount: document.querySelector("#expense-amount"),
  expensePaidBy: document.querySelector("#expense-paid-by"),
  expenseNotes: document.querySelector("#expense-notes"),
  splitPeople: document.querySelector("#split-people"),
  expenseSubmit: document.querySelector("#expense-submit"),
  expenseCancel: document.querySelector("#expense-cancel"),
  expenseList: document.querySelector("#expense-list"),
  summaryCards: document.querySelector("#summary-cards"),
  settlementList: document.querySelector("#settlement-list"),
  emptyStateTemplate: document.querySelector("#empty-state-template"),
};

const expenseDraft = {
  editingId: null,
};

initializeManager();

function initializeManager() {
  manageElements.tripName.addEventListener("input", (event) => {
    state.tripName = event.target.value.trimStart();
  });

  manageElements.tripCurrency.addEventListener("input", (event) => {
    event.target.value = window.SpliwiseShared.sanitizeCurrencyInput(event.target.value);
  });
  manageElements.tripCurrency.addEventListener("change", commitCurrencyInput);
  manageElements.tripCurrency.addEventListener("blur", commitCurrencyInput);

  manageElements.loadRepoData.addEventListener("click", loadRepoData);
  manageElements.importLegacy.addEventListener("click", importLegacyBrowserData);
  manageElements.importFile.addEventListener("change", handleImportFile);
  manageElements.exportJson.addEventListener("click", exportJson);
  manageElements.clearDraft.addEventListener("click", clearDraft);
  manageElements.personForm.addEventListener("submit", handleAddPerson);
  manageElements.expenseForm.addEventListener("submit", handleSaveExpense);
  manageElements.expenseCancel.addEventListener("click", resetExpenseForm);

  renderAll();
}

function renderAll() {
  manageElements.tripName.value = state.tripName;
  manageElements.tripCurrency.value = state.currency;
  renderPeople();
  renderExpenseControls();
  renderExpenseList();
  renderSummary();
}

function handleAddPerson(event) {
  event.preventDefault();

  const name = manageElements.personName.value.trim();
  if (!name) {
    updateManagerStatus("Enter a person's name first.");
    return;
  }

  state.people.push({
    id: window.SpliwiseShared.createId(),
    name,
  });

  manageElements.personName.value = "";
  renderAll();
  updateManagerStatus(`${name} was added to the draft.`);
}

function handleSaveExpense(event) {
  event.preventDefault();

  if (state.people.length === 0) {
    updateManagerStatus("Add at least one person before recording an expense.");
    return;
  }

  const title = manageElements.expenseTitle.value.trim();
  const amountValue = Number.parseFloat(manageElements.expenseAmount.value);
  const notes = manageElements.expenseNotes.value.trim();
  const paidById = manageElements.expensePaidBy.value;
  const splitWithIds = Array.from(
    manageElements.splitPeople.querySelectorAll("input[type='checkbox']:checked"),
    (input) => input.value
  );

  if (!title) {
    updateManagerStatus("Add a short label so people know what this expense was for.");
    return;
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    updateManagerStatus("Enter an amount greater than zero.");
    return;
  }

  if (!paidById) {
    updateManagerStatus("Choose who paid for this item.");
    return;
  }

  if (splitWithIds.length === 0) {
    updateManagerStatus("Select at least one person to split the item with.");
    return;
  }

  const isEditing = Boolean(expenseDraft.editingId);
  const expense = {
    id: expenseDraft.editingId ?? window.SpliwiseShared.createId(),
    title,
    notes,
    paidById,
    participantIds: splitWithIds,
    amountCents: window.SpliwiseShared.toCents(amountValue),
  };

  if (isEditing) {
    const index = state.expenses.findIndex((item) => item.id === expenseDraft.editingId);
    if (index >= 0) {
      state.expenses[index] = expense;
    }
  } else {
    state.expenses.unshift(expense);
  }

  renderAll();
  resetExpenseForm();
  updateManagerStatus(isEditing ? "Expense updated in the draft." : "Expense added to the draft.");
}

function renderPeople() {
  manageElements.peopleList.innerHTML = "";

  if (state.people.length === 0) {
    manageElements.peopleList.append(
      window.SpliwiseShared.createEmptyState(
        manageElements.emptyStateTemplate,
        "Start with your group",
        "Add everyone who joined the trip, including yourself."
      )
    );
    return;
  }

  state.people.forEach((person) => {
    const card = document.createElement("div");
    card.className = "person-card";

    const details = document.createElement("div");
    details.innerHTML = `
      <div class="person-name">${window.SpliwiseShared.escapeHtml(person.name)}</div>
      <div class="muted-text">Included in the split calculations</div>
    `;

    const actions = document.createElement("div");
    actions.className = "action-row";

    const renameButton = document.createElement("button");
    renameButton.className = "button ghost small";
    renameButton.type = "button";
    renameButton.textContent = "Rename";
    renameButton.addEventListener("click", () => renamePerson(person.id));

    const removeButton = document.createElement("button");
    removeButton.className = "button ghost small";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removePerson(person.id));

    actions.append(renameButton, removeButton);
    card.append(details, actions);
    manageElements.peopleList.append(card);
  });
}

function renderExpenseControls() {
  manageElements.expensePaidBy.innerHTML = "";
  manageElements.splitPeople.innerHTML = "";

  if (state.people.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Add people first";
    manageElements.expensePaidBy.append(option);
    return;
  }

  state.people.forEach((person, index) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    if (!expenseDraft.editingId && index === 0) {
      option.selected = true;
    }
    manageElements.expensePaidBy.append(option);

    const label = document.createElement("label");
    label.className = "checkbox-pill";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = person.id;
    input.checked = true;

    const text = document.createElement("span");
    text.textContent = person.name;

    label.append(input, text);
    manageElements.splitPeople.append(label);
  });
}

function renderExpenseList() {
  manageElements.expenseList.innerHTML = "";

  if (state.expenses.length === 0) {
    manageElements.expenseList.append(
      window.SpliwiseShared.createEmptyState(
        manageElements.emptyStateTemplate,
        "No draft expenses yet",
        "Import your old browser data or add fresh expenses here, then export the JSON file."
      )
    );
    return;
  }

  state.expenses.forEach((expense) => {
    const card = document.createElement("article");
    card.className = "expense-card";

    const top = document.createElement("div");
    top.className = "expense-card-top";

    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "expense-title";
    title.textContent = expense.title;

    const notes = document.createElement("p");
    notes.className = "expense-notes";
    notes.textContent = expense.notes || "No extra notes.";

    details.append(title, notes);

    const amount = document.createElement("div");
    amount.className = "expense-amount";
    amount.textContent = window.SpliwiseShared.formatMoney(expense.amountCents, state.currency);

    top.append(details, amount);

    const meta = document.createElement("div");
    meta.className = "expense-meta";
    meta.innerHTML = `
      <span class="tag">Paid by ${window.SpliwiseShared.escapeHtml(window.SpliwiseShared.getPersonName(state, expense.paidById))}</span>
      <span class="tag">Split between ${expense.participantIds.length} ${expense.participantIds.length === 1 ? "person" : "people"}</span>
    `;

    const splitLine = document.createElement("p");
    splitLine.className = "expense-split-line";
    splitLine.textContent = `Split between: ${expense.participantIds
      .map((personId) => window.SpliwiseShared.getPersonName(state, personId))
      .join(", ")}`;

    const actions = document.createElement("div");
    actions.className = "action-row";

    const editButton = document.createElement("button");
    editButton.className = "button ghost small";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => loadExpenseIntoForm(expense.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "button ghost small";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteExpense(expense.id));

    actions.append(editButton, deleteButton);
    card.append(top, meta, splitLine, actions);
    manageElements.expenseList.append(card);
  });
}

function renderSummary() {
  const summary = window.SpliwiseShared.calculateSummary(state);
  manageElements.summaryCards.innerHTML = "";
  manageElements.settlementList.innerHTML = "";

  if (state.people.length === 0) {
    manageElements.summaryCards.append(
      window.SpliwiseShared.createEmptyState(
        manageElements.emptyStateTemplate,
        "No group yet",
        "Add people first so the preview can calculate each person's share."
      )
    );
    manageElements.settlementList.append(
      window.SpliwiseShared.createEmptyState(
        manageElements.emptyStateTemplate,
        "No settlement yet",
        "Settlement suggestions appear after you add expenses."
      )
    );
    return;
  }

  summary.totals.forEach((personTotal) => {
    manageElements.summaryCards.append(buildSummaryCard(personTotal, state.currency));
  });

  if (summary.settlements.length === 0) {
    manageElements.settlementList.append(
      window.SpliwiseShared.createEmptyState(
        manageElements.emptyStateTemplate,
        "Everyone is even",
        "No extra transfers are needed based on the current draft."
      )
    );
    return;
  }

  summary.settlements.forEach((settlement) => {
    const item = document.createElement("article");
    item.className = "settlement-item";
    item.innerHTML = `
      <div class="settlement-row">
        <strong>${window.SpliwiseShared.escapeHtml(settlement.fromName)}</strong>
        <span class="muted-text">pays</span>
        <strong>${window.SpliwiseShared.escapeHtml(settlement.toName)}</strong>
      </div>
      <div class="settlement-amount">${window.SpliwiseShared.formatMoney(settlement.amountCents, state.currency)}</div>
    `;
    manageElements.settlementList.append(item);
  });
}

function buildSummaryCard(personTotal, currency) {
  const netClass =
    personTotal.netCents > 0 ? "positive" : personTotal.netCents < 0 ? "negative" : "neutral";
  const netLabel =
    personTotal.netCents > 0
      ? `${personTotal.name} should receive ${window.SpliwiseShared.formatMoney(personTotal.netCents, currency)}`
      : personTotal.netCents < 0
        ? `${personTotal.name} owes ${window.SpliwiseShared.formatMoney(Math.abs(personTotal.netCents), currency)}`
        : `${personTotal.name} is settled`;

  const card = document.createElement("article");
  card.className = "summary-card";

  const title = document.createElement("h3");
  title.textContent = personTotal.name;

  const shareList = document.createElement("div");
  shareList.className = "summary-share-list";

  if (personTotal.shareItems.length === 0) {
    const note = document.createElement("p");
    note.className = "summary-share-note";
    note.textContent = "No shared items for this person yet.";
    shareList.append(note);
  } else {
    personTotal.shareItems.forEach((item) => {
      const shareItem = document.createElement("div");
      shareItem.className = "summary-share-item";
      shareItem.innerHTML = `
        <div class="summary-share-top">
          <strong>${window.SpliwiseShared.escapeHtml(item.title)}</strong>
          <span>${window.SpliwiseShared.formatMoney(item.shareCents, currency)}</span>
        </div>
        <p class="summary-share-note">${window.SpliwiseShared.escapeHtml(item.meta)}</p>
      `;
      shareList.append(shareItem);
    });
  }

  const divider = document.createElement("div");
  divider.className = "summary-divider";

  const paidRow = document.createElement("div");
  paidRow.className = "summary-meta";
  paidRow.innerHTML = `<span>Paid</span><strong>${window.SpliwiseShared.formatMoney(personTotal.paidCents, currency)}</strong>`;

  const shareRow = document.createElement("div");
  shareRow.className = "summary-meta";
  shareRow.innerHTML = `<span>Total share</span><strong>${window.SpliwiseShared.formatMoney(personTotal.shareCents, currency)}</strong>`;

  const netChip = document.createElement("div");
  netChip.className = `net-chip ${netClass}`;
  netChip.textContent = netLabel;

  card.append(title, shareList, divider, paidRow, shareRow, netChip);
  return card;
}

function renamePerson(personId) {
  const person = state.people.find((entry) => entry.id === personId);
  if (!person) {
    return;
  }

  const newName = window.prompt("Rename person", person.name);
  if (newName === null) {
    return;
  }

  const trimmed = newName.trim();
  if (!trimmed) {
    updateManagerStatus("Name cannot be empty.");
    return;
  }

  person.name = trimmed;
  renderAll();
  updateManagerStatus("Person renamed in the draft.");
}

function removePerson(personId) {
  const isUsed = state.expenses.some(
    (expense) => expense.paidById === personId || expense.participantIds.includes(personId)
  );

  if (isUsed) {
    updateManagerStatus("Remove or edit expenses that use this person before deleting them.");
    return;
  }

  state.people = state.people.filter((person) => person.id !== personId);
  renderAll();
  updateManagerStatus("Person removed from the draft.");
}

function loadExpenseIntoForm(expenseId) {
  const expense = state.expenses.find((item) => item.id === expenseId);
  if (!expense) {
    return;
  }

  expenseDraft.editingId = expense.id;
  manageElements.expenseTitle.value = expense.title;
  manageElements.expenseAmount.value = (expense.amountCents / 100).toFixed(2);
  manageElements.expenseNotes.value = expense.notes;
  manageElements.expensePaidBy.value = expense.paidById;

  Array.from(manageElements.splitPeople.querySelectorAll("input[type='checkbox']")).forEach((input) => {
    input.checked = expense.participantIds.includes(input.value);
  });

  manageElements.expenseSubmit.textContent = "Save item";
  manageElements.expenseCancel.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteExpense(expenseId) {
  state.expenses = state.expenses.filter((expense) => expense.id !== expenseId);

  if (expenseDraft.editingId === expenseId) {
    resetExpenseForm();
  }

  renderAll();
  updateManagerStatus("Expense removed from the draft.");
}

function resetExpenseForm() {
  expenseDraft.editingId = null;
  manageElements.expenseForm.reset();
  manageElements.expenseSubmit.textContent = "Add item";
  manageElements.expenseCancel.classList.add("hidden");

  if (state.people.length > 0) {
    manageElements.expensePaidBy.value = state.people[0].id;
    Array.from(manageElements.splitPeople.querySelectorAll("input[type='checkbox']")).forEach((input) => {
      input.checked = true;
    });
  }
}

function commitCurrencyInput() {
  state.currency = window.SpliwiseShared.normalizeCurrencyCode(manageElements.tripCurrency.value);
  manageElements.tripCurrency.value = state.currency;
  renderAll();
}

async function loadRepoData() {
  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    replaceState(await response.json());
    updateManagerStatus("Loaded data/trip-data.json into the draft.");
  } catch (error) {
    console.error("Failed to load repo JSON", error);
    updateManagerStatus("Could not load data/trip-data.json. Import a local JSON file instead.");
  }
}

function importLegacyBrowserData() {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      updateManagerStatus("No old browser data was found under the previous app storage key.");
      return;
    }

    replaceState(JSON.parse(raw));
    updateManagerStatus("Imported your old browser-stored trip data into the draft.");
  } catch (error) {
    console.error("Failed to import legacy browser data", error);
    updateManagerStatus("The old browser data could not be read.");
  }
}

function handleImportFile(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      replaceState(JSON.parse(String(reader.result)));
      updateManagerStatus(`Imported ${file.name} into the draft.`);
    } catch (error) {
      console.error("Failed to import JSON file", error);
      updateManagerStatus("That file could not be parsed as valid trip JSON.");
    } finally {
      manageElements.importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function exportJson() {
  const updatedAt = new Date().toISOString();
  const snapshot = window.SpliwiseShared.serializeState(state, updatedAt);
  state = snapshot;
  renderAll();

  const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trip-data.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  updateManagerStatus("Exported trip-data.json. Replace data/trip-data.json in the repo and push the change.");
}

function clearDraft() {
  const confirmed = window.confirm("Clear the current draft?");
  if (!confirmed) {
    return;
  }

  state = window.SpliwiseShared.sanitizeState({});
  expenseDraft.editingId = null;
  renderAll();
  resetExpenseForm();
  updateManagerStatus("Draft cleared.");
}

function replaceState(nextState) {
  state = window.SpliwiseShared.sanitizeState(nextState);
  expenseDraft.editingId = null;
  renderAll();
  resetExpenseForm();
}

function updateManagerStatus(message) {
  manageElements.managerStatus.textContent = message;
}
