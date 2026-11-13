const { test, expect } = require('@playwright/test');
const game = '/arcade/park-builder/';
test.beforeEach(async ({page}) => { await page.goto(game); await page.evaluate(() => localStorage.removeItem('placesiwent-parkbuilder-alpha01')); await page.reload(); });
test('loads and simulates without page errors', async ({page}) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.locator('header .version')).toContainText('Alpha 0.10');
 await expect(page.locator('#cash')).toContainText('$');
 await expect(page.locator('#entertainerCount')).toHaveText('0');
 await page.locator('#hireEntertainer').click();await expect(page.locator('#toggleBubbles')).toContainText('on');await page.locator('#toggleBubbles').click();await expect(page.locator('#toggleBubbles')).toContainText('off');
 await expect(page.locator('#entertainerCount')).toHaveText('1');
 await page.locator('#speed').click();await page.waitForTimeout(2200);
 await expect(page.locator('#day')).not.toHaveText('1');
 expect(errors).toEqual([]);
});
test('bank, advertising, saves and restores', async ({page}) => {
 await page.locator('#takeLoan').click();
 await expect(page.locator('#loanBalance')).toContainText('5,000');
 await page.locator('#advertise').click();
 await expect(page.locator('#campaignDays')).toContainText('7');
 await page.locator('#save').click();
 await page.reload();
 await expect(page.locator('#loanBalance')).toContainText('5,000');
 await expect(page.locator('#campaignDays')).toContainText('7');
});
test('research and supplier controls respond', async ({page}) => {
 await page.locator('#premiumSupplier').click();
 await expect(page.locator('#supplierName')).toContainText('Golden Goods');
 await page.locator('#researchBudget').evaluate(el=>{el.value='200';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#researchBudgetValue')).toContainText('200');
});

test('park events appear as the simulation advances',async ({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>{const adapter=window.PiwGameAdapters['park-builder'];const save=adapter.exportSave();save.day=8;save.speed=4;adapter.importSave(save)});
 await expect(page.locator('#eventStatus')).not.toHaveText('All quiet',{timeout:12000});
 await expect(page.locator('#eventHistory')).toContainText('Day 9');
 expect(errors).toEqual([]);
});
