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

  function generateLawPairTen(op: Operation, max: number, min = 1): [number, number] {
    // Пары-комплементы до 10
    if (op === '+') {
      const u1 = randomIntInclusive(9, 1);
      const units2 = (10 - (u1 % 10)) % 10;
      const u2 = units2 === 0 ? 0 : units2;
      let a = makeWithUnits(max, u1 === 10 ? 0 : u1, min);
      let b = makeWithUnits(max, u2, min);
      if (Math.random() < 0.5) [a, b] = [b, a];
      return [a, b];
    } else {
      // Для вычитания: обеспечиваем a_units < b_units
      const uA = randomIntInclusive(8, 0); // 0..8
      const uB = randomIntInclusive(9, uA + 1); // 1..9 и > uA
      const maxTens = Math.floor((max - Math.max(uA, uB)) / 10);
      let tB = randomIntInclusive(maxTens, 0);
      let tA = randomIntInclusive(maxTens, tB); // tA >= tB
      let a = tA * 10 + uA;
      let b = tB * 10 + uB;
      if (a < b) a = (tB + 1) * 10 + uA;
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
    const lawsOn = cfg.lawsMode && cfg.lawsMode !== 'none';
    // Выбираем операцию; если законы активны — принудительно '+/-'
    let operation: Operation = cfg.operations[Math.floor(Math.random() * cfg.operations.length)];
    if (lawsOn && (operation === '*' || operation === '/')) {
      operation = Math.random() < 0.5 ? '+' : '-';
    }

    // ВАЖНО:
    // Ограничение "до 3 чисел" относится только к конкретной задаче с ×/÷,
    // а не к наличию ×/÷ в общем списке операций сессии.
    const isMulOrDiv = operation === '*' || operation === '/';
    const effectiveNumbersCount = isMulOrDiv ? Math.min(cfg.numbersCount, 3) : cfg.numbersCount;

    if (lawsOn && effectiveNumbersCount >= 2 && maxValue >= 1) {
      // Пытаемся сгенерировать выражение так, чтобы доля формул удовлетворяла требованиям.
      const attempts = 30;
      for (let attempt = 0; attempt < attempts; attempt++) {
        numbers.length = 0;
        opsSequence = [];
        const opPool = cfg.operations.filter(o => o === '+' || o === '-');
        if (opPool.length === 0) opPool.push('+');
        opsSequence = Array.from({ length: effectiveNumbersCount - 1 }, () => pickRandom(opPool)) as Operation[];
        // Если разрешены и '+' и '-', обеспечим наличие обоих типов операций
        if (opPool.includes('+') && opPool.includes('-') && opsSequence.length > 0) {
          if (!opsSequence.includes('+')) opsSequence[0] = '+';
          if (!opsSequence.includes('-')) opsSequence[opsSequence.length - 1] = '-';
        }
        const totalSteps = opsSequence.length;
        const requiredFormulaSteps = totalSteps <= 2 ? totalSteps : Math.max(1, Math.floor(totalSteps * 0.6));
        let leftToMake = requiredFormulaSteps;

        let current = randomIntInclusive(maxValue, minValue);
        numbers.push(current);
        const places = getAvailablePlaces(maxValue);
        let formulaCount = 0;

        for (let i = 0; i < totalSteps; i++) {
          const op = opsSequence[i];
          const useLaw: 'five' | 'ten' = (cfg.lawsMode === 'both') ? (Math.random() < 0.5 ? 'five' : 'ten') : (cfg.lawsMode as 'five' | 'ten');
          let madeFormula = false;
          // Для законов на 10 иногда предпочитаем старшие разряды (десятки/сотни), чтобы чаще тренировать перенос
          const preferHigher = useLaw === 'ten' && places.length > 1 && Math.random() < 0.6;
          const shuffledPlaces = weightedPlacesOrder(places, preferHigher);
          for (const place of shuffledPlaces) {
            const d = digitAtPlace(current, place);
            if (op === '+') {
              if (useLaw === 'five') {
                  // Требуем, чтобы сумма единичных цифр стала кратна 5
                  const r = d % 5; // 0..4
                  let aUnits = (5 - r) % 5; // 0..4
                  if (aUnits === 0) aUnits = 5; // используем 5 вместо 0
                  if (aUnits >= 1 && aUnits <= 5) {
                    const n = aUnits * place;
                    // ВАЖНО: maxValue — это ограничение на величину ШАГА/числа, а не на накопленный результат.
                    // Иначе законы на 10/5 не работают в диапазоне 1–9 (т.к. current+n всегда > 9).
                    if (n <= maxValue) {
                      numbers.push(n);
                      current += n;
                      madeFormula = true;
                      break;
                    }
                  }
              } else {
                // Закон на 10: берём строгий комплемент до 10 в выбранном разряде
                const need = (10 - (d % 10)) % 10; // 0..9
                // need==0 означает, что единицы уже кратны 10; такой шаг не тренировочный — пробуем другую позицию/попытку
                if (need > 0) {
                  const n = need * place;
                  if (n <= maxValue) {
                    numbers.push(n);
                    current += n;
                    madeFormula = true;
                    break;
                  }
                }
              }
            } else {
              if (useLaw === 'five') {
                if (d >= 5) {
                  const bMin = Math.max(1, d - 4);
                  const bMax = Math.min(4, d);
                  if (bMin <= bMax && current - bMin * place >= 0) {
                    const b = randomIntInclusive(bMax, bMin);
                    const n = b * place;
                    numbers.push(n);
                    current -= n;
                    madeFormula = true;
                    break;
                  }
                }
              } else {
                const bMin = d + 1;
                if (bMin <= 9) {
                  const b = randomIntInclusive(9, bMin);
                  const n = b * place;
                  if (current - n >= 0) {
                    numbers.push(n);
                    current -= n;
                    madeFormula = true;
                    break;
                  }
                }
              }
            }
          }

          if (madeFormula) {
            formulaCount += 1;
            leftToMake = Math.max(0, leftToMake - 1);
            continue;
          }

          // Если формула обязательна (в варианте с 1-2 шагами), пробуем другой старт с нуля
          if (requiredFormulaSteps === totalSteps) {
            // прерываем и начинаем заново
            formulaCount = -1;
            break;
          }

          // Иначе — делаем нефомульный шаг (маленький, безопасный)
          const place = pickRandom(places);
          const a = randomIntInclusive(4, 1);
          const n = a * place;
          if (op === '+') {
            numbers.push(Math.min(n, maxValue));
            current += Math.min(n, maxValue);
          } else {
            const step = Math.min(n, current);
            numbers.push(step);
            current -= step;
          }
        }

        if (formulaCount === -1) continue; // перегенерация для строгого требования
        if (formulaCount >= requiredFormulaSteps) {
          break; // удачный вариант
        } else {
          // пробуем заново
          numbers.length = 0;
          opsSequence = [];
          continue;
        }
      }
    } else {
      // Обычный режим (без законов). Поддержим смешанные операции для суммы/разности
      const wantsMixedPlusMinus = effectiveNumbersCount >= 3 && cfg.operations.includes('+') && cfg.operations.includes('-') && !isMulOrDiv;
      if (wantsMixedPlusMinus) {
        // Генерируем как минимум один '+' и один '-'
        const maxAttempts = 25;
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
          if (ok) break;
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


