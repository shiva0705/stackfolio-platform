import { test, expect } from '@playwright/test';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join } from 'path';

const API_ENDPOINT = process.env.TEST_API_ENDPOINT || 'http://localhost:3000';
const FRONTEND_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:5173';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

test.describe('End-to-End Portfolio Creation', () => {
  let authToken: string;
  let userId: string;

  test.beforeEach(async ({ page }) => {
    // Login to get auth token
    await page.goto(FRONTEND_URL);
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForSelector('[data-testid="dashboard"]');
    
    // Extract auth token from localStorage or cookies
    authToken = await page.evaluate(() => {
      return localStorage.getItem('authToken') || '';
    });
    
    userId = 'test-user-' + Date.now();
  });

  test('should upload resume PDF and extract content @smoke', async ({ page }) => {
    // Navigate to upload page
    await page.goto(`${FRONTEND_URL}/upload`);
    
    // Upload test resume
    const resumePath = join(__dirname, 'fixtures', 'sample-resume.pdf');
    await page.setInputFiles('input[type="file"]', resumePath);
    
    // Wait for upload and processing
    await expect(page.locator('[data-testid="upload-status"]')).toContainText('Processing', {
      timeout: 30000,
    });
    
    await expect(page.locator('[data-testid="upload-status"]')).toContainText('Complete', {
      timeout: 60000,
    });
    
    // Verify manifest was created
    await page.goto(`${FRONTEND_URL}/preview`);
    
    // Check that profile name was extracted
    await expect(page.locator('[data-testid="profile-name"]')).not.toBeEmpty();
    
    // Check that experience section exists
    const experienceCards = page.locator('[data-testid="experience-card"]');
    await expect(experienceCards).toHaveCount(await experienceCards.count());
    expect(await experienceCards.count()).toBeGreaterThan(0);
  });

  test('should chat to edit headline', async ({ page, request }) => {
    // First upload a resume to have content
    await setupTestPortfolio(userId);
    
    await page.goto(`${FRONTEND_URL}/edit`);
    
    // Open chat interface
    await page.click('[data-testid="chat-button"]');
    
    // Type chat message
    await page.fill('[data-testid="chat-input"]', 
      'Change my headline to "AI-Powered Executive Leader"');
    await page.click('[data-testid="chat-send"]');
    
    // Wait for AI response
    await expect(page.locator('[data-testid="chat-message"]:last-child'))
      .toContainText('updated your headline', { timeout: 30000 });
    
    // Verify preview updated
    await page.goto(`${FRONTEND_URL}/preview`);
    await expect(page.locator('[data-testid="profile-headline"]'))
      .toContainText('AI-Powered Executive Leader');
  });

  test('should publish portfolio to CloudFront', async ({ page, request }) => {
    await setupTestPortfolio(userId);
    
    await page.goto(`${FRONTEND_URL}/publish`);
    
    // Click publish button
    await page.click('[data-testid="publish-button"]');
    
    // Wait for deployment
    await expect(page.locator('[data-testid="publish-status"]'))
      .toContainText('Publishing', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="publish-status"]'))
      .toContainText('Live', { timeout: 60000 });
    
    // Get the live URL
    const liveUrl = await page.locator('[data-testid="live-url"]').textContent();
    expect(liveUrl).toBeTruthy();
    
    // Verify published page loads
    const publishedPage = await page.context().newPage();
    await publishedPage.goto(liveUrl!);
    
    // Check that it's valid HTML
    await expect(publishedPage.locator('h1')).toBeVisible();
    await expect(publishedPage.locator('[data-section="about"]')).toBeVisible();
    
    // Verify no React runtime (pure HTML)
    const reactRoot = await publishedPage.locator('#root').count();
    expect(reactRoot).toBe(0);
  });

  test('should handle multiple file uploads', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/upload`);
    
    // Upload multiple files
    const files = [
      join(__dirname, 'fixtures', 'resume.pdf'),
      join(__dirname, 'fixtures', 'headshot.jpg'),
      join(__dirname, 'fixtures', 'awards.txt'),
    ];
    
    await page.setInputFiles('input[type="file"]', files);
    
    // Wait for all uploads
    await expect(page.locator('[data-testid="upload-item"]')).toHaveCount(3);
    
    await expect(page.locator('[data-testid="upload-item"].completed'))
      .toHaveCount(3, { timeout: 90000 });
    
    // Verify all content types extracted
    await page.goto(`${FRONTEND_URL}/preview`);
    await expect(page.locator('[data-testid="profile-photo"]')).toBeVisible();
    await expect(page.locator('[data-testid="awards-section"]')).toBeVisible();
  });

  test('should regenerate HTML after content changes', async ({ request }) => {
    await setupTestPortfolio(userId);
    
    // Get initial HTML
    const initialHtml = await request.get(`${API_ENDPOINT}/users/${userId}/preview`);
    const initialBody = await initialHtml.text();
    
    // Update content via API
    await request.post(`${API_ENDPOINT}/chat`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      data: {
        userId,
        message: 'Add a new award: "Tech Innovator of the Year 2025"',
      },
    });
    
    // Wait for regeneration
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get updated HTML
    const updatedHtml = await request.get(`${API_ENDPOINT}/users/${userId}/preview`);
    const updatedBody = await updatedHtml.text();
    
    // Verify HTML changed
    expect(updatedBody).not.toEqual(initialBody);
    expect(updatedBody).toContain('Tech Innovator of the Year 2025');
  });
});

test.describe('Smoke Tests', () => {
  test('API health check @smoke', async ({ request }) => {
    const response = await request.get(`${API_ENDPOINT}/health`);
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('Frontend loads @smoke', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('CloudFront serves static assets @smoke', async ({ page }) => {
    const response = await page.goto(FRONTEND_URL);
    expect(response?.status()).toBe(200);
    
    // Check CloudFront headers
    const headers = response?.headers();
    expect(headers?.['x-cache']).toBeDefined();
  });
});

// Helper functions

async function setupTestPortfolio(userId: string) {
  const s3Client = new S3Client({ region: 'us-east-1' });
  
  // Upload sample resume
  const resumePath = join(__dirname, 'fixtures', 'sample-resume.pdf');
  const resumeContent = readFileSync(resumePath);
  
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.TEST_CONTENT_BUCKET!,
    Key: `users/${userId}/context/resume.pdf`,
    Body: resumeContent,
    ContentType: 'application/pdf',
  }));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 10000));
}
