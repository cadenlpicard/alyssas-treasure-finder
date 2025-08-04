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
    const { addresses } = await req.json();

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

    const prompt = `You are a route optimization expert. Given the following list of addresses in Michigan, please return the most efficient visiting order to minimize total driving time and distance.

Addresses to visit:
${addresses.map((addr, index) => `${index + 1}. ${addr}`).join('\n')}

Please analyze these addresses and return ONLY a JSON array with the optimal order. The array should contain the original addresses in the most efficient visiting sequence.

Important:
- Return ONLY the JSON array, no other text
- Use the exact address strings provided
- Consider typical Michigan traffic patterns and road networks
- Optimize for the shortest total driving time and distance
- The response must be valid JSON

Example format: ["address1", "address2", "address3"]`;

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
            content: 'You are a route optimization expert. Always respond with only valid JSON arrays containing the optimized address order.' 
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
    let parsedRoute;
    try {
      parsedRoute = JSON.parse(optimizedRoute);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', optimizedRoute);
      // Fallback to original order if parsing fails
      parsedRoute = addresses;
    }

    // Validate that all original addresses are included
    if (!Array.isArray(parsedRoute) || parsedRoute.length !== addresses.length) {
      console.warn('Invalid route response, using original order');
      parsedRoute = addresses;
    }

    console.log('Optimized route order:', parsedRoute);

    return new Response(
      JSON.stringify({ optimizedRoute: parsedRoute }),
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