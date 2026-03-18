'use client';
import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface AccuracyGaugeProps {
  score: number;
  animated?: boolean;
  size?: number;
}

function getGaugeColor(score: number): string {
  if (score >= 85) return '#538d4e';
  if (score >= 70) return '#6aaa64';
  if (score >= 55) return '#b59f3b';
  if (score >= 40) return '#e67e22';
  return '#e74c3c';
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const start = {
    x: cx + r * Math.cos(toRad(startAngle)),
    y: cy + r * Math.sin(toRad(startAngle)),
  };
  const end = {
    x: cx + r * Math.cos(toRad(endAngle)),
    y: cy + r * Math.sin(toRad(endAngle)),
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function AccuracyGauge({
  score,
  animated = true,
  size = 160,
}: AccuracyGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const thickness = 14;

  // Arc goes from 135deg to 405deg (270deg sweep)
  const startAngle = 135;
  const totalSweep = 270;

  const bgPath = describeArc(cx, cy, r, startAngle, startAngle + totalSweep);

  const circumference = (totalSweep / 360) * 2 * Math.PI * r;

  const color = getGaugeColor(score);

  // Animated display number
  const displayScore = useMotionValue(animated ? 0 : score);
  const springScore = useSpring(displayScore, { damping: 30, stiffness: 80 });
  const roundedScore = useTransform(springScore, (v) => Math.round(v));
  const [displayNum, setDisplayNum] = useState(animated ? 0 : score);

  useEffect(() => {
    const unsub = roundedScore.on('change', (v) => setDisplayNum(v));
    return unsub;
  }, [roundedScore]);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        displayScore.set(score);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [score, animated, displayScore]);

  // Animated stroke dashoffset
  const fillRatio = score / 100;
  const dashOffset = circumference * (1 - fillRatio);

  return (
    <div
      className="flex flex-col items-center"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Accuracy: ${score}%`}
      aria-valuetext={`Accuracy: ${score} percent`}
    >
      <svg width={size} height={size}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="#1e1f23"
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <motion.path
          d={bgPath}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
        {/* Center text */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {displayNum}
        </text>
        <text
          x={cx}
          y={cy + size * 0.14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#9ba1a6"
          fontSize={size * 0.085}
          fontFamily="Inter, sans-serif"
        >
          Accuracy
        </text>
      </svg>
    </div>
  );
}
