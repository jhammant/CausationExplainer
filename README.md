# The Causation Meter — an interactive guide to Assembly Theory's physics of causation

A standalone GitHub Pages microsite inspired by Cronin & Walker's 2026 preprint, **The Physics of Causation**.

Live site: https://jhammant.github.io/CausationExplainer/

## What it does

- Explains assembly index + copy number as a proposed physical metrology for causation.
- Provides an interactive sample lab: edit objects, copy counts, and assembly indices; watch points move on a complexity/abundance phase plot.
- Runs a toy random-vs-selection simulation showing why complex objects in high abundance are the interesting regime.
- Includes a string assembly calculator, reusing the pedagogical greedy approach from AssemblyExplainer.
- Includes a causal funnel visualization and threshold controls.

## Tech

- Static site: `index.html`, `app.js`, `favicon.svg`, `og.svg`.
- Vanilla JavaScript, no build step.
- Designed for GitHub Pages from `main` / root.

## Sources

- Leroy Cronin & Sara I. Walker. **The Physics of Causation.** arXiv:2601.00515, 2026.
- Prior Assembly Theory work cited in the app, including Marshall / Walker / Cronin and Sharma et al.

## Local run

```bash
python3 -m http.server 8765
# http://localhost:8765
```

## License

MIT. Educational/pedagogical implementation; toy models are illustrative, not a chemistry engine.
