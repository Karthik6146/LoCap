'use client';

import { HTMLAttributes, forwardRef } from 'react';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={`card ${className}`} {...rest}>{children}</div>
  ),
);
Card.displayName = 'Card';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={`p-6 ${className}`} {...rest}>{children}</div>
  ),
);
CardContent.displayName = 'CardContent';