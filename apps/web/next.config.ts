import path from "node:path";
import type { NextConfig } from "next";

const raiz = path.resolve(import.meta.dirname, "../..");

const config: NextConfig = {
  // Os pacotes do monorepo são TypeScript puro (imports com extensão .ts).
  transpilePackages: ["@reforma/core", "@reforma/search", "@reforma/mcp"],
  outputFileTracingRoot: raiz,
  // Os dados abertos (data/*.json) e os sinônimos são lidos do disco em tempo de execução.
  outputFileTracingIncludes: { "/**": ["../../data/*.json", "../../packages/search/sinonimos.yaml"] },
  poweredByHeader: false,
  agentRules: false,
};

export default config;
