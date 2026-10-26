# SIM-CoT project page

Static project page for *SIM-CoT: Supervised Implicit Chain-of-Thought* (ICLR 2026). Plain HTML, CSS and JavaScript: no build step, no framework, no third-party requests at runtime.

## Preview locally

```bash
python3 -m http.server 8000      # run inside this folder, then open http://localhost:8000/
```

Opening `index.html` directly from disk also works.

## Publish on GitHub Pages

The page is set up for `https://internlm.github.io/SIM-CoT/`, served from the `docs/` folder of `InternLM/SIM-CoT`:

1. Copy **the contents of this folder** (including the hidden `.nojekyll`) into `docs/` at the root of the repository and push to `main`.
2. *Settings → Pages → Build and deployment → Source: Deploy from a branch*, then choose `main` and `/docs`, and save.
3. After the first deployment, set the README's “Project Page” link to `https://internlm.github.io/SIM-CoT/`.

All paths are relative, so any other repository or folder works too. Only the link-preview tags (`og:url`, `og:image`, `twitter:image` in `index.html`) carry the absolute URL; update them if the address changes. Step-by-step instructions in Chinese are in [DEPLOY.md](DEPLOY.md).

## Content sources

All numbers, figures and examples come from the arXiv v2 paper (2509.20317v2) and its LaTeX source.

| Section | Source |
| --- | --- |
| Animated example | Figure 4 and the README animation (`assets/visual.gif` in the code repository) |
| Problem | Figure 1, Table 4(b) |
| Method | Figure 2, Section 3 |
| Results explorer | Tables 1–3 |
| Latent scaling chart | Figure 3 (values read from the vector figure and checked against Table 1) |
| Ablations | Tables 4(a), 5 and 6 |
| Decoded latents | Figures 4 and 7 |
| Latent geometry | Table 4(b), Figure 6 |

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page content |
| `assets/css/` | `style.css` (layout and shared components), plus one stylesheet per interactive component |
| `assets/js/` | `main.js` (navigation, BibTeX copy), `demo.js`, `results.js`, `cases.js` |
| `assets/data/site-data.js` | Tables, chart series and case studies used by the interactive components |
| `assets/img/` | Paper figures rendered from the vector PDFs, icons, link-preview image |
| `assets/fonts/` | DM Sans and DM Serif Display (SIL Open Font License 1.1) |
| `assets/icons/` | Hugging Face logo (LobeHub Icons, MIT) |
