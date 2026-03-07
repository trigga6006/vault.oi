import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'node:fs';
import path from 'node:path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'vault.oi',
    icon: './src/assets/app/icon',
    // Copy icon files to resources/ so they are accessible at runtime
    // via process.resourcesPath (nativeImage.createFromBuffer fallback path).
    extraResource: [
      './src/assets/app/icon.ico',
      './src/assets/app/icon.png',
    ],
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (_forgeConfig, options) => {
      // The VitePlugin only packages built output — node_modules are excluded.
      // Native modules like better-sqlite3 can't be bundled by Vite and can't
      // load from inside an ASAR. We fix this by:
      //   1. Extracting the existing app.asar to a temp dir
      //   2. Adding node_modules/better-sqlite3 into it
      //   3. Rebuilding app.asar with .node files marked as unpacked
      //      (so they land in app.asar.unpacked/ and are in the ASAR header)
      const asar = await import('@electron/asar');

      for (const outputPath of options.outputPaths) {
        const asarPath = path.join(outputPath, 'resources', 'app.asar');
        const tmpDir = path.join(outputPath, 'resources', '_asar_tmp');

        // Extract existing ASAR
        asar.extractAll(asarPath, tmpDir);

        // Inject better-sqlite3 and its runtime deps into the extracted tree.
        // bindings + file-uri-to-path are required by better-sqlite3 at runtime
        // to locate the native .node file.
        const nativeDeps = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
        for (const dep of nativeDeps) {
          const depSrc = path.join(__dirname, 'node_modules', dep);
          const depDest = path.join(tmpDir, 'node_modules', dep);
          fs.mkdirSync(depDest, { recursive: true });
          fs.cpSync(depSrc, depDest, { recursive: true });
        }

        // Rebuild ASAR — .node files are marked unpacked so they go to app.asar.unpacked/
        fs.rmSync(asarPath, { force: true });
        const unpackedDir = path.join(outputPath, 'resources', 'app.asar.unpacked');
        if (fs.existsSync(unpackedDir)) fs.rmSync(unpackedDir, { recursive: true, force: true });

        await asar.createPackageWithOptions(tmpDir, asarPath, { unpack: '**/*.node' });

        // Clean up temp dir
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
