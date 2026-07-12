import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { getSupabaseAdmin } from './helpers/supabase';

/**
 * E2E tests for the core game flow.
 *
 * These tests use two browser contexts (host and guest) to simulate two players.
 * They require a running local Supabase instance (`supabase start`) and the dev server.
 *
 * Validates: Requirements 2.4, 3.4, 6.2, 6.3, 7.2, 12.1
 */

test.describe('Core Game Flow', () => {
  // Configure serial execution — tests share browser contexts
  test.describe.configure({ mode: 'serial' });

  let hostContext: BrowserContext;
  let guestContext: BrowserContext;
  let hostPage: Page;
  let guestPage: Page;

  test.beforeEach(async ({ browser }) => {
    // Create isolated browser contexts for each player
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();

    hostPage = await hostContext.newPage();
    guestPage = await guestContext.newPage();

    // Sign in host user by setting auth state via the app
    // The app auto-signs in anonymously; for testing, we navigate and let it authenticate.
    // In a real test environment, you could inject auth tokens via storage state.
    await hostPage.goto('/');
    await guestPage.goto('/');

    // Wait for auth to complete (app shows main content after auth)
    await hostPage.waitForSelector('text=Create Room', { timeout: 15_000 });
    await guestPage.waitForSelector('text=Create Room', { timeout: 15_000 });
  });

  test.afterEach(async () => {
    await hostContext?.close();
    await guestContext?.close();
  });

  test('Host creates room and share code is displayed', async () => {
    // Navigate to create room page
    await hostPage.goto('/#/create');

    // Wait for category selector to load
    await expect(hostPage.getByText('Create a Room')).toBeVisible();
    await expect(hostPage.getByText('Select categories for your bingo board')).toBeVisible();

    // Select all categories to ensure ≥25 items
    // Click category cards to select them (checkboxes are pointer-events-none)
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();

    // Confirm selection
    await expect(hostPage.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();

    // Verify share code is displayed
    await expect(hostPage.getByText('Room Created')).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByLabel('Share code')).toBeVisible();

    // Share code should be ≤8 alphanumeric characters
    const shareCodeElement = hostPage.getByLabel('Share code');
    const shareCode = await shareCodeElement.textContent();
    expect(shareCode).toBeTruthy();
    expect(shareCode!.length).toBeLessThanOrEqual(8);
    expect(shareCode!).toMatch(/^[a-zA-Z0-9]+$/);

    // Copy link button should be visible
    await expect(hostPage.getByRole('button', { name: 'Copy share URL' })).toBeVisible();

    // Waiting indicator should be visible
    await expect(hostPage.getByText('Waiting for opponent to join')).toBeVisible();
  });

  test('Guest joins via share code and both see the same board', async () => {
    // Host creates a room
    await hostPage.goto('/#/create');
    await hostPage.waitForSelector('text=Create a Room');

    // Select all categories
    // Click category cards to select them (checkboxes are pointer-events-none)
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();

    // Wait for share code to appear and host to be subscribed to channel
    await expect(hostPage.getByLabel('Share code')).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByText('Waiting for opponent to join')).toBeVisible();
    const shareCode = await hostPage.getByLabel('Share code').textContent();
    expect(shareCode).toBeTruthy();

    // Guest navigates to join page and enters the code
    await guestPage.goto(`/#/join/${shareCode}`);

    // Guest should auto-join via URL code or enter it manually
    // The app auto-joins if code is in URL, so wait for game page to load
    await expect(guestPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Host should also be redirected to the game page (room became active)
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Both should see exactly 25 cells (buttons in interactive mode)
    const hostCells = hostPage.getByRole('grid', { name: 'Bingo board' }).getByRole('button');
    const guestCells = guestPage.getByRole('grid', { name: 'Bingo board' }).getByRole('button');
    await expect(hostCells).toHaveCount(25);
    await expect(guestCells).toHaveCount(25);

    // Verify both boards have the same cell texts (same seed → same board)
    const hostCellTexts: string[] = [];
    const guestCellTexts: string[] = [];

    for (let i = 0; i < 25; i++) {
      hostCellTexts.push((await hostCells.nth(i).textContent()) ?? '');
      guestCellTexts.push((await guestCells.nth(i).textContent()) ?? '');
    }

    expect(hostCellTexts).toEqual(guestCellTexts);
  });

  test('Mark cell appears on both screens via realtime sync', async () => {
    // Set up a game with both players
    await hostPage.goto('/#/create');
    await hostPage.waitForSelector('text=Create a Room');

    // Click category cards to select them (checkboxes are pointer-events-none)
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();
    await expect(hostPage.getByLabel('Share code')).toBeVisible({ timeout: 10_000 });
    const shareCode = await hostPage.getByLabel('Share code').textContent();

    // Guest joins
    await guestPage.goto(`/#/join/${shareCode}`);
    await expect(guestPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Host marks the first cell (index 0)
    const hostCells = hostPage.getByRole('grid', { name: 'Bingo board' }).getByRole('button');
    const firstCell = hostCells.first();
    await firstCell.click();

    // Verify the host cell is now marked (shows "marked by host" state)
    await expect(firstCell).toHaveAttribute('aria-pressed', 'true');

    // Verify the mark appears on the guest's screen via realtime sync
    const guestFirstCell = guestPage.getByRole('grid', { name: 'Bingo board' }).getByRole('button').first();
    await expect(guestFirstCell).toContainText(
      await firstCell.textContent() ?? '',
    );

    // Guest should see cell as "marked by host" (blue tint class indicates host mark)
    // We check the aria-label which contains "marked by host"
    await expect(guestFirstCell).toHaveAttribute(
      'aria-label',
      /marked by host/,
      { timeout: 10_000 },
    );
  });

  test('Bingo detection triggers notification', async () => {
    // Set up a game with both players
    await hostPage.goto('/#/create');
    await hostPage.waitForSelector('text=Create a Room');

    // Click category cards to select them (checkboxes are pointer-events-none)
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();
    await expect(hostPage.getByLabel('Share code')).toBeVisible({ timeout: 10_000 });
    const shareCode = await hostPage.getByLabel('Share code').textContent();

    await guestPage.goto(`/#/join/${shareCode}`);
    await expect(guestPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Extract the room ID from the host's URL
    const hostUrl = hostPage.url();
    const roomIdMatch = hostUrl.match(/#\/game\/(.+)/);
    expect(roomIdMatch).toBeTruthy();
    const roomId = roomIdMatch![1];

    // Use admin API to pre-mark an entire row (cells 0-4) to trigger bingo
    // This simulates both players marking cells to complete a row quickly
    const admin = getSupabaseAdmin();

    // Get the host user ID from the room record
    const { data: room } = await admin
      .from('rooms')
      .select('host_id, guest_id')
      .eq('id', roomId)
      .single();

    expect(room).toBeTruthy();

    // Insert marks for the first row (cells 0–4) by the host
    for (let cellIndex = 0; cellIndex < 5; cellIndex++) {
      await admin.from('marks').upsert(
        {
          room_id: roomId,
          cell_index: cellIndex,
          player_id: room!.host_id,
        },
        { onConflict: 'room_id,cell_index,player_id' }
      );
    }

    // Reload the host page to pick up the persisted marks
    await hostPage.reload();
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Bingo notification should appear (role="alert" with "BINGO!" text)
    await expect(hostPage.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByText('BINGO!')).toBeVisible();

    // Verify the notification shows which line was completed
    await expect(hostPage.getByText('Row 1')).toBeVisible();

    // Board should still be interactive (bingo doesn't lock the board)
    const hostCells = hostPage.getByRole('grid', { name: 'Bingo board' }).getByRole('button');
    // Cell at index 5 (first cell of row 2) should still be clickable
    const unplayedCell = hostCells.nth(5);
    await expect(unplayedCell).toBeEnabled();
  });

  test('End game makes board read-only', async () => {
    // Set up a game with both players
    await hostPage.goto('/#/create');
    await hostPage.waitForSelector('text=Create a Room');

    // Click category cards to select them (checkboxes are pointer-events-none)
    await hostPage.getByText('Shot Speeds').click();
    await hostPage.getByText('Shot Types').click();
    await hostPage.getByText('Game Events').click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();
    await expect(hostPage.getByLabel('Share code')).toBeVisible({ timeout: 10_000 });
    const shareCode = await hostPage.getByLabel('Share code').textContent();

    await guestPage.goto(`/#/join/${shareCode}`);
    await expect(guestPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(hostPage.getByRole('grid', { name: 'Bingo board' })).toBeVisible({
      timeout: 15_000,
    });

    // Verify End Game button is visible for Host
    const endGameButton = hostPage.getByRole('button', { name: 'End Game' });
    await expect(endGameButton).toBeVisible();

    // End Game button should NOT be visible for Guest
    await expect(
      guestPage.getByRole('button', { name: 'End Game' })
    ).not.toBeVisible();

    // Host clicks End Game
    await endGameButton.click();

    // Host should see "Game Over" message
    await expect(hostPage.getByText('Game Over')).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByText('This game has ended.')).toBeVisible();

    // Guest should also see "Game Over" message via realtime broadcast
    await expect(guestPage.getByText('Game Over')).toBeVisible({ timeout: 10_000 });

    // Board cells should become read-only (rendered as divs, not buttons)
    // In read-only mode, cells don't have aria-pressed attribute
    const hostCells = hostPage.getByRole('gridcell');
    const firstHostCell = hostCells.first();

    // Cells should no longer be clickable (no button role, just gridcell div)
    // Verify by checking that clicking doesn't trigger mark (no aria-pressed)
    await expect(firstHostCell).not.toHaveAttribute('aria-pressed');

    // "Create New Room" link should be visible
    await expect(hostPage.getByText('Create New Room')).toBeVisible();
    await expect(guestPage.getByText('Create New Room')).toBeVisible();
  });
});
