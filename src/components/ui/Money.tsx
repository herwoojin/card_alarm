import { won } from '@/lib/format';

interface MoneyProps {
  /** 원 단위 정수 */
  value: number;
  /** 뒤에 붙는 단위. 기본 '원' */
  suffix?: string;
  className?: string;
}

/**
 * 금액 표시 컴포넌트. 전 화면의 독립 금액 표기는 이 컴포넌트를 거친다.
 * tabular-nums로 자릿수를 정렬하고, aria-label에 "원"을 포함해 스크린리더에서 자연스럽게 읽힌다.
 */
export function Money({ value, suffix = '원', className }: MoneyProps) {
  const rounded = Math.round(value || 0);
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const label = `${neg ? '마이너스 ' : ''}${won(abs)}${suffix}`;
  return (
    <span className={`num${className ? ' ' + className : ''}`} aria-label={label}>
      {neg ? '-' : ''}
      {won(abs)}
      {suffix ? <span aria-hidden="true">{suffix}</span> : null}
    </span>
  );
}
