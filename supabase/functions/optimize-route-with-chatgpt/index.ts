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
    
    console.log('Optimizing route for addresses:', addresses);
    console.log('Starting address:', startingAddress);

    const prompt = `Given the following starting address and list of estate sale addresses, optimize the route for the shortest driving time and distance. Return ONLY a JSON object with the optimized order and Google Maps URL.

Starting address: ${startingAddress || 'Current location'}
Estate sale addresses:
${addresses.map((addr: string, index: number) => `${index + 1}. ${addr}`).join('\n')}

Return a JSON object in this exact format:
{
  "optimizedOrder": [array of address indices in optimal order, starting from 0],
  "googleMapsUrl": "https://www.google.com/maps/dir/[encoded addresses separated by /]",
  "estimatedTime": "estimated total driving time",
  "estimatedDistance": "estimated total distance"
}

Important: 
- The optimizedOrder should contain indices (0-based) referring to the original estate sale addresses array
- Include the starting address in the Google Maps URL if provided
- Optimize for shortest total driving time
- Do not include any explanation, just return the JSON object`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a route optimization expert. Return only valid JSON responses.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI');
    }
    
    const content = data.choices[0].message.content;
    console.log('ChatGPT response:', content);
    
    // Parse the JSON response
    let optimizationResult;
    try {
      optimizationResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse ChatGPT response as JSON:', parseError);
      throw new Error('ChatGPT returned invalid JSON');
    }

    // Remove Google Maps URL for now, just return optimized order
    const response = {
      optimizedOrder: optimizationResult.optimizedOrder || [],
      estimatedTime: optimizationResult.estimatedTime || 'Unknown',
      estimatedDistance: optimizationResult.estimatedDistance || 'Unknown'
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in optimize-route-with-chatgpt function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      optimizedOrder: [],
      googleMapsUrl: '',
      estimatedTime: 'Unknown',
      estimatedDistance: 'Unknown'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});