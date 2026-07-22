# Partner media kit assets

Source brand sheet:

- `public/media-kit/source/JobProofLG.png`

Generate cropped PNG exports:

```bash
node scripts/generate-partner-media-kit.mjs
```

Crop coordinates live in `scripts/generate-partner-media-kit.mjs`. After changing them, re-run the script and visually inspect exports under:

- `public/media-kit/logos/`
- `public/media-kit/icons/`
- `public/media-kit/favicons/`

Formats intentionally omitted until truthful source files exist:

- SVG
- PDF
- ICO
- ZIP pack
