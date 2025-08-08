import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Haversine distance in kilometers
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);

  const c = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return R * d;
}

async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  // If address is already a lat,lng string, parse directly
  const coordMatch = address.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

function nearestNeighborOrder(points: { lat: number; lng: number }[]) {
  const n = points.length;
  const visited = Array(n).fill(false);
  const order: number[] = [0];
  visited[0] = true;
  for (let i = 1; i < n; i++) {
    const last = order[order.length - 1];
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const d = haversine(points[last], points[j]);
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
    }
    if (best >= 0) {
      visited[best] = true;
      order.push(best);
    }
  }
  return order;
}

function twoOpt(points: { lat: number; lng: number }[], order: number[]) {
  const n = order.length;
  if (n <= 3) return order;

  const distance = (i1: number, i2: number) => haversine(points[order[i1]], points[order[i2]]);

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 2; i++) {
      for (let k = i + 1; k < n - 1; k++) {
        const delta = (distance(i - 1, i) + distance(k, k + 1)) - (distance(i - 1, k) + distance(i, k + 1));
        if (delta > 1e-6) {
          // reverse the segment between i and k
          const segment = order.slice(i, k + 1).reverse();
          order.splice(i, k - i + 1, ...segment);
          improved = true;
        }
      }
    }
  }
  return order;
}

function buildGoogleMapsUrl(addresses: string[]) {
  const parts = addresses.map((a) => encodeURIComponent(a));
  return `https://www.google.com/maps/dir/${parts.join('/')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { addresses, startingAddress } = await req.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 addresses are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not set in Supabase secrets');
    }

    // Ensure first element is the starting address
    let inputAddresses: string[] = addresses;
    if (startingAddress && addresses[0] !== startingAddress) {
      inputAddresses = [startingAddress, ...addresses];
    }

    // Geocode all addresses
    const geocoded = await Promise.all(inputAddresses.map((addr) => geocodeAddress(addr, apiKey)));

    // Filter out any that failed to geocode (but keep start if possible)
    const valid: { address: string; coord: { lat: number; lng: number } }[] = [];
    geocoded.forEach((coord, i) => {
      if (coord) valid.push({ address: inputAddresses[i], coord });
    });

    if (valid.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Unable to geocode enough addresses to build a route' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure the first point is the starting point
    const startIndex = 0;
    const points = valid.map((v) => v.coord);

    // Compute route order using NN + 2-opt
    let order = nearestNeighborOrder(points);
    order = twoOpt(points, order);

    // Map back to addresses
    const orderedAddresses = order.map((idx) => valid[idx].address);

    const googleMapsUrl = buildGoogleMapsUrl(orderedAddresses);

    return new Response(
      JSON.stringify({ optimizedRoute: orderedAddresses, googleMapsUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in optimize-route function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Route optimization failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
