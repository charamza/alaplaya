import { Game } from '@/core/Game';

async function main() {
  try {
    // Get the game container
    const container = document.getElementById('game-container');
    if (!container) {
      throw new Error('Game container not found');
    }

    // Create and initialize the game
    const game = new Game(container);
    await game.initialize();

    // Start the game loop
    game.start();

    console.log('Fiesta MMORPG started successfully!');

    // Handle cleanup on page unload
    window.addEventListener('beforeunload', () => {
      game.dispose();
    });

  } catch (error) {
    console.error('Failed to initialize game:', error);
    // Show error to user
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = `
        <div style="color: red; font-family: Arial; text-align: center; margin-top: 50px;">
          <h2>Failed to load game</h2>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p>Check the console for more details.</p>
        </div>
      `;
    }
  }
}

// Start the application
main();
