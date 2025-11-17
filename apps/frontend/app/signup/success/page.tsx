export default function SignupSuccessPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-wide text-green-600">Payment successful</p>
      <h1 className="text-3xl font-semibold text-slate-900">You are all set!</h1>
      <p className="text-slate-600">
        Thanks for subscribing to CertiWatch. Your tenant is being provisioned. Check your email for the magic-link to
        access the admin dashboard.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
      >
        Go to dashboard
      </a>
    </div>
  );
}
