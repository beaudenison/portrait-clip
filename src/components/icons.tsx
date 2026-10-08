import type { ReactNode } from "react";

type IconProps = { size?: number };

function Svg({
  size = 14,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconPlay() {
  return (
    <Svg size={12}>
      <path d="M4.2 2.4v11.2L13.4 8 4.2 2.4z" fill="currentColor" />
    </Svg>
  );
}

export function IconPause() {
  return (
    <Svg size={12}>
      <path d="M3.5 2.5h3v11h-3v-11zm6 0h3v11h-3v-11z" fill="currentColor" />
    </Svg>
  );
}

export function IconVolume() {
  return (
    <Svg>
      <path
        d="M2.5 6.2h2.2L8 3.4v9.2L4.7 9.8H2.5V6.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 6.1a2.6 2.6 0 0 1 0 3.8M11.8 4.6a4.6 4.6 0 0 1 0 6.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconMute() {
  return (
    <Svg>
      <path
        d="M2.5 6.2h2.2L8 3.4v9.2L4.7 9.8H2.5V6.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M11 6.2l3.2 3.6M14.2 6.2L11 9.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconEye() {
  return (
    <Svg>
      <path
        d="M1.6 8S4 3.8 8 3.8 14.4 8 14.4 8 12 12.2 8 12.2 1.6 8 1.6 8z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    </Svg>
  );
}

export function IconEyeOff() {
  return (
    <Svg>
      <path
        d="M2.2 3.2l11.6 9.6M6.4 6.6A2 2 0 0 0 9.5 9.7M4 5.2C2.6 6.2 1.6 8 1.6 8S4 12.2 8 12.2c.8 0 1.5-.2 2.2-.5M7.2 3.9c.3 0 .5 0 .8-.1 4 0 6.4 4.2 6.4 4.2s-.5.9-1.4 1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconClose() {
  return (
    <Svg size={12}>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconGear() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}
