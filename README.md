# Fiesta MMORPG

A modern MMORPG built with TypeScript and Three.js using Vite as the build tool.

## Project Structure

```
src/
├── core/           # Core game engine
│   └── Game.ts     # Main game class managing the application
├── scenes/         # Scene management
│   ├── SceneManager.ts    # Manages Three.js scene and camera
│   └── WorldScene.ts      # Main game world scene
├── entities/       # Game entities
│   ├── Player.ts   # Player character with movement
│   ├── Terrain.ts  # Flat terrain with height variation
│   └── Sky.ts      # Sky sphere with gradient
├── systems/        # Game systems
│   └── InputManager.ts    # Input handling (keyboard/mouse)
├── utils/          # Utility functions (for future use)
└── types/          # TypeScript type definitions (for future use)
```

## Features

- **Flat Terrain**: Large plane with subtle height variation
- **Sky Sphere**: Gradient sky background
- **Player Model**: Loads GLTF model from `assets/player.glb`
- **Movement Controls**: WASD keys for movement
- **Scalable Architecture**: Modular design ready for MMORPG features

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:5173`

## Controls

- **WASD**: Move player forward/backward/left/right
- **Space**: Jump (placeholder, not implemented yet)
- **Mouse**: Look around (placeholder, not implemented yet)

## Architecture Notes

This project is designed with scalability in mind for a future MMORPG:

- **Modular Systems**: Separate managers for input, scenes, entities
- **Entity Component System Ready**: Entities are self-contained with their own update logic
- **Scene Management**: Easy to add multiple scenes (worlds, menus, etc.)
- **Asset Management**: Structured asset loading ready for more complex models
- **Network Ready**: Architecture prepared for multiplayer features

## Development

- Uses **Vite** for fast development and building
- **TypeScript** for type safety
- **Three.js** for 3D graphics
- **ES Modules** for modern JavaScript

## Future Plans

- Player animations based on movement
- Camera controls (follow player, mouse look)
- More terrain features (textures, biomes)
- Additional entities (NPCs, enemies)
- Multiplayer networking
- UI systems
- Inventory and items
- Combat system
