INSERT INTO tenants (id, name, plan, created_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Care', 'trial', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, role, created_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@acmecare.test', 'CertiWatch Admin', 'admin', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_rules (id, tenant_id, course_name, default_validity_months, created_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'First Aid', 12, NOW())
ON CONFLICT (id) DO NOTHING;
