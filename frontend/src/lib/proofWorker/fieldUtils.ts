export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const b of bytes) result = (result << 8n) + BigInt(b);
  return result;
}

export function stringToBigInt(s: string): bigint {
  if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
  return BigInt(s);
}

/** Convert 32 raw bytes (big-endian) to a BigInt field element. */
export function bytesToFieldBigInt(bytes: Uint8Array): bigint {
  let val = 0n;
  for (const b of bytes) {
    val = (val << 8n) | BigInt(b);
  }
  return val;
}
