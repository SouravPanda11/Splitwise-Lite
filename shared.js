(function () {
  function normalizeCurrencyCode(value) {
    const cleaned = typeof value === "string" ? value.trim().toUpperCase() : "";
    return /^[A-Z]{3}$/.test(cleaned) ? cleaned : "USD";
  }

  function sanitizeCurrencyInput(value) {
    return (typeof value === "string" ? value.toUpperCase().replace(/[^A-Z]/g, "") : "").slice(0, 3);
  }

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function toCents(amount) {
    return Math.round(Number(amount) * 100);
  }

  function formatMoney(amountCents, currency) {
    const safeCurrency = normalizeCurrencyCode(currency);

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: safeCurrency,
      }).format(amountCents / 100);
    } catch (error) {
      return `${safeCurrency} ${(amountCents / 100).toFixed(2)}`;
    }
  }

  function createEmptyState(template, title, text) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".empty-title").textContent = title;
    fragment.querySelector(".empty-text").textContent = text;
    return fragment;
  }

  function getPersonName(state, personId) {
    return state.people.find((person) => person.id === personId)?.name ?? "Unknown";
  }

  function splitExpense(expense) {
    const count = Math.max(1, expense.participantIds.length);
    const baseShare = Math.floor(expense.amountCents / count);
    let remainder = expense.amountCents - baseShare * count;

    return {
      shares: expense.participantIds.map((personId) => {
        const shareCents = baseShare + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return { personId, shareCents };
      }),
    };
  }

  function buildShareMeta(state, expense) {
    const paidBy = getPersonName(state, expense.paidById);
    return expense.notes ? `${expense.notes} | Paid by ${paidBy}` : `Paid by ${paidBy}`;
  }

  function calculateSummary(state) {
    const totalsByPerson = new Map(
      state.people.map((person) => [
        person.id,
        {
          id: person.id,
          name: person.name,
          paidCents: 0,
          shareCents: 0,
          netCents: 0,
          shareItems: [],
        },
      ])
    );

    state.expenses.forEach((expense) => {
      const payer = totalsByPerson.get(expense.paidById);
      if (payer) {
        payer.paidCents += expense.amountCents;
      }

      const split = splitExpense(expense);
      split.shares.forEach((share) => {
        const person = totalsByPerson.get(share.personId);
        if (person) {
          person.shareCents += share.shareCents;
          person.shareItems.push({
            expenseId: expense.id,
            title: expense.title,
            shareCents: share.shareCents,
            meta: buildShareMeta(state, expense),
          });
        }
      });
    });

    const totals = Array.from(totalsByPerson.values()).map((entry) => ({
      ...entry,
      netCents: entry.paidCents - entry.shareCents,
    }));

    return {
      totals,
      settlements: calculateSettlements(totals),
    };
  }

  function calculateSettlements(totals) {
    const creditors = totals
      .filter((person) => person.netCents > 0)
      .map((person) => ({ ...person }))
      .sort((a, b) => b.netCents - a.netCents);

    const debtors = totals
      .filter((person) => person.netCents < 0)
      .map((person) => ({ ...person, netCents: Math.abs(person.netCents) }))
      .sort((a, b) => b.netCents - a.netCents);

    const settlements = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountCents = Math.min(debtor.netCents, creditor.netCents);

      settlements.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amountCents,
      });

      debtor.netCents -= amountCents;
      creditor.netCents -= amountCents;

      if (debtor.netCents === 0) {
        debtorIndex += 1;
      }

      if (creditor.netCents === 0) {
        creditorIndex += 1;
      }
    }

    return settlements;
  }

  function sanitizeState(input) {
    const people = Array.isArray(input?.people)
      ? input.people
          .filter((person) => person && typeof person.id === "string" && typeof person.name === "string")
          .map((person) => ({
            id: person.id,
            name: person.name.trim(),
          }))
          .filter((person) => person.name.length > 0)
      : [];

    const validIds = new Set(people.map((person) => person.id));
    const expenses = Array.isArray(input?.expenses)
      ? input.expenses
          .filter(
            (expense) =>
              expense &&
              typeof expense.id === "string" &&
              typeof expense.title === "string" &&
              typeof expense.paidById === "string" &&
              Array.isArray(expense.participantIds)
          )
          .map((expense) => ({
            id: expense.id,
            title: expense.title.trim(),
            notes: typeof expense.notes === "string" ? expense.notes.trim() : "",
            amountCents: Number.isInteger(expense.amountCents)
              ? expense.amountCents
              : Math.max(0, Math.round(Number(expense.amountCents) || 0)),
            paidById: expense.paidById,
            participantIds: expense.participantIds.filter((id) => typeof id === "string" && validIds.has(id)),
          }))
          .filter(
            (expense) =>
              expense.title.length > 0 &&
              expense.amountCents > 0 &&
              validIds.has(expense.paidById) &&
              expense.participantIds.length > 0
          )
      : [];

    return {
      tripName: typeof input?.tripName === "string" ? input.tripName.trim() : "",
      currency: normalizeCurrencyCode(input?.currency),
      updatedAt: typeof input?.updatedAt === "string" ? input.updatedAt : "",
      people,
      expenses,
    };
  }

  function serializeState(state, updatedAt) {
    const snapshot = sanitizeState(state);
    return {
      tripName: snapshot.tripName,
      currency: snapshot.currency,
      updatedAt: updatedAt ?? snapshot.updatedAt ?? "",
      people: snapshot.people,
      expenses: snapshot.expenses,
    };
  }

  function formatUpdatedAt(value) {
    if (!value) {
      return "No publish date";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "No publish date";
    }

    return `Updated ${parsed.toLocaleString()}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  window.SpliwiseShared = {
    calculateSummary,
    createEmptyState,
    createId,
    escapeHtml,
    formatMoney,
    formatUpdatedAt,
    getPersonName,
    normalizeCurrencyCode,
    sanitizeCurrencyInput,
    sanitizeState,
    serializeState,
    splitExpense,
    toCents,
  };
})();
