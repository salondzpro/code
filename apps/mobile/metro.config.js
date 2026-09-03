// Metro pour un monorepo pnpm (hoisted) : Metro doit voir la racine du repo
// pour résoudre les packages workspace (@salondz/*) et les dépendances hissées.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
// Évite de résoudre plusieurs copies de react / react-native via des symlinks.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
