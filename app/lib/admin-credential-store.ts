import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import {
  getDatabase,
  type DatabaseAccess,
} from "../../lib/server/database";
import {
  isAdminPasswordConfigured,
  type AdminSessionCredential,
} from "./admin-session";

export const ADMIN_BOOTSTRAP_MODE_ENV_NAME = "BGH_ADMIN_BOOTSTRAP_MODE";
export const ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE = "enabled";
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

type StoredAdminOwnerCredentialRow = {
  algorithm: unknown;
  password_hash: unknown;
  salt: unknown;
  schema_version: unknown;
  scrypt_block_size: unknown;
  scrypt_cost: unknown;
  scrypt_key_length: unknown;
  scrypt_parallelization: unknown;
  session_signing_key: unknown;
  session_version: unknown;
};

export type AdminOwnerCredentialReadResult =
  | { kind: "missing" }
  | { credential: StoredAdminOwnerCredential; kind: "ready" }
  | { kind: "unavailable" };

type AdminAuthenticationOptions = {
  adminPassword: string | undefined;
  bootstrapMode?: string;
  database?: DatabaseAccess;
  recoveryMode: string | undefined;
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

export type InitializeAdminOwnerCredentialResult =
  | { kind: "already_initialized" }
  | { kind: "initialized"; sessionVersion: string }
  | { kind: "invalid_password" }
  | { kind: "persistence_failed" }
  | { kind: "unavailable" };

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
  row: StoredAdminOwnerCredentialRow,
): StoredAdminOwnerCredential | null {
  if (
    row.schema_version !== 1 ||
    row.algorithm !== "scrypt" ||
    row.scrypt_cost !== SCRYPT_COST ||
    row.scrypt_block_size !== SCRYPT_BLOCK_SIZE ||
    row.scrypt_parallelization !== SCRYPT_PARALLELIZATION ||
    row.scrypt_key_length !== SCRYPT_KEY_LENGTH ||
    !decodeBase64(row.salt, PASSWORD_SALT_BYTES) ||
    !decodeBase64(row.password_hash, SCRYPT_KEY_LENGTH) ||
    !decodeBase64(row.session_signing_key, SESSION_SIGNING_KEY_BYTES) ||
    typeof row.session_version !== "string" ||
    !SESSION_VERSION_PATTERN.test(row.session_version)
  ) {
    return null;
  }

  return {
    algorithm: "scrypt",
    hash: row.password_hash as string,
    parameters: {
      blockSize: SCRYPT_BLOCK_SIZE,
      cost: SCRYPT_COST,
      keyLength: SCRYPT_KEY_LENGTH,
      parallelization: SCRYPT_PARALLELIZATION,
    },
    salt: row.salt as string,
    schemaVersion: 1,
    session: {
      signingKey: row.session_signing_key as string,
      version: row.session_version,
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

function isBootstrapModeEnabled(bootstrapMode: string | undefined) {
  return bootstrapMode === ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE;
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

function toCredentialValues(credential: StoredAdminOwnerCredential) {
  return [
    credential.schemaVersion,
    credential.algorithm,
    credential.hash,
    credential.salt,
    credential.parameters.cost,
    credential.parameters.blockSize,
    credential.parameters.parallelization,
    credential.parameters.keyLength,
    credential.session.signingKey,
    credential.session.version,
  ];
}

export async function readAdminOwnerCredential(
  database?: DatabaseAccess,
): Promise<AdminOwnerCredentialReadResult> {
  try {
    const result = await getDatabase(database).query<StoredAdminOwnerCredentialRow>(`
      SELECT
        schema_version,
        algorithm,
        password_hash,
        salt,
        scrypt_cost,
        scrypt_block_size,
        scrypt_parallelization,
        scrypt_key_length,
        session_signing_key,
        session_version::text AS session_version
      FROM admin_owner_credentials
      WHERE singleton = TRUE
    `);

    if (result.rows.length === 0) {
      return { kind: "missing" };
    }

    const credential = normalizeStoredAdminOwnerCredential(result.rows[0]);
    return credential ? { credential, kind: "ready" } : { kind: "unavailable" };
  } catch {
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
  database?: DatabaseAccess,
  expectedSessionVersion?: string | null,
): Promise<ReplaceAdminOwnerCredentialResult> {
  if (!isAdminPasswordConfigured(password)) {
    return { kind: "invalid_password" };
  }

  const existingCredential = await readAdminOwnerCredential(database);

  if (existingCredential.kind === "unavailable") {
    return { kind: "unavailable" };
  }

  if (expectedSessionVersion !== undefined) {
    const matchesExpectedState =
      expectedSessionVersion === null
        ? existingCredential.kind === "missing"
        : existingCredential.kind === "ready" &&
          existingCredential.credential.session.version ===
            expectedSessionVersion;

    if (!matchesExpectedState) {
      return { kind: "unavailable" };
    }
  }

  try {
    const credential = await createStoredAdminOwnerCredential(password);
    const values = toCredentialValues(credential);
    const result =
      existingCredential.kind === "missing"
        ? await getDatabase(database).query(
            `
              INSERT INTO admin_owner_credentials (
                singleton,
                schema_version,
                algorithm,
                password_hash,
                salt,
                scrypt_cost,
                scrypt_block_size,
                scrypt_parallelization,
                scrypt_key_length,
                session_signing_key,
                session_version
              )
              VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (singleton) DO NOTHING
            `,
            values,
          )
        : await getDatabase(database).query(
            `
              UPDATE admin_owner_credentials
              SET schema_version = $1,
                  algorithm = $2,
                  password_hash = $3,
                  salt = $4,
                  scrypt_cost = $5,
                  scrypt_block_size = $6,
                  scrypt_parallelization = $7,
                  scrypt_key_length = $8,
                  session_signing_key = $9,
                  session_version = $10,
                  updated_at = CURRENT_TIMESTAMP
              WHERE singleton = TRUE
                AND session_version = $11::uuid
            `,
            [
              ...values,
              expectedSessionVersion ??
                existingCredential.credential.session.version,
            ],
          );

    if (result.rowCount !== 1) {
      return { kind: "unavailable" };
    }

    return {
      kind: "replaced",
      sessionVersion: credential.session.version,
    };
  } catch {
    return { kind: "persistence_failed" };
  }
}

export async function initializeAdminOwnerCredential(
  password: string,
  database?: DatabaseAccess,
): Promise<InitializeAdminOwnerCredentialResult> {
  if (!isAdminPasswordConfigured(password)) {
    return { kind: "invalid_password" };
  }

  const existingCredential = await readAdminOwnerCredential(database);

  if (existingCredential.kind === "unavailable") {
    return { kind: "unavailable" };
  }

  if (existingCredential.kind === "ready") {
    return { kind: "already_initialized" };
  }

  try {
    const credential = await createStoredAdminOwnerCredential(password);
    const result = await getDatabase(database).query(
      `
        INSERT INTO admin_owner_credentials (
          singleton,
          schema_version,
          algorithm,
          password_hash,
          salt,
          scrypt_cost,
          scrypt_block_size,
          scrypt_parallelization,
          scrypt_key_length,
          session_signing_key,
          session_version
        )
        VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (singleton) DO NOTHING
      `,
      toCredentialValues(credential),
    );

    return result.rowCount === 1
      ? { kind: "initialized", sessionVersion: credential.session.version }
      : { kind: "already_initialized" };
  } catch {
    return { kind: "persistence_failed" };
  }
}

export async function authenticateAdminPassword(
  password: string,
  {
    adminPassword,
    bootstrapMode,
    database,
    recoveryMode,
  }: AdminAuthenticationOptions,
): Promise<AdminAuthenticationResult> {
  const credentialState = await readAdminOwnerCredential(database);

  if (credentialState.kind === "unavailable") {
    return { kind: "unavailable" };
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
            credentialState.kind === "ready"
              ? credentialState.credential.session.version
              : "recovery",
          ),
        }
      : { kind: "invalid" };
  }

  if (credentialState.kind === "missing") {
    if (
      !isBootstrapModeEnabled(bootstrapMode) ||
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

  return (await verifyAdminOwnerPassword(password, credentialState.credential))
    ? {
        kind: "authenticated",
        session: toOwnerSessionCredential(credentialState.credential),
      }
    : { kind: "invalid" };
}

export async function resolveAdminSessionCredential({
  adminPassword,
  bootstrapMode,
  database,
  recoveryMode,
}: AdminAuthenticationOptions): Promise<AdminSessionCredential | null> {
  const credentialState = await readAdminOwnerCredential(database);

  if (credentialState.kind === "unavailable") {
    return null;
  }

  if (isRecoveryModeEnabled(recoveryMode)) {
    return isAdminPasswordConfigured(adminPassword)
      ? toEnvironmentSessionCredential(
          "recovery",
          adminPassword,
          credentialState.kind === "ready"
            ? credentialState.credential.session.version
            : "recovery",
        )
      : null;
  }

  if (credentialState.kind === "missing") {
    return isBootstrapModeEnabled(bootstrapMode) &&
      isAdminPasswordConfigured(adminPassword)
      ? toEnvironmentSessionCredential(
          "bootstrap",
          adminPassword,
          "bootstrap",
        )
      : null;
  }

  return toOwnerSessionCredential(credentialState.credential);
}
