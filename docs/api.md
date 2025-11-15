# API Reference (excerpt)

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | /api/auth/login | Issue magic link for admins |
| POST | /api/devices/enroll | Enroll local agent |
| POST | /api/devices/events | Upload DocumentDetected events |
| GET | /api/records | List certificate records |
| PATCH | /api/records/{id} | Approve, adjust, or ignore |
| GET | /api/course-rules | Combined global + tenant rules |
| POST | /api/course-rules | Create tenant override |
| PATCH | /api/course-rules/{id} | Update override |
| GET | /api/reports/digest-preview | Render weekly digest HTML |
| POST | /api/reports/export-pdf | Export compliance report |

All endpoints require the `X-Tenant-Id` header in admin mode. Device endpoints additionally expect the device token in the `DeviceToken` header.
