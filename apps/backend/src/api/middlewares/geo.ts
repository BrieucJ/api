import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import geoip from "geoip-lite";
import { logger } from "@/utils/logger";

export type GeoSource = "platform" | "header" | "ip" | "none";

export interface GeoContext {
  source: GeoSource | null;
  country?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

declare module "hono" {
  interface Context {
    geo: GeoContext;
  }
}

type GeoExtractor = (c: Context) => GeoContext | null;

// Platform / headers extractors (Cloudflare, CloudFront, custom headers)
const cloudflareGeo: GeoExtractor = (c) => {
  const cf = (c.req.raw as any)?.cf;
  if (!cf?.country) return null;
  return {
    source: "platform",
    country: cf.country,
    region: cf.region,
    city: cf.city,
    lat: cf.latitude,
    lon: cf.longitude,
  };
};

const cloudFrontGeo: GeoExtractor = (c) => {
  const country = c.req.header("cloudfront-viewer-country");
  if (!country) return null;
  return {
    source: "platform",
    country,
    region: c.req.header("cloudfront-viewer-country-region") ?? undefined,
    city: c.req.header("cloudfront-viewer-city") ?? undefined,
  };
};

const headerGeo: GeoExtractor = (c) => {
  const country = c.req.header("x-geo-country");
  if (!country) return null;
  return {
    source: "header",
    country,
    region: c.req.header("x-geo-region") ?? undefined,
    city: c.req.header("x-geo-city") ?? undefined,
    lat: Number(c.req.header("x-geo-lat")) || undefined,
    lon: Number(c.req.header("x-geo-lon")) || undefined,
  };
};

const ipGeo: GeoExtractor = (c) => {
  const ip = c.req.header("x-forwarded-for") || "127.0.0.1";
  const geo = geoip.lookup(ip);
  if (!geo) return null;
  return {
    source: "ip",
    country: geo.country,
    region: geo.region,
    city: geo.city,
    lat: geo.ll[0],
    lon: geo.ll[1],
  };
};

// Middleware
const geo = createMiddleware(async (c, next) => {
  try {
    const extractors: GeoExtractor[] = [];

    if ((c.req.raw as any)?.cf) extractors.push(cloudflareGeo);
    else if (c.req.header("cloudfront-viewer-country"))
      extractors.push(cloudFrontGeo);

    extractors.push(headerGeo, ipGeo);

    let geo: GeoContext | null = null;
    for (const extract of extractors) {
      geo = extract(c);
      if (geo) break;
    }

    if (!geo) geo = { source: "none" };

    Object.defineProperty(c, "geo", {
      value: geo,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } catch (e) {
    logger.error("error", e);
  } finally {
    await next();
  }
});

export default geo;
