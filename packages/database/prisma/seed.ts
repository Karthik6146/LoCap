/**
 * LoCap seed — creates built-in caption styles + a demo user (dev only).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Built-in caption styles (seed a representative set; the full 30+ presets
  // live in @clipx/captions and are synced on demand by the app).
  const builtins: Array<{ name: string; category: string; data: Record<string, unknown> }> = [
    { name: 'Clean White', category: 'minimal', data: { font: 'Arial', fontSize: 64, color: '#ffffff', highlightColor: '#ffffff' } },
    { name: 'Impact Pop', category: 'bold', data: { font: 'Arial Black', fontSize: 88, color: '#ffffff', highlightColor: '#ffd400' } },
    { name: 'Valorant Vibes', category: 'gaming', data: { font: 'Arial Black', fontSize: 84, color: '#ff4655', highlightColor: '#ffffff' } },
    { name: 'Karaoke Fill', category: 'karaoke', data: { font: 'Arial Black', fontSize: 72, color: '#888888', highlightColor: '#ffe600' } },
    { name: 'Meme Pop', category: 'comedy', data: { font: 'Impact', fontSize: 96, color: '#ffffff', highlightColor: '#ffe600' } },
  ];
  for (const b of builtins) {
    const existing = await prisma.captionStyle.findFirst({
      where: { name: b.name, isBuiltin: true },
    });
    if (!existing) {
      await prisma.captionStyle.create({
        data: { name: b.name, category: b.category, isBuiltin: true, data: JSON.stringify(b.data) },
      });
    }
  }

  // Demo user (dev only) — created only if no user exists.
  const count = await prisma.user.count();
  if (count === 0) {
    await prisma.user.create({
      data: {
        email: 'demo@clipx.app',
        name: 'Demo Creator',
        role: 'user',
      },
    });
    console.log('Seeded local demo user: demo@clipx.app');
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
