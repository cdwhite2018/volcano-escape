import type { NextConfig } from "next";

const repository = "volcano-escape";
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGitHubPages ? `/${repository}` : "",
  assetPrefix: isGitHubPages ? `/${repository}/` : "",
  env: { NEXT_PUBLIC_BASE_PATH: isGitHubPages ? `/${repository}` : "" },
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
