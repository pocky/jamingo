const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
 testDir:'./tests/browser',
 forbidOnly:Boolean(process.env.CI),
 workers:process.env.CI ? 1 : undefined,
 reporter:[['list'],['html',{open:'never'}]],
 use:{
  headless:true,
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
  launchOptions:{
   executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
   args:['--no-sandbox'],
  },
 },
});
