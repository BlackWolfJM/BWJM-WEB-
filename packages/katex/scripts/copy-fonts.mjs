import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Copy KaTeX font files from playground node_modules to dist/fonts
 */
function copyKatexFonts() {
  const katexFontsPath = join(__dirname, "..", "..", "..", "apps", "playground", "node_modules", "katex", "dist", "fonts");
  const fontsDistPath = join(__dirname, "..", "dist", "fonts");

  // Create dist/fonts directory
  mkdirSync(fontsDistPath, { recursive: true });

  if (!existsSync(katexFontsPath)) {
    console.error(`Source fonts directory not found: ${katexFontsPath}`);
    process.exit(1);
  }

  const fontFiles = readdirSync(katexFontsPath);
  let copied = 0;

  for (const fontFile of fontFiles) {
    const src = join(katexFontsPath, fontFile);
    const dest = join(fontsDistPath, fontFile);
    if (statSync(src).isFile()) {
      copyFileSync(src, dest);
      console.log(`Copied font: ${fontFile}`);
      copied++;
    }
  }

  console.log(`Successfully copied ${copied} font files`);
}

copyKatexFonts();