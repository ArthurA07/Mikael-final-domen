import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
// axios уже импортирован выше
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  useTheme,
  useMediaQuery,
  Stack,
  Slider,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Settings,
  Calculate,
  InfoOutlined,
  CheckCircleRounded,
} from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import TrainerAbacus from '../../components/abacus/TrainerAbacus';
import { LawsMode, generateProblemFactory, Operation } from '../../utils/problemGenerator';
import { Container, CircularProgress } from '@mui/material';

// Типы данных
interface Problem {
  numbers: number[];
  operation: '+' | '-' | '*' | '/';
  correctAnswer: number;
  // Режим twoScreens: независимая задача для игрока B
  numbersB?: number[];
  operationB?: '+' | '-' | '*' | '/';
  correctAnswerB?: number;
  opsB?: ('+' | '-' | '*' | '/')[];
  userAnswer?: number;
  userAnswerB?: number;
  timeSpent?: number;
  timeSpentB?: number;
  isCorrect?: boolean;
  isCorrectB?: boolean;
  ops?: ('+' | '-' | '*' | '/')[];
}

interface TrainingSession {
  problems: Problem[];
  currentProblemIndex: number;
  startTime: number;
  endTime?: number;
  accuracy: number;
  totalTime: number;
  averageTime: number;
  score: number;
}

interface TrainerState {
  isTraining: boolean;
  currentSession: TrainingSession | null;
  currentProblem: Problem | null;
  userAnswer: string;
  showProblem: boolean;
  timeLeft: number;
  problemStartTime: number;
  showSettings: boolean;
  currentStep: 'waiting' | 'prestart' | 'showing' | 'answering' | 'result' | 'result_pause';
  sequentialIndex?: number;
  answerTimeLeft?: number;
  preStartTimeLeft?: number; // мс до начала показа
}

// Дополнительные типы настроек тренажёра
// Тип импортируется из utils/problemGenerator

// Настройки по умолчанию (вынесены за пределы компонента для избежания пересоздания)
const DEFAULT_SETTINGS = {
  numbersCount: 3,
  // Верхняя граница диапазона
  numberRange: 9,
  // Нижняя граница диапазона (для варианта 1000–1 000 000)
  numberRangeMin: 1,
  // Режим двух экранов (локальная игра на двоих)
  twoScreens: false,
  // Показывать правильный ответ между примерами
  showAnswer: false,
  operations: ['+'],
  displaySpeed: 2000,
  displayMode: 'digits' as 'digits' | 'abacus',
  soundEnabled: true,
  // Количество примеров в сессии
  totalProblems: 10,
  // Режим законов (5/10/оба/стандарт)
  lawsMode: 'none' as LawsMode,
  // Разрядности (опционально)
  multiplyDigits1: undefined as number | undefined,
  multiplyDigits2: undefined as number | undefined,
  multiplyDigits3: undefined as number | undefined,
  divisionDividendDigits: undefined as number | undefined,
  divisionDivisorDigits: undefined as number | undefined,
  divisionSecondDivisorDigits: undefined as number | undefined,
  // Паузы (секунды)
  preStartPause: 0,
  answerPause: 0,
  resultPause: 0,
  // Визуальные настройки
  fontScale: 1,
  randomPosition: false,
  randomColor: false,
  sequentialDisplay: false,
};

const TrainerPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated } = useAuth();
  const { trainerSettings, updateTrainerSettings, updateUserStats, addAchievement, userStats, refreshUserStats } = useUser();
  
  // Доступ для гостей (20 минут по IP). Для авторизованных — всегда true
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [guestAllowed, setGuestAllowed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [guestUsed, setGuestUsed] = useState<number | null>(null);

  const [state, setState] = useState<TrainerState>({
    isTraining: false,
    currentSession: null,
    currentProblem: null,
    userAnswer: '',
    // Ответ второго игрока (для режима двух экранов)
    // Не включаем в TrainerState интерфейс для простоты — локальный ключ
    // @ts-ignore
    userAnswerB: '',
    showProblem: false,
    timeLeft: 0,
    problemStartTime: 0,
    showSettings: false,
    currentStep: 'waiting',
    sequentialIndex: 0,
    answerTimeLeft: 0,
    preStartTimeLeft: 0,
  });

  // Проверка доступа при загрузке
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.post('/public/free-access');
        if (res.data?.success && res.data?.data?.allowed) {
          setGuestAllowed(true);
          setExpiresAt(res.data.data.expiresAt || null);
          if (typeof res.data.data.exercisesUsed === 'number') setGuestUsed(res.data.data.exercisesUsed);
        } else {
          setGuestAllowed(false);
        }
      } catch (e) {
        setGuestAllowed(false);
      } finally {
        setCheckingAccess(false);
      }
    };
    check();
  }, [isAuthenticated]);

  // Локальное состояние для настроек
  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);
  const [showHelp, setShowHelp] = useState(false);

  const problemTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Флаги для защиты от двойной отправки/сохранения
  const submittingAnswerRef = useRef(false);
  const sessionSavedRef = useRef(false);
  const displayViewportRef = useRef<HTMLDivElement | null>(null);
  const displayContentRef = useRef<HTMLDivElement | null>(null);
  const debugLoggedKeyRef = useRef<string>('');
  const [problemPosition, setProblemPosition] = useState<{ key: string; dx: number; dy: number }>({
    key: '',
    dx: 0,
    dy: 0,
  });
  const [abacusFit, setAbacusFit] = useState<{ key: string; scale: number }>({
    key: '',
    scale: 1,
  });
  const [problemColor, setProblemColor] = useState<{
    key: string;
    color: string;
    contrastRatio: number;
    applied: boolean;
  }>({
    key: '',
    color: theme.palette.primary.main,
    contrastRatio: 1,
    applied: false,
  });
  
  // Стабильная ссылка на текущие настройки
  const currentSettings = useMemo(() => localSettings, [localSettings]);
  const currentProblemKey = useMemo(() => {
    const sessionKey = state.currentSession?.startTime ?? 0;
    const problemIdx = state.currentSession?.currentProblemIndex ?? -1;
    const signature = state.currentProblem
      ? `${state.currentProblem.numbers.join(',')}|${state.currentProblem.ops?.join(',') || state.currentProblem.operation}`
      : 'none';
    return `${sessionKey}:${problemIdx}:${signature}`;
  }, [state.currentSession?.startTime, state.currentSession?.currentProblemIndex, state.currentProblem]);

  const getExpressionText = useCallback((problem: Pick<Problem, 'numbers' | 'operation' | 'ops'>): string => {
    const { numbers, operation, ops } = problem;
    if (ops && ops.length === numbers.length - 1) {
      let s = `${numbers[0]}`;
      for (let i = 1; i < numbers.length; i++) s += ` ${ops[i - 1]} ${numbers[i]}`;
      return s;
    }
    return numbers.join(` ${operation} `);
  }, []);

  const getSafeRandomPosition = useCallback((
    containerSize: { width: number; height: number },
    contentSize: { width: number; height: number }
  ) => {
    const sidePadding = isMobile ? 12 : 24;
    const topPadding = isMobile ? 8 : 16;
    const bottomPadding = isMobile ? 46 : 58;

    const availableWidth = containerSize.width - sidePadding * 2;
    const availableHeight = containerSize.height - topPadding - bottomPadding;
    if (availableWidth <= 0 || availableHeight <= 0) return { dx: 0, dy: 0 };

    // Иногда измерение контента может возвращать почти полную ширину контейнера
    // (из-за особенностей layout). В таком случае используем "эффективный" размер,
    // чтобы не блокировать рандомизацию позиции.
    const effectiveContentWidth = Math.min(contentSize.width, availableWidth * 0.65);
    const effectiveContentHeight = Math.min(contentSize.height, availableHeight * 0.65);

    const maxDx = Math.max(0, (availableWidth - effectiveContentWidth) / 2);
    const maxDy = Math.max(0, (availableHeight - effectiveContentHeight) / 2);
    if (maxDx < 8 && maxDy < 8) return { dx: 0, dy: 0 };

    const pickShift = (maxShift: number) => {
      if (maxShift < 8) return 0;
      const minVisible = Math.min(Math.max(isMobile ? 10 : 24, maxShift * 0.25), maxShift);
      const magnitude = minVisible + Math.random() * Math.max(0, maxShift - minVisible);
      const sign = Math.random() < 0.5 ? -1 : 1;
      return Math.round(sign * magnitude);
    };

    const pickVerticalShiftSafe = (maxShift: number) => {
      if (maxShift < 8) return 0;
      // Чтобы не наезжать на линию таймера под примером, двигаем по Y только вверх.
      const minVisible = Math.min(Math.max(isMobile ? 8 : 16, maxShift * 0.2), maxShift);
      const magnitude = minVisible + Math.random() * Math.max(0, maxShift - minVisible);
      return -Math.round(magnitude);
    };

    return {
      dx: pickShift(maxDx),
      dy: pickVerticalShiftSafe(maxDy),
    };
  }, [isMobile]);

  const recalculateProblemPosition = useCallback(() => {
    if (!(currentSettings as any).randomPosition || !state.showProblem) {
      setProblemPosition(prev => (prev.dx === 0 && prev.dy === 0 && prev.key === currentProblemKey)
        ? prev
        : { key: currentProblemKey, dx: 0, dy: 0 });
      return;
    }
    const viewportEl = displayViewportRef.current;
    const contentEl = displayContentRef.current;
    if (!viewportEl || !contentEl) return;

    const viewportRect = viewportEl.getBoundingClientRect();
    const contentRect = contentEl.getBoundingClientRect();
    const next = getSafeRandomPosition(
      { width: viewportRect.width, height: viewportRect.height },
      { width: contentRect.width, height: contentRect.height }
    );
    setProblemPosition({ key: currentProblemKey, dx: next.dx, dy: next.dy });
  }, [currentSettings, state.showProblem, currentProblemKey, getSafeRandomPosition]);

  const recalculateAbacusFit = useCallback(() => {
    const isAbacusMode = currentSettings.displayMode === 'abacus';
    const isSequential = !!(currentSettings as any).sequentialDisplay;
    const isTwoScreens = !!(currentSettings as any).twoScreens;
    if (!state.showProblem || !isAbacusMode || isSequential || isTwoScreens) {
      setAbacusFit(prev => (prev.key === currentProblemKey && prev.scale === 1)
        ? prev
        : { key: currentProblemKey, scale: 1 });
      return;
    }

    const viewportEl = displayViewportRef.current;
    const contentEl = displayContentRef.current;
    if (!viewportEl || !contentEl) return;

    const viewportRect = viewportEl.getBoundingClientRect();
    const rawContentWidth = contentEl.scrollWidth || contentEl.offsetWidth || contentEl.getBoundingClientRect().width;
    const rawContentHeight = contentEl.scrollHeight || contentEl.offsetHeight || contentEl.getBoundingClientRect().height;
    if (!rawContentWidth || !rawContentHeight) return;

    const horizontalPadding = isMobile ? 12 : 20;
    const verticalPadding = isMobile ? 12 : 16;
    const widthLimit = Math.max(1, viewportRect.width - horizontalPadding * 2);
    const heightLimit = Math.max(1, viewportRect.height - verticalPadding * 2);
    const scaleByWidth = widthLimit / rawContentWidth;
    const scaleByHeight = heightLimit / rawContentHeight;
    const nextScale = Math.max(0.2, Math.min(1, Math.min(scaleByWidth, scaleByHeight)));

    setAbacusFit(prev => (
      prev.key === currentProblemKey && Math.abs(prev.scale - nextScale) < 0.01
        ? prev
        : { key: currentProblemKey, scale: nextScale }
    ));
  }, [currentProblemKey, currentSettings, isMobile, state.showProblem]);

  useEffect(() => {
    if (!(currentSettings as any).randomPosition || !state.showProblem) {
      setProblemPosition(prev => (prev.dx === 0 && prev.dy === 0 && prev.key === currentProblemKey)
        ? prev
        : { key: currentProblemKey, dx: 0, dy: 0 });
      return;
    }

    const rafId = requestAnimationFrame(() => {
      recalculateProblemPosition();
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentProblemKey, state.showProblem, currentSettings, recalculateProblemPosition]);

  useEffect(() => {
    if (!state.showProblem) {
      setAbacusFit(prev => (prev.scale === 1 ? prev : { key: currentProblemKey, scale: 1 }));
      return;
    }
    const rafId = requestAnimationFrame(() => {
      recalculateAbacusFit();
    });
    const lateMeasureId = window.setTimeout(() => {
      recalculateAbacusFit();
    }, 140);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(lateMeasureId);
    };
  }, [currentProblemKey, state.showProblem, currentSettings, recalculateAbacusFit]);

  useEffect(() => {
    if (!(currentSettings as any).randomPosition || !state.showProblem) return;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => recalculateProblemPosition(), 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener('resize', onResize);
    };
  }, [currentSettings, state.showProblem, recalculateProblemPosition]);

  useEffect(() => {
    if (!state.showProblem) return;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => recalculateAbacusFit(), 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener('resize', onResize);
    };
  }, [state.showProblem, recalculateAbacusFit]);

  const toRgb = useCallback((input: string): { r: number; g: number; b: number } | null => {
    const value = (input || '').trim().toLowerCase();
    if (!value) return null;
    const hex = value.startsWith('#') ? value.slice(1) : value;
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      return {
        r: parseInt(`${hex[0]}${hex[0]}`, 16),
        g: parseInt(`${hex[1]}${hex[1]}`, 16),
        b: parseInt(`${hex[2]}${hex[2]}`, 16),
      };
    }
    const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
    if (!rgbMatch) return null;
    const parts = rgbMatch[1].split(',').map(part => Number(part.trim()));
    if (parts.length < 3 || parts.some(v => Number.isNaN(v))) return null;
    return {
      r: Math.max(0, Math.min(255, parts[0])),
      g: Math.max(0, Math.min(255, parts[1])),
      b: Math.max(0, Math.min(255, parts[2])),
    };
  }, []);

  const contrastRatio = useCallback((foreground: string, background: string): number => {
    const fg = toRgb(foreground);
    const bg = toRgb(background);
    if (!fg || !bg) return 1;
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminance = (c: { r: number; g: number; b: number }) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }, [toRgb]);

  const getRandomReadableColor = useCallback((backgroundColor: string, minContrastRatio = 4.5) => {
    const palette = [
      '#1E40AF', '#1D4ED8', '#1E3A8A', '#7E22CE', '#6B21A8',
      '#BE123C', '#B91C1C', '#C2410C', '#0F766E', '#0F766E',
      '#065F46', '#14532D', '#334155', '#4C1D95',
    ];
    const readable = palette
      .map(color => ({ color, ratio: contrastRatio(color, backgroundColor) }))
      .filter(entry => entry.ratio >= minContrastRatio);

    const selectedPool = readable.length ? readable : palette.map(color => ({ color, ratio: contrastRatio(color, backgroundColor) }));
    const selected = selectedPool[Math.floor(Math.random() * selectedPool.length)];
    return selected || { color: theme.palette.primary.main, ratio: contrastRatio(theme.palette.primary.main, backgroundColor) };
  }, [contrastRatio, theme.palette.primary.main]);

  useEffect(() => {
    if (!state.currentProblem) return;
    const randomColorOn = !!(currentSettings as any).randomColor;
    const isDigitsMode = currentSettings.displayMode === 'digits';
    const shouldApply = randomColorOn && isDigitsMode;
    const backgroundColor = theme.palette.background.paper || '#ffffff';

    if (!shouldApply) {
      setProblemColor({
        key: currentProblemKey,
        color: theme.palette.primary.main,
        contrastRatio: contrastRatio(theme.palette.primary.main, backgroundColor),
        applied: false,
      });
      return;
    }

    const picked = getRandomReadableColor(backgroundColor, 4.5);
    setProblemColor({
      key: currentProblemKey,
      color: picked.color,
      contrastRatio: picked.ratio,
      applied: true,
    });
  }, [
    currentProblemKey,
    currentSettings,
    state.currentProblem,
    theme.palette.primary.main,
    theme.palette.background.paper,
    getRandomReadableColor,
    contrastRatio,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!state.showProblem || !state.currentProblem) return;
    if (debugLoggedKeyRef.current === currentProblemKey) return;
    if (problemPosition.key !== currentProblemKey) return;
    if (problemColor.key !== currentProblemKey) return;

    const sequential = !!(currentSettings as any).sequentialDisplay;
    const branch = currentSettings.displayMode === 'abacus'
      ? (sequential ? 'abacus-sequential' : 'abacus-full')
      : (sequential ? 'digits-sequential' : 'digits-full');
    const randomPositionOn = !!(currentSettings as any).randomPosition;
    const randomColorOn = !!(currentSettings as any).randomColor;

    console.debug('[trainer-display-randomization]', {
      problemId: currentProblemKey,
      displayMode: currentSettings.displayMode,
      lawsMode: currentSettings.lawsMode,
      operations: currentSettings.operations,
      range: {
        min: currentSettings.numberRangeMin ?? 1,
        max: currentSettings.numberRange,
      },
      sequentialDisplay: sequential,
      randomPosition: {
        enabled: randomPositionOn,
        applied: randomPositionOn,
        selectedPosition: { dx: problemPosition.dx, dy: problemPosition.dy },
      },
      randomColor: {
        enabled: randomColorOn,
        applied: problemColor.applied,
        selectedColor: problemColor.color,
        contrastRatio: Number(problemColor.contrastRatio.toFixed(2)),
      },
      renderBranch: branch,
    });

    debugLoggedKeyRef.current = currentProblemKey;
  }, [currentProblemKey, currentSettings, state.showProblem, state.currentProblem, problemPosition, problemColor]);

  // Инициализация настроек при загрузке
  useEffect(() => {
    const initSettings = () => {
      if (isAuthenticated && trainerSettings) {
        // объединяем серверные настройки с локальными, НЕ теряя totalProblems
        setLocalSettings(prev => ({ ...prev, ...trainerSettings }));
      } else {
        // Для неавторизованных пользователей пробуем загрузить из localStorage
        try {
          const savedSettings = localStorage.getItem('trainerSettings');
          if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            setLocalSettings(prev => ({ ...prev, ...parsed }));
          }
        } catch (error) {
          console.warn('Ошибка загрузки настроек из localStorage:', error);
        }
      }
    };
    
    initSettings();
  }, [isAuthenticated, trainerSettings]);

  // Генерация проблемы через общий генератор
  const generateProblem = useCallback((): Problem => {
    const factory = generateProblemFactory({
      numbersCount: currentSettings.numbersCount,
      numberRange: currentSettings.numberRange,
      numberRangeMin: currentSettings.numberRangeMin ?? 1,
      operations: currentSettings.operations as ('+' | '-' | '*' | '/')[],
      lawsMode: currentSettings.lawsMode as LawsMode,
        multiplyDigits1: currentSettings.multiplyDigits1 as any,
        multiplyDigits2: currentSettings.multiplyDigits2 as any,
        multiplyDigits3: currentSettings.multiplyDigits3 as any,
      divisionDividendDigits: currentSettings.divisionDividendDigits as any,
        divisionDivisorDigits: currentSettings.divisionDivisorDigits as any,
        divisionSecondDivisorDigits: currentSettings.divisionSecondDivisorDigits as any,
    });
    return factory();
  }, [currentSettings.numbersCount, currentSettings.numberRange, currentSettings.numberRangeMin, currentSettings.operations, currentSettings.lawsMode]);

  // Очистка таймера - стабильная функция
  const clearCurrentTimeout = useCallback(() => {
    if (problemTimeoutRef.current) {
      clearTimeout(problemTimeoutRef.current);
      problemTimeoutRef.current = null;
    }
  }, []);

  // Локально меняем настройки (без запроса на сервер) — для плавной работы слайдеров
  const setLocalOnly = useCallback((partial: Partial<typeof currentSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...partial }));
  }, []);

  // Начало тренировки
  const startTraining = useCallback(() => {
    if (!guestAllowed) {
      alert(isAuthenticated
        ? 'Нужна активная платная подписка, чтобы продолжить тренировку.'
        : 'Бесплатный доступ для гостей завершён. Войдите или оформите подписку.');
      return;
    }
    clearCurrentTimeout();
    
    const problems: Problem[] = [];
    const total = Math.max(1, Math.min(100, currentSettings.totalProblems ?? 10));

    // План операций на сессию:
    // - '+/-' считаем одной "группой" (для длинных цепочек имеет смысл смешивать + и - внутри выражения)
    // - '*' и '/' — отдельные группы (и у них ограничение по количеству чисел до 3)
    const selectedOps = (currentSettings.operations || ['+']) as Operation[];
    const groups: Operation[][] = [];
    const hasPlus = selectedOps.includes('+');
    const hasMinus = selectedOps.includes('-');
    if (hasPlus || hasMinus) groups.push(([...(hasPlus ? ['+'] : []), ...(hasMinus ? ['-'] : [])] as Operation[]));
    if (selectedOps.includes('*')) groups.push(['*']);
    if (selectedOps.includes('/')) groups.push(['/']);
    if (!groups.length) groups.push(['+']);

    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const plan: Operation[][] = [];
    const base = shuffle(groups);
    const firstCount = Math.min(total, base.length);
    for (let i = 0; i < firstCount; i++) plan.push(base[i]);
    for (let i = firstCount; i < total; i++) {
      plan.push(groups[Math.floor(Math.random() * groups.length)]);
    }

    // Фабрики под каждую группу операций (создаём один раз)
    const keyOf = (ops: Operation[]) => ops.join('');
    const factories = new Map<string, () => any>();
    for (const g of groups) {
      const key = keyOf(g);
      if (!factories.has(key)) {
        factories.set(key, generateProblemFactory({
          numbersCount: currentSettings.numbersCount,
          numberRange: currentSettings.numberRange,
          numberRangeMin: (currentSettings as any).numberRangeMin ?? 1,
          operations: g,
          lawsMode: currentSettings.lawsMode as any,
          multiplyDigits1: (currentSettings as any).multiplyDigits1,
          multiplyDigits2: (currentSettings as any).multiplyDigits2,
          multiplyDigits3: (currentSettings as any).multiplyDigits3,
          divisionDividendDigits: (currentSettings as any).divisionDividendDigits,
          divisionDivisorDigits: (currentSettings as any).divisionDivisorDigits,
          divisionSecondDivisorDigits: (currentSettings as any).divisionSecondDivisorDigits,
        }));
      }
    }

    const isTwoScreensMode = !!(currentSettings as any).twoScreens;
    for (let i = 0; i < total; i++) {
      const g = plan[i];
      const factory = factories.get(keyOf(g))!;
      const a = factory() as Problem;
      if (!isTwoScreensMode) {
        problems.push(a);
        continue;
      }

      let b = factory() as Problem;
      const aExpr = getExpressionText(a);
      let retries = 0;
      while (retries < 12 && getExpressionText(b) === aExpr) {
        b = factory() as Problem;
        retries += 1;
      }

      problems.push({
        ...a,
        numbersB: b.numbers,
        operationB: b.operation,
        correctAnswerB: b.correctAnswer,
        opsB: b.ops,
      });
    }
    
    const session: TrainingSession = {
      problems,
      currentProblemIndex: 0,
      startTime: Date.now(),
      accuracy: 0,
      totalTime: 0,
      averageTime: 0,
      score: 0,
    };
    
    setState(prev => ({
      ...prev,
      isTraining: true,
      currentSession: session,
      currentProblem: problems[0],
      currentStep: (currentSettings as any).preStartPause > 0 ? 'prestart' : 'showing',
      showProblem: (currentSettings as any).preStartPause > 0 ? false : true,
      problemStartTime: Date.now(),
      timeLeft: currentSettings.displaySpeed,
      sequentialIndex: 0,
      userAnswer: '',
      // @ts-ignore
      userAnswerB: '',
    }));
    // Сбрасываем защитные флаги для новой сессии
    submittingAnswerRef.current = false;
    sessionSavedRef.current = false;
    
    const prePauseMs = ((currentSettings as any).preStartPause || 0) * 1000;
    if (prePauseMs > 0) {
      // Экран ожидания (перед показом)
      setState(prev => ({ ...prev, currentStep: 'prestart', showProblem: false, preStartTimeLeft: prePauseMs }));
      problemTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentStep: 'showing',
          showProblem: true,
          problemStartTime: Date.now(),
          timeLeft: currentSettings.displaySpeed,
          sequentialIndex: 0,
          preStartTimeLeft: 0,
        }));
      }, prePauseMs);
    } else {
      // Без предварительной паузы просто начинаем показ; дальнейший переход управляется эффектом показа
    }
    
  }, [generateProblem, currentSettings.displaySpeed, clearCurrentTimeout, currentSettings.totalProblems, currentSettings.operations, currentSettings.numbersCount, currentSettings.numberRange, (currentSettings as any).numberRangeMin, currentSettings.lawsMode, (currentSettings as any).multiplyDigits1, (currentSettings as any).multiplyDigits2, (currentSettings as any).multiplyDigits3, (currentSettings as any).divisionDividendDigits, (currentSettings as any).divisionDivisorDigits, (currentSettings as any).divisionSecondDivisorDigits, isAuthenticated, guestAllowed]);

  // Остановка тренировки
  const stopTraining = useCallback(() => {
    clearCurrentTimeout();
    
    setState(prev => ({
      ...prev,
      isTraining: false,
      currentSession: null,
      currentProblem: null,
      userAnswer: '',
      showProblem: false,
      currentStep: 'waiting',
    }));
  }, [clearCurrentTimeout]);

  // Отправка ответа
  const submitAnswer = useCallback(async () => {
    // Важно: submitAnswer вызывается из обработчиков событий и таймеров.
    // Если промис упадёт наружу — CRA покажет красный runtime overlay.
    // Поэтому обязательно ловим любые исключения внутри.
    try {
      if (!state.currentSession || !state.currentProblem) return;
      if (submittingAnswerRef.current) return; // антидребезг на быстрые клики/таймер
      submittingAnswerRef.current = true;
      
      clearCurrentTimeout();
      
      const userAnswer = parseInt(state.userAnswer);
      const userAnswerB = parseInt(((state as any).userAnswerB || ''));
      const isTwo = !!(currentSettings as any).twoScreens;
      const isCorrect = userAnswer === state.currentProblem.correctAnswer;
      const correctAnswerB = isTwo
        ? ((state.currentProblem as any).correctAnswerB ?? state.currentProblem.correctAnswer)
        : undefined;
      const isCorrectB = isTwo ? (userAnswerB === correctAnswerB) : undefined;
      const timeSpent = Date.now() - state.problemStartTime;
      const timeSpentB = isTwo ? timeSpent : undefined;
      
      const updatedProblem = {
        ...state.currentProblem,
        userAnswer,
        ...(isTwo ? { userAnswerB } : {}),
        isCorrect,
        ...(isTwo ? { isCorrectB } : {}),
        timeSpent,
        ...(isTwo ? { timeSpentB } : {}),
      };
      
      const updatedProblems = [...state.currentSession.problems];
      updatedProblems[state.currentSession.currentProblemIndex] = updatedProblem;
      
      const nextIndex = state.currentSession.currentProblemIndex + 1;
      const isLastProblem = nextIndex >= updatedProblems.length;
      
      // Для гостей учитываем лимит примеров на сервере
      if (!isAuthenticated) {
        try {
          const res = await axios.post('/public/track-exercise');
          if (res.data?.success && res.data?.data?.allowed === false) {
            alert('Лимит бесплатных примеров исчерпан. Войдите или оформите доступ, чтобы продолжить.');
            // Завершаем сессию немедленно
            setState(prev => ({
              ...prev,
              isTraining: false,
              currentSession: null,
              currentProblem: null,
              userAnswer: '',
              showProblem: false,
              currentStep: 'waiting',
            }));
            return;
          }
        } catch (e) {
          // если сервер не доступен — не блокируем, но не падаем
        }
      }

    if (isLastProblem) {
      const correctAnswers = updatedProblems.filter(p => p.isCorrect).length;
      const accuracy = (correctAnswers / updatedProblems.length) * 100;
      const totalTime = Date.now() - state.currentSession.startTime;
      const averageTime = totalTime / updatedProblems.length;
      const score = Math.round(accuracy * (1000 / averageTime) * 10);
      
      const completedSession = {
        ...state.currentSession,
        problems: updatedProblems,
        endTime: Date.now(),
        accuracy,
        totalTime,
        averageTime,
        score,
      };
      
      // Сохраняем статистику только для авторизованных пользователей
      if (isAuthenticated && user && updateUserStats && addAchievement) {
        try {
          // Логика начисления опыта: опыт за сессию равен её «Счёту»
          const sessionXp = Math.round(score);
          await updateUserStats({
            // Используем только инкременты, чтобы не удваивать агрегаты
            incTotalExercises: updatedProblems.length,
            incCorrectAnswers: correctAnswers,
            incTotalTime: totalTime,
            // Передаём accuracy — сервер обновит bestAccuracy при необходимости
            accuracy,
            // Опыт — абсолютным значением (текущее + начисленное)
            experiencePoints: (user.stats?.experiencePoints || 0) + sessionXp,
          });
          // Обновляем агрегаты в контексте, чтобы виджет и /stats сразу увидели изменения
          try { await refreshUserStats(); } catch {}

          // Сохраняем детальную историю в Training (бэкенд)
          try {
            if (!sessionSavedRef.current) {
              sessionSavedRef.current = true; // ставим флаг до запроса, чтобы отсеять дубликаты
              await axios.post('/training/complete', {
              problems: updatedProblems,
              settings: currentSettings,
              metrics: { totalTime },
              sessionType: 'practice',
              });
            }
            // Автовыдача простых достижений
            try {
              const totalAll = (user.stats?.totalExercises || 0) + updatedProblems.length;
              if (correctAnswers === updatedProblems.length) {
                await addAchievement?.({ id: 'perfect_session', name: 'Идеальная сессия', description: 'Все ответы верны', icon: '🎯' });
              }
              if (totalAll >= 10) {
                await addAchievement?.({ id: 'ten_exercises', name: '10 примеров', description: 'Решено 10 примеров', icon: '🔟' });
              }
            } catch {}
          } catch (e) {
            console.warn('Не удалось сохранить историю тренировки:', e);
          }
          
          if (accuracy === 100) {
            await addAchievement({
              id: 'perfect_session',
              name: 'Идеальная сессия',
              description: 'Решите все задачи в сессии без ошибок',
              icon: '🎯',
            });
          }
        } catch (error) {
          console.warn('Не удалось сохранить статистику:', error);
        }
      }

      // ВАЖНО: если включён показ ответа/пауза результата — показываем правильный ответ
      // также и для ПОСЛЕДНЕГО примера, иначе пользователь его не увидит.
      const wantShowAnswer = !!(currentSettings as any).showAnswer || ((currentSettings as any).resultPause || 0) > 0;
      if (wantShowAnswer) {
        // Если включили "Показывать ответы", но пауза результата = 0, делаем дефолтную паузу,
        // иначе экран "Правильный ответ" мигает за 1мс и пользователь думает, что его нет.
        const configuredPauseMs = Math.max(0, (((currentSettings as any).resultPause || 0) * 1000));
        const pauseMs = configuredPauseMs > 0 ? configuredPauseMs : ((currentSettings as any).showAnswer ? 1500 : 0);
        setState(prev => ({
          ...prev,
          currentSession: completedSession,
          currentProblem: updatedProblem,
          showProblem: false,
          currentStep: 'result_pause',
        }));

        // После паузы переходим на экран итогов
        clearCurrentTimeout();
        problemTimeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            currentSession: completedSession,
            currentStep: 'result',
          }));
        }, pauseMs || 1);
      } else {
        setState(prev => ({
          ...prev,
          currentSession: completedSession,
          currentStep: 'result',
        }));
      }

    } else {
      // Если нужно показать ответ — делаем короткую паузу result_pause
      const wantShowAnswer = !!(currentSettings as any).showAnswer || ((currentSettings as any).resultPause || 0) > 0;
      if (wantShowAnswer) {
        setState(prev => ({
          ...prev,
          currentSession: {
            ...prev.currentSession!,
            problems: updatedProblems,
            currentProblemIndex: nextIndex - 1, // остаёмся на предыдущем для показа ответа
          },
          currentProblem: updatedProblem,
          showProblem: false,
          currentStep: 'result_pause',
        }));
        const configuredPauseMs = Math.max(0, (((currentSettings as any).resultPause || 0) * 1000));
        const pauseMs = configuredPauseMs > 0 ? configuredPauseMs : ((currentSettings as any).showAnswer ? 1500 : 0);
        setTimeout(() => {
          const nextProblem = updatedProblems[nextIndex];
          setState(prev => ({
            ...prev,
            currentSession: {
              ...prev.currentSession!,
              problems: updatedProblems,
              currentProblemIndex: nextIndex,
            },
            currentProblem: nextProblem,
            userAnswer: '',
            // @ts-ignore
            userAnswerB: '',
            showProblem: true,
            currentStep: 'showing',
            problemStartTime: Date.now(),
            timeLeft: currentSettings.displaySpeed,
            sequentialIndex: 0,
          }));
        }, pauseMs || 1);
      } else {
        const nextProblem = updatedProblems[nextIndex];
        setState(prev => ({
          ...prev,
          currentSession: {
            ...prev.currentSession!,
            problems: updatedProblems,
            currentProblemIndex: nextIndex,
          },
          currentProblem: nextProblem,
          userAnswer: '',
          // @ts-ignore
          userAnswerB: '',
          showProblem: true,
          currentStep: 'showing',
          problemStartTime: Date.now(),
          timeLeft: currentSettings.displaySpeed,
          sequentialIndex: 0,
        }));
      }
    }
    } catch (err) {
      // Не даём ошибке улететь наружу (иначе будет красный overlay).
      console.error('Trainer submitAnswer runtime error:', err);
    } finally {
      submittingAnswerRef.current = false;
    }
  }, [state, currentSettings, user, updateUserStats, addAchievement, isAuthenticated, clearCurrentTimeout]);

  // Обновление настроек - стабилизированная функция
  const handleSettingsChange = useCallback(async (newSettings: Partial<typeof currentSettings>) => {
    // Обновляем локальное состояние сразу для отзывчивости UI
    const updatedSettings = { ...currentSettings, ...newSettings };
    // Полировка: при включении законов удаляем * и /; при включении * или / ограничиваем numbersCount <= 3
    if (newSettings.lawsMode && newSettings.lawsMode !== 'none') {
      if (updatedSettings.operations.some(op => op === '*' || op === '/')) {
        updatedSettings.operations = updatedSettings.operations.filter(op => op === '+' || op === '-');
      }
    }
    if (newSettings.operations) {
      const hasMulDiv = newSettings.operations.some(op => op === '*' || op === '/');
      if (hasMulDiv && (updatedSettings.numbersCount || 0) > 3) {
        updatedSettings.numbersCount = 3;
      }
    }
    setLocalSettings(updatedSettings);
    
    // Сохраняем настройки
    if (isAuthenticated && updateTrainerSettings) {
      try {
        // Отправляем на сервер только поддерживаемые ключи схемой пользователя
        const serverAllowedKeys: (keyof typeof currentSettings)[] = [
          'numbersCount', 'numberRange', 'operations', 'displaySpeed', 'displayMode',
          // новые ключи, сохраняемые на сервер
          'numberRangeMin', 'lawsMode', 'showAnswer',
          'multiplyDigits1','multiplyDigits2','multiplyDigits3',
          'divisionDividendDigits','divisionDivisorDigits','divisionSecondDivisorDigits',
          'preStartPause','answerPause','resultPause','fontScale','randomPosition','randomColor','sequentialDisplay','twoScreens',
          'totalProblems'
        ];
        const payload: Partial<typeof currentSettings> = {};
        serverAllowedKeys.forEach((k) => {
          if (k in newSettings) {
            // @ts-expect-error индексный доступ к частичным данным
            payload[k] = newSettings[k];
          }
        });
        if (Object.keys(payload).length > 0) {
          await updateTrainerSettings(payload);
        }
      } catch (error) {
        console.warn('Не удалось сохранить настройки на сервере, используем localStorage:', error);
        localStorage.setItem('trainerSettings', JSON.stringify(updatedSettings));
      }
    } else {
      // Для неавторизованных пользователей сохраняем в localStorage
      localStorage.setItem('trainerSettings', JSON.stringify(updatedSettings));
    }
  }, [currentSettings, isAuthenticated, updateTrainerSettings]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      clearCurrentTimeout();
    };
  }, [clearCurrentTimeout]);

  // Обновление таймера отображения примера (поддержка пошагового показа)
  useEffect(() => {
    if (!state.isTraining || state.currentStep !== 'showing' || !state.showProblem) return;

    const numbers = state.currentProblem?.numbers || [];
    const numbersB = ((state.currentProblem as any)?.numbersB || []) as number[];
    const isTwoScreens = !!(currentSettings as any).twoScreens;
    const timelineLength = isTwoScreens ? Math.max(numbers.length, numbersB.length) : numbers.length;
    const sequential = !!(currentSettings as any).sequentialDisplay;

    if (sequential && timelineLength > 0) {
      let localIndex = state.sequentialIndex || 0;
      let stepStart = Date.now();
      const tick = setInterval(() => {
        const elapsed = Date.now() - stepStart;
        const remaining = Math.max(0, currentSettings.displaySpeed - elapsed);
        setState(prev => ({ ...prev, timeLeft: remaining }));
        if (remaining === 0) {
          localIndex += 1;
          if (localIndex >= timelineLength) {
            clearInterval(tick);
            setState(prev => ({ ...prev, sequentialIndex: Math.max(0, timelineLength - 1), showProblem: false, currentStep: 'answering', answerTimeLeft: ((currentSettings as any).answerPause || 0) * 1000 }));
          } else {
            stepStart = Date.now();
            setState(prev => ({ ...prev, sequentialIndex: localIndex, timeLeft: currentSettings.displaySpeed }));
          }
        }
      }, 50);
      return () => clearInterval(tick);
    }

    // Обычный режим: показываем всю строку
    const startedAt = Date.now();
    setState(prev => ({ ...prev, problemStartTime: startedAt, timeLeft: currentSettings.displaySpeed }));
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, currentSettings.displaySpeed - elapsed);
      setState(prev => ({ ...prev, timeLeft: remaining }));
      if (remaining === 0) {
        clearInterval(intervalId);
        setState(prev => ({ ...prev, showProblem: false, currentStep: 'answering', answerTimeLeft: ((currentSettings as any).answerPause || 0) * 1000 }));
      }
    }, 50);
    return () => clearInterval(intervalId);
  }, [state.isTraining, state.currentStep, state.showProblem, state.currentProblem, state.sequentialIndex, currentSettings.displaySpeed, currentSettings]);

  // Таймер на ввод ответа: авто-отправка, когда время вышло
  useEffect(() => {
    if (!state.isTraining || state.currentStep !== 'answering') return;
    const total = ((currentSettings as any).answerPause || 0) * 1000;
    if (total <= 0) return;
    const start = Date.now();
    const t = setInterval(() => {
      const remain = Math.max(0, total - (Date.now() - start));
      setState(prev => ({ ...prev, answerTimeLeft: remain }));
      if (remain === 0) {
        clearInterval(t);
        submitAnswer();
      }
    }, 100);
    return () => clearInterval(t);
  }, [state.isTraining, state.currentStep, currentSettings, submitAnswer]);

  // Рендер текущей задачи
  const renderCurrentProblem = () => {
    if (!state.currentProblem) return null;

    const { numbers, operation } = state.currentProblem;
    const numbersB = ((state.currentProblem as any).numbersB || []) as number[];
    const operationB = (((state.currentProblem as any).operationB || operation) as Operation);
    const opsB = (((state.currentProblem as any).opsB || []) as Operation[]);
    const isTwoScreens = !!(currentSettings as any).twoScreens;
    const canSubmitCurrentAnswer = Boolean(state.userAnswer && (!isTwoScreens || (state as any).userAnswerB));
    const sequential = !!(currentSettings as any).sequentialDisplay;

    const expressionByStep = (vals: number[], op: Operation, opsSeq?: Operation[]) => {
      const idx = Math.min(state.sequentialIndex || 0, Math.max(0, vals.length - 1));
      if (!sequential) return getExpressionText({ numbers: vals, operation: op, ops: opsSeq });
      const num = vals[idx];
      if (idx === 0) return String(num ?? '');
      const opFromSeq = opsSeq?.[idx - 1];
      return `${opFromSeq || op} ${num ?? ''}`;
    };

    // Визуальные "рандомизации" (позиция/цвет).
    // Позиция фиксируется на весь текущий пример и меняется только на новом примере.
    const randomPositionOn = !!(currentSettings as any).randomPosition;
    const fontScale = ((currentSettings as any).fontScale || 1) as number;
    const activeOffset = randomPositionOn && problemPosition.key === currentProblemKey
      ? { dx: problemPosition.dx, dy: problemPosition.dy }
      : { dx: 0, dy: 0 };
    const activeAbacusScale = currentSettings.displayMode === 'abacus' && abacusFit.key === currentProblemKey
      ? abacusFit.scale
      : 1;
    const activeDigitsColor = problemColor.key === currentProblemKey ? problemColor.color : theme.palette.primary.main;

    return (
      <Box sx={{ 
        textAlign: 'center',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {state.showProblem ? (
          <Box ref={displayViewportRef}>
            {isTwoScreens && (
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={3}
                justifyContent="center"
                alignItems="stretch"
                sx={{ mb: 3 }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    minWidth: { xs: '100%', md: 320 },
                    borderWidth: 2,
                    borderColor: theme.palette.primary.main,
                    background: `linear-gradient(180deg, ${theme.palette.primary.light}14 0%, transparent 100%)`,
                  }}
                >
                  <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Chip label="Экран A" size="small" color="primary" />
                    <Typography variant="subtitle2" sx={{ textAlign: 'center' }}>Игрок A</Typography>
                  </Stack>
                  <Typography
                    variant="h4"
                    sx={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: theme.palette.primary.main,
                      transform: `scale(${fontScale})`,
                    }}
                  >
                    {expressionByStep(numbers, operation, state.currentProblem.ops)}
                  </Typography>
                </Paper>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    minWidth: { xs: '100%', md: 320 },
                    borderWidth: 2,
                    borderColor: theme.palette.secondary.main,
                    background: `linear-gradient(180deg, ${theme.palette.secondary.light}14 0%, transparent 100%)`,
                  }}
                >
                  <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Chip label="Экран B" size="small" color="secondary" />
                    <Typography variant="subtitle2" sx={{ textAlign: 'center' }}>Игрок B</Typography>
                  </Stack>
                  <Typography
                    variant="h4"
                    sx={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: theme.palette.secondary.main,
                      transform: `scale(${fontScale})`,
                    }}
                  >
                    {expressionByStep(numbersB.length ? numbersB : numbers, operationB, opsB.length ? opsB : undefined)}
                  </Typography>
                </Paper>
              </Stack>
            )}
            {!isTwoScreens && (currentSettings.displayMode === 'abacus' ? (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                  Запомните числа на абакусе:
                </Typography>
                {((currentSettings as any).sequentialDisplay ? (
                  // последовательный показ на абакусе — только один текущий элемент
                  (() => {
                    const idx = state.sequentialIndex || 0;
                    const number = numbers[idx];
                    return (
                      <Box
                        ref={displayContentRef}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          width: 'fit-content',
                          maxWidth: '100%',
                          transform: randomPositionOn ? `translate(${activeOffset.dx}px, ${activeOffset.dy}px)` : undefined,
                          transformOrigin: 'center',
                        }}
                      >
                        {idx === 0 ? null : (
                          <Typography variant="h1" sx={{ fontSize: { xs: '3rem', md: '4rem' }, fontWeight: 'bold', color: theme.palette.primary.main, userSelect: 'none' }}>
                            {state.currentProblem?.ops && state.currentProblem.ops[idx-1] ? state.currentProblem.ops[idx-1] : operation}
                          </Typography>
                        )}
                        <Box sx={{ flex: '0 1 280px', minWidth: '200px' }}>
                          <Typography variant="body1" sx={{ textAlign: 'center', mb: 1, fontWeight: 'bold' }}>Число {idx + 1}</Typography>
                          <TrainerAbacus value={number} showValue={false} />
                        </Box>
                      </Box>
                    );
                  })()
                ) : (
                  // обычный режим — все числа
                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                    <Box
                      ref={displayContentRef}
                      sx={{
                        display: 'inline-flex',
                        flexWrap: 'nowrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: { xs: 1, md: 1.5 },
                        width: 'max-content',
                        maxWidth: 'none',
                        transform: `${randomPositionOn ? `translate(${activeOffset.dx}px, ${activeOffset.dy}px) ` : ''}scale(${activeAbacusScale})`,
                        transformOrigin: 'top center',
                      }}
                    >
                      {numbers.map((number, index) => (
                        <React.Fragment key={index}>
                          <Box
                            sx={{
                              flex: '0 1 280px',
                              minWidth: '200px',
                            }}
                          >
                            <Typography variant="body1" sx={{ textAlign: 'center', mb: 1, fontWeight: 'bold' }}>Число {index + 1}</Typography>
                            <TrainerAbacus value={number} showValue={false} />
                          </Box>
                          {index < numbers.length - 1 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', px: 2 }}>
                              <Typography variant="h1" sx={{ fontSize: { xs: '3rem', md: '4rem' }, fontWeight: 'bold', color: theme.palette.primary.main, textShadow: '2px 2px 4px rgba(0,0,0,0.3)', userSelect: 'none' }}>
                                {state.currentProblem?.ops && state.currentProblem.ops[index] ? state.currentProblem.ops[index] : operation}
                              </Typography>
                            </Box>
                          )}
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>
                ))}
                <Typography variant="body1" sx={{ mt: 3, textAlign: 'center', fontWeight: 'bold', color: theme.palette.primary.main }}>
                  {state.currentProblem?.ops && state.currentProblem.ops.length > 0
                    ? `Операции: ${state.currentProblem.ops.join(' ')}`
                    : `Операция: ${operation}`}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                {(() => {
                  const dynScale = Math.max(0.6, Math.min(1, 8 / Math.max(1, numbers.length)));
                  if (sequential) {
                    const idx = state.sequentialIndex || 0;
                    const num = numbers[idx];
                    const text = (() => {
                      if (idx === 0) return String(num);
                      const opFromSeq = state.currentProblem?.ops?.[idx - 1];
                      return `${opFromSeq || operation} ${num}`;
                    })();
                    return (
                      <Box
                        ref={displayContentRef}
                        sx={{
                          display: 'inline-block',
                          width: 'fit-content',
                          maxWidth: '100%',
                          transform: randomPositionOn ? `translate(${activeOffset.dx}px, ${activeOffset.dy}px)` : undefined,
                          transformOrigin: 'center',
                        }}
                      >
                        <Typography
                          key={idx}
                          variant="h2"
                          sx={{
                            fontWeight: 'bold',
                            color: activeDigitsColor,
                            transform: `scale(${fontScale * dynScale})`,
                          }}
                        >
                          {text}
                        </Typography>
                      </Box>
                    );
                  }
                  // обычный режим — вся строка
                  return (
                    <Box
                      ref={displayContentRef}
                      sx={{
                        display: 'inline-block',
                        width: 'fit-content',
                        maxWidth: '100%',
                        transform: randomPositionOn ? `translate(${activeOffset.dx}px, ${activeOffset.dy}px)` : undefined,
                        transformOrigin: 'center',
                      }}
                    >
                      <Typography
                        variant="h2"
                        sx={{
                          fontWeight: 'bold',
                          color: activeDigitsColor,
                          transform: `scale(${fontScale * dynScale})`,
                        }}
                      >
                        {(() => {
                          const ops = state.currentProblem?.ops;
                          if (ops && ops.length === numbers.length - 1) {
                            let s = `${numbers[0]}`;
                            for (let i = 1; i < numbers.length; i++) s += ` ${ops[i-1]} ${numbers[i]}`;
                            return s;
                          }
                          return numbers.join(` ${operation} `);
                        })()}
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>
            ))}
            
            <LinearProgress 
              variant="determinate" 
              value={(state.timeLeft / currentSettings.displaySpeed) * 100}
              sx={{ width: '200px', mx: 'auto' }}
            />
          </Box>
        ) : (
          <Box>
            <Typography variant="h4" sx={{ mb: 3, color: theme.palette.text.secondary }}>
              Сколько получилось?
            </Typography>
            {isTwoScreens ? (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="center">
                <Box>
                  <Typography variant="subtitle2" sx={{ textAlign: 'center', mb: 1 }}>Игрок A</Typography>
                  <TextField
                    value={state.userAnswer}
                    onChange={(e) => setState(prev => ({ ...prev, userAnswer: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && canSubmitCurrentAnswer) submitAnswer(); }}
                    placeholder="Ответ A"
                    variant="outlined"
                    sx={{ 
                      width: '200px',
                      '& .MuiOutlinedInput-root': { fontSize: '1.5rem', textAlign: 'center' }
                    }}
                    autoFocus
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ textAlign: 'center', mb: 1 }}>Игрок B</Typography>
                  <TextField
                    value={(state as any).userAnswerB}
                    onChange={(e) => setState(prev => ({ ...prev, userAnswerB: e.target.value } as any))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && canSubmitCurrentAnswer) submitAnswer(); }}
                    placeholder="Ответ B"
                    variant="outlined"
                    sx={{ 
                      width: '200px',
                      '& .MuiOutlinedInput-root': { fontSize: '1.5rem', textAlign: 'center' }
                    }}
                  />
                </Box>
              </Stack>
            ) : (
              <TextField
                value={state.userAnswer}
                onChange={(e) => setState(prev => ({ ...prev, userAnswer: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmitCurrentAnswer) submitAnswer(); }}
                placeholder="Введите ответ"
                variant="outlined"
                sx={{ 
                  width: '200px',
                  '& .MuiOutlinedInput-root': { fontSize: '1.5rem', textAlign: 'center' }
                }}
                autoFocus
              />
            )}
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                size="large"
                onClick={submitAnswer}
                disabled={!canSubmitCurrentAnswer}
              >
                Ответить
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // Рендер результатов сессии
  const renderResults = () => {
    if (!state.currentSession) return null;
    
    const { accuracy, averageTime, score, problems } = state.currentSession;
    const correctCount = problems.filter(p => p.isCorrect).length;
    // Персональные счётчики для A/B (если включён режим двух экранов)
    const two = !!(currentSettings as any).twoScreens;
    const correctA = problems.filter(p => p.isCorrect === true).length;
    const correctB = two ? problems.filter(p => (p as any).isCorrectB === true).length : 0;
    const total = problems.length;
    
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 3, color: theme.palette.success.main }}>
          🎉 Сессия завершена!
        </Typography>
        
        <Stack direction={isMobile ? 'column' : 'row'} spacing={2} sx={{ mb: 4, justifyContent: 'center' }}>
          <Card sx={{ minWidth: 120 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {correctCount}/{problems.length}
              </Typography>
              <Typography variant="body2">
                Правильных ответов
              </Typography>
            </CardContent>
          </Card>
          {two && (
            <>
              <Card sx={{ minWidth: 120 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    A: {correctA}/{total}
                  </Typography>
                  <Typography variant="body2">
                    Игрок A
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ minWidth: 120 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    B: {correctB}/{total}
                  </Typography>
                  <Typography variant="body2">
                    Игрок B
                  </Typography>
                </CardContent>
              </Card>
            </>
          )}
          
          <Card sx={{ minWidth: 120 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {accuracy.toFixed(1)}%
              </Typography>
              <Typography variant="body2">
                Точность
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ minWidth: 120 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {(averageTime / 1000).toFixed(1)}с
              </Typography>
              <Typography variant="body2">
                Среднее время
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ minWidth: 120 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {score}
              </Typography>
              <Typography variant="body2">
                Очки
              </Typography>
            </CardContent>
          </Card>
        </Stack>
        
        <Box>
          <Button
            variant="contained"
            size="large"
            onClick={startTraining}
            sx={{ mr: 2 }}
          >
            Новая сессия
          </Button>
          
          <Button
            variant="outlined"
            size="large"
            onClick={stopTraining}
          >
            Завершить
          </Button>
          {problems.some(p => p.isCorrect === false || ((currentSettings as any).twoScreens && (p as any).isCorrectB === false)) && (
            <Button
              variant="text"
              size="large"
              sx={{ ml: 2 }}
              onClick={() => {
                const wrong = problems.filter(p => p.isCorrect === false || ((currentSettings as any).twoScreens && (p as any).isCorrectB === false));
                const shouldRegenerateForRetry = !!(currentSettings as any).showAnswer;
                const retryCount = Math.max(1, wrong.length);
                const selectedOps = (currentSettings.operations || ['+']) as Operation[];
                const retryFactory = generateProblemFactory({
                  numbersCount: currentSettings.numbersCount,
                  numberRange: currentSettings.numberRange,
                  numberRangeMin: (currentSettings as any).numberRangeMin ?? 1,
                  operations: selectedOps,
                  lawsMode: currentSettings.lawsMode as any,
                  multiplyDigits1: (currentSettings as any).multiplyDigits1,
                  multiplyDigits2: (currentSettings as any).multiplyDigits2,
                  multiplyDigits3: (currentSettings as any).multiplyDigits3,
                  divisionDividendDigits: (currentSettings as any).divisionDividendDigits,
                  divisionDivisorDigits: (currentSettings as any).divisionDivisorDigits,
                  divisionSecondDivisorDigits: (currentSettings as any).divisionSecondDivisorDigits,
                });
                const twoScreensMode = !!(currentSettings as any).twoScreens;
                const seen = new Set<string>(wrong.map(p => getExpressionText({ numbers: p.numbers, operation: p.operation, ops: p.ops })));
                const seenB = new Set<string>(
                  wrong
                    .map(p => ((p as any).numbersB && (p as any).operationB
                      ? getExpressionText({
                          numbers: (p as any).numbersB,
                          operation: (p as any).operationB,
                          ops: (p as any).opsB,
                        } as any)
                      : null))
                    .filter(Boolean) as string[]
                );
                const regenerated: Problem[] = [];
                if (shouldRegenerateForRetry) {
                  for (let i = 0; i < retryCount; i++) {
                    let a = retryFactory() as Problem;
                    let triesA = 0;
                    while (triesA < 20 && seen.has(getExpressionText({ numbers: a.numbers, operation: a.operation, ops: a.ops }))) {
                      a = retryFactory() as Problem;
                      triesA += 1;
                    }
                    seen.add(getExpressionText({ numbers: a.numbers, operation: a.operation, ops: a.ops }));

                    if (!twoScreensMode) {
                      regenerated.push(a);
                      continue;
                    }

                    let b = retryFactory() as Problem;
                    let triesB = 0;
                    const exprA = getExpressionText({ numbers: a.numbers, operation: a.operation, ops: a.ops });
                    while (
                      triesB < 20 &&
                      (
                        getExpressionText({ numbers: b.numbers, operation: b.operation, ops: b.ops }) === exprA ||
                        seenB.has(getExpressionText({ numbers: b.numbers, operation: b.operation, ops: b.ops }))
                      )
                    ) {
                      b = retryFactory() as Problem;
                      triesB += 1;
                    }
                    seenB.add(getExpressionText({ numbers: b.numbers, operation: b.operation, ops: b.ops }));

                    regenerated.push({
                      ...a,
                      numbersB: b.numbers,
                      operationB: b.operation,
                      correctAnswerB: b.correctAnswer,
                      opsB: b.ops,
                    });
                  }
                }

                // Важно: сохраняем ops (последовательность + / -), иначе при повторе
                // примеры со смешанными операциями отображаются как простая сумма
                // и пользователь видит другую задачу, чем правильный ответ.
                const session: TrainingSession = {
                  problems: (
                    shouldRegenerateForRetry
                      ? regenerated
                      : wrong.map(p => ({
                          numbers: p.numbers,
                          operation: p.operation,
                          correctAnswer: p.correctAnswer,
                          ...(p as any).numbersB ? { numbersB: (p as any).numbersB } : {},
                          ...(p as any).operationB ? { operationB: (p as any).operationB } : {},
                          ...(p as any).correctAnswerB !== undefined ? { correctAnswerB: (p as any).correctAnswerB } : {},
                          ...(p as any).ops ? { ops: (p as any).ops } : {},
                          ...(p as any).opsB ? { opsB: (p as any).opsB } : {},
                        }) as any)
                  ),
                  currentProblemIndex: 0,
                  startTime: Date.now(),
                  accuracy: 0,
                  totalTime: 0,
                  averageTime: 0,
                  score: 0,
                };
                setState(prev => ({
                  ...prev,
                  isTraining: true,
                  currentSession: session,
                  currentProblem: session.problems[0],
                  currentStep: 'showing',
                  showProblem: true,
                  problemStartTime: Date.now(),
                  timeLeft: currentSettings.displaySpeed,
                  sequentialIndex: 0,
                  userAnswer: '',
                  // @ts-ignore
                  userAnswerB: '',
                }));
              }}
            >
              Повторить ошибки
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  // Рендер настроек
  const renderSettings = () => (
    <Dialog 
      open={state.showSettings} 
      onClose={() => setState(prev => ({ ...prev, showSettings: false }))}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Настройки тренажёра</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Разрядности для умножения/деления */}
          <Box>
            <FormLabel>Разрядности (для умножения/деления)</FormLabel>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <FormLabel>Разрядность первого множителя</FormLabel>
                <Select
                  value={(currentSettings as any).multiplyDigits1 ?? ''}
                  onChange={(e) => handleSettingsChange({ multiplyDigits1: (e.target.value === '' ? null : Number(e.target.value)) as any })}
                  displayEmpty
                >
                  <MenuItem value="">Авто</MenuItem>
                  {[1,2,3].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel>Разрядность второго множителя</FormLabel>
                <Select
                  value={(currentSettings as any).multiplyDigits2 ?? ''}
                  onChange={(e) => handleSettingsChange({ multiplyDigits2: (e.target.value === '' ? null : Number(e.target.value)) as any })}
                  displayEmpty
                >
                  <MenuItem value="">Авто</MenuItem>
                  {[1,2,3].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel>Разрядность третьего множителя</FormLabel>
                <Select
                  value={(currentSettings as any).multiplyDigits3 ?? ''}
                  onChange={(e) => handleSettingsChange({ multiplyDigits3: (e.target.value === '' ? null : Number(e.target.value)) as any })}
                  displayEmpty
                >
                  <MenuItem value="">Авто</MenuItem>
                  {[1,2,3].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <FormLabel>Разрядность делимого</FormLabel>
                <Select
                  value={(currentSettings as any).divisionDividendDigits ?? ''}
                  onChange={(e) => handleSettingsChange({ divisionDividendDigits: (e.target.value === '' ? null : Number(e.target.value)) as any })}
                  displayEmpty
                >
                  <MenuItem value="">Авто</MenuItem>
                  {[1,2,3,4,5,6].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel>Разрядность делителя</FormLabel>
                <Select
                  value={(currentSettings as any).divisionDivisorDigits ?? ''}
                  onChange={(e) => handleSettingsChange({ divisionDivisorDigits: (e.target.value === '' ? null : Number(e.target.value)) as any })}
                  displayEmpty
                >
                  <MenuItem value="">Авто</MenuItem>
                  {[1,2,3,4].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel>Разрядность второго делителя</FormLabel>
                <Select
                  value={(currentSettings as any).divisionSecondDivisorDigits ?? ''}
                  onChange={(e) => handleSettingsChange({ divisionSecondDivisorDigits: (e.target.value === '' ? null : Number(e.target.value)) as any })}
                  displayEmpty
                >
                  <MenuItem value="">Авто</MenuItem>
                  {[1,2,3,4].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </Box>
          {/* Количество примеров */}
          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Количество примеров: {currentSettings.totalProblems}</FormLabel>
              <Tooltip title="Сколько задач будет показано за одну сессию (1–100)"><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Slider
              value={currentSettings.totalProblems}
              onChange={(_, value) => setLocalOnly({ totalProblems: value as number })}
              onChangeCommitted={(_, value) => handleSettingsChange({ totalProblems: value as number })}
              min={1}
              max={100}
              step={1}
              valueLabelDisplay="auto"
              marks={[
                { value: 1, label: '1' },
                { value: 10, label: '10' },
                { value: 20, label: '20' },
                { value: 30, label: '30' },
                { value: 40, label: '40' },
                { value: 50, label: '50' },
                { value: 60, label: '60' },
                { value: 70, label: '70' },
                { value: 80, label: '80' },
                { value: 90, label: '90' },
                { value: 100, label: '100' },
              ]}
              sx={{ mt: 2 }}
            />
          </FormControl>

          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Количество чисел: {currentSettings.numbersCount}</FormLabel>
              <Tooltip title="Сколько чисел в одном примере (2–15). В последовательном режиме показываются по одному."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Slider
              value={currentSettings.numbersCount}
              onChange={(_, value) => setLocalOnly({ numbersCount: value as number })}
              onChangeCommitted={(_, value) => handleSettingsChange({ numbersCount: value as number })}
              min={2}
              max={currentSettings.operations.some(op => op === '*' || op === '/') ? 3 : 15}
              step={1}
              marks={Array.from({ length: 14 }, (_, i) => {
                const v = i + 2; // 2..15
                const major = [2,5,10,15].includes(v);
                return major ? { value: v, label: String(v) } : { value: v } as any;
              })}
              valueLabelDisplay="auto"
              sx={{ mt: 2 }}
            />
          </FormControl>

          {/* Третий знак для * и / (управление арностью для умножения/деления) */}
          {currentSettings.operations.length > 0 && currentSettings.operations.every(op => (op === '*' || op === '/')) && (
            <FormControl fullWidth>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormLabel>Третий знак для × и ÷</FormLabel>
                <Tooltip title="Если выключено — примеры на ×/÷ генерируются только с двумя числами. Если включено — с тремя."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
              </Box>
              <Select
                value={currentSettings.numbersCount >= 3 ? 'yes' : 'no'}
                onChange={(e) => {
                  const wantThree = e.target.value === 'yes';
                  handleSettingsChange({ numbersCount: wantThree ? 3 : 2 });
                }}
              >
                <MenuItem value="no">Нет, только 2 числа</MenuItem>
                <MenuItem value="yes">Да, 3 числа</MenuItem>
              </Select>
            </FormControl>
          )}
          
          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Диапазон чисел</FormLabel>
              <Tooltip title="Максимум и минимум для генерируемых чисел."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Select
              value={`${currentSettings.numberRange}:${currentSettings.numberRangeMin}`}
              onChange={(e) => {
                const [maxStr, minStr] = String(e.target.value).split(':');
                handleSettingsChange({ numberRange: parseInt(maxStr, 10), numberRangeMin: parseInt(minStr, 10) });
              }}
            >
              <MenuItem value={`9:1`}>1-9</MenuItem>
              <MenuItem value={`99:1`}>1-99</MenuItem>
              <MenuItem value={`999:1`}>1-999</MenuItem>
              <MenuItem value={`999999:1`}>1-999999</MenuItem>
            </Select>
          </FormControl>
          
          {/* Режим законов */}
          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Режим законов</FormLabel>
              <Tooltip title="Законы на 5/10 — специальные примеры для тренировки правил сложения/вычитания."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Select
              value={currentSettings.lawsMode}
              onChange={(e) => handleSettingsChange({ lawsMode: e.target.value as LawsMode })}
            >
              <MenuItem value="none">Стандартные примеры</MenuItem>
              <MenuItem value="five">Законы на 5</MenuItem>
              <MenuItem value="ten">Законы на 10</MenuItem>
              <MenuItem value="both">Законы на 5 и 10</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              При законах операции × и ÷ недоступны, примеры генерируются со смешением +/−. Для «на 10» чаще используются десятки/сотни.
            </Typography>
          </FormControl>

          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Скорость показа: {currentSettings.displaySpeed} мс</FormLabel>
              <Tooltip title="Время показа одного шага/строки. Меньше — быстрее."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Slider
              value={currentSettings.displaySpeed}
              onChange={(_, value) => setLocalOnly({ displaySpeed: value as number })}
              onChangeCommitted={(_, value) => handleSettingsChange({ displaySpeed: value as number })}
              min={100}
              max={10000}
              step={100}
              marks={[
                { value: 500, label: '0.5с' },
                { value: 1000, label: '1с' },
                { value: 2000, label: '2с' },
                { value: 3000, label: '3с' },
                { value: 4000, label: '4с' },
                { value: 5000, label: '5с' },
                { value: 6000, label: '6с' },
                { value: 7000, label: '7с' },
                { value: 8000, label: '8с' },
                { value: 9000, label: '9с' },
                { value: 10000, label: '10с' },
              ]}
              valueLabelDisplay="auto"
            />
          </FormControl>

          {/* Паузы */}
          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Пауза перед стартом: {(currentSettings as any).preStartPause}s</FormLabel>
              <Tooltip title="Задержка перед началом показа — чтобы подготовиться."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Slider
              value={(currentSettings as any).preStartPause}
              onChange={(_, value) => setLocalOnly({ preStartPause: value as number } as any)}
              onChangeCommitted={(_, value) => handleSettingsChange({ preStartPause: value as number })}
              min={0}
              max={60}
              step={1}
              marks={[
                { value: 0, label: '0с' },
                { value: 5, label: '5с' },
                { value: 10, label: '10с' },
                { value: 20, label: '20с' },
                { value: 30, label: '30с' },
                { value: 40, label: '40с' },
                { value: 50, label: '50с' },
                { value: 60, label: '60с' },
              ]}
              valueLabelDisplay="auto"
            />
          </FormControl>

          {/* Показывать ответы */}
          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Показывать ответы</FormLabel>
              <Tooltip title="Показывать правильный ответ между примерами, затем автоматически переходить дальше."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Select
              value={(currentSettings as any).showAnswer ? 'yes' : 'no'}
              onChange={(e) => handleSettingsChange({ showAnswer: e.target.value === 'yes' } as any)}
            >
              <MenuItem value="no">Нет</MenuItem>
              <MenuItem value="yes">Да</MenuItem>
            </Select>
          </FormControl>

            <FormControl fullWidth>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormLabel>Время для ответа: {(currentSettings as any).answerPause}s</FormLabel>
                <Tooltip title="Автоматическая отправка ответа по истечении времени."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
              </Box>
              <Slider
                value={(currentSettings as any).answerPause}
                onChange={(_, value) => setLocalOnly({ answerPause: value as number } as any)}
                onChangeCommitted={(_, value) => handleSettingsChange({ answerPause: value as number })}
                min={0}
                max={120}
                step={1}
                marks={[
                  0,5,10,20,30,40,50,60,70,80,90,100,110,120
                ].map(v => ({ value: v, label: `${v}с` }))}
                valueLabelDisplay="auto"
              />
            </FormControl>

            <FormControl fullWidth>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormLabel>Пауза показа результата: {(currentSettings as any).resultPause}s</FormLabel>
                <Tooltip title="Сколько времени держать результат перед переходом к следующему примеру."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
              </Box>
              <Slider
                value={(currentSettings as any).resultPause}
                onChange={(_, value) => setLocalOnly({ resultPause: value as number } as any)}
                onChangeCommitted={(_, value) => handleSettingsChange({ resultPause: value as number })}
                min={0}
                max={60}
                step={1}
                marks={[0,5,10,20,30,40,50,60].map(v => ({ value: v, label: `${v}с` }))}
                valueLabelDisplay="auto"
              />
            </FormControl>
          
          <Box>
            <FormLabel>Операции:</FormLabel>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {['+', '-', '*', '/'].map((op) => {
                const lawsOn = (currentSettings as any).lawsMode && (currentSettings as any).lawsMode !== 'none';
                const disabled = lawsOn && (op === '*' || op === '/');
                const selected = currentSettings.operations.includes(op);
                return (
                  <Chip
                    key={op}
                    label={op}
                    color={disabled ? 'default' : undefined}
                    icon={selected ? <CheckCircleRounded /> : undefined}
                    variant={selected ? 'filled' : 'outlined'}
                    onClick={() => {
                      if (disabled) return; // блокируем выбор при включённых законах
                      const newOps = selected
                        ? currentSettings.operations.filter((o: string) => o !== op)
                        : [...currentSettings.operations, op];
                      if (newOps.length > 0) {
                        handleSettingsChange({ operations: newOps });
                      }
                    }}
                    sx={{
                      // Делаем выбор очевидным: крупнее, контрастнее, с галочкой и чётким бордером
                      height: 44,
                      minWidth: 54,
                      px: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      borderRadius: 999,
                      transition: 'transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease, border-color 120ms ease',
                      ...(disabled ? { opacity: 0.4, pointerEvents: 'none' } : {}),
                      ...(selected ? {
                        bgcolor: 'primary.main',
                        color: '#fff',
                        border: '2px solid',
                        borderColor: 'primary.dark',
                        boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
                        transform: 'translateY(-1px)',
                        '& .MuiChip-icon': { color: '#fff', ml: 0.5 },
                      } : {
                        bgcolor: 'transparent',
                        border: '2px solid',
                        borderColor: 'rgba(0,0,0,0.28)',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'rgba(25, 118, 210, 0.06)',
                        },
                      }),
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Два экрана (локально вдвоём) */}
          <FormControl fullWidth>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <FormLabel>Режим «Два экрана»</FormLabel>
              <Tooltip title="Два независимых поля ответа на одном устройстве (соревновательный режим)."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Select
              value={(currentSettings as any).twoScreens ? 'yes' : 'no'}
              onChange={(e) => handleSettingsChange({ twoScreens: e.target.value === 'yes' } as any)}
            >
              <MenuItem value="no">Нет</MenuItem>
              <MenuItem value="yes">Да</MenuItem>
            </Select>
          </FormControl>
          
          {/* Визуальные опции */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Визуализация</FormLabel>
              <Tooltip title="Настройки внешнего вида чисел: размер, случайные позиция и цвет."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <FormLabel>Размер шрифта</FormLabel>
                <Select
                  value={(currentSettings as any).fontScale ?? 1}
                  onChange={(e) => handleSettingsChange({ fontScale: e.target.value as number })}
                >
                  {[1,1.25,1.5,1.75,2].map(s => (
                    <MenuItem key={s} value={s}>{s}x</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel>Случайная позиция</FormLabel>
                <Select
                  value={(currentSettings as any).randomPosition ? 'yes' : 'no'}
                  onChange={(e) => handleSettingsChange({ randomPosition: e.target.value === 'yes' })}
                >
                  <MenuItem value="no">Нет</MenuItem>
                  <MenuItem value="yes">Да</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel>Случайный цвет</FormLabel>
                <Select
                  value={(currentSettings as any).randomColor ? 'yes' : 'no'}
                  onChange={(e) => handleSettingsChange({ randomColor: e.target.value === 'yes' })}
                >
                  <MenuItem value="no">Нет</MenuItem>
                  <MenuItem value="yes">Да</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <FormControl sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormLabel>Показывать действия последовательно</FormLabel>
                <Tooltip title="Показывать числа по одному шагу (число → знак и число → ...)"><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
              </Box>
              <Select
                value={(currentSettings as any).sequentialDisplay ? 'yes' : 'no'}
                onChange={(e) => handleSettingsChange({ sequentialDisplay: e.target.value === 'yes' })}
              >
                <MenuItem value="no">Нет</MenuItem>
                <MenuItem value="yes">Да</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormLabel>Режим отображения</FormLabel>
              <Tooltip title="Цифры — обычная запись, Абакус — визуализация на счётах."><InfoOutlined fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
            </Box>
            <Select
              value={currentSettings.displayMode}
              onChange={(e) => handleSettingsChange({ displayMode: e.target.value as 'digits' | 'abacus' })}
            >
              <MenuItem value="digits">Цифры</MenuItem>
              <MenuItem value="abacus">Абакус</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setState(prev => ({ ...prev, showSettings: false }))}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (checkingAccess) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!guestAllowed) {
    return (
      <Box sx={{ p: 3, maxWidth: '800px', mx: 'auto' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            {isAuthenticated ? 'Тренажёр доступен только с активной подпиской' : 'Бесплатный доступ к тренажёру уже использован'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {isAuthenticated
              ? 'Оформите или продлите подписку, чтобы продолжить занятия в тренажёре и абакусе.'
              : 'Войдите в аккаунт или оформите подписку, чтобы продолжить занятия.'}
          </Typography>
          {isAuthenticated ? (
            <Button variant="contained" href="/pricing">Перейти к тарифам</Button>
          ) : (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="contained" href="/login">Войти</Button>
              <Button variant="outlined" href="/pricing">Тарифы</Button>
            </Stack>
          )}
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      {/* Заголовок */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
          🧮 Числовой тренажёр
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Тренируйте ментальную арифметику с визуализацией абакуса
        </Typography>
        {!isAuthenticated && guestAllowed && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Гостевой доступ активен{expiresAt ? ` до ${new Date(expiresAt).toLocaleTimeString()}` : ''}{guestUsed !== null ? ` · Использовано: ${guestUsed}` : ''}
          </Typography>
        )}
      </Box>

      {/* Основной контент */}
      {!state.isTraining ? (
        <Box sx={{ textAlign: 'center' }}>
          <Paper sx={{ p: 4, mb: 3, maxWidth: '600px', mx: 'auto' }}>
            <Calculate sx={{ fontSize: 60, color: theme.palette.primary.main, mb: 2 }} />
            
            <Typography variant="h5" sx={{ mb: 3 }}>
              Готовы начать тренировку?
            </Typography>
            
            <Stack direction="row" spacing={1} sx={{ mb: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip label={`${currentSettings.numbersCount} чисел`} />
              <Chip label={`Диапазон: 1-${currentSettings.numberRange}`} />
              <Chip label={`Операции: ${currentSettings.operations.join(', ')}`} />
              <Chip label={`${currentSettings.displaySpeed}мс`} />
            </Stack>
            
            <Box>
              <Button
                variant="contained"
                size="large"
                onClick={startTraining}
                startIcon={<PlayArrow />}
                sx={{ mr: 2 }}
              >
                Начать тренировку
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                onClick={() => setState(prev => ({ ...prev, showSettings: true }))}
                startIcon={<Settings />}
              >
                Настройки
              </Button>
              <Button
                variant="text"
                size="large"
                onClick={() => setShowHelp(true)}
                sx={{ ml: 1 }}
              >
                ℹ️ Помощь
              </Button>
            </Box>
          </Paper>

          {/* Быстрый старт отключён по просьбе пользователя */}

          {/* Статистика пользователя (из UserContext) */}
          {(userStats || user?.stats) && (
            <Paper sx={{ p: 3, maxWidth: '600px', mx: 'auto' }}>
              <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                📊 Ваша статистика
              </Typography>
              
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2} sx={{ justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                  <Typography variant="h6" color="primary">
                    {(userStats?.totalExercises ?? user?.stats?.totalExercises) || 0}
                  </Typography>
                  <Typography variant="body2">
                    Кол-во примеров
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                  <Typography variant="h6" color="primary">
                    {(userStats?.correctAnswers ?? user?.stats?.correctAnswers) || 0}
                  </Typography>
                  <Typography variant="body2">
                    Правильных
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                  <Typography variant="h6" color="primary">
                    {((userStats?.bestAccuracy ?? user?.stats?.bestAccuracy) ?? 0).toFixed ? ((userStats?.bestAccuracy ?? user?.stats?.bestAccuracy) as number).toFixed(1) : (userStats?.bestAccuracy ?? user?.stats?.bestAccuracy ?? 0)}%
                  </Typography>
                  <Typography variant="body2">
                    Точность (лучшая)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                  <Typography variant="h6" color="primary">
                    {(userStats?.level ?? user?.stats?.level) || 1}
                  </Typography>
                  <Typography variant="body2">
                    Уровень
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}
        </Box>
      ) : (
        <Box>
          {/* Прогресс тренировки */}
          {state.currentSession && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Задача {state.currentSession.currentProblemIndex + 1} из {state.currentSession.problems.length}
                </Typography>
                
                <Box>
                  <IconButton onClick={stopTraining}>
                    <Stop />
                  </IconButton>
                </Box>
              </Box>
              
              <LinearProgress
                variant="determinate"
                value={(state.currentSession.currentProblemIndex / state.currentSession.problems.length) * 100}
                sx={{ mt: 1 }}
              />
            </Paper>
          )}
          
          {/* Контент тренировки */}
          <Paper sx={{ p: 4, minHeight: '400px' }}>
            {state.currentStep === 'prestart' && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  Подготовьтесь…
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Показ начнётся через {(Math.ceil((state.preStartTimeLeft || 0)/1000))} c
                </Typography>
                <LinearProgress sx={{ maxWidth: 360, mx: 'auto' }} />
              </Box>
            )}
            {state.currentStep !== 'prestart' && (
              <>
                {state.currentStep === 'result' ? (
                  renderResults()
                ) : state.currentStep === 'result_pause' ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    {(currentSettings as any).twoScreens ? (
                      <Stack spacing={1} sx={{ mb: 2 }} alignItems="center">
                        <Typography variant="h5" sx={{ color: theme.palette.info.main }}>
                          Игрок A: правильный ответ {state.currentProblem?.correctAnswer}
                        </Typography>
                        <Typography variant="h5" sx={{ color: theme.palette.info.main }}>
                          Игрок B: правильный ответ {((state.currentProblem as any)?.correctAnswerB ?? state.currentProblem?.correctAnswer)}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="h4" sx={{ mb: 2, color: theme.palette.info.main }}>
                        Правильный ответ: {state.currentProblem?.correctAnswer}
                      </Typography>
                    )}
                    {(currentSettings as any).twoScreens && (
                      <Stack direction="row" spacing={2} justifyContent="center">
                        <Chip label={`A: ${state.currentProblem?.userAnswer} ${state.currentProblem?.isCorrect ? '✅' : '❌'}`} color={state.currentProblem?.isCorrect ? 'success' : 'error'} />
                        <Chip label={`B: ${(state.currentProblem as any)?.userAnswerB ?? ''} ${((state.currentProblem as any)?.isCorrectB ? '✅' : '❌')}`} color={((state.currentProblem as any)?.isCorrectB ? 'success' : 'error')} />
                      </Stack>
                    )}
                    {!(currentSettings as any).twoScreens && (
                      <Chip label={`${state.currentProblem?.isCorrect ? 'Правильно' : 'Неправильно'}`} color={state.currentProblem?.isCorrect ? 'success' : 'error'} sx={{ mt: 2 }} />
                    )}
                  </Box>
                ) : (
                  renderCurrentProblem()
                )}
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* Настройки */}
      {renderSettings()}

      {/* Диалог помощи */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Как тренироваться</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            1) Выберите режим: цифры или абакус. 2) Задайте количество примеров и чисел в примере.
            3) Выберите диапазон, операции и скорость. 4) Включите последовательный показ, если нужно.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Советы: используйте паузу перед стартом для концентрации; увеличивайте шрифт или включайте случайный
            цвет/позицию для усложнения; историю и результаты смотрите в разделе Статистика → История.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Понятно</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrainerPage; 