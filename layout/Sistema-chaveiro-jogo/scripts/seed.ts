import { getDb } from '@/lib/mongo';
import type { Game } from '@/models/game';
import type { Cartridge } from '@/models/cartridge';

const sampleGames: Game[] = [
  {
    id: 'game-1',
    title: 'Super Retro',
    console: 'Arcade',
    system: 'Arcade (FBNeo)',
    slug: 'super-retro',
    description: 'A classic arcade experience with endless waves of enemies.',
    image: '/images/super-retro.png',
    romPath: '/roms/super-retro.bin',
    active: true
  },
  {
    id: 'game-2',
    title: 'Pixel Quest',
    console: 'Arcade',
    system: 'Arcade (FBNeo)',
    slug: 'pixel-quest',
    description: 'A retro platformer with challenging levels and hidden secrets.',
    image: '/images/pixel-quest.png',
    romPath: '/roms/pixel-quest.bin',
    active: true
  },
  {
    id: 'game-3',
    title: 'Space Runner',
    console: 'Arcade',
    system: 'Arcade (FBNeo)',
    slug: 'space-runner',
    description: 'Navigate through asteroid fields in this fast-paced shooter.',
    image: '/images/space-runner.png',
    romPath: '/roms/space-runner.bin',
    active: true
  }
];

const sampleCartridges: Cartridge[] = [
  {
    id: 'cartridge-1',
    nfcId: 'demo',
    gameId: 'game-1',
    collectionNumber: 101,
    status: 'active'
  },
  {
    id: 'cartridge-2',
    nfcId: 'nfc-001',
    gameId: 'game-2',
    collectionNumber: 102,
    status: 'active'
  },
  {
    id: 'cartridge-3',
    nfcId: 'nfc-002',
    gameId: 'game-3',
    collectionNumber: 103,
    status: 'active'
  }
];

async function seedDatabase() {
  try {
    const db = await getDb();

    const gamesCollection = db.collection<Game>('games');
    const cartridgesCollection = db.collection<Cartridge>('cartridges');

    const gamesCount = await gamesCollection.countDocuments();
    if (gamesCount === 0) {
      await gamesCollection.insertMany(sampleGames);
      console.log('✓ Seeded games');
    } else {
      console.log('✓ Games already exist');
    }

    const cartridgesCount = await cartridgesCollection.countDocuments();
    if (cartridgesCount === 0) {
      await cartridgesCollection.insertMany(sampleCartridges);
      console.log('✓ Seeded cartridges');
    } else {
      console.log('✓ Cartridges already exist');
    }

    console.log('\n✓ Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
