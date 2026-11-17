export interface TransactionClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

export async function runInTransaction<T>(
  client: TransactionClient,
  workFn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  await client.query("BEGIN;");
  try {
    const result = await workFn(client);
    await client.query("COMMIT;");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK;");
    } catch (rollbackErr) {
      console.error("Failed to rollback transaction:", rollbackErr);
    }
    throw err;
  }
}
