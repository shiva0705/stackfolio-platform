import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { Handler } from 'aws-lambda';
import type { S3Event, ContentManifest, ExtractedContent } from '../types/index.js';
import { BedrockService } from '../services/bedrock.service.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const textractClient = new TextractClient({ region: process.env.AWS_REGION });

/**
 * Content Processor Lambda
 * 
 * Triggered when user uploads files to S3
 * Extracts text from PDFs, classifies content, updates manifest
 */
export const handler: Handler = async (event: S3Event) => {
  console.log('Content Processor triggered:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    try {
      // Extract userId from key: users/{userId}/context/{filename}
      const pathParts = key.split('/');
      if (pathParts.length < 4 || pathParts[0] !== 'users') {
        console.log('Skipping non-user file:', key);
        continue;
      }

      const userId = pathParts[1];
      const fileName = pathParts[pathParts.length - 1];

      console.log(`Processing file for user ${userId}: ${fileName}`);

      // Extract content based on file type
      let extractedText = '';
      const fileExt = fileName.split('.').pop()?.toLowerCase();

      if (fileExt === 'pdf') {
        extractedText = await extractPDFText(bucket, key);
      } else if (['jpg', 'jpeg', 'png'].includes(fileExt || '')) {
        // For images, just record metadata for now
        console.log(`Image file detected: ${fileName}`);
        await updateManifestWithImage(userId, bucket, key, fileName);
        continue;
      } else if (fileExt === 'txt') {
        extractedText = await getTextFile(bucket, key);
      } else {
        console.log(`Unsupported file type: ${fileExt}`);
        continue;
      }

      if (extractedText) {
        // Classify content using Bedrock
        console.log(`Classifying content from ${fileName}...`);
        const classified = await BedrockService.classifyContent(
          extractedText,
          fileName
        );

        if (classified) {
          // Update or create manifest
          await updateManifest(userId, classified, fileName);
          
          // Trigger HTML regeneration
          await regenerateHTML(userId);
        }
      }
    } catch (error) {
      console.error(`Error processing ${key}:`, error);
      // Don't throw - continue processing other files
    }
  }

  return { statusCode: 200, body: 'Processing complete' };
};

/**
 * Extract text from PDF using Textract
 */
async function extractPDFText(bucket: string, key: string): Promise<string> {
  console.log(`Extracting text from PDF: ${key}`);

  const command = new DetectDocumentTextCommand({
    Document: {
      S3Object: {
        Bucket: bucket,
        Name: key,
      },
    },
  });

  const response = await textractClient.send(command);
  
  // Combine all text blocks
  const text = response.Blocks?.filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join('\n') || '';

  console.log(`Extracted ${text.length} characters from PDF`);
  return text;
}

/**
 * Get text file content
 */
async function getTextFile(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  const text = await response.Body?.transformToString() || '';
  return text;
}

/**
 * Update manifest with image metadata
 */
async function updateManifestWithImage(
  userId: string,
  bucket: string,
  key: string,
  fileName: string
): Promise<void> {
  const manifestKey = `users/${userId}/metadata/content-manifest.json`;
  
  try {
    // Load existing manifest
    const manifest = await loadManifest(userId);
    
    // Determine if this is a profile photo or other image
    const isHeadshot = fileName.toLowerCase().includes('headshot') ||
                       fileName.toLowerCase().includes('profile') ||
                       fileName.toLowerCase().includes('photo');

    if (isHeadshot && !manifest.profile.photo) {
      manifest.profile.photo = {
        url: `s3://${bucket}/${key}`,
        alt: `Professional photo of ${manifest.profile.name}`,
      };
    }

    // Save manifest
    await saveManifest(userId, manifest);
  } catch (error) {
    console.error('Error updating manifest with image:', error);
  }
}

/**
 * Update or create content manifest
 */
async function updateManifest(
  userId: string,
  classified: any,
  sourceFile: string
): Promise<void> {
  console.log(`Updating manifest for user ${userId}`);

  let manifest: ContentManifest;

  try {
    // Try to load existing manifest
    manifest = await loadManifest(userId);
  } catch (error) {
    // Create new manifest
    manifest = createNewManifest(userId);
  }

  // Merge classified content
  if (classified.profile) {
    manifest.profile = { ...manifest.profile, ...classified.profile };
  }

  if (classified.about) {
    manifest.about.summary = classified.about.summary || manifest.about.summary;
    manifest.about.highlights = [
      ...manifest.about.highlights,
      ...(classified.about.highlights || []),
    ];
    if (!manifest.about.sourceFiles.includes(sourceFile)) {
      manifest.about.sourceFiles.push(sourceFile);
    }
  }

  if (classified.experience && Array.isArray(classified.experience)) {
    manifest.experience = [
      ...manifest.experience,
      ...classified.experience.map((exp: any, idx: number) => ({
        ...exp,
        id: `exp-${Date.now()}-${idx}`,
        sourceFiles: [sourceFile],
      })),
    ];
  }

  if (classified.awards && Array.isArray(classified.awards)) {
    manifest.awards = [
      ...manifest.awards,
      ...classified.awards.map((award: any, idx: number) => ({
        ...award,
        id: `award-${Date.now()}-${idx}`,
        sourceFiles: [sourceFile],
      })),
    ];
  }

  if (classified.boards && Array.isArray(classified.boards)) {
    manifest.boards = [
      ...manifest.boards,
      ...classified.boards.map((board: any, idx: number) => ({
        ...board,
        id: `board-${Date.now()}-${idx}`,
      })),
    ];
  }

  if (classified.contact) {
    manifest.contact = { ...manifest.contact, ...classified.contact };
  }

  manifest.lastUpdated = new Date().toISOString();
  manifest.metadata.draftVersion += 1;

  await saveManifest(userId, manifest);
  console.log(`Manifest updated for ${userId}`);
}

/**
 * Load manifest from S3
 */
async function loadManifest(userId: string): Promise<ContentManifest> {
  const bucket = process.env.CONTENT_BUCKET!;
  const key = `users/${userId}/metadata/content-manifest.json`;

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  const data = await response.Body?.transformToString();

  if (!data) {
    throw new Error('No manifest data');
  }

  return JSON.parse(data) as ContentManifest;
}

/**
 * Save manifest to S3
 */
async function saveManifest(userId: string, manifest: ContentManifest): Promise<void> {
  const bucket = process.env.CONTENT_BUCKET!;
  const key = `users/${userId}/metadata/content-manifest.json`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json',
  });

  await s3Client.send(command);
}

/**
 * Create new manifest
 */
function createNewManifest(userId: string): ContentManifest {
  return {
    userId,
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    profile: {
      name: '',
      headline: '',
    },
    about: {
      summary: '',
      highlights: [],
      sourceFiles: [],
    },
    experience: [],
    awards: [],
    boards: [],
    philanthropy: {},
    media: [],
    contact: {},
    template: {
      name: 'professional-executive',
      colorScheme: {
        primary: '#0C2340',
        accent: '#8B9DC3',
        background: '#FFFFFF',
      },
      sections: ['hero', 'about', 'experience', 'awards', 'contact'],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      draftVersion: 1,
      liveVersion: 0,
    },
  };
}

/**
 * Trigger HTML regeneration (placeholder)
 */
async function regenerateHTML(userId: string): Promise<void> {
  console.log(`TODO: Trigger HTML regeneration for ${userId}`);
  // This will invoke the html-generator Lambda
}
