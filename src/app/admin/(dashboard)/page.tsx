export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <section className="bg-[#101322] border border-[#232948] rounded-2xl p-6">
        <h1 className="text-2xl font-black font-serif mb-2">Dashboard</h1>
        <p className="text-[#929bc9] text-sm">
          Overview of recent activity and system status. (Placeholder)
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[#101322] border border-[#232948] rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-2">Books</h2>
          <p className="text-[#929bc9] text-sm">Published, drafts, pending QC.</p>
        </div>
        <div className="bg-[#101322] border border-[#232948] rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-2">Soundscapes</h2>
          <p className="text-[#929bc9] text-sm">Curated and AI-generated assets.</p>
        </div>
      </section>
    </div>
  );
}