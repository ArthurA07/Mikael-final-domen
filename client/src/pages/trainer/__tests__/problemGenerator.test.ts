import { generateProblemFactory } from '../../../utils/problemGenerator';

describe('problem generator', () => {
  test('sum within range', () => {
    const gen = generateProblemFactory({ numbersCount: 3, numberRange: 10, operations: ['+'] });
    for (let i = 0; i < 50; i++) {
      const p = gen();
      expect(p.numbers.length).toBe(3);
      expect(Math.max(...p.numbers)).toBeLessThanOrEqual(10);
      expect(Math.min(...p.numbers)).toBeGreaterThanOrEqual(1);
      expect(p.correctAnswer).toBe(p.numbers.reduce((s, n) => s + n, 0));
    }
  });

  test('range with min=1000', () => {
    const gen = generateProblemFactory({ numbersCount: 2, numberRange: 1000000, numberRangeMin: 1000, operations: ['+'] });
    for (let i = 0; i < 20; i++) {
      const p = gen();
      expect(Math.min(...p.numbers)).toBeGreaterThanOrEqual(1000);
      expect(Math.max(...p.numbers)).toBeLessThanOrEqual(1000000);
    }
  });

  test('laws five constrain last digit sum to 5 when applicable', () => {
    const gen = generateProblemFactory({ numbersCount: 2, numberRange: 9, operations: ['+'], lawsMode: 'five' });
    for (let i = 0; i < 20; i++) {
      const p = gen();
      const s = (p.numbers[0] % 10) + (p.numbers[1] % 10);
      expect(s % 5).toBe(0);
      expect(p.correctAnswer).toBe(p.numbers[0] + p.numbers[1]);
    }
  });

  test('laws five with mixed +/- produce both formula and non-formula style steps on units', () => {
    const gen = generateProblemFactory({
      numbersCount: 7,
      numberRange: 9, // работаем только в единицах, как в примерах заказчика
      operations: ['+', '-'],
      lawsMode: 'five',
    });

    let seenFormulaStep = false;
    let seenNonFormulaStep = false;

    // Дадим несколько попыток, чтобы из-за рандома не поймать только формулы или только обычные шаги
    for (let attempt = 0; attempt < 30 && !(seenFormulaStep && seenNonFormulaStep); attempt++) {
      const p = gen();
      expect(p.ops).toBeDefined();
      if (!p.ops) continue;

      let acc = p.numbers[0];
      for (let i = 1; i < p.numbers.length; i++) {
        const op = p.ops[i - 1];
        const step = p.numbers[i];

        const beforeUnits = Math.abs(acc) % 10;
        const stepUnits = Math.abs(step) % 10;

        // Эвристика "шаг по формуле на 5" в единицах:
        //  - для сложения: добавляем 1..5 так, чтобы новая единичная цифра стала кратна 5
        //  - для вычитания: вычитаем 1..4 при текущей единичной цифре >= 5
        let isFormulaLike = false;
        if (op === '+') {
          if (stepUnits >= 1 && stepUnits <= 5 && ((beforeUnits + stepUnits) % 5 === 0)) {
            isFormulaLike = true;
          }
        } else if (op === '-') {
          if (beforeUnits >= 5 && stepUnits >= 1 && stepUnits <= 4) {
            isFormulaLike = true;
          }
        }

        if (isFormulaLike) {
          seenFormulaStep = true;
        } else {
          // учитываем только нетривиальные шаги в единицах
          if (stepUnits !== 0) {
            seenNonFormulaStep = true;
          }
        }

        // обновляем аккумулятор как это сделает тренажёр
        acc = op === '+' ? acc + step : acc - step;
      }
    }

    expect(seenFormulaStep).toBe(true);
    expect(seenNonFormulaStep).toBe(true);
  });

  test('division returns integer quotient', () => {
    const gen = generateProblemFactory({ numbersCount: 2, numberRange: 100, operations: ['/'] });
    for (let i = 0; i < 20; i++) {
      const p = gen();
      expect(p.numbers[0] % p.numbers[1]).toBe(0);
    }
  });

  test('division respects constraints: dividend<=6 digits, divisors<=4 digits and not 1', () => {
    const gen = generateProblemFactory({ numbersCount: 3, numberRange: 1000000, operations: ['/'] });
    for (let i = 0; i < 30; i++) {
      const p = gen();
      expect(p.numbers.length).toBeGreaterThanOrEqual(2);
      const [dividend, ...divisors] = p.numbers;
      expect(dividend).toBeGreaterThanOrEqual(1);
      expect(dividend).toBeLessThanOrEqual(999999);
      divisors.forEach((d) => {
        expect(d).toBeGreaterThanOrEqual(2);
        expect(d).toBeLessThanOrEqual(9999);
      });
      // целочисленность результата
      let acc = dividend;
      for (const d of divisors) acc = acc / d;
      expect(Number.isInteger(acc)).toBe(true);
    }
  });

  test('multiplication respects constraints: each factor <= 3 digits', () => {
    const gen = generateProblemFactory({ numbersCount: 3, numberRange: 1000000, operations: ['*'] });
    for (let i = 0; i < 30; i++) {
      const p = gen();
      expect(p.numbers.length).toBeLessThanOrEqual(3);
      p.numbers.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(999);
      });
    }
  });

  test('laws ten: sum of unit digits >= 10 when numbersCount=2 and + (units place)', () => {
    // ограничиваем диапазон 1-9, чтобы проверять именно единицы
    const gen = generateProblemFactory({ numbersCount: 2, numberRange: 9, operations: ['+'], lawsMode: 'ten' });
    for (let i = 0; i < 30; i++) {
      const p = gen();
      const s = (p.numbers[0] % 10) + (p.numbers[1] % 10);
      expect(s).toBeGreaterThanOrEqual(10);
    }
  });

  test('mixed +/- contains both ops when both requested', () => {
    const gen = generateProblemFactory({ numbersCount: 5, numberRange: 20, operations: ['+','-'] });
    let seenBoth = false;
    for (let i = 0; i < 50; i++) {
      const p = gen();
      if (p.ops && p.ops.includes('+') && p.ops.includes('-')) {
        seenBoth = true;
        break;
      }
    }
    expect(seenBoth).toBe(true);
  });

  test('subtraction-only yields non-negative results', () => {
    const gen = generateProblemFactory({ numbersCount: 5, numberRange: 20, operations: ['-'] });
    for (let i = 0; i < 20; i++) {
      const p = gen();
      expect(p.correctAnswer).toBeGreaterThanOrEqual(0);
    }
  });

  test('laws both generate within range and without exceptions for longer sequences', () => {
    const gen = generateProblemFactory({ numbersCount: 7, numberRange: 999, operations: ['+','-'], lawsMode: 'both' });
    for (let i = 0; i < 20; i++) {
      const p = gen();
      expect(Math.max(...p.numbers)).toBeLessThanOrEqual(999);
      // допускаем 0 как нейтральный шаг при вычитании на нуле
      expect(Math.min(...p.numbers)).toBeGreaterThanOrEqual(0);
      // корректный ответ должен быть числом
      expect(typeof p.correctAnswer).toBe('number');
    }
  });

  test('ten numbers do not crash and stay within range', () => {
    const gen = generateProblemFactory({ numbersCount: 10, numberRange: 99, operations: ['+'] });
    for (let i = 0; i < 10; i++) {
      const p = gen();
      expect(p.numbers.length).toBe(10);
      expect(Math.max(...p.numbers)).toBeLessThanOrEqual(99);
      expect(Math.min(...p.numbers)).toBeGreaterThanOrEqual(1);
      expect(p.correctAnswer).toBe(p.numbers.reduce((s, n) => s + n, 0));
    }
  });
});


