import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { addresses, startingAddress } = await req.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 addresses are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Optimizing route for addresses:', addresses);
    console.log('Starting address:', startingAddress);

    const prompt = `You are a route optimization expert. Given the following list of addresses, please return the most efficient visiting order to minimize total driving time and distance, along with a Google Maps directions URL.

${startingAddress ? `Starting Address: ${startingAddress}` : ''}

Addresses to visit:
${addresses.map((addr, index) => `${index + 1}. ${addr}`).join('\n')}

Please analyze these addresses and return ONLY a JSON object with the optimal order and Google Maps URL. ${startingAddress ? 'The first address in the route should always be the starting address, followed by the estate sales in optimal visiting order.' : 'The array should contain the addresses in the most efficient visiting sequence.'}

Critical Requirements:
- Return ONLY the JSON object, no other text
- Use the EXACT address strings provided (do not modify them)
- Each address must appear EXACTLY ONCE in the optimized route
- Do not duplicate any addresses
- Consider typical traffic patterns and road networks
- Optimize for the shortest total driving time and distance
- The response must be valid JSON
${startingAddress ? '- Always start with the provided starting address' : ''}
- Generate a proper Google Maps directions URL with all waypoints
- The optimizedRoute array must contain exactly ${addresses.length} unique addresses

Example format: {
  "optimizedRoute": ["address1", "address2", "address3"],
  "googleMapsUrl": "https://www.google.com/maps/dir/encoded_address1/encoded_address2/encoded_address3"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'You are a route optimization expert. Always respond with only valid JSON objects containing the optimized route and Google Maps URL.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedRoute = data.choices[0].message.content.trim();

    console.log('OpenAI response:', optimizedRoute);

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(optimizedRoute);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', optimizedRoute);
      // Fallback to original order if parsing fails
      parsedResponse = {
        optimizedRoute: addresses,
        googleMapsUrl: ''
      };
    }

    // Validate the response structure
    if (!parsedResponse.optimizedRoute || !Array.isArray(parsedResponse.optimizedRoute)) {
      console.warn('Invalid route response, using original order');
      parsedResponse = {
        optimizedRoute: addresses,
        googleMapsUrl: parsedResponse.googleMapsUrl || ''
      };
    }

    // Remove duplicates and validate uniqueness
    const uniqueRoute = [...new Set(parsedResponse.optimizedRoute)];
    if (uniqueRoute.length !== parsedResponse.optimizedRoute.length) {
      console.warn('Duplicates found in route, removing duplicates');
      parsedResponse.optimizedRoute = uniqueRoute;
    }

    // Validate that all original addresses are included and no duplicates exist
    if (parsedResponse.optimizedRoute.length !== addresses.length) {
      console.warn('Route length mismatch after deduplication, using original order');
      parsedResponse.optimizedRoute = addresses;
    }

    // Ensure all original addresses are present in the optimized route
    const originalAddressSet = new Set(addresses);
    const optimizedAddressSet = new Set(parsedResponse.optimizedRoute);
    const hasAllAddresses = addresses.every(addr => optimizedAddressSet.has(addr));
    
    if (!hasAllAddresses) {
      console.warn('Missing addresses in optimized route, using original order');
      parsedResponse.optimizedRoute = addresses;
    }

    console.log('Optimized route order:', parsedResponse.optimizedRoute);
    console.log('Google Maps URL:', parsedResponse.googleMapsUrl);

    return new Response(
      JSON.stringify({
        optimizedRoute: parsedResponse.optimizedRoute,
        googleMapsUrl: parsedResponse.googleMapsUrl || ''
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in optimize-route function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Route optimization failed' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});