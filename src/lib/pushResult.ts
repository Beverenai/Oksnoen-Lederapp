interface PushSendResult {
  sent?: number;
  failed?: number;
  nativeSkipped?: number;
  message?: string;
}

export function getPushResultMessage(data: PushSendResult | null | undefined): {
  type: 'success' | 'warning' | 'error';
  message: string;
} {
  const sent = data?.sent ?? 0;
  const failed = data?.failed ?? 0;
  const nativeSkipped = data?.nativeSkipped ?? 0;

  if (sent > 0 && failed === 0 && nativeSkipped === 0) {
    return { type: 'success', message: `Varsling sendt til ${sent} mottakere` };
  }

  if (sent > 0) {
    return {
      type: 'warning',
      message: `Sendt til ${sent}, men ${failed} feilet og ${nativeSkipped} iPhone-varsler ble hoppet over`,
    };
  }

  if (nativeSkipped > 0) {
    return {
      type: 'error',
      message: 'iPhone-varsler ble hoppet over fordi APNs ikke er konfigurert i backend',
    };
  }

  if (failed > 0) {
    return {
      type: 'error',
      message: `Varslingen feilet for ${failed} mottakere`,
    };
  }

  return {
    type: 'warning',
    message: data?.message || 'Ingen aktive push-abonnementer funnet',
  };
}
