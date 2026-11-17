import { Building2 } from 'lucide-react';

interface LogoSlotProps {
  logoUrl: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'navy';
}

export function LogoSlot({ logoUrl, size = 'md', variant = 'light' }: LogoSlotProps) {
  const dim =
    size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-20 h-20' : 'w-11 h-11';

  if (logoUrl) {
    return (
      <div
        className={`${dim} rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 p-1`}
      >
        <img
          src={logoUrl}
          alt="Logo Resmi BAPPEDA Kabupaten Sidoarjo"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      title="Slot Logo Resmi BAPPEDA (Dapat diunggah oleh Administrator pada menu Pengaturan)"
      className={`${dim} rounded-lg border border-dashed flex flex-col items-center justify-center shrink-0 ${
        variant === 'navy'
          ? 'border-amber-300/60 bg-blue-900/50 text-amber-200'
          : 'border-amber-500/60 bg-amber-50/70 text-amber-800'
      }`}
    >
      <Building2 className={size === 'lg' ? 'w-7 h-7' : 'w-4 h-4'} />
      {size === 'lg' && (
        <span className="text-[9px] font-semibold tracking-tight mt-1 text-center leading-tight px-1">
          Slot Logo Resmi
        </span>
      )}
    </div>
  );
}
