# Figma workspace implementation

This project now maps the seven supplied Figma boards (nodes `17:2093`–`17:2099`) to the existing rental-manager workflows.

| Figma board | In-app workflow |
| --- | --- |
| `17:2093` Loading and error states | Loading, offline/reconnected, retry, empty, and application recovery states. |
| `17:2094` Admin dashboard | Owner overview with occupancy and rent metrics, six-month approved-rent chart, quick actions, follow-ups, notices, and recent rent activity. |
| `17:2095` House management | Owner → Houses; add a house opens Property Setup, house cards open profiles, and vacant houses can be assigned to a tenant. |
| `17:2096` Tenant management | Owner → Tenants; add tenant routes to house assignment; tenant profiles include contact, rent, and login setup/reset actions. |
| `17:2097` Tenant mobile app | Tenant mobile home, UPI launch, payment proof submission, and submission status. |
| `17:2098` Rent approval | Owner → Rent approvals; search submissions, inspect proof, confirm approval, or reject with a reason. |
| `17:2099` Manual payments | Owner → Manual payment; review house, tenant, period, amount, date, and method before submitting the record. |

The supplied boards are mobile-first references. Existing data services and permissions remain the source of truth; the new presentation is wired into the authenticated owner and tenant routes. The live website needs a separate deployment before these local code changes appear there.
