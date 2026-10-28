import "server-only";
import { statSync } from "node:fs";
import path from "node:path";

/**
 * Arquivos de marca. Coloque-os em /public com estes nomes:
 *   public/images/gt-studio/login-background.webp  (fundo do login)
 *   public/images/gt-studio/logo.png               (logo exibida no card)
 * Se um arquivo não existir, a interface usa um fallback sem imagem quebrada.
 */
export const BRAND_ASSETS = {
  loginBackground: "/images/gt-studio/login-background.webp",
  logo: "/images/gt-studio/logo.png",
} as const;

export function publicAssetExists(publicUrl: string) {
  try {
    return statSync(path.join(process.cwd(), "public", publicUrl)).isFile();
  } catch {
    return false;
  }
}
