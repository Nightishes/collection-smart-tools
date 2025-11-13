This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Puppeteer Docker image (HTML → PDF conversion)

This project includes a small Node script and a Dockerfile to run Puppeteer/Chromium inside a container for reliable HTML → PDF conversion without requiring a local Chromium install.

Files of interest:
- `Dockerfile.puppeteer` — Dockerfile that builds an image containing Node and Chromium suitable for running the converter script.
- `scripts/convert-html-to-pdf.js` — Node script used by the Docker image to convert an input HTML file to a PDF file.

Basic build & run (PowerShell)

1. Build the Docker image (run from the project root):

```powershell
docker build -f Dockerfile.puppeteer -t collection-tools-puppeteer .
```

2. Convert an HTML file to PDF by mounting the `uploads/` folder into the container (example):

```powershell
# from project root; ensure uploads\ contains input.html
docker run --rm -v ${PWD}:/app -w /app collection-tools-puppeteer \
	node scripts/convert-html-to-pdf.js uploads/input.html uploads/output.pdf
```

Notes
- The API route `src/app/api/upload/html/convert-to-pdf/route.ts` expects the Docker image (or equivalent) to be available when converting server-side. If you change the image name, update that route accordingly.
- On Windows PowerShell use `${PWD}` for the current path in the `-v` mount. For WSL or other shells use the shell's appropriate `$(pwd)` or `$PWD` variant.
- Docker Desktop is required to build and run the image locally.

If you'd like, I can add a small npm script to build/run the container and wire an environment variable so the server-based convert route uses a consistent image name.
