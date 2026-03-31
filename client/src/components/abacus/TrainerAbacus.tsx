import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Типы данных
interface AbacusColumn {
  upper: boolean;  // верхняя костяшка (значение 5)
  lower: number;   // количество активных нижних костяшек (0-4)
}

interface TrainerAbacusProps {
  value: number;
  showValue?: boolean;
  animationSpeed?: number;
  style?: React.CSSProperties;
}

// Адаптивные размеры для тренера (более компактный)
const getTrainerSizes = (columnsCount: number, isMobile: boolean) => {
  const baseMultiplier = isMobile ? 0.5 : 0.7;
  const columnMultiplier = Math.max(0.7, Math.min(1.0, 7 / columnsCount));
  
  return {
    frameWidth: Math.min(85, Math.max(50, columnsCount * 8)) + '%',
    framePadding: isMobile ? '15px 10px' : '20px 15px',
    rodHeight: (isMobile ? 200 : 240) * baseMultiplier * columnMultiplier,
    rodWidth: Math.max(3, 5 * columnMultiplier),
    beadUpperWidth: Math.max(24, 36 * columnMultiplier * baseMultiplier),
    beadUpperHeight: Math.max(14, 20 * columnMultiplier * baseMultiplier),
    beadLowerWidth: Math.max(20, 32 * columnMultiplier * baseMultiplier),
    beadLowerHeight: Math.max(12, 16 * columnMultiplier * baseMultiplier),
    columnGap: Math.max(6, 12 * columnMultiplier),
    upperSectionHeight: (isMobile ? 60 : 80) * baseMultiplier * columnMultiplier,
    lowerSectionHeight: (isMobile ? 90 : 120) * baseMultiplier * columnMultiplier,
    crossbeamHeight: Math.max(6, 8 * columnMultiplier),
    fontSize: Math.max(0.6, 0.8 * columnMultiplier * baseMultiplier),
  };
};

// Стилизованные компоненты
const AbacusFrame = styled(Box)<{ adaptiveSizes: any }>(({ adaptiveSizes }) => ({
  background: `
    linear-gradient(135deg, 
      #8B4513 0%, 
      #A0522D 15%, 
      #CD853F 30%, 
      #8B4513 45%, 
      #654321 60%, 
      #4A4A4A 85%, 
      #2F2F2F 100%
    )
  `,
  borderRadius: '15px',
  padding: adaptiveSizes.framePadding,
  width: '100%',
  maxWidth: '500px',
  margin: '0 auto',
  position: 'relative',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: adaptiveSizes.rodHeight + 60,
  overflow: 'hidden',
}));

const Crossbeam = styled(Box)<{ adaptiveSizes: any }>(({ adaptiveSizes }) => ({
  width: '95%',
  height: adaptiveSizes.crossbeamHeight,
  background: 'linear-gradient(90deg, #4A4A4A 0%, #2F2F2F 50%, #4A4A4A 100%)',
  borderRadius: `${adaptiveSizes.crossbeamHeight / 2}px`,
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 5,
  boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
}));

const Rod = styled(Box)<{ adaptiveSizes: any }>(({ adaptiveSizes }) => ({
  width: adaptiveSizes.rodWidth,
  height: adaptiveSizes.rodHeight,
  background: 'linear-gradient(180deg, #C0C0C0 0%, #808080 100%)',
  borderRadius: `${adaptiveSizes.rodWidth / 2}px`,
  position: 'relative',
  boxShadow: 'inset 0 0 3px rgba(0,0,0,0.3)',
}));

const Bead = styled(Box)<{ 
  adaptiveSizes: any; 
  isUpper: boolean; 
  isActive: boolean;
  beadPosition: number;
}>(({ adaptiveSizes, isUpper, isActive, beadPosition }) => ({
  width: isUpper ? adaptiveSizes.beadUpperWidth : adaptiveSizes.beadLowerWidth,
  height: isUpper ? adaptiveSizes.beadUpperHeight : adaptiveSizes.beadLowerHeight,
  background: isActive 
    ? (isUpper 
        ? 'linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 50%, #FF6B6B 100%)'
        : 'linear-gradient(135deg, #4ECDC4 0%, #81D4D4 50%, #4ECDC4 100%)')
    : 'linear-gradient(135deg, #F0F0F0 0%, #D0D0D0 50%, #F0F0F0 100%)',
  borderRadius: '50%',
  position: 'absolute' as const,
  left: '50%',
  transform: 'translateX(-50%)',
  cursor: 'default',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: isActive 
    ? '0 3px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)' 
    : '0 2px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.5)',
  top: `${beadPosition}px`,
  border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
  zIndex: 10,
}));

const TrainerAbacus: React.FC<TrainerAbacusProps> = ({ 
  value, 
  showValue = true, 
  animationSpeed = 300,
  style 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [columns, setColumns] = useState<AbacusColumn[]>([]);

  // Определяем количество колонок на основе значения - мемоизировано
  const columnsCount = useMemo(() => {
    return Math.max(3, Math.abs(value).toString().length);
  }, [value]);
  
  // Адаптивные размеры - стабилизированные
  const adaptiveSizes = useMemo(() => 
    getTrainerSizes(columnsCount, isMobile), 
    [columnsCount, isMobile]
  );

  // Дополнительное масштабирование для больших разрядов.
  // Даже если размеры уже "компактные", минимальные bead размеры могут не дать поместиться на рамку.
  const scale = useMemo(() => {
    const base = isMobile ? 5 / columnsCount : 7 / columnsCount;
    return Math.max(0.55, Math.min(1, base));
  }, [columnsCount, isMobile]);

  // Конвертация числа в состояние абакуса - мемоизированная функция
  const numberToAbacus = useCallback((num: number, colCount: number): AbacusColumn[] => {
    const numStr = Math.abs(num).toString().padStart(colCount, '0');
    return numStr.split('').map(digitStr => {
      const digit = parseInt(digitStr);
      return {
        upper: digit >= 5,
        lower: digit % 5,
      };
    });
  }, []);

  // Обновление состояния абакуса при изменении значения
  useEffect(() => {
    const newColumns = numberToAbacus(value, columnsCount);
    setColumns(newColumns);
  }, [value, columnsCount, numberToAbacus]);

  // Рендер одной колонки - мемоизированная функция
  const renderColumn = useCallback((column: AbacusColumn, columnIndex: number) => {
    const columnKey = `column-${columnIndex}`;
    
    // Позиции костяшек
    const upperBeadActiveTop = adaptiveSizes.crossbeamHeight + 5;
    const upperBeadInactiveTop = 5;
    const lowerBeadActiveTop = adaptiveSizes.upperSectionHeight + adaptiveSizes.crossbeamHeight + 5;
    const lowerBeadInactiveTop = adaptiveSizes.upperSectionHeight + adaptiveSizes.crossbeamHeight + 
      adaptiveSizes.lowerSectionHeight - adaptiveSizes.beadLowerHeight - 5;

    return (
      <Box key={columnKey} sx={{ position: 'relative', mx: 0.5 }}>
        <Rod adaptiveSizes={adaptiveSizes}>
          {/* Верхняя костяшка */}
          <Bead
            adaptiveSizes={adaptiveSizes}
            isUpper={true}
            isActive={column.upper}
            beadPosition={column.upper ? upperBeadActiveTop : upperBeadInactiveTop}
          />
          
          {/* Нижние костяшки */}
          {[0, 1, 2, 3].map((beadIndex) => (
            <Bead
              key={`lower-${beadIndex}`}
              adaptiveSizes={adaptiveSizes}
              isUpper={false}
              isActive={beadIndex < column.lower}
              beadPosition={
                beadIndex < column.lower
                  ? lowerBeadActiveTop + beadIndex * (adaptiveSizes.beadLowerHeight + 2)
                  : lowerBeadInactiveTop - (3 - beadIndex) * (adaptiveSizes.beadLowerHeight + 2)
              }
            />
          ))}
        </Rod>
        
        {/* Подпись позиции */}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: -25,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `${adaptiveSizes.fontSize}rem`,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 'bold',
          }}
        >
          {columns.length <= 6 ? Math.pow(10, columns.length - 1 - columnIndex) : ''}
        </Typography>
      </Box>
    );
  }, [adaptiveSizes, columns.length]);

  return (
    <Box sx={{ ...style, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Отображаемое значение */}
      {showValue && (
        <Typography 
          variant="h4" 
          sx={{ 
            mb: 2, 
            fontWeight: 'bold', 
            color: theme.palette.primary.main,
            textAlign: 'center',
          }}
        >
          {value}
        </Typography>
      )}

      {/* Абакус */}
      <Paper elevation={8} sx={{ overflow: 'hidden', borderRadius: '20px' }}>
        <AbacusFrame adaptiveSizes={adaptiveSizes}>
          <Crossbeam adaptiveSizes={adaptiveSizes} />
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start',
            gap: `${adaptiveSizes.columnGap}px`,
            position: 'relative',
            zIndex: 10,
            mt: 1,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}>
            {columns.map((column, columnIndex) => renderColumn(column, columnIndex))}
          </Box>
        </AbacusFrame>
      </Paper>
    </Box>
  );
};

export default TrainerAbacus; 