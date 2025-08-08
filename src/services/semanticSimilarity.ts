// Semantic Similarity Service
// Uses OpenAI embeddings and cosine similarity to detect duplicate content

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface SimilarityResult {
  isSimilar: boolean;
  similarity: number;
  threshold: number;
}

// Configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Similarity thresholds
const SIMILARITY_THRESHOLDS = {
  HIGH: 0.90,    // 90%+ = definitely duplicate, reject
  MEDIUM: 0.85,  // 85-90% = very similar, likely reject
  LOW: 0.75      // 75-85% = somewhat similar, flag for review
};

export class SemanticSimilarityService {
  
  /**
   * Generate embedding vector for a text using OpenAI
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured for embeddings');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    console.log(`🔍 Generating embedding for: "${text.substring(0, 50)}..."`);
    
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: text.trim(),
          model: EMBEDDING_MODEL,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI Embeddings API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data: EmbeddingResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI API');
      }

      const embedding = data.data[0].embedding;
      
      console.log(`✅ Generated embedding: ${embedding.length} dimensions, ${data.usage.total_tokens} tokens`);
      return embedding;
      
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error(`Vector dimensions mismatch: ${vectorA.length} vs ${vectorB.length}`);
    }

    if (vectorA.length === 0) {
      return 0;
    }

    // Calculate dot product
    let dotProduct = 0;
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
    }

    // Calculate magnitudes
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < vectorA.length; i++) {
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    // Return cosine similarity
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Check if new text is semantically similar to existing embeddings
   */
  static async checkSimilarity(
    newText: string,
    existingEmbeddings: number[][],
    threshold: number = SIMILARITY_THRESHOLDS.MEDIUM
  ): Promise<SimilarityResult> {
    if (existingEmbeddings.length === 0) {
      return {
        isSimilar: false,
        similarity: 0,
        threshold
      };
    }

    try {
      // Generate embedding for new text
      const newEmbedding = await this.generateEmbedding(newText);
      
      // Calculate similarity with each existing embedding
      let maxSimilarity = 0;
      let similarityScores: number[] = [];
      
      for (const existingEmbedding of existingEmbeddings) {
        const similarity = this.calculateCosineSimilarity(newEmbedding, existingEmbedding);
        similarityScores.push(similarity);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      const isSimilar = maxSimilarity >= threshold;
      
      console.log(`🔍 Similarity check: ${(maxSimilarity * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`);
      
      if (isSimilar) {
        console.log(`⚠️ Content too similar! Similarity: ${(maxSimilarity * 100).toFixed(1)}%`);
      } else {
        console.log(`✅ Content is unique! Similarity: ${(maxSimilarity * 100).toFixed(1)}%`);
      }

      return {
        isSimilar,
        similarity: maxSimilarity,
        threshold
      };
      
    } catch (error) {
      console.error('❌ Error in similarity check:', error);
      // Default to allowing content if similarity check fails
      return {
        isSimilar: false,
        similarity: 0,
        threshold
      };
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  static async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);
        
        // Small delay to avoid rate limiting
        if (i < texts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Failed to generate embedding for text ${i + 1}:`, error);
        // Skip this text and continue
      }
    }
    
    return embeddings;
  }

  /**
   * Get similarity threshold by name
   */
  static getThreshold(level: 'HIGH' | 'MEDIUM' | 'LOW'): number {
    return SIMILARITY_THRESHOLDS[level];
  }

  /**
   * Analyze similarity distribution for debugging
   */
  static async analyzeSimilarityDistribution(texts: string[]): Promise<{
    averageSimilarity: number;
    maxSimilarity: number;
    minSimilarity: number;
    totalComparisons: number;
  }> {
    const embeddings = await this.batchGenerateEmbeddings(texts);
    const similarities: number[] = [];
    
    // Compare each embedding with every other embedding
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = this.calculateCosineSimilarity(embeddings[i], embeddings[j]);
        similarities.push(similarity);
      }
    }
    
    if (similarities.length === 0) {
      return {
        averageSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0,
        totalComparisons: 0
      };
    }
    
    const sum = similarities.reduce((a, b) => a + b, 0);
    return {
      averageSimilarity: sum / similarities.length,
      maxSimilarity: Math.max(...similarities),
      minSimilarity: Math.min(...similarities),
      totalComparisons: similarities.length
    };
  }
}

export default SemanticSimilarityService;