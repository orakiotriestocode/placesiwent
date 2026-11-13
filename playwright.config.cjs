const { defineConfig } = require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/browser',timeout:30000,retries:1,use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:4173',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list'],['html',{open:'never'}]]});
