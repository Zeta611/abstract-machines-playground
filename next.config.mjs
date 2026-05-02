import path from "node:path"
import { fileURLToPath } from "node:url"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const melangeNodeModules = path.join(
  dirname,
  "_build/default/output/node_modules"
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      melange: path.join(melangeNodeModules, "melange"),
      "melange.js": path.join(melangeNodeModules, "melange.js"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      melange: path.join(melangeNodeModules, "melange"),
      "melange.js": path.join(melangeNodeModules, "melange.js"),
    }
    return config
  },
}

export default nextConfig
