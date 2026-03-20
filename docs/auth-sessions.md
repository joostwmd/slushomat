# Admin & operator dashboards: shared Better Auth session

Both the admin and operator frontends use the same Better Auth client `baseURL` (the API / `VITE_SERVER_URL`). The **session cookie is set on that API origin**, not on the admin or operator site origins.

For a normal browser profile there is **one** session cookie for that API host. Any response that sends `Set-Cookie` for the session updates it for **every tab** that uses credentialed requests to the same API.

## What you’ll observe

1. **Signing in on admin, then on operator (or the reverse)**  
   The latest sign-in wins. The other app will start using the new session on the next request.

2. **Impersonation handoff (one-time token)**  
   `createOperatorHandoffToken` avoids swapping the admin cookie **during that tRPC call** (server-side impersonation + OTT).  
   When the **operator** tab runs `one-time-token/verify`, Better Auth still calls `setSessionCookie`, which **overwrites** the shared session cookie. The admin tab can then look signed out or show the impersonated user.

3. **Renaming the session cookie (`cookiePrefix` / `advanced.cookies.session_token.name`)**  
   Better Auth allows **one** global name/prefix per `betterAuth({ ... })` instance. That renames the cookie for everyone; it does **not** give you two concurrent sessions (admin + operator) in one profile against one auth instance.

## Practical mitigations

- Use a **private/incognito** window (or another browser / profile) for the operator handoff URL if you need to stay signed in as admin in the main window.
- Accept **one session per profile** for a single auth `baseURL`.

## Do you need two full API servers?

**No** — you don’t need two copies of all business logic. To get **two independent cookie-based sessions** in one browser you’d need **two isolated auth surfaces** (e.g. two `betterAuth` instances with different `baseURL`s and different cookie names/prefixes, often on different paths or hostnames), plus a clear plan for shared DB / session tables. That’s an architecture change, not a rename of one cookie.

## References

- [Better Auth: Cookies](https://www.better-auth.com/docs/concepts/cookies)
