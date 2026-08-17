export type TechCategory =
  | "CMS"
  | "Ecommerce"
  | "Frontend"
  | "Page builder"
  | "Hosting / CDN"
  | "Analytics"
  | "Marketing"
  | "Payments"
  | "Other";

export type TechnologySignature = {
  name: string;
  category: TechCategory;
  confidence: number;
  match: (ctx: SignatureContext) => string | null;
};

export type SignatureContext = {
  html: string;
  htmlLower: string;
  headers: Record<string, string>;
  scriptSrcs: string[];
  stylesheetHrefs: string[];
  metaGenerator: string | null;
};

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export const TECHNOLOGY_SIGNATURES: TechnologySignature[] = [
  {
    name: "WordPress",
    category: "CMS",
    confidence: 0.98,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["wp-content", "wp-includes", "wp-json"])
        ? "wp-content/wp-includes detected in HTML"
        : ctx.metaGenerator?.toLowerCase().includes("wordpress")
          ? `generator tag: ${ctx.metaGenerator}`
          : null,
  },
  {
    name: "Elementor",
    category: "Page builder",
    confidence: 0.95,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["elementor", "elementor-kit"]) ? "Elementor markup detected in HTML" : null,
  },
  {
    name: "WooCommerce",
    category: "Ecommerce",
    confidence: 0.95,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["woocommerce", "wp-content/plugins/woocommerce"])
        ? "WooCommerce assets or markup detected"
        : null,
  },
  {
    name: "Shopify",
    category: "Ecommerce",
    confidence: 0.97,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["cdn.shopify.com", "shopify.theme", "myshopify.com"])
        ? "Shopify CDN or theme markers detected"
        : ctx.headers["x-shopify-stage"]
          ? "x-shopify-stage response header"
          : null,
  },
  {
    name: "React",
    category: "Frontend",
    confidence: 0.8,
    match: (ctx) =>
      includesAny(ctx.html, ["data-reactroot", "data-reactid", "__NEXT_DATA__"]) ||
      ctx.scriptSrcs.some((src) => src.includes("react"))
        ? "React root, Next data, or React scripts detected"
        : includesAny(ctx.htmlLower, ["react-root"])
          ? "react-root container detected"
          : null,
  },
  {
    name: "Next.js",
    category: "Frontend",
    confidence: 0.97,
    match: (ctx) =>
      includesAny(ctx.html, ["__NEXT_DATA__", "/_next/static"])
        ? "__NEXT_DATA__ or /_next/static detected"
        : ctx.headers["x-powered-by"]?.toLowerCase().includes("next")
          ? "x-powered-by: Next.js"
          : null,
  },
  {
    name: "Vue",
    category: "Frontend",
    confidence: 0.85,
    match: (ctx) =>
      includesAny(ctx.html, ["data-v-", "id=\"app\""]) && includesAny(ctx.htmlLower, ["vue"])
        ? "Vue markers detected in HTML/scripts"
        : ctx.scriptSrcs.some((src) => src.includes("vue"))
          ? "Vue script URL detected"
          : null,
  },
  {
    name: "Angular",
    category: "Frontend",
    confidence: 0.9,
    match: (ctx) =>
      includesAny(ctx.html, ["ng-version", "ng-app", "_ngcontent"])
        ? "Angular attributes detected"
        : ctx.scriptSrcs.some((src) => src.includes("angular"))
          ? "Angular script URL detected"
          : null,
  },
  {
    name: "Webflow",
    category: "CMS",
    confidence: 0.96,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["webflow", "wf-page", "w-mod-"]) ? "Webflow class or script markers detected" : null,
  },
  {
    name: "Wix",
    category: "CMS",
    confidence: 0.96,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["wix.com", "static.wixstatic.com", "wix-warmup-data"])
        ? "Wix assets or warmup data detected"
        : null,
  },
  {
    name: "Squarespace",
    category: "CMS",
    confidence: 0.96,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["squarespace", "static1.squarespace.com"])
        ? "Squarespace assets detected"
        : ctx.headers["x-servedby"]?.toLowerCase().includes("squarespace")
          ? "Squarespace response header"
          : null,
  },
  {
    name: "Cloudflare",
    category: "Hosting / CDN",
    confidence: 0.9,
    match: (ctx) =>
      ctx.headers["cf-ray"] || ctx.headers["server"]?.toLowerCase().includes("cloudflare")
        ? "Cloudflare headers detected"
        : includesAny(ctx.htmlLower, ["cdnjs.cloudflare.com", "cloudflareinsights"])
          ? "Cloudflare assets detected"
          : null,
  },
  {
    name: "Google Analytics",
    category: "Analytics",
    confidence: 0.95,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["google-analytics.com/analytics.js", "gtag(", "www.google-analytics.com", "googletagmanager.com/gtag"])
        ? "Google Analytics / gtag snippet detected"
        : null,
  },
  {
    name: "Google Tag Manager",
    category: "Analytics",
    confidence: 0.97,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["googletagmanager.com/gtm.js", "gtm.js", "gtm-"])
        ? "Google Tag Manager snippet detected"
        : null,
  },
  {
    name: "Meta Pixel",
    category: "Marketing",
    confidence: 0.95,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["connect.facebook.net/en_us/fbevents.js", "fbq(", "facebook.net/en_us/fbevents"])
        ? "Meta Pixel / fbevents detected"
        : null,
  },
  {
    name: "HubSpot",
    category: "Marketing",
    confidence: 0.95,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["js.hs-scripts.com", "hs-script-loader", "hubspot"])
        ? "HubSpot script or markup detected"
        : null,
  },
  {
    name: "Hotjar",
    category: "Analytics",
    confidence: 0.95,
    match: (ctx) => (includesAny(ctx.htmlLower, ["static.hotjar.com", "hj("]) ? "Hotjar snippet detected" : null),
  },
  {
    name: "Stripe",
    category: "Payments",
    confidence: 0.93,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["js.stripe.com", "stripe.com/v3", "data-stripe"])
        ? "Stripe script or markup detected"
        : null,
  },
  {
    name: "PayPal",
    category: "Payments",
    confidence: 0.93,
    match: (ctx) =>
      includesAny(ctx.htmlLower, ["paypal.com/sdk", "paypalobjects.com", "data-paypal"])
        ? "PayPal SDK or assets detected"
        : null,
  },
];
