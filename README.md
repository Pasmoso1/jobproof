This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

You can start editing the page by modifying `app/page.tsx`.

### Cleaning the dev cache (Windows)

Use `npm run dev:safe` if you ever see lock/port issues or localhost refuses to connect.

If the dev server hangs or shows lock errors, run:

```bash
npm run clean:dev
```

This removes the `.next/dev/lock` file and clears the `.next` cache. On Windows, this works from PowerShell or Command Prompt. Then run `npm run dev` again. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Automated invoice reminders (operators)

Contractors enable timing in **Settings → Business**. For sends to run on a schedule, configure your host to call the automation entry point:

- **Route:** `POST /api/cron/invoice-reminders`
- **Auth:** header `Authorization: Bearer <value>` where the value matches env **`CRON_SECRET`**
- **Also required:** `SUPABASE_SERVICE_ROLE_KEY`, Resend (`RESEND_API_KEY`), and applied DB migrations (including invoice reminder automation).

Implementation: `src/app/api/cron/invoice-reminders/route.ts` and `src/lib/invoice-reminder-cron.ts`.
