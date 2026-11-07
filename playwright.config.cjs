const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({testDir:'./tests/browser',use:{headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',args:['--no-sandbox']}}});
