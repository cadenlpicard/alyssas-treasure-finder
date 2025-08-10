import { supabase } from "@/integrations/supabase/client";

export type SemanticSearchResult = {
  id: string;
  name: string;
  name_normalized: string;
  similarity: number;
};

export const OpenAIBackend = {
  async generateEmbeddings(input: string | string[], model?: string) {
    const { data, error } = await supabase.functions.invoke("generate-embeddings", {
      body: { input, model },
    });
    if (error) throw error;
    return data?.embeddings as number[][];
  },

  async semanticSearchItems(query: string, threshold = 0.2, matchCount = 10) {
    const { data, error } = await supabase.functions.invoke("semantic-search-items", {
      body: { query, threshold, match_count: matchCount },
    });
    if (error) throw error;
    return (data?.results || []) as SemanticSearchResult[];
  },

  async ocrExtract(params: { imageUrl?: string; imageBase64?: string; hints?: string }) {
    const { data, error } = await supabase.functions.invoke("ocr-extract", {
      body: params,
    });
    if (error) throw error;
    return data as { success: boolean; text: string };
  },
};
