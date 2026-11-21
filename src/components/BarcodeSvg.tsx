import React, { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { encodeCode128B } from '../utils/barcode.ts';

interface BarcodeSvgProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  height = 38,
  showText = true,
  className = '',
}) => {
  const encoded = useMemo(() => encodeCode128B(value || 'ITM000000'), [value]);

  return (
    <div className={`inline-flex flex-col items-center bg-white px-2 py-1 rounded border border-slate-200 ${className}`}>
      <svg
        viewBox={`0 0 ${encoded.totalWidth} ${height}`}
        className="w-full max-w-[170px] h-auto block"
        role="img"
        aria-label={`Barcode ${value}`}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={encoded.totalWidth} height={height} fill="#FFFFFF" />
        {encoded.bars.map((bar, idx) => (
          <rect
            key={`${bar.x}-${idx}`}
            x={bar.x}
            y={2}
            width={bar.width}
            height={height - 4}
            fill="#0F172A"
          />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-800 mt-0.5 tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
};

interface ProductImageProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProductImage: React.FC<ProductImageProps> = ({ src, alt, size = 'md' }) => {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-10 h-10 rounded-md'
      : size === 'lg'
        ? 'w-24 h-24 rounded-lg'
        : 'w-12 h-12 rounded-lg';

  if (!src || failed) {
    return (
      <div
        className={`${dims} shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400`}
        title={alt}
      >
        <Package className={size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dims} shrink-0 object-cover border border-slate-200 bg-slate-50`}
    />
  );
};
