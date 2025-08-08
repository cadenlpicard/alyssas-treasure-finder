import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Haversine distance in miles
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function geocode(location: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;
  return data.results[0].geometry.location as { lat: number; lng: number };
}

async function nearbySearch({ lat, lng }: { lat: number; lng: number }, radiusMiles: number, keyword: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(Math.min(50000, Math.round(radiusMiles * 1609.34)))); // cap 50km
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  return res.json();
}

async function details(placeId: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", [
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "rating",
    "opening_hours",
    "geometry",
    "types",
    // keep photos out for speed; URLs require extra fetch
  ].join(","));
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, radius } = await req.json();
    if (!location) {
      return new Response(JSON.stringify({ success: false, error: "Location is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "Google Places API key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = await geocode(location, apiKey);
    if (!origin) {
      return new Response(JSON.stringify({ success: false, error: "Unable to geocode location" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prioritized compact keyword set for speed
    const keywords = [
      "thrift store",
      "consignment shop",
      "vintage store",
      "Goodwill",
      "Salvation Army",
      "Habitat for Humanity ReStore",
    ];

    const seen = new Set<string>();
    let results: any[] = [];

    // Fetch nearby results in small parallel batches
    const batchSize = 3;
    for (let i = 0; i < keywords.length; i += batchSize) {
      const slice = keywords.slice(i, i + batchSize);
      const nearbyResponses = await Promise.allSettled(
        slice.map((kw) => nearbySearch(origin, radius === 999 ? 25 : radius, kw, apiKey))
      );

      for (const res of nearbyResponses) {
        if (res.status !== "fulfilled") continue;
        const data = res.value;
        if (data.status !== "OK" || !data.results) continue;
        for (const place of data.results) {
          if (!place.place_id || seen.has(place.place_id)) continue;
          seen.add(place.place_id);
          // Stage minimal record; details later for a subset
          const coord = place.geometry?.location;
          const distance = coord ? haversineMiles(origin.lat, origin.lng, coord.lat, coord.lng) : null;
          results.push({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.vicinity || place.formatted_address,
            rating: place.rating,
            types: place.types,
            distance,
          });
        }
      }

      // Early exit if we already have plenty
      if (results.length >= 30) break;
    }

    // Sort by distance then rating and take top N for details
    results.sort((a, b) => {
      const da = a.distance ?? 9999;
      const db = b.distance ?? 9999;
      if (da !== db) return da - db;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    const topForDetails = results.slice(0, 20);

    // Fetch details in parallel with a cap to avoid throttling
    const detailBatchSize = 5;
    const enriched: any[] = [];
    for (let i = 0; i < topForDetails.length; i += detailBatchSize) {
      const slice = topForDetails.slice(i, i + detailBatchSize);
      const detailResponses = await Promise.allSettled(slice.map((p) => details(p.place_id, apiKey)));
      detailResponses.forEach((r, idx) => {
        if (r.status === "fulfilled" && r.value.status === "OK" && r.value.result) {
          const d = r.value.result;
          const base = slice[idx];
          enriched.push({
            ...base,
            name: d.name ?? base.name,
            formatted_address: d.formatted_address ?? base.formatted_address,
            formatted_phone_number: d.formatted_phone_number ?? "",
            website: d.website ?? "",
            rating: d.rating ?? base.rating,
            opening_hours: d.opening_hours ?? null,
            types: d.types ?? base.types,
          });
        } else {
          enriched.push(slice[idx]);
        }
      });
    }

    // Final sort & limit
    enriched.sort((a, b) => {
      const da = a.distance ?? 9999;
      const db = b.distance ?? 9999;
      if (da !== db) return da - db;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    const limited = enriched.slice(0, 20);

    return new Response(
      JSON.stringify({ success: true, total: limited.length, results: limited }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in handler:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
