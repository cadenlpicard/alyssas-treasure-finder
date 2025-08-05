import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, radius } = await req.json();
    
    if (!location) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Location is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Searching for thrift stores near: ${location} within ${radius} miles`);

    // Use Google Places API Text Search
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Places API key not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Search for thrift stores, secondhand stores, consignment shops, and specific chains
    const searchQueries = [
      `thrift stores near ${location}`,
      `secondhand stores near ${location}`,
      `consignment shops near ${location}`,
      `vintage stores near ${location}`,
      `Goodwill store ${location}`,
      `Goodwill ${location}`,
      `"Goodwill" ${location}`,
      `Salvation Army store ${location}`,
      `Salvation Army ${location}`,
      `"Salvation Army" ${location}`,
      `charity shops near ${location}`,
      `thrift shop ${location}`
    ];

    const allResults = [];
    const seenPlaceIds = new Set();

    for (const query of searchQueries) {
      try {
        const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        searchUrl.searchParams.append('query', query);
        searchUrl.searchParams.append('key', googleApiKey);
        searchUrl.searchParams.append('radius', (radius * 1609.34).toString()); // Convert miles to meters
        searchUrl.searchParams.append('type', 'store');
        // Remove location bias to get broader results
        if (query.includes('Goodwill') || query.includes('Salvation Army')) {
          searchUrl.searchParams.append('type', 'establishment'); // Use broader type for chain stores
        }

        console.log(`Searching with query: ${query}`);

        const response = await fetch(searchUrl.toString());
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          for (const place of data.results) {
            // Avoid duplicates
            if (seenPlaceIds.has(place.place_id)) {
              continue;
            }
            seenPlaceIds.add(place.place_id);

            // Get detailed place information including business hours
            try {
              const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
              detailsUrl.searchParams.append('place_id', place.place_id);
              detailsUrl.searchParams.append('key', googleApiKey);
              detailsUrl.searchParams.append('fields', 'name,formatted_address,formatted_phone_number,website,rating,opening_hours,geometry,photos,types,place_id');

              const detailsResponse = await fetch(detailsUrl.toString());
              const detailsData = await detailsResponse.json();

              if (detailsData.status === 'OK' && detailsData.result) {
                const placeDetails = detailsData.result;
                
                // Calculate distance from search location (approximation)
                const placeLat = placeDetails.geometry?.location?.lat;
                const placeLng = placeDetails.geometry?.location?.lng;
                
                let distance = null;
                if (placeLat && placeLng) {
                  // For now, we'll use the radius as an approximation
                  // In a real implementation, you'd geocode the location and calculate actual distance
                  distance = Math.random() * radius; // Placeholder distance calculation
                }

                allResults.push({
                  place_id: place.place_id,
                  name: placeDetails.name,
                  formatted_address: placeDetails.formatted_address,
                  vicinity: place.vicinity,
                  rating: placeDetails.rating,
                  formatted_phone_number: placeDetails.formatted_phone_number,
                  website: placeDetails.website,
                  opening_hours: placeDetails.opening_hours,
                  types: placeDetails.types,
                  photos: placeDetails.photos,
                  distance: distance
                });
              }
            } catch (detailsError) {
              console.error('Error fetching place details:', detailsError);
              // Add basic info without details if details fetch fails
              allResults.push({
                place_id: place.place_id,
                name: place.name,
                formatted_address: place.formatted_address,
                vicinity: place.vicinity,
                rating: place.rating,
                types: place.types
              });
            }
          }
        } else {
          console.log(`No results for query: ${query}, status: ${data.status}`);
        }
      } catch (searchError) {
        console.error(`Error searching with query "${query}":`, searchError);
      }
    }

    // Sort by distance if available, then by rating
    allResults.sort((a, b) => {
      if (a.distance && b.distance) {
        return a.distance - b.distance;
      }
      if (a.rating && b.rating) {
        return b.rating - a.rating;
      }
      return 0;
    });

    // Limit to top 20 results
    const limitedResults = allResults.slice(0, 20);

    console.log(`Found ${limitedResults.length} unique thrift stores`);

    return new Response(
      JSON.stringify({
        success: true,
        results: limitedResults,
        total: limitedResults.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in search-thrift-stores function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});