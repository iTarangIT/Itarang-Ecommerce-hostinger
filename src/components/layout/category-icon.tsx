import { BatteryCharging, Layers, PlugZap, Server, Zap } from 'lucide-react';
import type { CategoryIconKind } from '@/lib/commerce/types';
import { cn } from '@/lib/utils';

const ICONS = {
  inverter: Zap,
  battery: BatteryCharging,
  ups: Server,
  combo: Layers,
  charger: PlugZap,
} as const;

export function CategoryIcon({
  kind,
  className,
}: {
  kind: CategoryIconKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon className={cn('h-5 w-5', className)} aria-hidden="true" />;
}
