# ts3-auth

EVE Online SSO → TeamSpeak 3 role assignment. Users log in with EVE SSO, and if their corporation or alliance is mapped to TS3 server groups, they receive a short-lived token. Typing `!auth <token>` in any TeamSpeak channel assigns the groups automatically.

## Setup

**1. Register an EVE app**

Go to https://developers.eveonline.com/ and create an application. No special scopes needed. Add your callback URL:
- Dev: `http://localhost:3000/auth/callback`
- Prod: `https://your-domain.com/auth/callback`

**2. Configure environment**

```bash
cp .env.example .env
```

Fill in `.env`:
- `EVE_CLIENT_ID` / `EVE_CLIENT_SECRET` — from the EVE developer portal
- `EVE_CALLBACK_URL` — must match what you registered above
- `TS3_HOST` / `TS3_USERNAME` / `TS3_PASSWORD` — your TS3 ServerQuery credentials
- `ADMIN_CHARACTER_IDS` — comma-separated EVE character IDs that get admin access
- `SESSION_SECRET` / `PGPASSWORD` — set to long random strings

**3. Run**

Development (live reload):
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Production:
```bash
docker compose up -d
```

## Admin

Log in with an admin character and go to `/admin` to manage corp/alliance → TS3 group mappings. Server groups are pulled live from TS3 when the bot is connected.

## Auth flow

1. User visits the site and logs in with EVE SSO
2. If their corp/alliance is mapped, they get a token (valid for 5 minutes)
3. They type `!auth <token>` in any TeamSpeak channel
4. The bot assigns the mapped server groups and confirms via private message
