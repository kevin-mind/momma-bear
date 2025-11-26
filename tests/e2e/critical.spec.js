import {test, expect} from '@playwright/test';

test.describe('Critical E2E Tests', () => {
  test('app loads successfully', async ({page}) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check title contains Hydrogen
    await expect(page).toHaveTitle(/Hydrogen/, {timeout: 10000});
  });

  test('homepage renders products', async ({page}) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for the recommended products section to load
    const recommendedProductsHeading = page.getByRole('heading', {
      name: /recommended products/i,
    });
    await expect(recommendedProductsHeading).toBeVisible({timeout: 15000});

    // Wait for the products grid to be present (Suspense boundary resolved)
    const productsGrid = page.locator('.recommended-products-grid');
    await expect(productsGrid).toBeVisible({timeout: 15000});

    // Check that product items are rendered
    // ProductItem components should be visible
    const productLinks = page.locator('.product-item');
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);
    await expect(productLinks.first()).toBeVisible({timeout: 10000});
  });

  test('product page loads and renders product details', async ({page}) => {
    // First, navigate to homepage to get a product link
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    
    await page.waitForLoadState('networkidle');

    // Wait for products grid to load (Suspense boundary resolved)
    await expect(page.locator('.recommended-products-grid')).toBeVisible({timeout: 15000});

    // Wait for products to load
    const productLink = page.locator('.product-item').first();
    await expect(productLink).toBeVisible({timeout: 10000});

    // Get the product URL
    const productUrl = await productLink.getAttribute('href');
    expect(productUrl).toBeTruthy();
    if (!productUrl) {
      throw new Error('No product URL found on homepage');
    }

    // Navigate to product page
    const productResponse = await page.goto(productUrl);
    expect(productResponse?.status()).toBe(200);
    
    await page.waitForLoadState('networkidle');

    // Verify product page elements
    await expect(page.locator('h1')).toBeVisible({timeout: 10000});
    await expect(page.locator('.product')).toBeVisible({timeout: 10000});
  });

  test('collections page loads and displays products', async ({page}) => {
    // Navigate to homepage first
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    
    // Wait a bit for page to fully load
    await page.waitForLoadState('networkidle');

    // Look for a collection link (featured collection)
    const collectionLink = page.locator('.featured-collection, a[href*="/collections/"]').first();
    
    // Wait for collection link to be available
    const collectionHref = await collectionLink.getAttribute('href').catch(() => null);
    if (collectionHref) {
      const collectionResponse = await page.goto(collectionHref);
      expect(collectionResponse?.status()).toBe(200);
      
      await page.waitForLoadState('networkidle');
      
      // Verify collection page loads
      await expect(page.locator('h1')).toBeVisible({timeout: 15000});
      
      // Verify products grid is present
      const productsGrid = page.locator('.products-grid');
      await expect(productsGrid).toBeVisible({timeout: 15000});
    } else {
      // If no collection link, try navigating to /collections directly
      const collectionsResponse = await page.goto('/collections');
      expect(collectionsResponse?.status()).toBe(200);
      await expect(page).toHaveURL(/collections/, {timeout: 10000});
    }
  });
});

