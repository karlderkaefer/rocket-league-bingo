import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * E2E tests for the player name and board legend features.
 *
 * Validates:
 * - Optional player name input on homepage
 * - Name persists and shows in the board legend
 * - Legend displays color indicators for both players
 */

test.describe('Player Name & Board Legend', () => {
  test.describe.configure({ mode: 'serial' });

  let hostContext: BrowserContext;
  let guestContext: BrowserContext;
  let hostPage: Page;
  let guestPage: Page;

  test.beforeEach(async ({ browser }) => {
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    guestPage = await guestContext.newPage();

    await hostPage.goto('/');
    await guestPage.goto('/');
    await hostPage.waitForSelector('text=Create Room', { timeout: 15_000 });
    await guestPage.waitForSelector('text=Create Room', { timeout: 15_000 });
  });

  test.afterEach(async () => {
    await hostContext?.close();
    await guestContext?.close();
  });

  test('homepage shows optional name input', async () => {
    await expect(hostPage.getByRole('textbox', { name: 'Player name' })).toBeVisible();
    await expect(hostPage.getByRole('textbox', { name: 'Player name' })).toHaveAttribute(
      'placeholder',
      'Your name (optional)'
    );
  });

  test('player name appears in board legend after entering it', async () => {
    // Host enters their name
    await hostPage.getByRole('textbox', { name: 'Player name' }).fill('RocketFan');

    // Host creates a room
    await hostPage.getByRole('button', { name: 'Create Room' }).click();
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();

    // Wait for share code
    await expect(hostPage.getByLabel('Share code')).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByText('Waiting for opponent to join')).toBeVisible();
    const shareCode = await hostPage.getByLabel('Share code').textContent();

    // Guest joins
    await guestPage.goto(`/#/join/${shareCode}`);
    await expect(guestPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Host's legend shows their custom name
    await expect(hostPage.getByText('RocketFan').first()).toBeVisible();
    await expect(hostPage.getByText('Opponent')).toBeVisible();
  });

  test('default legend shows "You" when no name is entered', async () => {
    // Host does NOT enter a name — goes straight to create
    await hostPage.getByRole('button', { name: 'Create Room' }).click();
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();

    await expect(hostPage.getByLabel('Share code')).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByText('Waiting for opponent to join')).toBeVisible();
    const shareCode = await hostPage.getByLabel('Share code').textContent();

    // Guest joins
    await guestPage.goto(`/#/join/${shareCode}`);
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Legend shows "You" as default
    await expect(hostPage.getByText('You').first()).toBeVisible();
    await expect(hostPage.getByText('Opponent')).toBeVisible();
  });
});
