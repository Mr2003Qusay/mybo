const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Reading cookies from config...");
  const cookiesJson = process.argv[2];
  if (!cookiesJson) {
      console.error("No cookies provided.");
      process.exit(1);
  }

  const cookieDict = JSON.parse(cookiesJson);
  const browserCookies = [];
  for (const [name, value] of Object.entries(cookieDict)) {
      browserCookies.push({
          name: name,
          value: value,
          domain: '.jio.com',
          path: '/'
      });
  }

  await context.addCookies(browserCookies);

  let successUrlFound = false;

  // Intercept all requests and responses
  page.on('response', async response => {
      const url = response.url();
      if (url.includes('one.google.com') || url.includes('serviceactivation.google.com')) {
          console.log(`SUCCESS_URL:${url}`);
          successUrlFound = true;
      }
      
      if (response.status() >= 300 && response.status() <= 399) {
          const location = await response.headerValue('location');
          if (location && (location.includes('google.com'))) {
               console.log(`SUCCESS_URL:${location}`);
               successUrlFound = true;
          }
      }
  });

  console.log("Navigating to Jio Google One offer...");
  try {
      await page.goto("https://www.jio.com/selfcare/googleai/?header=no&type=Z0241&source=JIO", { waitUntil: 'networkidle', timeout: 15000 });
      
      // Wait for 3 seconds to let scripts run
      await page.waitForTimeout(3000);
      
      if (!successUrlFound) {
          console.log("Executing API fetch manually...");
          
          await page.evaluate(async () => {
               await fetch("https://www.jio.com/api/jio-ott-service/ott/subscription/google-ai");
          });
          
          await page.waitForTimeout(2000);
          
          const submitResp = await page.evaluate(async () => {
               const r = await fetch("https://www.jio.com/api/jio-ott-service/ott/subscription/submit");
               if (r.redirected) return { url: r.url };
               return await r.json();
          });
          
          console.log(`Submit response: ${JSON.stringify(submitResp)}`);
      }
      
  } catch (e) {
      console.error(`Error during navigation: ${e}`);
  } finally {
      await browser.close();
  }
})();
