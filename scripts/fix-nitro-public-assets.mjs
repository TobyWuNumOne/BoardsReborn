import { cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outputDir = resolve(repoRoot, '.output');
const sourcePublicDir = resolve(outputDir, 'public');
const serverChunksDir = resolve(outputDir, 'server', 'chunks');
const targetPublicDir = resolve(serverChunksDir, 'public');
const clientAssetsDir = resolve(sourcePublicDir, '_nuxt');
const relativeTarget = relative(serverChunksDir, sourcePublicDir);

const isMissingPathError = (error) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');

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
    if (!isMissingPathError(error)) {
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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rewriteClientEntryImports = async () => {
  let assetNames;

  try {
    assetNames = await readdir(clientAssetsDir);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }

    console.warn(
      `[fix-nitro-public-assets] skipped #entry rewrite because client asset dir was not found: ${clientAssetsDir}`,
    );
    return;
  }

  let entryAsset;

  for (const assetName of assetNames) {
    if (!assetName.endsWith('.js')) {
      continue;
    }

    const assetPath = resolve(clientAssetsDir, assetName);
    const source = await readFile(assetPath, 'utf8');

    if (source.includes('Error while mounting app:')) {
      entryAsset = assetName;
      break;
    }
  }

  if (!entryAsset) {
    console.warn('[fix-nitro-public-assets] skipped #entry rewrite because no client entry asset was found');
    return;
  }

  let rewrittenFiles = 0;
  const replacePattern = new RegExp(`(["'])#entry\\1`, 'g');

  for (const assetName of assetNames) {
    if (!assetName.endsWith('.js')) {
      continue;
    }

    const assetPath = resolve(clientAssetsDir, assetName);
    const source = await readFile(assetPath, 'utf8');
    const nextSource = source.replace(replacePattern, (match, quote) => `${quote}./${entryAsset}${quote}`);

    if (nextSource === source) {
      continue;
    }

    await writeFile(assetPath, nextSource, 'utf8');
    rewrittenFiles += 1;
  }

  if (rewrittenFiles > 0) {
    console.log(
      `[fix-nitro-public-assets] rewrote #entry imports to ./${entryAsset} in ${rewrittenFiles} client chunks`,
    );
  }
};

await ensureLinkedPublicAssets();
await rewriteClientEntryImports();
