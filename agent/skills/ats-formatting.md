---
description: Load when structuring the CV JSON for compile_pdf or when improving a low ATS score.
---

# ATS formatting rules

## Structure

- The PDF template is already single-column, standard-font, and table-free — your job is what goes *in* the fields, not layout.
- Keep it to 1 page for < 8 years of experience, 2 pages maximum.
- Use every relevant CvSchema field: a missing education or languages section costs structure points.
- Skill groups: 3–5 categories, JD-matched skills first within each group. Use the JD's exact spelling for matched terms (e.g. "PostgreSQL" if the JD says PostgreSQL, not "Postgres").

## Raising a low score

Read the `score_ats` breakdown and target the weakest component:

- **keyword** low → check `missing`: for each missing term the profile truthfully supports, add it to the matching skill group AND mention it in one bullet where it was genuinely used. Terms the profile does not support are listed in the staging summary, never added.
- **semantic** low → the summary and top bullets don't speak the JD's language: rephrase them using the JD's own domain vocabulary (truthfully), especially in the summary and the first bullet of each role.
- **structure** low → follow the suggestions: usually too few quantified bullets (add profile-backed numbers, %, currency) or length outside the 300–1100 word band.

Diminishing returns: if two consecutive iterations improve the total by < 3 points, stop looping and stage.
