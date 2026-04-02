/**
 * Mock data for premium "Collections" demonstration.
 * Includes diverse categories, timestamps, and placeholder descriptions.
 */

const CATEGORIES = [
  'Shopping',
  'Study',
  'Project idea',
  'Place',
  'Event',
  'Person',
  'Receipt',
  'Ticket',
  'Code',
];

const SUMMARIES = {
  Shopping: [
    'Nike Air Jordan 1 Low - Obsidian/White',
    'Logitech MX Master 3S Mouse',
    'Mechanical Keyboard Keycaps (PBT)',
    'Comfortable Ergo Chair for office',
  ],
  Study: [
    'React Native Gesture Handler Tutorial',
    'Advanced TypeScript Patterns',
    'System Design Interview Prep',
    'Deep Learning with PyTorch',
  ],
  'Project idea': [
    'AI-powered recipe generator app',
    'LaterLens: Next-gen visual library',
    'Minimalist focus timer for work',
  ],
  Place: [
    'Aesthetic Cafe in Tokyo (Shibuya)',
    'Hiking trail in Rajasthan (Aravali)',
    'Coworking space in Berlin (Mitte)',
  ],
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMockCollections(count = 20) {
  const items = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const category = getRandomItem(CATEGORIES);
    const summaryList = SUMMARIES[category] || [
      `Captured ${category} screenshot`,
      `Important ${category} info`,
    ];
    
    items.push({
      id: `mock-${i}`,
      type: 'screenshot',
      contentType: category,
      summary: getRandomItem(summaryList),
      timestamp: now - Math.floor(Math.random() * 1000000000),
      status: 'queued',
      tags: [category.toLowerCase(), 'mock', 'saved'],
      // In a real app, these would be local file URIs
      thumbnail: `https://picsum.photos/seed/${i * 10}/400/600`, 
    });
  }

  return items;
}

export const SMART_COLLECTIONS = [
  { id: 'smart-1', name: 'Your app ideas', count: 12, tags: ['idea', 'app'] },
  { id: 'smart-2', name: 'Rajasthan trip', count: 8, tags: ['travel', 'india'] },
  { id: 'smart-3', name: 'React learning path', count: 15, tags: ['coding', 'react'] },
];
