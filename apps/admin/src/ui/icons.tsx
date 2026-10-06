import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const PlusIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PencilIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const MenuIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Points to the "next" side. Mirrored in RTL by the caller (rtl:-scale-x-100). */
export const ChevronNextIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const GlobeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
  </svg>
);

/** Sign-out arrow leaves the door toward the "end" side; mirrored in RTL by the caller. */
export const SignOutIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M13 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" />
    <path d="M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5" />
  </svg>
);

export const AlertIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const SpinnerIcon = (props: IconProps) => (
  <svg {...base(props)} className={`animate-spin ${props.className ?? ''}`}>
    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
  </svg>
);
