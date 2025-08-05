import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in Supabase secrets')
    }

    const { url } = await req.json()
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('Analyzing URL for estate sale variants:', url)
    
    // Call OpenAI to analyze the URL and generate variants
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing estate sales websites. Given a URL, determine:
1. How many estate sales are likely on the main page
2. Whether pagination or additional URL variants would help get more comprehensive results
3. Generate specific URL variants that would capture more estate sales

Focus on estate sales websites like estatesales.net. Consider factors like:
- Pagination (page=2, page=3, etc.)
- Date ranges that might show more results
- Geographic expansions if the search seems limited

Return a JSON response with:
{
  "estimatedSalesOnMainPage": number,
  "needsVariants": boolean,
  "reasoning": "explanation of your analysis",
  "recommendedVariants": ["url1", "url2", ...] // max 5 variants including original
}`
          },
          {
            role: 'user',
            content: `Analyze this estate sales URL and recommend variants for comprehensive scraping: ${url}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API request failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI response:', openaiData);

    let analysis;
    try {
      const content = openaiData.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }
      
      // Parse the JSON response from ChatGPT
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Fallback: return original URL only
      analysis = {
        estimatedSalesOnMainPage: 10,
        needsVariants: false,
        reasoning: "Could not parse analysis response, using original URL only",
        recommendedVariants: [url]
      };
    }

    // Ensure we always include the original URL and limit to 5 variants max
    const variants = Array.from(new Set([url, ...(analysis.recommendedVariants || [])]))
      .slice(0, 5);

    console.log('Generated URL variants:', variants);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        analysis: {
          ...analysis,
          recommendedVariants: variants
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in analyze-url-variants function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})