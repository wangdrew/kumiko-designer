const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/browser',use:{browserName:'chromium',channel:'chrome',headless:true,viewport:{width:1440,height:1000}},workers:1});
