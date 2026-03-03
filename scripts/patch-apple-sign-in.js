import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Patches @capacitor-community/apple-sign-in to work with Capacitor 8.
 * The plugin's Package.swift requires capacitor-swift-pm 7.x but the Swift code is fully compatible with 8.x.
 */
const patchAppleSignIn = () => {
  const packageSwiftPath = join(
    process.cwd(),
    'node_modules/@capacitor-community/apple-sign-in/Package.swift'
  );

  const content = readFileSync(packageSwiftPath, 'utf-8');
  const patched = content.replace('from: "7.0.0"', 'from: "8.0.0"');

  if (content === patched) {
    console.log('[patch-apple-sign-in] Already patched or no change needed');
    return;
  }

  writeFileSync(packageSwiftPath, patched, 'utf-8');
  console.log('[patch-apple-sign-in] Patched Package.swift: capacitor-swift-pm 7.0.0 → 8.0.0');
};

patchAppleSignIn();
