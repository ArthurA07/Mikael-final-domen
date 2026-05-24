import {
  classifyLaw10Step,
  classifyLaw5Step,
  generateProblemFactory,
  getDigitAtPlace,
  isLawOfFiveAddition,
  isLawOfFiveSubtraction,
  isLawOfTenAddition,
  isLawOfTenSubtraction,
  isValidLawOfFiveOperation,
  Problem
} from '../../../utils/problemGenerator';

describe('problem generator', () => {
  const expressionOf = (problem: Problem): string => {
    const ops = problem.ops && problem.ops.length === problem.numbers.length - 1
      ? problem.ops
      : Array.from({ length: Math.max(0, problem.numbers.length - 1) }, () => problem.operation);
    let expr = `${problem.numbers[0]}`;
    for (let i = 1; i < problem.numbers.length; i++) {
      expr += ` ${ops[i - 1]} ${problem.numbers[i]}`;
    }
    return expr;
  };

  const classifyOperandStructure = (value: number): string => {
    const abs = Math.abs(Math.trunc(value));
    if (abs <= 9) return 'unitsOnly';
    if (abs >= 1000 && abs % 1000 === 0) return 'round1000plus';
    if (abs >= 100 && abs % 100 === 0) return 'round100';
    if (abs >= 10 && abs % 10 === 0) return 'round10';
    return 'mixed';
  };

  const activePlaces = (value: number): number[] => {
    const abs = Math.abs(Math.trunc(value));
    if (abs === 0) return [1];
    const places: number[] = [];
    let place = 1;
    let n = abs;
    while (n > 0) {
      if (n % 10 !== 0) places.push(place);
      n = Math.floor(n / 10);
      place *= 10;
    }
    return places;
  };

  const structuralSignatureOf = (problem: Problem): string => {
    const ops = problem.ops && problem.ops.length === problem.numbers.length - 1
      ? problem.ops
      : Array.from({ length: Math.max(0, problem.numbers.length - 1) }, () => problem.operation);
    const firstDigits = Math.max(1, Math.floor(Math.log10(Math.max(1, Math.abs(problem.numbers[0])))) + 1);
    const classes = problem.numbers.slice(1).map(classifyOperandStructure).join(',');
    const places = problem.numbers.slice(1).map((n, idx) => `${ops[idx]}:${activePlaces(n).join('.')}`).join('|');
    return `first:${firstDigits}digit|ops:${ops.join('')}|classes:${classes}|places:${places}`;
  };

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

  const expectLaw5 = (current: number, op: '+' | '-', operand: number, type: 'law5_plus' | 'law5_minus') => {
    const cls = classifyLaw5Step(current, op, operand);
    expect(cls.okForLaw5Mode).toBe(true);
    expect(cls.hasLaw5).toBe(true);
    expect(cls.parts.some(part => part.type === type)).toBe(true);
  };

  const expectInvalidForLaw5 = (current: number, op: '+' | '-', operand: number) => {
    const cls = classifyLaw5Step(current, op, operand);
    expect(cls.okForLaw5Mode).toBe(false);
    expect(cls.hasLaw5).toBe(false);
  };

  const expectForbidden = (current: number, op: '+' | '-', operand: number, type: 'forbidden_carry' | 'forbidden_borrow') => {
    const cls = classifyLaw5Step(current, op, operand);
    expect(cls.okForLaw5Mode).toBe(false);
    expect(cls.hasForbiddenCarryOrBorrow).toBe(true);
    expect(cls.parts.some(part => part.type === type)).toBe(true);
  };

  const validateLaw5Problem = (problem: Problem) => {
    expect(problem.ops).toBeDefined();
    expect(problem.ops?.length).toBe(problem.numbers.length - 1);

    let current = problem.numbers[0];
    for (let i = 1; i < problem.numbers.length; i++) {
      const op = problem.ops![i - 1] as '+' | '-';
      const operand = problem.numbers[i];
      const signedDelta = op === '+' ? operand : -operand;
      const cls = classifyLaw5Step(current, op, operand);
      expect(cls.okForLaw5Mode).toBe(true);
      expect(cls.parts.some(part => (
        part.type === 'forbidden_carry' ||
        part.type === 'forbidden_borrow' ||
        part.type === 'invalid'
      ))).toBe(false);
      expect(cls.hasLaw5).toBe(true);
      expect(isValidLawOfFiveOperation(current, signedDelta)).toBe(true);
      current = op === '+' ? current + operand : current - operand;
      expect(current).toBeGreaterThanOrEqual(0);
    }
    expect(problem.correctAnswer).toBe(current);
  };

  const validateLaw10Problem = (
    problem: Problem,
    options: {
      operations: Array<'+' | '-'>;
      shouldRequireBothFormulaSteps: boolean;
      expectAtLeastOneLaw10: boolean;
    }
  ) => {
    expect(problem.ops).toBeDefined();
    expect(problem.ops?.length).toBe(problem.numbers.length - 1);
    expect(problem.law10Classifications).toBeDefined();
    expect(problem.law10Classifications?.length).toBe(problem.numbers.length - 1);

    let current = problem.numbers[0];
    let hasLaw10 = false;
    let law10Plus = 0;
    let law10Minus = 0;
    const formulaSums = new Set<number>();
    const formulaPlaces = new Set<number>();
    const usedOps = new Set<'+' | '-'>();

    for (let i = 1; i < problem.numbers.length; i++) {
      const op = problem.ops![i - 1] as '+' | '-';
      const operand = problem.numbers[i];
      const cls = classifyLaw10Step(current, op, operand);
      const fromProblem = problem.law10Classifications![i - 1];
      usedOps.add(op);

      expect(cls.okForLaw10Mode).toBe(true);
      expect(cls.hasInvalid).toBe(false);
      expect(fromProblem).toEqual(cls);
      expect(cls.parts.length).toBeGreaterThan(0);
      expect(cls.parts.every(part => part.type !== 'invalid')).toBe(true);

      if (op === '+' && options.operations.length === 1 && options.operations[0] === '+') {
        expect(cls.parts.some(part => part.type === 'law10_minus')).toBe(false);
      }
      if (op === '-' && options.operations.length === 1 && options.operations[0] === '-') {
        expect(cls.parts.some(part => part.type === 'law10_plus')).toBe(false);
      }

      if (cls.hasLaw10) {
        hasLaw10 = true;
        const part = cls.parts[0];
        formulaPlaces.add(part.place);
        formulaSums.add(part.currentDigit + part.operandDigit);
        if (part.type === 'law10_plus') law10Plus += 1;
        if (part.type === 'law10_minus') law10Minus += 1;
      }

      current = op === '+' ? current + operand : current - operand;
      expect(current).toBeGreaterThanOrEqual(0);
    }

    expect(problem.correctAnswer).toBe(current);
    if (options.expectAtLeastOneLaw10) {
      expect(hasLaw10).toBe(true);
    }

    if (options.shouldRequireBothFormulaSteps && problem.numbers.length === 3 && options.operations.length === 2) {
      expect(law10Plus).toBeGreaterThanOrEqual(1);
      expect(law10Minus).toBeGreaterThanOrEqual(1);
    }

    if (options.operations.length === 2) {
      expect(usedOps.has('+')).toBe(true);
      expect(usedOps.has('-')).toBe(true);
    }

    return { formulaSums, formulaPlaces };
  };

  const parseExpressionProblem = (expression: string): Problem => {
    const tokens = expression.trim().split(/\s+/);
    const numbers: number[] = [];
    const ops: Array<'+' | '-'> = [];
    tokens.forEach((token, idx) => {
      if (idx % 2 === 0) numbers.push(Number(token));
      else ops.push(token as '+' | '-');
    });
    let acc = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
      acc = ops[i - 1] === '+' ? acc + numbers[i] : acc - numbers[i];
    }
    return { numbers, operation: '+', ops, correctAnswer: acc };
  };

  const validateCombinedLawsProblem = (
    problem: Problem,
    options: { mustHaveLaw5: boolean; mustHaveLaw10: boolean }
  ) => {
    expect(problem.ops).toBeDefined();
    expect(problem.ops?.length).toBe(problem.numbers.length - 1);

    let current = problem.numbers[0];
    let hasLaw5 = false;
    let hasLaw10 = false;
    for (let i = 1; i < problem.numbers.length; i++) {
      const op = problem.ops![i - 1] as '+' | '-';
      const operand = problem.numbers[i];
      const law5 = classifyLaw5Step(current, op, operand);
      const law10 = classifyLaw10Step(current, op, operand);

      expect(law10.hasInvalid).toBe(false);

      hasLaw5 = hasLaw5 || law5.hasLaw5;
      hasLaw10 = hasLaw10 || law10.hasLaw10;

      current = op === '+' ? current + operand : current - operand;
      expect(current).toBeGreaterThanOrEqual(0);
    }
    expect(problem.correctAnswer).toBe(current);
    if (options.mustHaveLaw5) expect(hasLaw5).toBe(true);
    if (options.mustHaveLaw10) expect(hasLaw10).toBe(true);
    return { hasLaw5, hasLaw10 };
  };

  test('law5 helpers return expected values', () => {
    expect(getDigitAtPlace(506673, 10000)).toBe(0);
    expect(getDigitAtPlace(506673, 1000)).toBe(6);
    expect(isLawOfFiveAddition(3, 2)).toBe(true);
    expect(isLawOfFiveAddition(0, 4)).toBe(false);
    expect(isLawOfFiveSubtraction(8, 4)).toBe(true);
    expect(isLawOfFiveSubtraction(6, 1)).toBe(false);
  });

  test('classifyLaw5Step detects law5 addition steps', () => {
    [
      [3, 2],
      [4, 1],
      [1, 4],
      [4, 4],
      [36, 20],
      [34223, 1000],
      [702411, 4],
    ].forEach(([current, operand]) => expectLaw5(current, '+', operand, 'law5_plus'));
  });

  test('classifyLaw5Step detects law5 subtraction steps', () => {
    [
      [5, 1],
      [6, 2],
      [7, 3],
      [8, 4],
      [380515, 100],
      [81986, 40],
      [814301, 400000],
      [535223, 3000],
    ].forEach(([current, operand]) => expectLaw5(current, '-', operand, 'law5_minus'));
  });

  test('isValidLawOfFiveOperation accepts strict law5 steps only', () => {
    [
      [3, 2],
      [4, 1],
      [1, 4],
      [5, -1],
      [6, -2],
      [7, -3],
      [8, -4],
      [380515, -100],
      [435375, 30000],
      [465375, -4],
    ].forEach(([current, signedDelta]) => {
      expect(isValidLawOfFiveOperation(current as number, signedDelta as number)).toBe(true);
    });
  });

  test('classifyLaw5Step forbids carry in law5 mode', () => {
    [
      [230663, 40],
      [230703, 300],
      [526152, 4000],
      [843686, 4],
      [869863, 40],
    ].forEach(([current, operand]) => expectForbidden(current, '+', operand, 'forbidden_carry'));
  });

  test('strict law5 rejects non-law5 direct operations', () => {
    [
      [2, '+', 2],   // не переход через 5
      [1, '+', 2],   // не переход через 5
      [6, '+', 1],   // обычное сложение
      [380415, '+', 5], // k=5 не допускается в режиме закона на 5
      [8, '-', 3],   // обычное вычитание
      [9, '-', 4],   // обычное вычитание
      [6, '-', 1],   // обычное вычитание
      [506673, '-', 10000], // запрещённый заём из старшего разряда
    ].forEach(([current, op, operand]) => expectInvalidForLaw5(current as number, op as '+' | '-', operand as number));
  });

  test('laws five generator builds valid step-by-step expressions across current ranges', () => {
    [9, 99, 999, 999999].forEach((numberRange) => {
      const gen = generateProblemFactory({ numbersCount: 3, numberRange, operations: ['+', '-'], lawsMode: 'five' });
      for (let i = 0; i < 1000; i++) {
        validateLaw5Problem(gen());
      }
    });
  });

  test('laws five long generator keeps all operations valid for law5', () => {
    [9, 99, 999, 999999].forEach((numberRange) => {
      const gen = generateProblemFactory({ numbersCount: 7, numberRange, operations: ['+', '-'], lawsMode: 'five' });
      for (let i = 0; i < 1000; i++) {
        validateLaw5Problem(gen());
      }
    });
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

  test('law10 helpers return expected values', () => {
    expect(isLawOfTenAddition(9, 1)).toBe(true);
    expect(isLawOfTenAddition(6, 8)).toBe(true);
    expect(isLawOfTenAddition(4, 5)).toBe(false);
    expect(isLawOfTenSubtraction(0, 4)).toBe(true);
    expect(isLawOfTenSubtraction(3, 9)).toBe(true);
    expect(isLawOfTenSubtraction(8, 3)).toBe(false);
  });

  test('classifyLaw10Step detects law10_plus steps', () => {
    [
      [9, 1],
      [4, 9],
      [6, 8],
      [5, 9],
      [265, 50],
      [375, 900],
      [295890, 8000],
      [881709, 4],
      [698877, 800000],
    ].forEach(([current, operand]) => {
      const cls = classifyLaw10Step(current, '+', operand);
      expect(cls.okForLaw10Mode).toBe(true);
      expect(cls.hasLaw10).toBe(true);
      expect(cls.hasCarry).toBe(true);
      expect(cls.hasBorrow).toBe(false);
      expect(cls.parts.some(part => part.type === 'law10_plus')).toBe(true);
    });
  });

  test('classifyLaw10Step detects law10_minus steps', () => {
    [
      [10, 4],
      [13, 9],
      [1021, 2],
      [315, 60],
      [204288, 600],
      [247634, 60],
      [109, 10],
    ].forEach(([current, operand]) => {
      const cls = classifyLaw10Step(current, '-', operand);
      expect(cls.okForLaw10Mode).toBe(true);
      expect(cls.hasLaw10).toBe(true);
      expect(cls.hasCarry).toBe(false);
      expect(cls.hasBorrow).toBe(true);
      expect(cls.parts.some(part => part.type === 'law10_minus')).toBe(true);
    });
  });

  test('classifyLaw10Step marks direct steps without carry/borrow', () => {
    [
      [15, '-', 5],
      [698787, '-', 100000],
      [80, '-', 40],
      [1000, '+', 5000],
    ].forEach(([current, op, operand]) => {
      const cls = classifyLaw10Step(current as number, op as '+' | '-', operand as number);
      expect(cls.okForLaw10Mode).toBe(true);
      expect(cls.hasLaw10).toBe(false);
      expect(cls.hasInvalid).toBe(false);
      expect(cls.parts.every(part => part.type === 'direct')).toBe(true);
    });
  });

  test('classifyLaw10Step marks non-formula operations as direct (not law10)', () => {
    [
      [2, '+', 2],
      [3, '+', 1],
      [8, '-', 3],
      [9, '-', 4],
      [40, '+', 20],
      [90, '-', 30],
    ].forEach(([current, op, operand]) => {
      const cls = classifyLaw10Step(current as number, op as '+' | '-', operand as number);
      expect(cls.okForLaw10Mode).toBe(true);
      expect(cls.hasLaw10).toBe(false);
      expect(cls.parts.every(part => part.type === 'direct')).toBe(true);
    });
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

  test('mixed +/- always returns full-length valid problem and consistent answer', () => {
    const gen = generateProblemFactory({ numbersCount: 12, numberRange: 99, operations: ['+', '-'] });
    for (let i = 0; i < 80; i++) {
      const p = gen();
      expect(p.numbers.length).toBe(12);
      expect(p.ops).toBeDefined();
      expect(p.ops?.length).toBe(11);
      let acc = p.numbers[0];
      for (let j = 1; j < p.numbers.length; j++) {
        const op = p.ops![j - 1];
        acc = op === '+' ? acc + p.numbers[j] : acc - p.numbers[j];
      }
      expect(p.correctAnswer).toBe(acc);
    }
  });

  test('subtraction-only yields non-negative results', () => {
    const gen = generateProblemFactory({ numbersCount: 5, numberRange: 20, operations: ['-'] });
    for (let i = 0; i < 20; i++) {
      const p = gen();
      expect(p.correctAnswer).toBeGreaterThanOrEqual(0);
    }
  });

  test('laws both generator includes both law5 and law10 in mixed mode', () => {
    const gen = generateProblemFactory({ numbersCount: 7, numberRange: 999, operations: ['+','-'], lawsMode: 'both' });
    for (let i = 0; i < 300; i++) {
      const p = gen();
      const stats = validateCombinedLawsProblem(p, { mustHaveLaw5: true, mustHaveLaw10: true });
      expect(stats.hasLaw5).toBe(true);
      expect(stats.hasLaw10).toBe(true);
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

  test('laws ten stress: step-by-step validation, variability and range coverage', () => {
    const ranges = [9, 99, 999, 999999];
    const operationsSets: Array<Array<'+' | '-'>> = [['+'], ['-'], ['+', '-']];
    const numbersCounts = [3, 10];

    ranges.forEach((numberRange) => {
      operationsSets.forEach((operations) => {
        numbersCounts.forEach((numbersCount) => {
          const gen = generateProblemFactory({
            numbersCount,
            numberRange,
            operations,
            lawsMode: 'ten',
          });

          const aggregateSums = new Set<number>();
          const aggregatePlaces = new Set<number>();

          for (let i = 0; i < 1000; i++) {
            const p = gen();
            expect(p.numbers.length).toBe(numbersCount);
            if (!p.ops || !p.law10Classifications) {
              throw new Error(`fallback-to-non-law10 range=${numberRange} ops=${operations.join('')} count=${numbersCount}`);
            }
            const stats = validateLaw10Problem(p, {
              operations,
              shouldRequireBothFormulaSteps: true,
              expectAtLeastOneLaw10: !(operations.length === 1 && operations[0] === '-' && numberRange < 10),
            });
            stats.formulaSums.forEach(sum => aggregateSums.add(sum));
            stats.formulaPlaces.forEach(place => aggregatePlaces.add(place));
          }

          // Для сложения проверяем вариативность сумм 10..14+
          if (operations.includes('+')) {
            expect([...aggregateSums].some(sum => sum === 10)).toBe(true);
            expect([...aggregateSums].some(sum => sum === 11)).toBe(true);
            expect([...aggregateSums].some(sum => sum === 12)).toBe(true);
            expect([...aggregateSums].some(sum => sum === 13)).toBe(true);
            expect([...aggregateSums].some(sum => sum >= 14)).toBe(true);
          }

          // Покрытие доступных разрядов для данного диапазона:
          // строго требуем для сценариев с '+'; для только '-' проверяем, что формулы вообще есть.
          const expectAtLeastOneLaw10 = !(operations.length === 1 && operations[0] === '-' && numberRange < 10);
          if (operations.includes('+')) {
            const expectedPlaces: number[] = [1];
            if (numberRange >= 10) expectedPlaces.push(10);
            if (numberRange >= 100) expectedPlaces.push(100);
            if (numberRange >= 1000) expectedPlaces.push(1000);
            if (numberRange >= 10000) expectedPlaces.push(10000);
            if (numberRange >= 100000) expectedPlaces.push(100000);
            expectedPlaces.forEach(place => expect(aggregatePlaces.has(place)).toBe(true));
          } else if (expectAtLeastOneLaw10) {
            expect(aggregatePlaces.size).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  test('laws both long sequence stays full-length and keeps mixed +/- available', () => {
    const gen = generateProblemFactory({ numbersCount: 12, numberRange: 999, operations: ['+', '-'], lawsMode: 'both' });
    let seenPlus = false;
    let seenMinus = false;
    for (let i = 0; i < 30; i++) {
      const p = gen();
      expect(p.numbers.length).toBe(12);
      expect(p.ops).toBeDefined();
      expect(p.ops?.length).toBe(11);
      if (p.ops?.includes('+')) seenPlus = true;
      if (p.ops?.includes('-')) seenMinus = true;
      validateCombinedLawsProblem(p, { mustHaveLaw5: true, mustHaveLaw10: true });
    }
    expect(seenPlus).toBe(true);
    expect(seenMinus).toBe(true);
  });

  test('combined laws known valid examples contain both law5 and law10', () => {
    [
      '334182 + 20 + 200000 + 800000 - 30000',
      '567367 + 40 + 800 - 300000 - 40000',
      '34542 + 3 - 4 + 4 + 70',
      '70 - 40 + 5 + 80 - 1 - 5',
      '968 - 80 - 90 + 300 - 700 - 4',
      '582 - 90 - 400 - 30 + 90 - 30',
      '422 + 100 + 500 - 200 + 900 + 80',
      '126 + 4 + 5 + 400 + 20 - 9',
      '704 + 1 + 5 - 90 + 30 + 70',
      '656 - 70 + 700 + 7 + 300 + 10',
    ].forEach((expr) => {
      const p = parseExpressionProblem(expr);
      const stats = validateCombinedLawsProblem(p, { mustHaveLaw5: true, mustHaveLaw10: true });
      expect(stats.hasLaw5).toBe(true);
      expect(stats.hasLaw10).toBe(true);
    });
  });

  test('combined laws insufficient examples miss law5 and should be rejected', () => {
    [
      '67068 + 60000 - 9000 + 900000 + 2000',
      '290824 - 6000 - 9000 + 800 + 900000',
      '944778 + 700000 + 300 - 600 + 400000',
      '76 - 8 + 40 + 2 - 3',
      '87 - 8 - 1 - 9 + 1',
      '83 + 20 - 5 - 9 - 3',
    ].forEach((expr) => {
      const p = parseExpressionProblem(expr);
      const stats = validateCombinedLawsProblem(p, { mustHaveLaw5: false, mustHaveLaw10: false });
      expect(stats.hasLaw10).toBe(true);
      expect(stats.hasLaw5).toBe(false);
    });
  });

  test('laws both stress: ranges, lengths, operation sets', () => {
    const ranges = [9, 99, 999, 999999];
    const operationSets: Array<Array<'+' | '-'>> = [['+'], ['-'], ['+', '-']];
    const numbersCounts = [3, 10];

    ranges.forEach((numberRange) => {
      operationSets.forEach((operations) => {
        numbersCounts.forEach((numbersCount) => {
          const gen = generateProblemFactory({
            numbersCount,
            numberRange,
            operations,
            lawsMode: 'both',
          });

          const mustHaveLaw10 = !(operations.length === 1 && operations[0] === '-' && numberRange < 10);
          for (let i = 0; i < 1000; i++) {
            const p = gen();
            expect(p.numbers.length).toBe(numbersCount);
            validateCombinedLawsProblem(p, { mustHaveLaw5: true, mustHaveLaw10 });
            if (p.law5Classifications && p.law10Classifications) {
              expect(p.law5Classifications.length).toBe(numbersCount - 1);
              expect(p.law10Classifications.length).toBe(numbersCount - 1);
            }
          }
        });
      });
    });
  });

  test('standard division fallback is not fixed to classic x/2 template', () => {
    const classicFallbacks = new Set(['8 / 2', '98 / 2', '998 / 2', '19998 / 2']);

    [9, 99, 999, 999999].forEach((numberRange) => {
      const gen = generateProblemFactory({ numbersCount: 3, numberRange, operations: ['/'], lawsMode: 'none' });
      const unique = new Set<string>();
      let classicCount = 0;
      for (let i = 0; i < 400; i++) {
        const p = gen();
        // Деление всегда целочисленное
        let acc = p.numbers[0];
        for (let j = 1; j < p.numbers.length; j++) acc = acc / p.numbers[j];
        expect(Number.isInteger(acc)).toBe(true);
        expect(acc).toBe(p.correctAnswer);

        const expr = expressionOf(p);
        unique.add(expr);
        if (classicFallbacks.has(expr)) classicCount += 1;
      }

      // Для малых диапазонов вариантов меньше, но всё равно должна быть вариативность.
      const minUnique = numberRange === 9 ? 4 : 40;
      expect(unique.size).toBeGreaterThanOrEqual(minUnique);
      expect(classicCount).toBeLessThan(40);
    });
  });

  test('standard division in 1-9 softly limits x/x and answer=1 frequency', () => {
    // Для оценки частоты x/x и answer=1 проверяем классический сценарий из 2 чисел.
    // При 3 числах в диапазоне 1-9 доля answer=1 неизбежно выше из-за малого пространства.
    const gen = generateProblemFactory({ numbersCount: 2, numberRange: 9, operations: ['/'], lawsMode: 'none' });
    let answerOne = 0;
    let exactSelfDivision = 0;
    const total = 500;

    for (let i = 0; i < total; i++) {
      const p = gen();
      if (p.correctAnswer === 1) answerOne += 1;
      if (p.numbers.length === 2 && p.numbers[0] === p.numbers[1]) exactSelfDivision += 1;
    }

    expect(answerOne / total).toBeLessThan(0.5);
    expect(exactSelfDivision / total).toBeLessThan(0.3);
  });

  test('standard minus in range 1-9 avoids excessive repeated easy chains', () => {
    const gen = generateProblemFactory({ numbersCount: 3, numberRange: 9, operations: ['-'], lawsMode: 'none' });
    const freq = new Map<string, number>();
    let repeatedOnes = 0;

    for (let i = 0; i < 400; i++) {
      const p = gen();
      const expr = expressionOf(p);
      freq.set(expr, (freq.get(expr) || 0) + 1);
      if (p.numbers[1] === 1 && p.numbers[2] === 1) repeatedOnes += 1;
    }

    const maxRepeat = Math.max(...freq.values());
    expect(freq.size).toBeGreaterThanOrEqual(65);
    expect(maxRepeat).toBeLessThan(40);
    expect(repeatedOnes).toBeLessThan(140);
  });

  test('standard 1-99 plus with 3 numbers does not collapse into one structural template', () => {
    const gen = generateProblemFactory({ numbersCount: 3, numberRange: 99, operations: ['+'], lawsMode: 'none' });
    const signatures = new Map<string, number>();
    const secondOperand = new Map<number, number>();
    const SAMPLE = 1200;

    for (let i = 0; i < SAMPLE; i++) {
      const p = gen();
      const signature = structuralSignatureOf(p);
      signatures.set(signature, (signatures.get(signature) || 0) + 1);
      secondOperand.set(p.numbers[1], (secondOperand.get(p.numbers[1]) || 0) + 1);
    }

    const topSignature = [...signatures.entries()].sort((a, b) => b[1] - a[1])[0];
    const topSecondOperand = [...secondOperand.entries()].sort((a, b) => b[1] - a[1])[0];
    const topSignatureShare = topSignature ? topSignature[1] / SAMPLE : 0;
    const topSecondOperandShare = topSecondOperand ? topSecondOperand[1] / SAMPLE : 0;
    const targetTemplate = 'first:2digit|ops:++|classes:round10,unitsOnly';
    const targetTemplateCount = signatures.get(targetTemplate) || 0;

    expect(signatures.size).toBeGreaterThanOrEqual(12);
    expect(topSignatureShare).toBeLessThan(0.28);
    expect(topSecondOperandShare).toBeLessThan(0.23);
    expect(targetTemplateCount / SAMPLE).toBeLessThan(0.2);
  });

  test('standard structural diversity stress across ranges and operation sets', () => {
    const ranges = [9, 99, 999, 999999];
    const operationSets: Array<{ name: string; ops: Array<'+' | '-' | '*' | '/'> }> = [
      { name: '+', ops: ['+'] },
      { name: '-', ops: ['-'] },
      { name: '+/-', ops: ['+', '-'] },
      { name: '*', ops: ['*'] },
      { name: '/', ops: ['/'] },
      { name: '+-*/', ops: ['+', '-', '*', '/'] },
    ];
    const counts = [3, 10];
    const SAMPLE = 1000;

    ranges.forEach((range) => {
      operationSets.forEach(({ name, ops }) => {
        counts.forEach((numbersCount) => {
          const gen = generateProblemFactory({ numbersCount, numberRange: range, operations: ops, lawsMode: 'none' });
          const signatureFreq = new Map<string, number>();
          const positionOperandFreq = new Map<string, number>();
          let maxSignatureStreak = 0;
          let currentSignatureStreak = 0;
          let previousSignature = '';
          let badNonNegative = 0;
          let badDivision = 0;

          for (let i = 0; i < SAMPLE; i++) {
            const p = gen();
            const signature = structuralSignatureOf(p);
            signatureFreq.set(signature, (signatureFreq.get(signature) || 0) + 1);
            if (signature === previousSignature) currentSignatureStreak += 1;
            else currentSignatureStreak = 1;
            previousSignature = signature;
            maxSignatureStreak = Math.max(maxSignatureStreak, currentSignatureStreak);

            const seqOps = p.ops && p.ops.length === p.numbers.length - 1
              ? p.ops
              : Array.from({ length: Math.max(0, p.numbers.length - 1) }, () => p.operation);
            let acc = p.numbers[0];
            for (let idx = 1; idx < p.numbers.length; idx++) {
              const op = seqOps[idx - 1];
              const operand = p.numbers[idx];
              positionOperandFreq.set(`${idx}:${op}${operand}`, (positionOperandFreq.get(`${idx}:${op}${operand}`) || 0) + 1);
              if (op === '+') acc += operand;
              else if (op === '-') {
                acc -= operand;
                if ((name === '-' || name === '+/-') && acc < 0) badNonNegative += 1;
              } else if (op === '*') acc *= operand;
              else if (op === '/') {
                if (operand === 0) badDivision += 1;
                const next = acc / operand;
                if (!Number.isInteger(next)) badDivision += 1;
                acc = next;
              }
            }
            if (acc !== p.correctAnswer) badDivision += 1;
          }

          const sortedSignatures = [...signatureFreq.entries()].sort((a, b) => b[1] - a[1]);
          const top5 = sortedSignatures.slice(0, 5);
          const topShare = top5.length ? top5[0][1] / SAMPLE : 1;
          const uniqueSignatures = signatureFreq.size;
          const topPositionOperandShare = Math.max(...[...positionOperandFreq.values()].map(v => v / SAMPLE), 0);

          expect(badNonNegative).toBe(0);
          expect(badDivision).toBe(0);

          const strictStructuralDiversityOps = name === '+' || name === '-' || name === '+/-' || name === '+-*/';
          if (strictStructuralDiversityOps && range > 9) {
            expect(uniqueSignatures).toBeGreaterThan(3);
          }
          if (range > 9 && strictStructuralDiversityOps) {
            expect(maxSignatureStreak).toBeLessThan(80);
            expect(topShare).toBeLessThan(0.45);
          }
          if (range === 99 && name === '+') {
            expect(topPositionOperandShare).toBeLessThan(0.2);
          }
        });
      });
    });
  });
});


