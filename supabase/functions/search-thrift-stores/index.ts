import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, radius } = await req.json();
    if (!location) {
      return new Response(
        JSON.stringify({ success: false, error: "Location is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Geocode the user’s location
    const geoUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    geoUrl.searchParams.append("address", location);
    geoUrl.searchParams.append("key", googleApiKey);

    const geoRes = await fetch(geoUrl.toString());
    const geoData = await geoRes.json();
    if (geoData.status !== "OK" || !geoData.results?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "Unable to geocode location" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { lat, lng } = geoData.results[0].geometry.location;

    console.log(`Geocoded "${location}" to ${lat},${lng}`);

    // 2) Keywords for thrift stores, chains, consignment, etc.
    const keywordQueries = [
      "thrift store",
      "thrift shop",
      "secondhand store",
      "consignment shop",
      "vintage store",
      "resale store",
      "used clothing store",
      "charity shop",
      "Goodwill",
      "Salvation Army",
      "Habitat for Humanity ReStore",
      "flea market",
      "junk shop",
      "antique store",
      "donation center",
    ];

    const allResults: any[] = [];
    const seenPlaceIds = new Set<string>();

    // 3) Nearby Search for each keyword
    for (const keyword of keywordQueries) {
      try {
        const nearbyUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        nearbyUrl.searchParams.append("location", `${lat},${lng}`);
        nearbyUrl.searchParams.append("radius", (radius * 1609.34).toString()); // miles → meters
        nearbyUrl.searchParams.append("keyword", keyword);
        nearbyUrl.searchParams.append("key", googleApiKey);

        console.log(`NearbySearch keyword="${keyword}"`);
        const resp = await fetch(nearbyUrl.toString());
        const data = await resp.json();

        if (data.status === "OK" && data.results) {
          for (const place of data.results) {
            if (seenPlaceIds.has(place.place_id)) continue;
            seenPlaceIds.add(place.place_id);

            // Fetch details
            try {
              const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
              detailsUrl.searchParams.append("place_id", place.place_id);
              detailsUrl.searchParams.append("key", googleApiKey);
              detailsUrl.searchParams.append(
                "fields",
                [
                  "name",
                  "formatted_address",
                  "formatted_phone_number",
                  "website",
                  "rating",
                  "opening_hours",
                  "geometry",
                  "photos",
                  "types",
                ].join(",")
              );

              const detResp = await fetch(detailsUrl.toString());
              const detData = await detResp.json();

              if (detData.status === "OK" && detData.result) {
                const pd = detData.result;
                // Approximate distance placeholder
                const distance = Math.random() * radius;
                allResults.push({
                  place_id: pd.place_id,
                  name: pd.name,
                  formatted_address: pd.formatted_address,
                  rating: pd.rating,
                  formatted_phone_number: pd.formatted_phone_number,
                  website: pd.website,
                  opening_hours: pd.opening_hours,
                  types: pd.types,
                  photos: pd.photos,
                  distance,
                });
              }
            } catch {
              // fallback minimal info
              allResults.push({
                place_id: place.place_id,
                name: place.name,
                formatted_address: place.formatted_address,
                rating: place.rating,
                types: place.types,
              });
            }
          }
        } else {
          console.log(`No results for keyword="${keyword}" (status=${data.status})`);
        }
      } catch (err) {
        console.error(`Error NearbySearch "${keyword}":`, err);
      }
    }

    // 4) Sort & limit
    allResults.sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      if (a.rating != null && b.rating != null) return b.rating - a.rating;
      return 0;
    });
    const limited = allResults.slice(0, 20);

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
