// Icon.jsx
// Wrapper CondoDesk sopra @solar-icons/react-perf (stile LineDuotone).
import React from 'react';

const SIZE_MAP = {
  sm: 16,
  md: 20,
  lg: 24,
};

export default function Icon({
  icon: SolarIcon,
  size = 'md',
  color = 'currentColor',
  disabled = false,
  className = '',
  ...rest
}) {
  if (!SolarIcon) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Icon: prop "icon" mancante o non valida.');
    }
    return null;
  }

  const resolvedSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? SIZE_MAP.md;
  const resolvedColor = disabled ? 'var(--gray-400, #9ca3af)' : color;

  return (
    <SolarIcon
      size={resolvedSize}
      color={resolvedColor}
      className={className}
      aria-hidden="true"
      {...rest}
    />
  );
}
