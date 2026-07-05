/*
 * PANTOR INTELLIGENCE — RAW DATASET (FILED FACTS ONLY)
 * ----------------------------------------------------
 * Every record below is transcribed from the Pantor Capital Solutions
 * Tender Offer Tracker, which is itself sourced from SC TO-I / SC TO-I/A
 * filings on SEC EDGAR. Nothing in this file is modeled, estimated,
 * or predicted. All analytics live in metrics.js and are labeled there.
 *
 * Field notes:
 *   dateOfTender   — signature date of the final amendment (SC TO-I/A), mm/dd/yyyy
 *   sharesTendered — shares validly tendered and not withdrawn (Rule 13e-4(c)(4))
 *   pctOutstanding — shares tendered / total shares outstanding (per SC TO-I)
 *   floodgate      — cap on % of outstanding shares the fund offered to repurchase
 *   repurchasePct  — % of tendered shares accepted for repurchase
 *   null           — the fund has not completed a tender cycle (no SC TO-I/A on file)
 */

export const DATASET_META = {
  source: "Pantor Capital Solutions Tender Offer Tracker",
  upstream: "SEC EDGAR — SC TO-I and SC TO-I/A filings",
  asOf: "2026-07-05",
  fundCount: 32,
};

export const BDCS = [
  { slug: "first-eagle-private-credit-fund", name: "First Eagle Private Credit Fund", cik: "0001890107",
    dateOfTender: "2026-06-05", sharesTendered: 0, pctOutstanding: 0.0, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "goldman-sachs-private-credit-corp", name: "Goldman Sachs Private Credit Corp", cik: "0001920145",
    dateOfTender: "2026-06-01", sharesTendered: 17281858.237, pctOutstanding: 5.0, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "oaktree-strategic-credit-fund", name: "Oaktree Strategic Credit Fund", cik: "0001872371",
    dateOfTender: "2026-05-15", sharesTendered: 13869407.67, pctOutstanding: 6.82, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "golub-capital-private-credit-fund", name: "Golub Capital Private Credit Fund", cik: "0001930087",
    dateOfTender: "2026-05-14", sharesTendered: 15148979, pctOutstanding: 8.52, floodgate: 5.0, repurchasePct: 58.69 },

  { slug: "ab-private-lending-fund", name: "AB Private Lending Fund", cik: "0001982701",
    dateOfTender: "2026-05-06", sharesTendered: 203775.63, pctOutstanding: 3.15, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "apollo-debt-solutions-bdc", name: "Apollo Debt Solutions BDC", cik: "0001837532",
    dateOfTender: "2026-05-06", sharesTendered: 66882332, pctOutstanding: 11.05, floodgate: 5.0, repurchasePct: 45.0 },

  { slug: "blackrock-private-credit-fund", name: "BlackRock Private Credit Fund", cik: "0001902649",
    dateOfTender: "2026-05-06", sharesTendered: 2957174, pctOutstanding: 4.49, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "jeffries-credit-partners-bdc", name: "Jeffries Credit Partners BDC Inc.", cik: "0001959604",
    dateOfTender: "2026-05-06", sharesTendered: 1820427.07, pctOutstanding: 3.74, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "nuveen-churchill-private-capital-income-fund", name: "Nuveen Churchill Private Capital Income Fund", cik: "0001911066",
    dateOfTender: "2026-05-06", sharesTendered: 1752091.60, pctOutstanding: 3.07, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "bain-capital-private-credit", name: "Bain Capital Private Credit", cik: "0001899017",
    dateOfTender: "2026-05-01", sharesTendered: 359029, pctOutstanding: 1.01, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "blackstone-private-credit-fund", name: "Blackstone Private Credit Fund", cik: "0001803498",
    dateOfTender: "2026-05-01", sharesTendered: 133689552, pctOutstanding: 6.96, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "hps-corporate-capital-solutions-bdc", name: "HPS Corporate Capital Solutions BDC", cik: "0001989817",
    dateOfTender: "2026-05-01", sharesTendered: 1078563, pctOutstanding: 2.34, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "hps-corporate-lending-fund", name: "HPS Corporate Lending Fund", cik: "0001838126",
    dateOfTender: "2026-05-01", sharesTendered: 45605292, pctOutstanding: 9.25, floodgate: 5.0, repurchasePct: 54.04 },

  { slug: "pgim-private-credit-fund", name: "PGIM Private Credit Fund", cik: "0001923622",
    dateOfTender: "2026-05-01", sharesTendered: 23350.783, pctOutstanding: 0.28, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "ag-twin-brook-capital-income-fund", name: "AG Twin Brook Capital Income Fund", cik: "0001913724",
    dateOfTender: "2026-04-30", sharesTendered: 1223904, pctOutstanding: 1.29, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "vista-credit-strategic-lending-corp", name: "Vista Credit Strategic Lending Corp", cik: "0001919369",
    dateOfTender: "2026-04-29", sharesTendered: 4910881.57, pctOutstanding: 10.07, floodgate: 5.0, repurchasePct: 49.63 },

  { slug: "north-haven-private-income-fund-a", name: "North Haven Private Income Fund A LLC", cik: "0001973476",
    dateOfTender: "2026-04-28", sharesTendered: 1020893.44, pctOutstanding: 6.83, floodgate: 5.0, repurchasePct: 73.20 },

  { slug: "north-haven-private-income-fund", name: "North Haven Private Income Fund LLC", cik: "0001851322",
    dateOfTender: "2026-04-28", sharesTendered: 19042788.7, pctOutstanding: 10.46, floodgate: 5.0, repurchasePct: 47.80 },

  { slug: "kkr-fs-income-trust", name: "KKR FS Income Trust", cik: "0001930679",
    dateOfTender: "2026-04-27", sharesTendered: 3239786.33, pctOutstanding: 6.25, floodgate: 5.0, repurchasePct: 80.0 },

  { slug: "kkr-fs-income-trust-select", name: "KKR FS Income Trust Select", cik: "0001975736",
    dateOfTender: "2026-04-27", sharesTendered: 1350591.60, pctOutstanding: 3.70, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "owl-rock-core-income-corp", name: "Owl Rock Core Income Corp.", cik: "0001812554",
    dateOfTender: "2026-04-27", sharesTendered: 463820625, pctOutstanding: 21.90, floodgate: 5.0, repurchasePct: 22.82 },

  { slug: "owl-rock-technology-income-corp", name: "Owl Rock Technology Income Corp.", cik: "0001869453",
    dateOfTender: "2026-04-27", sharesTendered: 119934135, pctOutstanding: 40.40, floodgate: 5.0, repurchasePct: 14.38 },

  { slug: "barings-private-credit-corporation", name: "Barings Private Credit Corporation", cik: "0001859919",
    dateOfTender: "2026-04-21", sharesTendered: 15742664, pctOutstanding: 11.30, floodgate: 5.0, repurchasePct: 44.30 },

  { slug: "ares-strategic-income-fund", name: "Ares Strategic Income Fund", cik: "0001918712",
    dateOfTender: "2026-04-17", sharesTendered: 45344917, pctOutstanding: 11.61, floodgate: 5.0, repurchasePct: 43.10 },

  { slug: "stepstone-private-credit-fund", name: "Stepstone Private Credit Fund", cik: "0001950803",
    dateOfTender: "2026-04-10", sharesTendered: 0, pctOutstanding: 0.0, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "amg-comvest-senior-lending-fund", name: "AMG Comvest Senior Lending Fund", cik: "0001987221",
    dateOfTender: "2026-03-31", sharesTendered: 0, pctOutstanding: 0.0, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "crescent-private-credit-income-corp", name: "Crescent Private Credit Income Corp", cik: "0001954360",
    dateOfTender: "2026-03-27", sharesTendered: 0, pctOutstanding: 0.0, floodgate: 5.0, repurchasePct: 100.0 },

  { slug: "antares-strategic-credit-fund", name: "Antares Strategic Credit Fund", cik: "0001993402",
    dateOfTender: "2026-02-06", sharesTendered: 2618441.41, pctOutstanding: 3.94, floodgate: 7.50, repurchasePct: 100.0 },

  { slug: "owl-rock-capital-corp-ii", name: "Owl Rock Capital Corp II", cik: "0001655887",
    dateOfTender: "2025-09-25", sharesTendered: 7067336, pctOutstanding: 5.88, floodgate: 4.92, repurchasePct: 100.0 },

  { slug: "cliffwater-corporate-lending-fund", name: "Cliffwater Corporate Lending Fund", cik: "0001735964",
    dateOfTender: null, sharesTendered: null, pctOutstanding: null, floodgate: null, repurchasePct: null },

  { slug: "nuveen-churchill-private-credit-fund", name: "Nuveen Churchill Private Credit Fund", cik: "0002022625",
    dateOfTender: null, sharesTendered: null, pctOutstanding: null, floodgate: null, repurchasePct: null },

  { slug: "silver-point-specialty-lending-fund", name: "Silver Point Specialty Lending Fund", cik: "0001646614",
    dateOfTender: null, sharesTendered: null, pctOutstanding: null, floodgate: null, repurchasePct: null },
];

export function edgarUrl(cik) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=SC+TO-I&dateb=&owner=include&count=40`;
}
