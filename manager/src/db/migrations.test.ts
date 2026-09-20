import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const directory = path.dirname(fileURLToPath(import.meta.url));
let client: PGlite;

describe("manager PostgreSQL migrations", () => {
  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, {
      migrationsFolder: path.join(directory, "migrations"),
    });
  }, 60_000);

  afterAll(async () => {
    await client.close();
  });

  it("creates the complete operational schema", async () => {
    const result = await client.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const names = result.rows.map((row) => row.table_name);

    expect(names).toEqual(
      expect.arrayContaining([
        "source_documents",
        "import_batches",
        "purchases",
        "goods_receipts",
        "inventory_movements",
        "sales_orders",
        "sales_payments",
        "daily_sales_controls",
        "inventory_count_observations",
        "journal_batches",
        "payroll_runs",
        "payroll_employees",
        "audit_events",
      ]),
    );
    expect(names.length).toBeGreaterThanOrEqual(48);
  });

  it("installs database-level immutable ledger triggers", async () => {
    const result = await client.query<{ trigger_name: string }>(
      `select trigger_name
       from information_schema.triggers
       where trigger_schema = 'public'`,
    );
    const names = result.rows.map((row) => row.trigger_name);

    expect(names).toEqual(
      expect.arrayContaining([
        "audit_events_append_only",
        "inventory_movements_append_only",
        "inventory_count_observations_append_only",
        "purchases_terminal_immutable",
        "journal_lines_posted_immutable",
        "source_documents_terminal_immutable",
      ]),
    );
  });

  it("rejects mutation of an appended audit event", async () => {
    const organizationId = "7f7bb3ba-e39b-4c36-94eb-fb20e45ac03b";
    const eventId = "cb49470a-d9d7-4835-bbfa-e59a323b0353";
    await client.exec(`
      insert into organizations
        (id, slug, legal_name, display_name, base_currency, timezone)
      values
        ('${organizationId}', 'migration-test', 'Migration Test',
         'Migration Test', 'USD', 'America/New_York');

      insert into audit_events
        (id, organization_id, occurred_at, actor_type, actor_external_id,
         source_system, action, entity_type, entity_external_id, event_hash,
         event_data)
      values
        ('${eventId}', '${organizationId}', now(), 'system', 'migration-test',
         'migration-test', 'created', 'migration_test', 'one',
         '${"a".repeat(64)}', '{}'::jsonb);
    `);

    await expect(
      client.exec(
        `update audit_events set action = 'changed' where id = '${eventId}'`,
      ),
    ).rejects.toThrow("append-only");
  });

  it("lets owners void an unposted source document and blocks posted deletes", async () => {
    const organizationId = "3c2d1e0f-9a8b-4c7d-8e6f-5a4b3c2d1e0f";
    const locationId = "33333333-3333-4333-8333-333333333333";
    const receivedId = "11111111-1111-4111-8111-111111111111";
    const postedId = "22222222-2222-4222-8222-222222222222";
    const hash = "b".repeat(64);
    const postedHash = "c".repeat(64);
    await client.exec(`
      insert into organizations
        (id, slug, legal_name, display_name, base_currency, timezone)
      values
        ('${organizationId}', 'document-void-test', 'Document Void Test',
         'Document Void Test', 'USD', 'America/New_York');

      insert into locations
        (id, organization_id, code, name, timezone)
      values
        ('${locationId}', '${organizationId}', 'rockville', 'Rockville',
         'America/New_York');

      insert into source_documents
        (id, organization_id, location_id, document_type, status, source_system,
         storage_key, original_file_name, mime_type, sha256)
      values
        ('${receivedId}', '${organizationId}', '${locationId}', 'invoice', 'needs_review',
         'manager_upload', 'storage/received', 'invoice.pdf', 'application/pdf',
         '${hash}'),
        ('${postedId}', '${organizationId}', '${locationId}', 'invoice', 'posted',
         'manager_upload', 'storage/posted', 'posted.pdf', 'application/pdf',
         '${postedHash}');
    `);

    await client.exec(
      `update source_documents set status = 'voided' where id = '${receivedId}'`,
    );

    await expect(
      client.exec(
        `update source_documents set status = 'voided' where id = '${postedId}'`,
      ),
    ).rejects.toThrow("posted and immutable");

    await expect(
      client.exec(`delete from source_documents where id = '${postedId}'`),
    ).rejects.toThrow("posted and immutable");
  });

  it("lets posted payroll be voided and blocks the same active file hash twice", async () => {
    const organizationId = "4d3c2b1a-0f9e-4d8c-7b6a-5c4d3e2f1a0b";
    const locationId = "44444444-4444-4444-8444-444444444444";
    const payrollId = "55555555-5555-4555-8555-555555555555";
    const duplicateId = "66666666-6666-4666-8666-666666666666";
    const replacementId = "77777777-7777-4777-8777-777777777777";
    const hash = "d".repeat(64);
    await client.exec(`
      insert into organizations
        (id, slug, legal_name, display_name, base_currency, timezone)
      values
        ('${organizationId}', 'payroll-void-test', 'Payroll Void Test',
         'Payroll Void Test', 'USD', 'America/New_York');

      insert into locations
        (id, organization_id, code, name, timezone)
      values
        ('${locationId}', '${organizationId}', 'rockville', 'Rockville',
         'America/New_York');

      insert into source_documents
        (id, organization_id, location_id, document_type, status, source_system,
         storage_key, original_file_name, mime_type, sha256)
      values
        ('${payrollId}', '${organizationId}', '${locationId}', 'payroll', 'posted',
         'manager_upload', 'storage/payroll', 'payroll.pdf', 'application/pdf',
         '${hash}');
    `);

    await expect(
      client.exec(`
        insert into source_documents
          (id, organization_id, location_id, document_type, status, source_system,
           storage_key, original_file_name, mime_type, sha256)
        values
          ('${duplicateId}', '${organizationId}', '${locationId}', 'payroll', 'received',
           'manager_upload', 'storage/payroll-dup', 'payroll.pdf', 'application/pdf',
           '${hash}');
      `),
    ).rejects.toThrow();

    await client.exec(
      `update source_documents set status = 'voided' where id = '${payrollId}'`,
    );

    await client.exec(`
      insert into source_documents
        (id, organization_id, location_id, document_type, status, source_system,
         storage_key, original_file_name, mime_type, sha256)
      values
        ('${replacementId}', '${organizationId}', '${locationId}', 'payroll', 'received',
         'manager_upload', 'storage/payroll-replacement', 'payroll.pdf',
         'application/pdf', '${hash}');
    `);

    const result = await client.query<{ status: string }>(
      `select status from source_documents where id = '${replacementId}'`,
    );
    expect(result.rows[0]?.status).toBe("received");
  });

  it("requires every source document to belong to a location", async () => {
    const result = await client.query<{ is_nullable: string }>(
      `select is_nullable
       from information_schema.columns
       where table_name = 'source_documents' and column_name = 'location_id'`,
    );
    expect(result.rows[0]?.is_nullable).toBe("NO");
  });
});
