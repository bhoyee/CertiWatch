    {confirmDelete && (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">Delete upload link?</h3>
          <p className="mt-2 text-sm text-slate-700">
            This will delete the upload link for {confirmDelete.staffEmail ?? confirmDelete.staffName ?? "unknown user"}. This cannot be
            undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!confirmDelete) return;
                setDeleting(true);
                try {
                  const res = await fetch(`/api/uploads/${confirmDelete.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Failed to delete upload");
                  setConfirmDelete(null);
                  loadHistory();
                } catch (err: any) {
                  setError(err.message ?? "Failed to delete upload");
                } finally {
                  setDeleting(false);
                }
              }}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    )}
