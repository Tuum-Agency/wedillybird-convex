import { describe, it, expect } from 'vitest';
import {
  normalizeRsvpConfig,
  sanitizeRsvpConfig,
  sanitizeCustomAnswers,
  MAX_CUSTOM_QUESTIONS,
  MAX_OPTIONS,
  MAX_LONG_ANSWER,
  type RsvpConfig,
  type RsvpQuestion,
} from '../../../lib/rsvp/questions';

const q = (over: Partial<RsvpQuestion>): RsvpQuestion => ({
  id: 'q1',
  type: 'short_text',
  label: 'Question',
  ...over,
});

describe('normalizeRsvpConfig', () => {
  it('champs built-in affichés par défaut quand la config est absente', () => {
    const n = normalizeRsvpConfig(undefined);
    expect(n).toMatchObject({ askDietary: true, askNotes: true, askPlusOnes: true });
    expect(n.customQuestions).toEqual([]);
  });

  it('respecte les toggles explicites et vide les labels blancs', () => {
    const n = normalizeRsvpConfig({ askNotes: false, dietaryLabel: '   ' });
    expect(n.askNotes).toBe(false);
    expect(n.dietaryLabel).toBeUndefined();
  });

  it('écarte les questions mal formées (choix sans options, label vide)', () => {
    const n = normalizeRsvpConfig({
      customQuestions: [
        q({ id: 'ok', type: 'single_choice', options: ['A', 'B'] }),
        q({ id: 'bad-choice', type: 'single_choice', options: [] }),
        q({ id: '', label: 'sans id' }),
        q({ id: 'blank', label: '   ' }),
      ],
    });
    expect(n.customQuestions.map((x) => x.id)).toEqual(['ok']);
  });
});

describe('sanitizeRsvpConfig', () => {
  it('dédoublonne + plafonne les options des choix', () => {
    const out = sanitizeRsvpConfig({
      customQuestions: [
        q({
          id: 'menu',
          type: 'single_choice',
          options: [
            'Viande',
            'Viande',
            'Poisson',
            ...Array.from({ length: 20 }, (_, i) => `x${i}`),
          ],
        }),
      ],
    });
    const opts = out.customQuestions?.[0]?.options ?? [];
    expect(opts.length).toBeLessThanOrEqual(MAX_OPTIONS);
    expect(new Set(opts).size).toBe(opts.length); // pas de doublon
    expect(opts.slice(0, 2)).toEqual(['Viande', 'Poisson']);
  });

  it('plafonne le nombre de questions', () => {
    const many = Array.from({ length: MAX_CUSTOM_QUESTIONS + 5 }, (_, i) =>
      q({ id: `q${i}`, label: `Q${i}` }),
    );
    const out = sanitizeRsvpConfig({ customQuestions: many });
    expect(out.customQuestions?.length).toBe(MAX_CUSTOM_QUESTIONS);
  });

  it('écarte une question sans id (jamais de fabrication d’id)', () => {
    const out = sanitizeRsvpConfig({
      customQuestions: [q({ id: '   ', label: 'no id' }), q({ id: 'keep', label: 'ok' })],
    });
    expect(out.customQuestions?.map((x) => x.id)).toEqual(['keep']);
  });

  it('conserve required + onlyIfAttending seulement si true', () => {
    const out = sanitizeRsvpConfig({
      customQuestions: [q({ id: 'a', required: true, onlyIfAttending: true })],
    });
    expect(out.customQuestions?.[0]).toMatchObject({ required: true, onlyIfAttending: true });
  });
});

describe('sanitizeCustomAnswers', () => {
  const config: RsvpConfig = {
    customQuestions: [
      q({ id: 'song', type: 'short_text', label: 'Chanson', required: true }),
      q({ id: 'menu', type: 'single_choice', label: 'Menu', options: ['Viande', 'Poisson'] }),
      q({ id: 'allergies', type: 'multi_choice', label: 'Allergies', options: ['Gluten', 'Noix'] }),
      q({ id: 'bus', type: 'boolean', label: 'Navette ?' }),
      q({ id: 'kids', type: 'short_text', label: 'Enfants', onlyIfAttending: true }),
    ],
  };

  it('nettoie et conserve les réponses valides', () => {
    const { answers, errors } = sanitizeCustomAnswers(
      config,
      [
        { questionId: 'song', values: ['  Perfect — Ed Sheeran '] },
        { questionId: 'menu', values: ['Poisson'] },
        { questionId: 'allergies', values: ['Gluten', 'Noix', 'Gluten'] },
        { questionId: 'bus', values: ['yes'] },
        { questionId: 'kids', values: ['2'] },
      ],
      true,
    );
    expect(errors).toEqual({});
    expect(answers).toEqual([
      { questionId: 'song', values: ['Perfect — Ed Sheeran'] },
      { questionId: 'menu', values: ['Poisson'] },
      { questionId: 'allergies', values: ['Gluten', 'Noix'] }, // dédoublonné
      { questionId: 'bus', values: ['yes'] },
      { questionId: 'kids', values: ['2'] },
    ]);
  });

  it('rejette les valeurs de choix hors options et les booléens invalides', () => {
    const { answers } = sanitizeCustomAnswers(
      config,
      [
        { questionId: 'menu', values: ['Vegan'] },
        { questionId: 'allergies', values: ['Lactose', 'Noix'] },
        { questionId: 'bus', values: ['peut-être'] },
        { questionId: 'song', values: ['x'] },
      ],
      true,
    );
    const byId = Object.fromEntries(answers.map((a) => [a.questionId, a.values]));
    expect(byId.menu).toBeUndefined(); // 'Vegan' hors options → droppé
    expect(byId.allergies).toEqual(['Noix']); // seul 'Noix' valide
    expect(byId.bus).toBeUndefined(); // booléen invalide
  });

  it('signale les questions required non répondues', () => {
    const { errors } = sanitizeCustomAnswers(
      config,
      [{ questionId: 'menu', values: ['Viande'] }],
      true,
    );
    expect(errors.song).toBe('answerRequired');
  });

  it('saute les questions onlyIfAttending quand l’invité n’est pas présent', () => {
    const { answers, errors } = sanitizeCustomAnswers(
      config,
      [
        { questionId: 'song', values: ['Une chanson'] },
        { questionId: 'kids', values: ['3'] },
      ],
      false,
    );
    expect(answers.find((a) => a.questionId === 'kids')).toBeUndefined();
    expect(errors.kids).toBeUndefined();
  });

  it('ignore les réponses à des questions inconnues', () => {
    const { answers } = sanitizeCustomAnswers(
      config,
      [
        { questionId: 'ghost', values: ['x'] },
        { questionId: 'song', values: ['ok'] },
      ],
      true,
    );
    expect(answers.some((a) => a.questionId === 'ghost')).toBe(false);
  });

  it('clampe le texte long à la limite', () => {
    const longConfig: RsvpConfig = {
      customQuestions: [q({ id: 'msg', type: 'long_text', label: 'Mot' })],
    };
    const { answers } = sanitizeCustomAnswers(
      longConfig,
      [{ questionId: 'msg', values: ['a'.repeat(MAX_LONG_ANSWER + 50)] }],
      true,
    );
    expect(answers[0]?.values[0]?.length).toBe(MAX_LONG_ANSWER);
  });
});
