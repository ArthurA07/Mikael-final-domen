// Генератор задач для числового тренажёра

export type Operation = '+' | '-' | '*' | '/';
export type LawsMode = 'none' | 'five' | 'ten' | 'both';

export interface GeneratorSettings {
  numbersCount: number;
  numberRange: number; // максимум
  numberRangeMin?: number; // минимум, по умолчанию 1
  operations: Operation[];
  lawsMode?: LawsMode;
  // Разрядности для умножения/деления (количество цифр)
  multiplyDigits1?: number;
  multiplyDigits2?: number;
  multiplyDigits3?: number;
  divisionDividendDigits?: number;
  divisionDivisorDigits?: number;
  divisionSecondDivisorDigits?: number;
}

export interface Problem {
  numbers: number[];
  operation: Operation; // базовая операция для обратной совместимости/сервера
  correctAnswer: number;
  // Необязательно: последовательность операций между числами (для смешанных + и -)
  ops?: Operation[]; // длина = numbers.length - 1; используются только '+' | '-'
  // Единая пошаговая классификация для режима "Законы на 10"
  law10Classifications?: Law10StepClassification[];
  // Единая пошаговая классификация для режима "Законы на 5"
  law5Classifications?: Law5StepClassification[];
}

export type Law5PartType =
  | 'law5_plus'
  | 'law5_minus'
  | 'direct'
  | 'forbidden_carry'
  | 'forbidden_borrow'
  | 'invalid';

export interface Law5StepPart {
  place: number;
  currentDigit: number;
  operandDigit: number;
  type: Law5PartType;
}

export interface Law5StepClassification {
  okForLaw5Mode: boolean;
  hasLaw5: boolean;
  hasForbiddenCarryOrBorrow: boolean;
  parts: Law5StepPart[];
}

export type Law10PartType = 'law10_plus' | 'law10_minus' | 'direct' | 'invalid';

export interface Law10StepPart {
  place: number;
  currentDigit: number;
  operandDigit: number;
  type: Law10PartType;
}

export interface Law10StepClassification {
  okForLaw10Mode: boolean;
  hasLaw10: boolean;
  hasCarry: boolean;
  hasBorrow: boolean;
  hasInvalid: boolean;
  parts: Law10StepPart[];
}

function digitAt(num: number, place: number): number {
  return Math.floor(Math.abs(num) / place) % 10;
}

function parseSinglePlaceDelta(signedDelta: number, maxK: number): { place: number; k: number; sign: 1 | -1 } | null {
  const delta = Math.trunc(signedDelta);
  if (!Number.isFinite(delta) || delta === 0) return null;

  const sign: 1 | -1 = delta > 0 ? 1 : -1;
  const absDelta = Math.abs(delta);
  let place = 1;
  while (absDelta % (place * 10) === 0) place *= 10;

  const k = absDelta / place;
  if (!Number.isInteger(k) || k < 1 || k > maxK) return null;
  return { place, k, sign };
}

export function getDigitAtPlace(value: number, place: number): number {
  return digitAt(value, place);
}

export function isLawOfFiveAddition(digit: number, k: number): boolean {
  return digit < 5 && digit + k >= 5 && digit + k <= 9;
}

export function isLawOfFiveSubtraction(digit: number, k: number): boolean {
  return digit >= 5 && digit - k < 5 && digit - k >= 0;
}

export function isValidLawOfFiveOperation(currentValue: number, signedDelta: number): boolean {
  const parsed = parseSinglePlaceDelta(signedDelta, 4);
  if (!parsed || !Number.isFinite(currentValue) || currentValue < 0) return false;

  const { place, k, sign } = parsed;
  const digit = getDigitAtPlace(currentValue, place);
  if (sign > 0) return isLawOfFiveAddition(digit, k);
  return isLawOfFiveSubtraction(digit, k);
}

export function isLawOfTenAddition(digit: number, k: number): boolean {
  return digit >= 1 && digit <= 9 && k >= 1 && k <= 9 && digit + k >= 10;
}

export function isLawOfTenSubtraction(digit: number, k: number): boolean {
  return digit >= 0 && digit <= 9 && k >= 1 && k <= 9 && digit < k;
}

export function classifyLaw10Step(
  currentValue: number,
  operation: '+' | '-',
  operand: number
): Law10StepClassification {
  const signedDelta = operation === '+' ? operand : -operand;
  const parsed = parseSinglePlaceDelta(signedDelta, 9);
  if (!parsed || !Number.isFinite(currentValue) || currentValue < 0 || !Number.isFinite(operand) || operand <= 0) {
    return {
      okForLaw10Mode: false,
      hasLaw10: false,
      hasCarry: false,
      hasBorrow: false,
      hasInvalid: true,
      parts: [{
        place: 1,
        currentDigit: getDigitAtPlace(currentValue, 1),
        operandDigit: Math.abs(Math.trunc(operand)) % 10,
        type: 'invalid',
      }],
    };
  }

  const { place, k, sign } = parsed;
  const currentDigit = getDigitAtPlace(currentValue, place);
  const nextValue = currentValue + signedDelta;
  if (nextValue < 0) {
    return {
      okForLaw10Mode: false,
      hasLaw10: false,
      hasCarry: false,
      hasBorrow: false,
      hasInvalid: true,
      parts: [{ place, currentDigit, operandDigit: k, type: 'invalid' }],
    };
  }

  let type: Law10PartType = 'direct';
  let hasCarry = false;
  let hasBorrow = false;
  if (sign > 0) {
    if (isLawOfTenAddition(currentDigit, k)) {
      type = 'law10_plus';
      hasCarry = true;
    } else if (currentDigit + k > 9) {
      type = 'invalid';
    }
  } else {
    if (isLawOfTenSubtraction(currentDigit, k)) {
      type = 'law10_minus';
      hasBorrow = true;
    } else if (currentDigit - k < 0) {
      type = 'invalid';
    }
  }

  const hasLaw10 = type === 'law10_plus' || type === 'law10_minus';
  const hasInvalid = type === 'invalid';
  return {
    okForLaw10Mode: !hasInvalid,
    hasLaw10,
    hasCarry,
    hasBorrow,
    hasInvalid,
    parts: [{ place, currentDigit, operandDigit: k, type }],
  };
}

export function isValidLawOfTenOperation(currentValue: number, signedDelta: number): boolean {
  const operation: '+' | '-' = signedDelta >= 0 ? '+' : '-';
  return classifyLaw10Step(currentValue, operation, Math.abs(signedDelta)).okForLaw10Mode;
}

export function classifyLaw5Step(
  currentValue: number,
  operation: '+' | '-',
  operand: number
): Law5StepClassification {
  const signedDelta = operation === '+' ? operand : -operand;
  const parsed = parseSinglePlaceDelta(signedDelta, 4);
  if (!parsed || !Number.isFinite(currentValue) || currentValue < 0 || !Number.isFinite(operand) || operand <= 0) {
    return {
      okForLaw5Mode: false,
      hasLaw5: false,
      hasForbiddenCarryOrBorrow: false,
      parts: [{
        place: 1,
        currentDigit: getDigitAtPlace(currentValue, 1),
        operandDigit: Math.abs(Math.trunc(operand)) % 10,
        type: 'invalid',
      }],
    };
  }

  const { place, k, sign } = parsed;
  const currentDigit = getDigitAtPlace(currentValue, place);
  let type: Law5PartType = 'invalid';

  if (sign > 0) {
    const nextDigit = currentDigit + k;
    if (nextDigit >= 10) {
      type = 'forbidden_carry';
    } else if (isLawOfFiveAddition(currentDigit, k)) {
      type = 'law5_plus';
    } else {
      type = 'direct';
    }
  } else {
    const nextDigit = currentDigit - k;
    if (nextDigit < 0) {
      type = 'forbidden_borrow';
    } else if (isLawOfFiveSubtraction(currentDigit, k)) {
      type = 'law5_minus';
    } else {
      type = 'direct';
    }
  }

  const hasLaw5 = type === 'law5_plus' || type === 'law5_minus';
  const hasForbiddenCarryOrBorrow = type === 'forbidden_carry' || type === 'forbidden_borrow';
  return {
    okForLaw5Mode: hasLaw5,
    hasLaw5,
    hasForbiddenCarryOrBorrow,
    parts: [{ place, currentDigit, operandDigit: k, type }],
  };
}

function randomIntInclusive(max: number, min = 1): number {
  const span = max - min + 1;
  return Math.floor(Math.random() * span) + min;
}

export function generateProblemFactory(settings: GeneratorSettings) {
  const cfg = {
    numberRangeMin: 1,
    lawsMode: 'none' as LawsMode,
    ...settings,
  };

  // Глобальные ограничения по ТЗ (должны работать одинаково во всех режимах).
  // - Для умножения: любой множитель максимум 3 разряда (<= 999)
  // - Для деления: делимое максимум 6 разрядов (<= 999999)
  // - Для деления: делители максимум 4 разряда (<= 9999) и НЕ допускаем делитель = 1
  const MAX_MUL_DIGITS = 3;
  const MAX_DIVIDEND_DIGITS = 6;
  const MAX_DIVISOR_DIGITS = 4;
  const MAX_MUL_VALUE = Math.pow(10, MAX_MUL_DIGITS) - 1; // 999
  const MAX_DIVIDEND_VALUE = Math.pow(10, MAX_DIVIDEND_DIGITS) - 1; // 999999
  const MAX_DIVISOR_VALUE = Math.pow(10, MAX_DIVISOR_DIGITS) - 1; // 9999

  function makeWithUnits(max: number, units: number, min = 1): number {
    // Подбираем число с заданной единичной цифрой, не превышая max
    if (max < units) return Math.min(max, units);
    const maxTens = Math.floor((max - units) / 10);
    const tens = maxTens > 0 ? randomIntInclusive(maxTens, 0) : 0;
    const candidate = tens * 10 + units;
    return Math.max(min, candidate);
  }

  function numDigits(n: number): number {
    return Math.max(1, Math.floor(Math.log10(Math.max(1, n))) + 1);
  }

  function digitAtPlace(num: number, place: number): number {
    return Math.floor(Math.abs(num) / place) % 10;
  }

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getAvailablePlaces(max: number): number[] {
    const places: number[] = [1];
    let p = 10;
    while (p <= max) { places.push(p); p *= 10; }
    return places;
  }
  function weightedPlacesOrder(places: number[], preferHigher: boolean): number[] {
    if (places.length <= 1) return [...places];
    // Если нужно предпочесть старшие разряды — сортируем по убыванию, иначе перемешиваем
    if (preferHigher) {
      return [...places].sort((a, b) => b - a);
    }
    return [...places].sort(() => Math.random() - 0.5);
  }

  function ensureNonNegativePair(a: number, b: number): [number, number] {
    if (a < b) return [b, a];
    return [a, b];
  }

  function buildLaw5Ops(totalSteps: number): ('+' | '-')[] {
    const opPool = cfg.operations.filter((o): o is '+' | '-' => o === '+' || o === '-');
    if (opPool.length === 0) return Array.from({ length: totalSteps }, () => '+');

    if (opPool.length === 1) return Array.from({ length: totalSteps }, () => opPool[0]);

    if (totalSteps === 1) return [Math.random() < 0.5 ? '+' : '-'];
    if (totalSteps === 2) return Math.random() < 0.5 ? ['+', '-'] : ['-', '+'];

    const result: ('+' | '-')[] = [];
    for (let i = 0; i < totalSteps; i++) {
      if (i === 0) {
        result.push(Math.random() < 0.5 ? '+' : '-');
      } else {
        const prev = result[i - 1];
        result.push(Math.random() < 0.7 ? (prev === '+' ? '-' : '+') : prev);
      }
    }
    if (!result.includes('+')) result[0] = '+';
    if (!result.includes('-')) result[result.length - 1] = '-';
    return result;
  }

  function getLaw5Candidates(
    currentValue: number,
    operation: '+' | '-',
    places: number[],
    maxValue: number
  ): number[] {
    const candidates: number[] = [];
    for (const place of places) {
      for (let k = 1; k <= 4; k++) {
        const absDelta = k * place;
        if (absDelta > maxValue) continue;
        const signedDelta = operation === '+' ? absDelta : -absDelta;
        if (!isValidLawOfFiveOperation(currentValue, signedDelta)) continue;
        if (currentValue + signedDelta < 0) continue;
        candidates.push(absDelta);
      }
    }
    return candidates;
  }

  function getPlaceFromOperand(operand: number): number {
    let place = 1;
    while (operand % (place * 10) === 0) place *= 10;
    return place;
  }

  function maybeLogLaw5Debug(problem: Problem, range: number, classifications: Law5StepClassification[]) {
    if (process.env.NODE_ENV !== 'development') return;

    let current = problem.numbers[0];
    const steps = problem.numbers.slice(1).map((operand, index) => {
      const op = problem.ops?.[index] || problem.operation;
      const result = op === '+' ? current + operand : current - operand;
      const entry = {
        currentValue: current,
        operation: op,
        operand,
        result,
        classification: classifications[index],
      };
      current = result;
      return entry;
    });

    console.debug('[law5-generator]', {
      expression: problem.numbers.reduce((expr, number, index) => {
        if (index === 0) return String(number);
        return `${expr} ${problem.ops?.[index - 1] || problem.operation} ${number}`;
      }, ''),
      range,
      lawsMode: cfg.lawsMode,
      start: problem.numbers[0],
      steps,
      correctAnswer: problem.correctAnswer,
    });
  }

  function maybeLogCombinedDebug(
    problem: Problem,
    range: number,
    law5Classifications: Law5StepClassification[],
    law10Classifications: Law10StepClassification[]
  ) {
    if (process.env.NODE_ENV !== 'development') return;

    let current = problem.numbers[0];
    let hasLaw5 = false;
    let hasLaw10 = false;
    const steps = problem.numbers.slice(1).map((operand, index) => {
      const op = problem.ops?.[index] || problem.operation;
      const result = op === '+' ? current + operand : current - operand;
      const law5 = law5Classifications[index];
      const law10 = law10Classifications[index];
      const stepType = law5?.hasLaw5 ? 'law5' : (law10?.hasLaw10 ? 'law10' : (law10?.hasInvalid ? 'invalid' : 'direct'));
      hasLaw5 = hasLaw5 || !!law5?.hasLaw5;
      hasLaw10 = hasLaw10 || !!law10?.hasLaw10;
      const entry = {
        currentValue: current,
        operation: op,
        operand,
        result,
        law5,
        law10,
        stepType,
      };
      current = result;
      return entry;
    });

    console.debug('[laws-both-generator]', {
      expression: problem.numbers.reduce((expr, number, index) => {
        if (index === 0) return String(number);
        return `${expr} ${problem.ops?.[index - 1] || problem.operation} ${number}`;
      }, ''),
      range,
      lawsMode: cfg.lawsMode,
      start: problem.numbers[0],
      steps,
      hasLaw5,
      hasLaw10,
      correctAnswer: problem.correctAnswer,
    });
  }

  function tryGenerateLaw5Problem(
    maxValue: number,
    minValue: number,
    effectiveNumbersCount: number
  ): Problem | null {
    const totalSteps = effectiveNumbersCount - 1;
    const places = getAvailablePlaces(maxValue);
    const maxAttempts = 400;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const numbers: number[] = [];
      const opsSequence = buildLaw5Ops(totalSteps);
      const classifications: Law5StepClassification[] = [];

      let current = randomIntInclusive(maxValue, minValue);
      let ok = true;
      let prevSignedDelta: number | null = null;
      let prevPlace: number | null = null;
      numbers.push(current);

      for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
        const op = opsSequence[stepIndex];
        const candidates = getLaw5Candidates(current, op, places, maxValue);
        if (!candidates.length) {
          ok = false;
          break;
        }

        const filtered = candidates.filter((candidate) => {
          if (prevSignedDelta === null) return true;
          const signed = op === '+' ? candidate : -candidate;
          const place = getPlaceFromOperand(candidate);
          const repeatsSameDelta = signed === prevSignedDelta;
          const immediateCancel = signed === -prevSignedDelta;
          const repeatsSamePlace = place === prevPlace;
          return !repeatsSameDelta && !immediateCancel && !repeatsSamePlace;
        });
        const operand = pickRandom(filtered.length ? filtered : candidates);
        const classification = classifyLaw5Step(current, op as '+' | '-', operand);
        const signedDelta = op === '+' ? operand : -operand;
        const nextValue = current + signedDelta;
        if (!classification.okForLaw5Mode || !classification.hasLaw5 || nextValue < 0) {
          ok = false;
          break;
        }

        numbers.push(operand);
        classifications.push(classification);
        current = nextValue;
        prevSignedDelta = signedDelta;
        prevPlace = classification.parts[0]?.place || getPlaceFromOperand(operand);
      }

      if (!ok) continue;

      const correctAnswer = numbers.slice(1).reduce((acc, number, index) => (
        opsSequence[index] === '+' ? acc + number : acc - number
      ), numbers[0]);
      const problem: Problem = {
        numbers,
        operation: '+',
        correctAnswer,
        ops: opsSequence.map(op => (op === '+' || op === '-' ? op : '+')),
      };
      maybeLogLaw5Debug(problem, maxValue, classifications);
      return problem;
    }

    return null;
  }

  function buildLaw10Ops(totalSteps: number): ('+' | '-')[] {
    const opPool = cfg.operations.filter((o): o is '+' | '-' => o === '+' || o === '-');
    if (opPool.length === 0) return Array.from({ length: totalSteps }, () => '+');
    if (opPool.length === 1) {
      const single = opPool[0];
      const result = Array.from({ length: totalSteps }, () => single);
      // В длинных примерах для режима только "-" допускаем редкие "+" как прямые шаги,
      // чтобы не "упереться" в ноль и сохранить длину цепочки.
      if (single === '-' && totalSteps > 2) {
        const helperPlusCount = Math.max(1, Math.floor(totalSteps / 3));
        for (let i = 0; i < helperPlusCount; i++) {
          const idx = Math.min(totalSteps - 1, 1 + i * 3);
          result[idx] = '+';
        }
      }
      return result;
    }

    if (totalSteps === 1) return [Math.random() < 0.5 ? '+' : '-'];
    if (totalSteps === 2) return Math.random() < 0.5 ? ['+', '-'] : ['-', '+'];

    const result: ('+' | '-')[] = [];
    for (let i = 0; i < totalSteps; i++) {
      if (i === 0) {
        result.push(Math.random() < 0.5 ? '+' : '-');
      } else {
        const prev = result[i - 1];
        result.push(Math.random() < 0.65 ? (prev === '+' ? '-' : '+') : prev);
      }
    }
    if (!result.includes('+')) result[0] = '+';
    if (!result.includes('-')) result[result.length - 1] = '-';
    return result;
  }

  function getLaw10Candidates(
    currentValue: number,
    operation: '+' | '-',
    places: number[],
    maxValue: number,
    kind: 'formula' | 'direct'
  ): number[] {
    const candidates: number[] = [];
    for (const place of places) {
      const currentDigit = getDigitAtPlace(currentValue, place);
      for (let k = 1; k <= 9; k++) {
        const absDelta = k * place;
        if (absDelta > maxValue) continue;
        const classification = classifyLaw10Step(currentValue, operation, absDelta);
        if (!classification.okForLaw10Mode) continue;
        if (kind === 'formula' && !classification.hasLaw10) continue;
        if (kind === 'direct' && classification.hasLaw10) continue;

        // Для формул на 10 избегаем перекоса только в "комплементы до 10":
        // чаще добавляем шаги с суммой >= 11.
        if (kind === 'formula' && operation === '+') {
          const sum = currentDigit + k;
          if (sum === 10 && Math.random() < 0.35) continue;
        }

        candidates.push(absDelta);
      }
    }
    return candidates;
  }

  function tryGenerateLaw10Problem(
    maxValue: number,
    minValue: number,
    effectiveNumbersCount: number
  ): Problem | null {
    const totalSteps = effectiveNumbersCount - 1;
    const places = getAvailablePlaces(maxValue);
    const maxAttempts = 600;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const numbers: number[] = [];
      const opsSequence = buildLaw10Ops(totalSteps);
      const classifications: Law10StepClassification[] = [];
      let current = randomIntInclusive(maxValue, minValue);
      numbers.push(current);

      const minusOnlySingleDigitRange = cfg.operations.length === 1 && cfg.operations[0] === '-' && maxValue < 10;
      const targetFormulaStepsBase = totalSteps <= 2 ? totalSteps : Math.max(1, Math.floor(totalSteps * 0.6));
      // В диапазоне 1-9 при операции только "-" формула "закон на 10" недостижима:
      // старт и операнды однозначные, заём из старшего разряда невозможен.
      const targetFormulaSteps = minusOnlySingleDigitRange ? 0 : targetFormulaStepsBase;
      let formulaSteps = 0;
      let ok = true;
      let prevSignedDelta: number | null = null;
      let prevPlace: number | null = null;

      for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
        const op = opsSequence[stepIndex];
        const remainingSteps = totalSteps - stepIndex;
        const mustBeFormula = formulaSteps + remainingSteps <= targetFormulaSteps;
        const shouldPreferFormula = mustBeFormula || (formulaSteps < targetFormulaSteps && Math.random() < 0.75);
        const operationIsAuxiliary = cfg.operations.length === 1 && cfg.operations[0] !== op;
        const allowFormulaForThisOp = !operationIsAuxiliary;

        const formulaCandidates = getLaw10Candidates(current, op, places, maxValue, 'formula');
        const directCandidates = getLaw10Candidates(current, op, places, maxValue, 'direct');

        let pool: number[] = [];
        if (allowFormulaForThisOp) {
          if (shouldPreferFormula && formulaCandidates.length) pool = formulaCandidates;
          else if (!shouldPreferFormula && directCandidates.length) pool = directCandidates;
          else pool = formulaCandidates.length ? formulaCandidates : directCandidates;
        } else {
          pool = directCandidates;
        }

        if (!pool.length) {
          ok = false;
          break;
        }

        const filtered = pool.filter((candidate) => {
          if (prevSignedDelta === null) return true;
          const signed = op === '+' ? candidate : -candidate;
          const place = getPlaceFromOperand(candidate);
          const repeatsSameDelta = signed === prevSignedDelta;
          const immediateCancel = signed === -prevSignedDelta;
          const repeatsSamePlace = place === prevPlace;
          return !repeatsSameDelta && !immediateCancel && !repeatsSamePlace;
        });

        const operand = pickRandom(filtered.length ? filtered : pool);
        const classification = classifyLaw10Step(current, op, operand);
        const signedDelta = op === '+' ? operand : -operand;
        const nextValue = current + signedDelta;
        if (!classification.okForLaw10Mode || classification.hasInvalid || nextValue < 0) {
          ok = false;
          break;
        }
        if (mustBeFormula && allowFormulaForThisOp && !classification.hasLaw10) {
          ok = false;
          break;
        }
        if (operationIsAuxiliary && classification.hasLaw10) {
          ok = false;
          break;
        }

        numbers.push(operand);
        classifications.push(classification);
        if (classification.hasLaw10) formulaSteps += 1;
        current = nextValue;
        prevSignedDelta = signedDelta;
        prevPlace = classification.parts[0]?.place || getPlaceFromOperand(operand);
      }

      if (!ok || formulaSteps < targetFormulaSteps) continue;
      if (opsSequence.includes('+') && opsSequence.includes('-') && totalSteps >= 2) {
        const plusCount = opsSequence.filter(op => op === '+').length;
        const minusCount = opsSequence.filter(op => op === '-').length;
        if (plusCount === 0 || minusCount === 0) continue;
      }

      const correctAnswer = numbers.slice(1).reduce((acc, number, index) => (
        opsSequence[index] === '+' ? acc + number : acc - number
      ), numbers[0]);

      const problem: Problem = {
        numbers,
        operation: '+',
        correctAnswer,
        ops: opsSequence.map(op => (op === '+' || op === '-' ? op : '+')),
        law10Classifications: classifications,
      };
      return problem;
    }

    return null;
  }

  function buildBothOps(totalSteps: number): ('+' | '-')[] {
    const opPool = cfg.operations.filter((o): o is '+' | '-' => o === '+' || o === '-');
    if (opPool.length === 0) return Array.from({ length: totalSteps }, () => '+');
    if (opPool.length === 1) {
      const single = opPool[0];
      const result = Array.from({ length: totalSteps }, () => single);
      if (single === '-' && totalSteps > 2) {
        const helperPlusCount = Math.max(1, Math.floor(totalSteps / 3));
        for (let i = 0; i < helperPlusCount; i++) {
          const idx = Math.min(totalSteps - 1, 1 + i * 3);
          result[idx] = '+';
        }
      }
      return result;
    }
    return buildLaw10Ops(totalSteps);
  }

  function getBothModeCandidates(
    currentValue: number,
    operation: '+' | '-',
    places: number[],
    maxValue: number,
    kind: 'law5' | 'law10' | 'direct'
  ): Array<{ operand: number; law5: Law5StepClassification; law10: Law10StepClassification }> {
    const candidates: Array<{ operand: number; law5: Law5StepClassification; law10: Law10StepClassification }> = [];
    for (const place of places) {
      for (let k = 1; k <= 9; k++) {
        const absDelta = k * place;
        if (absDelta > maxValue) continue;
        const law5 = classifyLaw5Step(currentValue, operation, absDelta);
        const law10 = classifyLaw10Step(currentValue, operation, absDelta);
        const nextValue = operation === '+' ? currentValue + absDelta : currentValue - absDelta;
        if (nextValue < 0 || !law10.okForLaw10Mode || law10.hasInvalid) continue;

        const isLaw5 = law5.hasLaw5;
        const isLaw10 = law10.hasLaw10;
        if (kind === 'law5' && !isLaw5) continue;
        if (kind === 'law10' && !isLaw10) continue;
        if (kind === 'direct' && (isLaw5 || isLaw10)) continue;
        candidates.push({ operand: absDelta, law5, law10 });
      }
    }
    return candidates;
  }

  function tryGenerateBothLawsProblem(
    maxValue: number,
    minValue: number,
    effectiveNumbersCount: number
  ): Problem | null {
    const totalSteps = effectiveNumbersCount - 1;
    const places = getAvailablePlaces(maxValue);
    const maxAttempts = 900;
    const selectedOps = cfg.operations.filter((o): o is '+' | '-' => o === '+' || o === '-');
    const minusOnlySingleDigitRange = selectedOps.length === 1 && selectedOps[0] === '-' && maxValue < 10;
    const mustHaveLaw10 = !minusOnlySingleDigitRange;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const numbers: number[] = [];
      const opsSequence = buildBothOps(totalSteps);
      const law5Classifications: Law5StepClassification[] = [];
      const law10Classifications: Law10StepClassification[] = [];
      let current = randomIntInclusive(maxValue, minValue);
      numbers.push(current);

      let hasLaw5 = false;
      let hasLaw10 = false;
      let ok = true;
      let prevSignedDelta: number | null = null;
      let prevPlace: number | null = null;

      for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
        const op = opsSequence[stepIndex];
        const remainingSteps = totalSteps - stepIndex;
        const needLaw5 = !hasLaw5;
        const needLaw10 = mustHaveLaw10 && !hasLaw10;
        const mustPickLaw5Now = needLaw5 && remainingSteps <= (needLaw10 ? 2 : 1);
        const mustPickLaw10Now = needLaw10 && remainingSteps <= (needLaw5 ? 2 : 1);
        const operationIsAuxiliary = selectedOps.length === 1 && selectedOps[0] !== op;

        const law5Candidates = operationIsAuxiliary ? [] : getBothModeCandidates(current, op, places, maxValue, 'law5');
        const law10Candidates = operationIsAuxiliary ? [] : getBothModeCandidates(current, op, places, maxValue, 'law10');
        const directCandidates = getBothModeCandidates(current, op, places, maxValue, 'direct');

        let pool: Array<{ operand: number; law5: Law5StepClassification; law10: Law10StepClassification }> = [];
        if (mustPickLaw5Now) {
          pool = law5Candidates;
        } else if (mustPickLaw10Now) {
          pool = law10Candidates;
        } else if (needLaw5 && needLaw10) {
          pool = Math.random() < 0.5 ? (law5Candidates.length ? law5Candidates : law10Candidates) : (law10Candidates.length ? law10Candidates : law5Candidates);
        } else if (needLaw5) {
          pool = law5Candidates.length ? law5Candidates : directCandidates;
        } else if (needLaw10) {
          pool = law10Candidates.length ? law10Candidates : directCandidates;
        } else {
          const randomRoll = Math.random();
          if (randomRoll < 0.4 && law5Candidates.length) pool = law5Candidates;
          else if (randomRoll < 0.8 && law10Candidates.length) pool = law10Candidates;
          else pool = directCandidates.length ? directCandidates : (law5Candidates.length ? law5Candidates : law10Candidates);
        }

        if (!pool.length) {
          ok = false;
          break;
        }

        const filtered = pool.filter((entry) => {
          if (prevSignedDelta === null) return true;
          const signed = op === '+' ? entry.operand : -entry.operand;
          const place = getPlaceFromOperand(entry.operand);
          const repeatsSameDelta = signed === prevSignedDelta;
          const immediateCancel = signed === -prevSignedDelta;
          const repeatsSamePlace = place === prevPlace;
          return !repeatsSameDelta && !immediateCancel && !repeatsSamePlace;
        });

        const chosen = pickRandom(filtered.length ? filtered : pool);
        const signedDelta = op === '+' ? chosen.operand : -chosen.operand;
        const nextValue = current + signedDelta;
        if (nextValue < 0 || chosen.law10.hasInvalid) {
          ok = false;
          break;
        }
        if (operationIsAuxiliary && (chosen.law5.hasLaw5 || chosen.law10.hasLaw10)) {
          ok = false;
          break;
        }

        numbers.push(chosen.operand);
        law5Classifications.push(chosen.law5);
        law10Classifications.push(chosen.law10);
        hasLaw5 = hasLaw5 || chosen.law5.hasLaw5;
        hasLaw10 = hasLaw10 || chosen.law10.hasLaw10;
        current = nextValue;
        prevSignedDelta = signedDelta;
        prevPlace = chosen.law5.parts[0]?.place || chosen.law10.parts[0]?.place || getPlaceFromOperand(chosen.operand);
      }

      if (!ok || !hasLaw5 || (mustHaveLaw10 && !hasLaw10)) continue;
      if (opsSequence.includes('+') && opsSequence.includes('-') && totalSteps >= 2) {
        const plusCount = opsSequence.filter(op => op === '+').length;
        const minusCount = opsSequence.filter(op => op === '-').length;
        if (plusCount === 0 || minusCount === 0) continue;
      }

      const correctAnswer = numbers.slice(1).reduce((acc, number, index) => (
        opsSequence[index] === '+' ? acc + number : acc - number
      ), numbers[0]);

      const problem: Problem = {
        numbers,
        operation: '+',
        correctAnswer,
        ops: opsSequence.map(op => (op === '+' || op === '-' ? op : '+')),
        law5Classifications,
        law10Classifications,
      };
      maybeLogCombinedDebug(problem, maxValue, law5Classifications, law10Classifications);
      return problem;
    }

    return null;
  }

  function generateLawPairFive(op: Operation, max: number, min = 1): [number, number] {
    // Пары для тренировки «через 5»
    if (op === '+') {
      // Сложение: (1..4,1..4) или (5,1..4)
      const pick = Math.random() < 0.5 ? 'pair14' : 'five_plus';
      if (pick === 'pair14') {
        const u1 = randomIntInclusive(4, 1);
        const u2 = randomIntInclusive(4, 1);
        let a = makeWithUnits(max, u1, min);
        let b = makeWithUnits(max, u2, min);
        if (Math.random() < 0.5) [a, b] = [b, a];
        return [a, b];
      } else {
        const u1 = 5;
        const u2 = randomIntInclusive(4, 1);
        let a = makeWithUnits(max, u1, min);
        let b = makeWithUnits(max, u2, min);
        if (Math.random() < 0.5) [a, b] = [b, a];
        return [a, b];
      }
    } else {
      // Вычитание: обеспечиваем заём через 5 — единицы уменьшаемого < единиц вычитаемого
      const pick = Math.random() < 0.5 ? 'u_lt' : 'five_minus';
      let uA = 0, uB = 0;
      if (pick === 'u_lt') {
        uA = randomIntInclusive(4, 0); // 0..4
        uB = randomIntInclusive(4, Math.max(1, uA + 1)); // 1..4 и > uA
      } else {
        uA = 5;
        uB = randomIntInclusive(4, 1); // 1..4
      }
      const maxTens = Math.floor((max - Math.max(uA, uB)) / 10);
      let tB = randomIntInclusive(maxTens, 0);
      let tA = randomIntInclusive(maxTens, tB); // tA >= tB, чтобы a >= b
      let a = tA * 10 + uA;
      let b = tB * 10 + uB;
      if (a < b) a = (tB + 1) * 10 + uA; // страховка
      a = Math.min(a, max);
      b = Math.min(b, Math.min(a, max));
      a = Math.max(a, min);
      b = Math.max(b, min);
      return [a, b];
    }
  }

  return function generate(): Problem {
    const minValue = cfg.numberRangeMin ?? 1;
    const maxValue = cfg.numberRange;

    const numbers: number[] = [];
    let opsSequence: Operation[] | undefined;
    // Выбираем операцию. Законы применяются только к сложению/вычитанию;
    // умножение и деление должны оставаться на своей существующей логике.
    let operation: Operation = cfg.operations[Math.floor(Math.random() * cfg.operations.length)];

    // ВАЖНО:
    // Ограничение "до 3 чисел" относится только к конкретной задаче с ×/÷,
    // а не к наличию ×/÷ в общем списке операций сессии.
    const isMulOrDiv = operation === '*' || operation === '/';
    const effectiveNumbersCount = isMulOrDiv ? Math.min(cfg.numbersCount, 3) : cfg.numbersCount;

    if (cfg.lawsMode === 'five' && !isMulOrDiv && effectiveNumbersCount >= 2 && maxValue >= 1) {
      const law5Problem = tryGenerateLaw5Problem(maxValue, minValue, effectiveNumbersCount);
      if (law5Problem) {
        return law5Problem;
      }
    }

    if (cfg.lawsMode === 'ten' && !isMulOrDiv && effectiveNumbersCount >= 2 && maxValue >= 1) {
      const law10Problem = tryGenerateLaw10Problem(maxValue, minValue, effectiveNumbersCount);
      if (law10Problem) {
        return law10Problem;
      }
    }

    if (cfg.lawsMode === 'both' && !isMulOrDiv && effectiveNumbersCount >= 2 && maxValue >= 1) {
      const combinedProblem = tryGenerateBothLawsProblem(maxValue, minValue, effectiveNumbersCount);
      if (combinedProblem) {
        return combinedProblem;
      }
    }

    if (numbers.length === 0) {
      // Обычный режим (без законов). Поддержим смешанные операции для суммы/разности
      const wantsMixedPlusMinus = effectiveNumbersCount >= 3 && cfg.operations.includes('+') && cfg.operations.includes('-') && !isMulOrDiv;
      if (wantsMixedPlusMinus) {
        // Генерируем как минимум один '+' и один '-'
        const maxAttempts = 25;
        let builtMixed = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          opsSequence = Array.from({ length: effectiveNumbersCount - 1 }, () => (Math.random() < 0.5 ? '+' : '-')) as Operation[];
          if (!opsSequence.includes('+')) opsSequence[0] = '+';
          if (!opsSequence.includes('-')) opsSequence[opsSequence.length - 1] = '-';
          numbers.length = 0;
          // Собираем числа пошагово так, чтобы промежуточный результат НИКОГДА не уходил в минус.
          // Это ближе к базовой логике ментальной арифметики.
          let acc = randomIntInclusive(maxValue, minValue);
          numbers.push(acc);
          let ok = true;
          for (let i = 0; i < opsSequence.length; i++) {
            const op = opsSequence[i];
            if (op === '+') {
              const n = randomIntInclusive(maxValue, minValue);
              numbers.push(n);
              acc += n;
            } else {
              // '-' — нельзя, чтобы acc стал отрицательным
              if (acc < minValue) { ok = false; break; }
              const hi = Math.min(maxValue, acc);
              const n = randomIntInclusive(hi, minValue);
              numbers.push(n);
              acc -= n;
            }
          }
          if (ok) {
            builtMixed = true;
            break;
          }
        }
        // Защитный фолбэк: даже если случайная генерация не нашла корректную цепочку,
        // возвращаем валидный пример с обеими операциями и неотрицательными промежуточными значениями.
        if (!builtMixed) {
          opsSequence = Array.from(
            { length: effectiveNumbersCount - 1 },
            (_, idx) => (idx % 2 === 0 ? '+' : '-')
          ) as Operation[];
          numbers.length = 0;
          let acc = Math.max(minValue, Math.min(maxValue, Math.max(minValue * 2, Math.floor(maxValue * 0.7))));
          numbers.push(acc);
          for (let i = 0; i < opsSequence.length; i++) {
            const op = opsSequence[i];
            if (op === '+') {
              const n = Math.max(minValue, Math.min(maxValue, Math.max(minValue, Math.floor(maxValue / 2))));
              numbers.push(n);
              acc += n;
            } else {
              const hi = Math.max(minValue, Math.min(maxValue, acc));
              const n = Math.max(minValue, Math.min(hi, Math.max(minValue, Math.floor(acc / 2))));
              numbers.push(n);
              acc -= n;
            }
          }
        }
      } else {
        // ВАЖНО: при вычитании не допускаем отрицательный итог в любом случае (не только когда выбрана одна операция '-').
        // Для диапазона 1–9 и 3+ чисел частые ответы "0" выглядят как плохая рандомность.
        // Поэтому для режима только '-' целимся в ненулевой итог, когда это математически возможно,
        // и слегка смещаем выбор первого числа к верхней границе диапазона.
        if (operation === '-' && effectiveNumbersCount >= 2) {
          // минимально возможное первое число, чтобы хотя бы minValue на каждом шаге было допустимо
          const minFirst = Math.max(minValue, (effectiveNumbersCount - 1) * minValue);
          const maxFirst = maxValue;

          // 1) Выбираем первый элемент с bias к большим значениям
          const span = Math.max(0, maxFirst - minFirst);
          const u = Math.random();
          const biasHigh = 1 - u * u; // чаще ближе к 1
          const a0 = minFirst + Math.floor(span * biasHigh);
          numbers.push(a0);

          // 2) Выбираем желаемый итог r (предпочитаем r>0, если возможно)
          const maxR = Math.max(0, a0 - (effectiveNumbersCount - 1) * minValue);
          const preferNonZero = Math.random() < 0.85;
          const r = (preferNonZero && maxR >= 1) ? randomIntInclusive(maxR, 1) : randomIntInclusive(maxR, 0);

          // 3) Генерируем вычитаемые так, чтобы:
          //  - сумма вычитаемых = a0 - r
          //  - каждый шаг в [minValue..maxValue] (или [0..maxValue] в невозможных конфигурациях)
          //  - промежуточный результат никогда не уходит в минус
          let remainingToSubtract = a0 - r;
          const canKeepMinRest = maxValue >= (effectiveNumbersCount - 1) * minValue;
          for (let i = 1; i < effectiveNumbersCount; i++) {
            const remainingSteps = effectiveNumbersCount - i;
            const minThis = canKeepMinRest ? minValue : 0;
            const minNeededForRest = (remainingSteps - 1) * minThis;
            const maxForThis = Math.min(maxValue, remainingToSubtract - minNeededForRest);
            const pick = maxForThis <= minThis ? minThis : randomIntInclusive(maxForThis, minThis);
            numbers.push(pick);
            remainingToSubtract -= pick;
          }
        } else {
          for (let i = 0; i < effectiveNumbersCount; i++) {
            numbers.push(randomIntInclusive(maxValue, minValue));
          }
        }
      }
    }

    let correctAnswer: number;
    switch (operation) {
      case '+':
        if (opsSequence && opsSequence.length === numbers.length - 1) {
          // Смешанная последовательность плюс/минус, базовая операция оставляем '+'
          let acc = numbers[0];
          for (let i = 1; i < numbers.length; i++) {
            const op = opsSequence[i - 1];
            acc = op === '+' ? acc + numbers[i] : acc - numbers[i];
          }
          correctAnswer = acc;
        } else {
          correctAnswer = numbers.reduce((s, n) => s + n, 0);
        }
        break;
      case '-':
        if (opsSequence && opsSequence.length === numbers.length - 1) {
          let acc = numbers[0];
          for (let i = 1; i < numbers.length; i++) {
            const op = opsSequence[i - 1];
            acc = op === '+' ? acc + numbers[i] : acc - numbers[i];
          }
          correctAnswer = acc;
        } else {
          correctAnswer = numbers.reduce((d, n, idx) => (idx === 0 ? n : d - n));
        }
        break;
      case '*':
        if (isMulOrDiv) {
          // Ограничиваем количество множителей до 3 и уважаем разрядности
          const count = Math.min(effectiveNumbersCount, 3);
          const picks: number[] = [];
          const digitsForIndex = (idx: number | undefined) => {
            // Жёстко ограничиваем максимумом 3 разряда даже если в настройках кто-то передаст больше
            if (idx === 0 && cfg.multiplyDigits1) return Math.min(cfg.multiplyDigits1, MAX_MUL_DIGITS);
            if (idx === 1 && cfg.multiplyDigits2) return Math.min(cfg.multiplyDigits2, MAX_MUL_DIGITS);
            if (idx === 2 && cfg.multiplyDigits3) return Math.min(cfg.multiplyDigits3, MAX_MUL_DIGITS);
            return undefined;
          };
          for (let i = 0; i < count; i++) {
            const d = digitsForIndex(i);
            // Если задана разрядность — игнорируем numberRange и берём строго по разрядности
            // Если не задана — всё равно НЕ выходим за 3 разряда (<= 999)
            const val = d
              ? randomIntInclusive(Math.pow(10, d) - 1, Math.pow(10, d - 1))
              : (() => {
                  const cappedMax = Math.min(maxValue, MAX_MUL_VALUE);
                  const cappedMin = (minValue <= cappedMax) ? Math.max(1, minValue) : 1;
                  return randomIntInclusive(cappedMax, cappedMin);
                })();
            picks.push(Math.max(1, Math.min(val, MAX_MUL_VALUE)));
          }
          numbers.splice(0, numbers.length, ...picks);
        }
        correctAnswer = numbers.reduce((p, n) => p * n, 1);
        break;
      case '/':
        // Деление генерируем КОНСТРУКТИВНО: сначала выбираем делители (>=2, <=4 разряда),
        // затем подбираем частное и вычисляем делимое (<=6 разрядов). Так исключаем /1 и /1/1.
        {
          const countDivs = Math.min(effectiveNumbersCount, 3) - 1; // 1 или 2 делителя

          // Диапазон делимого: если указана разрядность — игнорируем numberRange, иначе ограничиваемся numberRange, но не больше 6 разрядов.
          const maxDividendByRange = cfg.divisionDividendDigits ? MAX_DIVIDEND_VALUE : Math.min(MAX_DIVIDEND_VALUE, maxValue);
          const minDividendByRange = cfg.divisionDividendDigits ? 1 : Math.max(1, minValue);
          const dd = cfg.divisionDividendDigits ? Math.min(cfg.divisionDividendDigits, MAX_DIVIDEND_DIGITS) : undefined;
          const minDividend = dd ? Math.pow(10, dd - 1) : minDividendByRange;
          const maxDividend = dd ? Math.min(Math.pow(10, dd) - 1, MAX_DIVIDEND_VALUE) : maxDividendByRange;

          const clampDigits = (d: number | undefined, maxD: number) => d ? Math.min(d, maxD) : undefined;
          const d1Digits = clampDigits(cfg.divisionDivisorDigits, MAX_DIVISOR_DIGITS);
          const d2Digits = clampDigits(cfg.divisionSecondDivisorDigits || cfg.divisionDivisorDigits, MAX_DIVISOR_DIGITS);

          const pickDivisor = (digits: number | undefined) => {
            if (digits) {
              const lo = Math.max(2, Math.pow(10, digits - 1));
              const hi = Math.min(MAX_DIVISOR_VALUE, Math.pow(10, digits) - 1);
              return randomIntInclusive(hi, lo);
            }
            return randomIntInclusive(MAX_DIVISOR_VALUE, 2);
          };

          const attempts = 60;
          for (let a = 0; a < attempts; a++) {
            const d1 = pickDivisor(d1Digits);
            const d2 = countDivs >= 2 ? pickDivisor(d2Digits) : 1;
            const base = d1 * d2;
            if (base <= 0) continue;

            const qMax = Math.floor(maxDividend / base);
            const qMin = Math.max(2, Math.ceil(minDividend / base));
            if (qMax < qMin) continue;

            const q = randomIntInclusive(qMax, qMin);
            const dividend = base * q;
            if (dividend < minDividend || dividend > maxDividend) continue;

            if (countDivs >= 2) {
              return { numbers: [dividend, d1, d2], operation: '/', correctAnswer: q };
            }
            return { numbers: [dividend, d1], operation: '/', correctAnswer: q };
          }

          // Если совсем не получилось (крайние настройки) — безопасный фолбэк
          const d1 = 2;
          const q = Math.max(2, Math.min(9999, Math.floor(maxDividend / d1) || 2));
          return { numbers: [d1 * q, d1], operation: '/', correctAnswer: q };
        }
      default:
        correctAnswer = numbers.reduce((s, n) => s + n, 0);
    }

    // Если создали смешанную последовательность, всегда проставляем operation как '+' (UI/сервер совместим)
    if (opsSequence && opsSequence.length === numbers.length - 1) {
      return { numbers, operation: '+', correctAnswer, ops: opsSequence.map(op => (op === '+' || op === '-' ? op : '+')) };
    }

    return { numbers, operation, correctAnswer };
  };
}


