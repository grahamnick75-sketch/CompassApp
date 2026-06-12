# Compass v6

Compass is an ADHD-friendly household financial planning app focused on one core question:

> Am I okay until the next paycheck?

## Upload to GitHub Pages

Upload these files to the root of your GitHub Pages repository:

- `index.html`
- `styles.css`
- `app.js`

The app is fully static and stores data in browser localStorage. GitHub Pages can host static HTML/CSS/JavaScript files directly from a repository.

## v6 Highlights

- Dashboard + Accounts stay in the main header, all other sections live in the More sidebar.
- Dream Compass Dashboard:
  - Funded Through
  - Projected Through
  - Planning Balance
  - Next Paycheck
  - Swipeable Compass Insight cards
  - Funding Map
- Stable Compass v6 data model with schema versioning.
- Household and member ownership on every record type.
- Accounts support “Include in Planning”.
- Bills require non-editable priorities: Critical, Important, Flexible.
- Buckets are short-term planning allocations.
- Savings Goals replace cumulative buckets.
- Events are calendar records and can prompt linked savings goals.
- Paychecks support Expected / Received. Mark Received prompts Assign Money.
- Assign Money supports partial funding for bills, buckets, and savings goals.
- Funding History has its own tab.
- Decision Simulator can convert simulations into bills, buckets, savings goals, events, or paychecks.
- Configurable Planning Rules for Funded Through / Projected Through.
- Import/export backup with validation and migration from older backup formats.
- Form bug fixes: Cancel cancels, validation runs before save, character limits, date validation, number validation, duplicate warnings.

## Data Safety Notes

- Export before upgrading.
- Imports are previewed and validated before live data is replaced.
- The importer attempts to migrate legacy fields like `person`, `nextDate`, `frequency`, `recurrence`, and `balance`.
- The app rejects very large backups and unsafe values.

## Future Releases

- v7: Supabase cloud sync and household account login.
- v8: Plaid integration and real bank data.
