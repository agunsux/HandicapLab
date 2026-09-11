import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show brand text alongside mark */
  showText?: boolean;
  /** CSS className override */
  className?: string;
}

const sizeMap = {
  sm: { mark: 24, text: 'text-sm' },
  md: { mark: 32, text: 'text-base' },
  lg: { mark: 48, text: 'text-xl' },
} as const;

/**
 * Centralized HandicapLab brand logo component.
 * References the official user-uploaded logo asset: /brand/logo.png
 * Preserves native 1:1 aspect ratio with no crop, stretch, or distortion.
 */
export function BrandLogo({ size = 'md', showText = true, className = '' }: BrandLogoProps) {
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/brand/logo.png"
        alt="HandicapLab"
        width={s.mark}
        height={s.mark}
        className="aspect-square object-contain shrink-0"
        priority
      />
      {showText && (
        <span className={`font-display font-bold tracking-tight text-[#F0F4F8] ${s.text}`}>
          HandicapLab<span className="font-normal text-[#64748B]">.dev</span>
        </span>
      )}
    </span>
  );
}
