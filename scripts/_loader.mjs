// Tiny Node loader hook so the audit script can import the React Native
// source files (which use Metro's extensionless module resolution).
// Only used by scripts/ — not part of the app build.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    // Try appending .js BEFORE asking the default resolver, since the default
    // resolver returns a rejected promise (not a sync throw) on miss.
    if (!/\.[a-z]+$/i.test(specifier)) {
      const candidate = new URL(specifier + '.js', context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true, format: 'module' };
      }
    }
  }
  return defaultResolve(specifier, context);
}
