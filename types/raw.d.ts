declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
