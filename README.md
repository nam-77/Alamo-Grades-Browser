# Alamo-Grades-Browser
A simple browser-based card scanner for trading card games.

This version includes a local Magic: The Gathering Spider-Man card database. When OCR detects a matching card name, the app will show the matched card details from the Spider-Man set.

## Features
- Camera capture for TCG cards
- Image upload support
- Browser OCR via Tesseract.js
- Local Spider-Man MTG card database matching
- Displays matched card details and search links

## Run locally
1. Open `index.html` in a browser that supports camera access.
2. Or serve the folder with a static server, for example:

```bash
python3 -m http.server 8000
```

3. Open `http://localhost:8000`.

## Deploy to a public URL
### GitHub Pages
1. Push this repo to GitHub.
2. The included workflow in `.github/workflows/deploy-pages.yml` will publish the site automatically on every push to `main`.
3. After the workflow runs, the public URL will be available from the repository's Pages settings. For a public GitHub repo, it will typically be:
   `https://nam-77.github.io/Alamo-Grades-Browser`

### Netlify
1. Create a new site from Git.
2. Connect your GitHub repo.
3. Netlify will use `netlify.toml` and publish the root folder.

### Vercel
1. Import the repo into Vercel.
2. Vercel will detect the static site and deploy it.
3. The `vercel.json` file is included to make the static deployment explicit.

## Usage
- Click **Start Camera** to begin live scanning.
- Align your card inside the frame.
- Click **Capture Card** to run OCR.
- You can also upload a card image with **Upload Image**.
