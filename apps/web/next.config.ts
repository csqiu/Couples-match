import type { NextConfig } from 'next';

const config: NextConfig = {
  // The engine, data and db packages are TypeScript sources in this monorepo.
  transpilePackages: ['@pairwise/engine', '@pairwise/data', '@pairwise/db'],
  poweredByHeader: false,
};

export default config;
