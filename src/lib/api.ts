let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errMsg = `Permintaan gagal (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errMsg);
  }

  return (await res.json()) as T;
}

export async function fetchProtectedBlob(url: string): Promise<Blob> {
  const headers = new Headers();
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  const res = await fetch(url, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    let errMsg = 'Tidak dapat mengakses berkas terproteksi.';
    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return await res.blob();
}

export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Belum tersedia';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactRupiah(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  return formatRupiah(amount);
}

export function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
