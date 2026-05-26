import { cp, lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputDir = resolve(repoRoot, '.output');
const sourcePublicDir = resolve(outputDir, 'public');
const serverChunksDir = resolve(outputDir, 'server', 'chunks');
const targetPublicDir = resolve(serverChunksDir, 'public');
const relativeTarget = relative(serverChunksDir, sourcePublicDir);

const ensureLinkedPublicAssets = async () => {
  try {
    const stat = await lstat(targetPublicDir);

    if (stat.isSymbolicLink()) {
      const currentTarget = await readlink(targetPublicDir);

      if (currentTarget === relativeTarget) {
        console.log(`[fix-nitro-public-assets] using existing symlink ${targetPublicDir} -> ${currentTarget}`);
        return;
      }
    }

    await rm(targetPublicDir, { recursive: true, force: true });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  await mkdir(serverChunksDir, { recursive: true });

  try {
    await symlink(relativeTarget, targetPublicDir, 'dir');
    console.log(`[fix-nitro-public-assets] linked ${targetPublicDir} -> ${relativeTarget}`);
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EPERM')) {
      throw error;
    }

    await cp(sourcePublicDir, targetPublicDir, { recursive: true, force: true });
    console.log(`[fix-nitro-public-assets] symlink unavailable; copied public assets to ${targetPublicDir}`);
  }
};

await ensureLinkedPublicAssets();
