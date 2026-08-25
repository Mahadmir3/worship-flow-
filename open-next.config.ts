import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {
      // Prisma's driver adapter + pg run on the Node.js compatibility layer.
      external: {
        serverPackages: ["@prisma/client", ".prisma/client", "pg"],
      },
    },
  },
};

export default config;
