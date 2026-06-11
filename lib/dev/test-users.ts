export interface TestUserFixture {
  phone: string;
  email: string;
  fullName: string;
  role: 'couple' | 'pro';
  locale: 'fr';
}

export const TEST_USERS: ReadonlyArray<TestUserFixture> = [
  {
    phone: '+33612931779',
    email: 'mamadou@wedillybird.test',
    fullName: 'Mamadou Seck',
    role: 'couple',
    locale: 'fr',
  },
  {
    phone: '+221771234567',
    email: 'aicha@wedillybird.test',
    fullName: 'Aïcha Diallo',
    role: 'couple',
    locale: 'fr',
  },
  {
    phone: '+33698765432',
    email: 'jean@wedillybird.test',
    fullName: 'Jean Dupont',
    role: 'couple',
    locale: 'fr',
  },
  {
    phone: '+212661234567',
    email: 'fatima@wedillybird.test',
    fullName: 'Fatima Bennani',
    role: 'couple',
    locale: 'fr',
  },
  {
    phone: '+225071234567',
    email: 'kwame@wedillybird.test',
    fullName: 'Kwame Kouassi',
    role: 'pro',
    locale: 'fr',
  },
  {
    // Agence Business (Studio Lumière) — back-office complet (CRM, budget…).
    phone: '+33600000002',
    email: 'camille@wedillybird.test',
    fullName: 'Camille Faye',
    role: 'pro',
    locale: 'fr',
  },
];
