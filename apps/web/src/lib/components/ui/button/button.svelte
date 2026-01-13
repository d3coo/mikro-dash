<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  export const buttonVariants = tv({
    base: 'btn cursor-pointer',
    variants: {
      variant: {
        default: 'btn-primary',
        destructive: 'btn-danger',
        outline: 'btn-secondary',
        secondary: 'btn-secondary',
        ghost: 'btn-ghost',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline p-0'
      },
      size: {
        default: 'h-11 px-6',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10 p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
  export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
  export type ButtonProps = HTMLButtonAttributes & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  };
</script>

<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    class: className,
    variant = 'default',
    size = 'default',
    children,
    ...restProps
  }: ButtonProps & { children?: import('svelte').Snippet } = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
  {@render children?.()}
</button>
