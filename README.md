# TimeCalc bilingual website

Static bilingual website for `timecalc.top`.

- Existing English calculator URLs remain unchanged.
- English advanced tools: `/time-chain-calculator` and `/leave-time-calculator`.
- Simplified Chinese pages live under `/zh/`.
- Shareable advanced plans use the URL hash and language switching preserves `#p=` state.
- No service worker is registered, so the advanced tools cannot take over the existing English site cache.
- Production responses include security headers but no global `noindex`; canonical pages are available for search indexing.

Validation from the workspace root:

```powershell
& 'C:\Users\itsfi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' validate_bilingual_preview.mjs
& 'C:\Users\itsfi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' qa_bilingual_browser.mjs
```
