const DATA_PATH = "data/trip-data.json";

const viewerElements = {
  tripTitle: document.querySelector("#trip-title"),
  tripDescription: document.querySelector("#trip-description"),
  tripCurrency: document.querySelector("#trip-currency"),
  tripUpdated: document.querySelector("#trip-updated"),
  dataStatus: document.querySelector("#data-status"),
  expenseList: document.querySelector("#expense-list"),
  summaryCards: document.querySelector("#summary-cards"),
  settlementList: document.querySelector("#settlement-list"),
  emptyStateTemplate: document.querySelector("#empty-state-template"),
};

initializeViewer();

async function initializeViewer() {
  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const state = window.SpliwiseShared.sanitizeState(payload);
    renderViewer(state);
    viewerElements.dataStatus.textContent = "Showing the latest published trip data.";
  } catch (error) {
    console.error("Failed to load published trip data", error);
    renderViewer(window.SpliwiseShared.sanitizeState({}));
    viewerElements.dataStatus.textContent =
      "Could not load data/trip-data.json. Publish that file to show the trip.";
  }
}

function renderViewer(state) {
  const summary = window.SpliwiseShared.calculateSummary(state);
  const peopleCount = state.people.length;
  const expenseCount = state.expenses.length;

  viewerElements.tripTitle.textContent = state.tripName || "Trip summary";
  viewerElements.tripDescription.textContent =
    peopleCount > 0 || expenseCount > 0
      ? `${peopleCount} ${peopleCount === 1 ? "person" : "people"} and ${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"} in this published trip summary.`
      : "This page is view-only. Once trip data is published, everyone can check the latest split here.";
  viewerElements.tripCurrency.textContent = state.currency;
  viewerElements.tripUpdated.textContent = window.SpliwiseShared.formatUpdatedAt(state.updatedAt);

  renderViewerExpenses(state);
  renderViewerSummary(state, summary);
}

function renderViewerExpenses(state) {
  viewerElements.expenseList.innerHTML = "";

  if (state.expenses.length === 0) {
    viewerElements.expenseList.append(
      window.SpliwiseShared.createEmptyState(
        viewerElements.emptyStateTemplate,
        "No expenses published",
        "Publish data/trip-data.json after updating the trip and the items will appear here."
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

    card.append(top, meta, splitLine);
    viewerElements.expenseList.append(card);
  });
}

function renderViewerSummary(state, summary) {
  viewerElements.summaryCards.innerHTML = "";
  viewerElements.settlementList.innerHTML = "";

  if (state.people.length === 0) {
    viewerElements.summaryCards.append(
      window.SpliwiseShared.createEmptyState(
        viewerElements.emptyStateTemplate,
        "No group yet",
        "Once people are added to the published data, each share will appear here."
      )
    );
    viewerElements.settlementList.append(
      window.SpliwiseShared.createEmptyState(
        viewerElements.emptyStateTemplate,
        "No settlement yet",
        "Settlement suggestions appear after published expenses are available."
      )
    );
    return;
  }

  summary.totals.forEach((personTotal) => {
    viewerElements.summaryCards.append(buildSummaryCard(personTotal, state.currency));
  });

  if (summary.settlements.length === 0) {
    viewerElements.settlementList.append(
      window.SpliwiseShared.createEmptyState(
        viewerElements.emptyStateTemplate,
        "Everyone is even",
        "No extra transfers are needed based on the published trip items."
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
    viewerElements.settlementList.append(item);
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
