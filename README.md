# Pantor Intelligence — BDC Tender Offer Terminal

A self-contained static web product that turns the Pantor Capital Solutions
Tender Offer Tracker into an interactive intelligence platform for the
non-traded BDC liquidity market. Built as a lightweight alternative to
$20k/yr tools in this space.

## What's inside

- **Dashboard** (`index.html`) — interactive 3D market view (every fund is a
  column; the violet plane is the 5% floodgate), KPI row, ranked
  oversubscription chart, opportunity scatter, and a sortable/filterable
  league table of all 32 tracked funds.
- **32 fund dossiers** (`bdc/<slug>.html`) — filed facts, a 3D particle
  simulation of the fund's floodgate, demand-vs-cap meter, repurchased-vs-
  trapped split, forward projections, and desk advice.
- **Opportunities** (`opportunities.html`) — the full universe ranked by the
  Pantor opportunity score, with per-fund revenue advice.
- **Methodology** (`methodology.html`) — full disclosure of the fact /
  derived / estimate provenance system, the queue model, and the score formula.

## Fact vs. prediction

Every number carries a provenance grade, enforced visually site-wide:
solid blue = **filed fact** (from SC TO-I / SC TO-I/A), green = **derived**
(deterministic arithmetic), dashed violet = **model estimate** (may be wrong).

## Stack

Zero build step, zero external requests: hand-rolled SVG charts, vendored
Three.js (`assets/vendor/`), ES modules, one CSS file. Deploys as static
files anywhere.

```bash
# local preview
python3 -m http.server 8080
# regenerate fund pages after editing assets/js/data.js
node scripts/generate-pages.mjs
```

## Updating data

Edit `assets/js/data.js` (facts only — everything else recomputes at load),
then rerun the generator if funds were added or removed.
