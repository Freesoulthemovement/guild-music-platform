# Static assets

## free-soul-living-dictionary.pdf

The Dictionary page (`/library`) links here, and deep-links to individual
entries using the PDF viewer's `#page=` fragment — the mapping lives in
`shared/living-dictionary.ts`.

The file is not in this repository: it is ~3.2MB and tracked with Git LFS in
the nigtalk repository. Copy it in before deploying:

    cp /path/to/nigtalk/client/public/free-soul-living-dictionary.pdf client/public/

Until it is present, the entries and search still work — only the "Read the
full work" and per-entry page links will 404.

Because it is a large binary that changes rarely, consider serving it from R2
instead and pointing `DICTIONARY_PDF_URL` in `client/src/pages/library.tsx` at
that URL.
