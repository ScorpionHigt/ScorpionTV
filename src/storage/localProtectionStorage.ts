import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const LOCAL_PROTECTION_MODE_KEY =
  'scorpiontv_local_protection_mode';

const LOCAL_PROTECTION_HASH_KEY =
  'scorpiontv_local_protection_hash';

export type LocalProtectionMode =
  | 'same'
  | 'custom';

export async function saveLocalProtection(
  mode: LocalProtectionMode,
  passwordHash: string,
): Promise<void> {
  await SecureStore.setItemAsync(
    LOCAL_PROTECTION_MODE_KEY,
    mode
  );

  await SecureStore.setItemAsync(
    LOCAL_PROTECTION_HASH_KEY,
    passwordHash
  );
}

export async function getLocalProtection(): Promise<{
  mode: LocalProtectionMode;
  passwordHash: string;
} | null> {
  const mode =
    await SecureStore.getItemAsync(
      LOCAL_PROTECTION_MODE_KEY
    );

  const passwordHash =
    await SecureStore.getItemAsync(
      LOCAL_PROTECTION_HASH_KEY
    );

  if (!mode || !passwordHash) {
    return null;
  }

  if (
    mode !== 'same' &&
    mode !== 'custom'
  ) {
    return null;
  }

  return {
    mode,
    passwordHash,
  };
}

export async function verifyLocalProtection(
  password: string
): Promise<boolean> {
  if (!password) {
    return false;
  }

  const protection =
    await getLocalProtection();

  if (!protection) {
    return false;
  }

  const passwordHash =
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );

  return passwordHash ===
    protection.passwordHash;
}

export async function isLocalProtectionEnabled(): Promise<boolean> {
  const protection =
    await getLocalProtection();

  return protection !== null;
}

export async function clearLocalProtection(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(
      LOCAL_PROTECTION_MODE_KEY
    ),
    SecureStore.deleteItemAsync(
      LOCAL_PROTECTION_HASH_KEY
    ),
  ]);
}
