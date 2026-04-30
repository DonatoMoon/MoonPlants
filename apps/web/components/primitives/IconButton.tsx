import { type ComponentProps, type ComponentType, type SVGProps } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ButtonProps = ComponentProps<typeof Button>;

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  showTooltip?: boolean;
  size?: ButtonProps['size'];
}

export function IconButton({
  icon: Icon,
  label,
  showTooltip = true,
  size = 'icon',
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  const btn = (
    <Button size={size} variant={variant} aria-label={label} {...props}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
  if (!showTooltip) return btn;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
