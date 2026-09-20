import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isAdminPasswordConfigured,
  type AdminSessionCredential,
} from "./admin-session";

export const ADMIN_CREDENTIAL_STORE_PATH_ENV_NAME =
  "BGH_ADMIN_CREDENTIAL_STORE_PATH";
export const ADMIN_RECOVERY_MODE_ENV_NAME = "BGH_ADMIN_RECOVERY_MODE";
export const ADMIN_RECOVERY_MODE_ENABLED_VALUE = "enabled";

const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 3;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const PASSWORD_SALT_BYTES = 16;
const SESSION_SIGNING_KEY_BYTES = 32;
const SESSION_VERSION_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type StoredAdminOwnerCredential = {
  algorithm: "scrypt";
  hash: string;
  parameters: {
    blockSize: number;
    cost: number;
    keyLength: number;
    parallelization: number;
  };
  salt: string;
  schemaVersion: 1;
  session: {
    signingKey: string;
    version: string;
  };
};

export type AdminOwnerCredentialReadResult =
  | { kind: "missing" }
  | { credential: StoredAdminOwnerCredential; kind: "ready" }
  | { kind: "unavailable" };

type AdminAuthenticationOptions = {
  adminPassword: string | undefined;
  recoveryMode: string | undefined;
  storePath?: string;
};

export type AdminAuthenticationResult =
  | { kind: "authenticated"; session: AdminSessionCredential }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export type ReplaceAdminOwnerCredentialResult =
  | { kind: "invalid_password" }
  | { kind: "persistence_failed" }
  | { kind: "replaced"; sessionVersion: string }
  | { kind: "unavailable" };

function getAdminOwnerCredentialStorePath() {
  return (
    process.env[ADMIN_CREDENTIAL_STORE_PATH_ENV_NAME] ??
    path.join(process.cwd(), "data", "admin-owner-credential.json")
  );
}

function hasErrorCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

function decodeBase64(value: unknown, expectedLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const decoded = Buffer.from(value, "base64");

  if (
    decoded.length !== expectedLength ||
    decoded.toString("base64") !== value
  ) {
    return null;
  }

  return decoded;
}

function normalizeStoredAdminOwnerCredential(
  value: unknown,
): StoredAdminOwnerCredential | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const parameters = record.parameters;
  const session = record.session;

  if (
    record.schemaVersion !== 1 ||
    record.algorithm !== "scrypt" ||
    !parameters ||
    typeof parameters !== "object" ||
    Array.isArray(parameters) ||
    !session ||
    typeof session !== "object" ||
    Array.isArray(session)
  ) {
    return null;
  }

  const parameterRecord = parameters as Record<string, unknown>;
  const sessionRecord = session as Record<string, unknown>;

  if (
    parameterRecord.cost !== SCRYPT_COST ||
    parameterRecord.blockSize !== SCRYPT_BLOCK_SIZE ||
    parameterRecord.parallelization !== SCRYPT_PARALLELIZATION ||
    parameterRecord.keyLength !== SCRYPT_KEY_LENGTH ||
    !decodeBase64(record.salt, PASSWORD_SALT_BYTES) ||
    !decodeBase64(record.hash, SCRYPT_KEY_LENGTH) ||
    !decodeBase64(sessionRecord.signingKey, SESSION_SIGNING_KEY_BYTES) ||
    typeof sessionRecord.version !== "string" ||
    !SESSION_VERSION_PATTERN.test(sessionRecord.version)
  ) {
    return null;
  }

  return {
    algorithm: "scrypt",
    hash: record.hash as string,
    parameters: {
      blockSize: SCRYPT_BLOCK_SIZE,
      cost: SCRYPT_COST,
      keyLength: SCRYPT_KEY_LENGTH,
      parallelization: SCRYPT_PARALLELIZATION,
    },
    salt: record.salt as string,
    schemaVersion: 1,
    session: {
      signingKey: sessionRecord.signingKey as string,
      version: sessionRecord.version,
    },
  };
}

function derivePasswordHash(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        p: SCRYPT_PARALLELIZATION,
        r: SCRYPT_BLOCK_SIZE,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function compareSecretStrings(first: string, second: string) {
  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function toOwnerSessionCredential(
  credential: StoredAdminOwnerCredential,
): AdminSessionCredential {
  return {
    kind: "owner",
    sessionVersion: credential.session.version,
    signingKey: credential.session.signingKey,
  };
}

function toEnvironmentSessionCredential(
  kind: "bootstrap" | "recovery",
  adminPassword: string,
  sessionVersion: string,
): AdminSessionCredential {
  return {
    kind,
    sessionVersion,
    signingKey: adminPassword,
  };
}

function isRecoveryModeEnabled(recoveryMode: string | undefined) {
  return recoveryMode === ADMIN_RECOVERY_MODE_ENABLED_VALUE;
}

async function createStoredAdminOwnerCredential(
  password: string,
): Promise<StoredAdminOwnerCredential> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = await derivePasswordHash(password, salt);

  return {
    algorithm: "scrypt",
    hash: hash.toString("base64"),
    parameters: {
      blockSize: SCRYPT_BLOCK_SIZE,
      cost: SCRYPT_COST,
      keyLength: SCRYPT_KEY_LENGTH,
      parallelization: SCRYPT_PARALLELIZATION,
    },
    salt: salt.toString("base64"),
    schemaVersion: 1,
    session: {
      signingKey: randomBytes(SESSION_SIGNING_KEY_BYTES).toString("base64"),
      version: randomUUID(),
    },
  };
}

async function writeAdminOwnerCredential(
  credential: StoredAdminOwnerCredential,
  storePath: string,
) {
  const directory = path.dirname(storePath);
  const temporaryPath = `${storePath}.tmp`;
  const serializedCredential = `${JSON.stringify(credential, null, 2)}\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, serializedCredential, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, storePath);
}

export async function readAdminOwnerCredential(
  storePath = getAdminOwnerCredentialStorePath(),
): Promise<AdminOwnerCredentialReadResult> {
  try {
    const fileContents = await readFile(storePath, "utf8");
    const parsedCredential = JSON.parse(fileContents);
    const credential = normalizeStoredAdminOwnerCredential(parsedCredential);

    return credential ? { credential, kind: "ready" } : { kind: "unavailable" };
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return { kind: "missing" };
    }

    return { kind: "unavailable" };
  }
}

export async function verifyAdminOwnerPassword(
  password: string,
  credential: StoredAdminOwnerCredential,
) {
  try {
    const actualHash = await derivePasswordHash(
      password,
      Buffer.from(credential.salt, "base64"),
    );
    const expectedHash = Buffer.from(credential.hash, "base64");

    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

export async function replaceAdminOwnerCredential(
  password: string,
  storePath = getAdminOwnerCredentialStorePath(),
  expectedSessionVersion?: string,
): Promise<ReplaceAdminOwnerCredentialResult> {
  if (!isAdminPasswordConfigured(password)) {
    return { kind: "invalid_password" };
  }

  const existingCredential = await readAdminOwnerCredential(storePath);

  if (existingCredential.kind === "unavailable") {
    return { kind: "unavailable" };
  }

  if (
    expectedSessionVersion !== undefined &&
    (existingCredential.kind !== "ready" ||
      existingCredential.credential.session.version !== expectedSessionVersion)
  ) {
    return { kind: "unavailable" };
  }

  try {
    const credential = await createStoredAdminOwnerCredential(password);
    await writeAdminOwnerCredential(credential, storePath);

    return {
      kind: "replaced",
      sessionVersion: credential.session.version,
    };
  } catch {
    return { kind: "persistence_failed" };
  }
}

export async function authenticateAdminPassword(
  password: string,
  {
    adminPassword,
    recoveryMode,
    storePath = getAdminOwnerCredentialStorePath(),
  }: AdminAuthenticationOptions,
): Promise<AdminAuthenticationResult> {
  const credentialState = await readAdminOwnerCredential(storePath);

  if (credentialState.kind === "unavailable") {
    return { kind: "unavailable" };
  }

  if (credentialState.kind === "missing") {
    if (
      !isRecoveryModeEnabled(recoveryMode) ||
      !isAdminPasswordConfigured(adminPassword)
    ) {
      return { kind: "unavailable" };
    }

    return compareSecretStrings(password, adminPassword)
      ? {
          kind: "authenticated",
          session: toEnvironmentSessionCredential(
            "bootstrap",
            adminPassword,
            "bootstrap",
          ),
        }
      : { kind: "invalid" };
  }

  if (isRecoveryModeEnabled(recoveryMode)) {
    if (!isAdminPasswordConfigured(adminPassword)) {
      return { kind: "unavailable" };
    }

    return compareSecretStrings(password, adminPassword)
      ? {
          kind: "authenticated",
          session: toEnvironmentSessionCredential(
            "recovery",
            adminPassword,
            credentialState.credential.session.version,
          ),
        }
      : { kind: "invalid" };
  }

  return (await verifyAdminOwnerPassword(password, credentialState.credential))
    ? {
        kind: "authenticated",
        session: toOwnerSessionCredential(credentialState.credential),
      }
    : { kind: "invalid" };
}

export async function resolveAdminSessionCredential({
  adminPassword,
  recoveryMode,
  storePath = getAdminOwnerCredentialStorePath(),
}: AdminAuthenticationOptions): Promise<AdminSessionCredential | null> {
  const credentialState = await readAdminOwnerCredential(storePath);

  if (credentialState.kind === "unavailable") {
    return null;
  }

  if (credentialState.kind === "missing") {
    return isRecoveryModeEnabled(recoveryMode) &&
      isAdminPasswordConfigured(adminPassword)
      ? toEnvironmentSessionCredential(
          "bootstrap",
          adminPassword,
          "bootstrap",
        )
      : null;
  }

  if (isRecoveryModeEnabled(recoveryMode)) {
    return isAdminPasswordConfigured(adminPassword)
      ? toEnvironmentSessionCredential(
          "recovery",
          adminPassword,
          credentialState.credential.session.version,
        )
      : null;
  }

  return toOwnerSessionCredential(credentialState.credential);
}
