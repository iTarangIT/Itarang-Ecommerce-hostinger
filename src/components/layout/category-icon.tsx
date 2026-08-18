import { BatteryCharging, Layers, Server, Zap } from 'lucide-react';
import type { ProductArtKind } from '@/lib/commerce/types';
import { cn } from '@/lib/utils';

const ICONS = {
  inverter: Zap,
  battery: BatteryCharging,
  ups: Server,
  combo: Layers,
} as const;

export function CategoryIcon({
  kind,
  className,
}: {
  kind: ProductArtKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon className={cn('h-5 w-5', className)} aria-hidden="true" />;
}
