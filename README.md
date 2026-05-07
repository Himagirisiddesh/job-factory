# FactoryFlow AI

FactoryFlow AI is a role-based manufacturing order management demo with separate customer and admin portals.

## What It Does

- Customers can view the product catalog, place natural-language manufacturing requests, and confirm them with a 6-character verification code.
- Admins see only confirmed customer requests, then accept, reject, move through production stages, and add quality notes.
- Order updates are persisted in `backend/data/store.json` and both portals poll for live changes.

## Portals

- Customer portal: `/portal/user`
- Admin portal: `/portal/admin`

## Demo Accounts

- `customer@factoryflow.demo` / `Customer#2026!`
- `admin@factoryflow.demo` / `Admin#2026!`

## Workflow

```text
Customer logs in
  -> Reviews catalog
  -> Sends natural-language request
  -> Gets verification code
  -> Confirms code
  -> Order becomes visible to admin
  -> Admin accepts / rejects / updates production
  -> Customer sees live status and quality updates
```

## Supported Status Flow

```text
Pending Approval -> In Review -> Accepted -> Production -> Quality Check -> Completed
                                           \
                                            -> Rejected
```

## Project Structure

```text
standalone/
  backend/
    package.json
    server.js
    data/store.json
  frontend/
    package.json
    vite.config.js
    src/
      App.jsx
      api.js
      components/
        WorkspaceHeader.jsx
        LoginPanel.jsx
        ProductCatalog.jsx
        ChatPanel.jsx
        UserDashboard.jsx
        AdminDashboard.jsx
        OrderCard.jsx
        StatusBadge.jsx
        Toast.jsx
```

## Run Locally

### Backend

```bash
cd backend
npm install
node server.js
```

Runs on `http://localhost:4000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

If PowerShell blocks `npm`, use `npm.cmd install` and `npm.cmd run dev`.

## Example Customer Messages

- `I need 300 titanium brackets by July 12`
- `Create order for 180 aluminum rods before August 4`
- `I need 60 copper pipes by June 30`
- `Show my orders`

## Example Admin Messages

- `Accept order ORD-001 because machining capacity is available`
- `Move order ORD-001 to production`
- `Move order ORD-001 to quality check`
- `Quality note on order ORD-001 surface finish passed inspection`
- `Show all orders`

## API Summary

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/catalog`
- `GET /api/order-drafts`
- `POST /api/chat`
- `POST /api/orders/confirm`
- `GET /api/orders`
- `GET /api/orders/stats`
- `GET /api/orders/activity`
- `POST /api/orders/:orderId/status`
- `POST /api/orders/:orderId/quality-note`

## Notes

- Authentication is role-based and backed by secure server-side sessions with `HttpOnly` cookies.
- Draft requests are not visible to admins until the customer confirms the verification code.
- The backend resets to a clean schema if an older demo store format is detected.
