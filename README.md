# OMR Editor

OMR Editor je webová aplikace pro ruční vyplňování optických odpovědních archů. Umožňuje nahrát šablonu jako obrázek nebo `DOCX`, provést ruční kalibraci bublin a následně exportovat vyplněný arch ve vhodném výstupu.

## Co aplikace umí

- načíst arch jako obrázek nebo `DOCX`
- zobrazit Word dokument přímo v prohlížeči
- ručně zkalibrovat pozice odpovědních bublin
- vyplňovat odpovědi `A-D` pro otázky `1-50`
- exportovat obrázkový arch do `PNG`
- exportovat Word šablonu do nového souboru `*-filled.docx`

## Jak funguje kalibrace

Aplikace aktuálně počítá s archem rozděleným do tří bloků otázek:

- `1-17`
- `18-34`
- `35-50`

Při kalibraci se postupně kliká na středy těchto bublin:

- `1A`, `1B`, `1C`, `1D`
- `17A`, `17B`, `17C`, `17D`
- `18A`, `18B`, `18C`, `18D`
- `34A`, `34B`, `34C`, `34D`
- `35A`, `35B`, `35C`, `35D`
- `50A`, `50B`, `50C`, `50D`

Z těchto 24 bodů aplikace dopočítá pozice všech ostatních bublin interpolací.

## Technologie

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Konva a `react-konva`
- `docx-preview`
- `JSZip`

## Požadavky

- Node.js 20 nebo novější
- npm

## Lokální spuštění

```bash
npm ci
npm run dev
```

Vývojový server poběží na adrese, kterou vypíše Vite, obvykle `http://localhost:5173`.

## Dostupné skripty

- `npm run dev` spustí lokální vývojový server
- `npm run build` vytvoří produkční build do adresáře `dist`
- `npm run preview` spustí lokální náhled produkčního buildu
- `npm run lint` zkontroluje zdrojové soubory přes ESLint

## Doporučený postup práce

1. Nahraj arch tlačítkem `Nahrát arch`.
2. Klikni na `Spustit kalibraci`.
3. Postupně označ všechny požadované referenční bubliny.
4. Po dokončení kalibrace vybírej odpovědi klikáním do bublin.
5. Hotový arch vyexportuj pomocí `Export PNG` nebo `Export DOCX`.

## Poznámky k DOCX režimu

- Náhled `DOCX` se renderuje v prohlížeči pomocí knihovny `docx-preview`.
- Při exportu se přímo upravuje soubor `word/document.xml` uvnitř `.docx` archivu.
- Projekt obsahuje font `OMR Bubbles` v `public/fonts/OMR-Bubbles.ttf` pro korektní zobrazení bublin.
- Aplikace nepoužívá automatické rozpoznávání odpovědí z naskenovaného obrazu; jde o editor nad existující šablonou.

## Nasazení

Projekt je připravený pro GitHub Pages:

- `vite.config.ts` používá `base: "/omr-editor/"`
- workflow v `.github/workflows/deploy.yml` publikuje obsah `dist` po pushi do větve `main`

Pokud je v repozitáři povolené GitHub Pages nasazení, standardní cílová adresa bude `https://i3lade02.github.io/omr-editor/`.

## Omezení

- aktuálně podporuje pouze 50 otázek
- každá otázka má pouze čtyři možnosti odpovědi `A-D`
- bez ruční kalibrace nelze správně dopočítat pozice bublin
