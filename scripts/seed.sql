INSERT INTO "Tenants" ("Id", "Name", "Plan", "CreatedAtUtc", "CreatedAt")
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Care', 'trial', NOW(), NOW())
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "Users" ("Id", "TenantId", "Email", "Name", "Role", "CreatedAt")
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@acmecare.test', 'CertiWatch Admin', 'admin', NOW())
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "CourseRules" ("Id", "TenantId", "CourseName", "DefaultValidityMonths", "IsRenewable", "IsOneTime", "CreatedAt")
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'First Aid', 12, true, false, NOW())
ON CONFLICT ("Id") DO NOTHING;

-- Lets a local worker/agent enroll with `enrollmentCode: "local-dev"` (see README docker quickstart)
-- without needing to mint a code through the authenticated /api/devices/enrollment-codes endpoint
-- first. The hash below is sha256("local-dev"); rotate/remove this row before using seed.sql
-- anywhere other than a local dev database.
INSERT INTO "DeviceEnrollmentCodes" ("Id", "TenantId", "CodeHash", "ExpiresAt", "CreatedAt")
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '08846e81b3a87fd9cc39d4023a75dcff47a6588055793a5f065212e668c94fe6',
    '2099-01-01T00:00:00Z',
    NOW()
)
ON CONFLICT ("Id") DO NOTHING;
