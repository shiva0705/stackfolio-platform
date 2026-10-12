import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { BedrockMessage, BedrockResponse } from '../types/index.js';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Bedrock service for AI operations
 */
export class BedrockService {
  private static readonly CLAUDE_SONNET = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  private static readonly CLAUDE_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0';

  /**
   * Generate HTML from content manifest
   */
  static async generateHTML(
    manifest: any,
    template: string
  ): Promise<string> {
    const prompt = this.buildHTMLGenerationPrompt(manifest, template);
    
    const response = await this.invokeModel(
      this.CLAUDE_SONNET,
      prompt,
      8000
    );

    return response;
  }

  /**
   * Process chat message and determine intent
   */
  static async processChat(
    message: string,
    manifest: any,
    history: BedrockMessage[] = []
  ): Promise<{
    intent: string;
    updatedManifest: any;
    response: string;
  }> {
    const prompt = `You are an AI assistant helping a user build their professional portfolio.

Current portfolio content:
${JSON.stringify(manifest, null, 2)}

Conversation history:
${history.map(m => `${m.role}: ${m.content}`).join('\n')}

User message: ${message}

Analyze the user's intent and provide:
1. The specific change they want (intent)
2. The updated manifest JSON
3. A friendly response

Output as JSON:
{
  "intent": "update_headline | add_award | modify_bio | etc.",
  "updatedManifest": {...},
  "response": "I've updated your headline to emphasize..."
}`;

    const response = await this.invokeModel(
      this.CLAUDE_HAIKU,
      prompt,
      4000
    );

    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse Bedrock response: ${error}`);
    }
  }

  /**
   * Extract and classify content from text
   */
  static async classifyContent(
    text: string,
    fileName: string
  ): Promise<any> {
    const prompt = `You are an expert at analyzing resumes, CVs, and professional documents.

Extract and classify the following content into a structured format:
- Name and title
- Professional summary
- Work experience (with dates, roles, companies)
- Education
- Awards and recognition
- Board positions
- Skills
- Contact information

Document content:
${text}

Output as JSON matching this schema:
{
  "profile": { "name": "", "headline": "" },
  "about": { "summary": "", "highlights": [] },
  "experience": [{ "role": "", "company": "", "period": "", "description": "" }],
  "awards": [{ "title": "", "issuer": "", "date": "" }],
  "boards": [{ "organization": "", "role": "", "period": "" }],
  "contact": { "email": "", "linkedin": "" }
}`;

    const response = await this.invokeModel(
      this.CLAUDE_SONNET,
      prompt,
      4000
    );

    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse classification response:', error);
      return null;
    }
  }

  /**
   * Build HTML generation prompt
   */
  private static buildHTMLGenerationPrompt(
    manifest: any,
    template: string
  ): string {
    return `You are an expert web developer creating a professional portfolio website.

Generate a complete, valid HTML5 document that is:
- Semantic and accessible (WCAG 2.1 AA compliant)
- Mobile-responsive (use CSS media queries)
- Fast-loading (inline all CSS, no external dependencies)
- SEO-optimized (meta tags, Open Graph, Schema.org markup)
- Beautiful and professional

Content to include:
${JSON.stringify(manifest, null, 2)}

Design requirements:
- Template style: ${template}
- Color scheme: Primary ${manifest.template?.colorScheme?.primary || '#0C2340'}
- Use professional typography
- Clean, modern layout
- Sections: ${manifest.template?.sections?.join(', ') || 'hero, about, experience, contact'}

CRITICAL REQUIREMENTS:
1. Output ONLY the complete HTML document
2. Inline ALL CSS in a <style> tag
3. No external dependencies (no CDN links)
4. Include proper meta tags for SEO
5. Add Schema.org structured data for Person
6. Make it mobile-responsive
7. Use semantic HTML5 tags
8. Ensure 4.5:1 contrast ratio minimum

Begin HTML output now:`;
  }

  /**
   * Invoke Bedrock model
   */
  private static async invokeModel(
    modelId: string,
    prompt: string,
    maxTokens: number
  ): Promise<string> {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    };

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body)
    ) as BedrockResponse;

    if (responseBody.content && responseBody.content.length > 0) {
      return responseBody.content[0].text;
    }

    throw new Error('No content in Bedrock response');
  }
}
