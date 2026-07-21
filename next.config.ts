import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its bundled AFM font metrics files from disk at runtime via
  // a path relative to its own package location — bundling it (the Next.js
  // default for server code) rewrites/loses that path, causing "ENOENT
  // .../pdfkit/js/data/Helvetica.afm" at request time. Keeping it external
  // means it's just `require()`d normally from node_modules, where its
  // internal relative paths resolve correctly.
  serverExternalPackages: ["pdfkit"],

  // Contactos moved from its own top-level route into Inbox's secondary nav
  // (src/app/(protected)/inbox/contactos/) — keeps old bookmarks/links alive.
  async redirects() {
    return [{ source: "/contacts", destination: "/inbox/contactos", permanent: false }];
  },
};

export default nextConfig;
